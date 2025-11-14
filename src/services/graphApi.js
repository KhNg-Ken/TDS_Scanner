import axios from "axios";
import { loginAndGetToken } from "../auth/index.js";

// Adjust these to match your file
const EXCEL_FILE_PATH = "children/EventRegistration/children"; // path in OneDrive
const TABLE_NAME = "Table1"; // table in your worksheet

// Helper: get access token via MSAL delegated flow
async function getToken() {
	const token = await loginAndGetToken();
	return token;
}

// Small retry wrapper for Graph requests. Retries on network errors and 5xx responses.
async function graphRequest(method, url, token, data = null, attempts = 3, timeout = 8000) {
	let lastErr = null;
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await axios({ method, url, data, headers: { Authorization: `Bearer ${token}` }, timeout });
			return res;
		} catch (err) {
			lastErr = err;
			const status = err?.response?.status;
			// don't retry on client errors
			if (status && status < 500) break;
			// otherwise retry after a short backoff
			const backoff = 200 * Math.pow(2, i);
			await new Promise(r => setTimeout(r, backoff));
		}
	}
	throw lastErr;
}

// deterministic 3-digit event code based on fileId (stable per event file)
function generateEventCode(fileId) {
	if (!fileId) return "000";
	let sum = 0;
	for (let i = 0; i < fileId.length; i++) sum = (sum + fileId.charCodeAt(i)) % 1000;
	return String(sum).padStart(3, "0");
}

// Utility: remove diacritics and sanitize a string to an underscore-separated Name_Company key
function removeDiacriticsAndSanitize(str) {
	if (!str) return "";
		try {
			const base = str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
			return base.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
		} catch {
			const base = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
			return base.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
		}
}

// Step 1: Check if file exists
// Check for an Excel file id. Accepts optional fileSelector which can be:
// - a fileId (drive item id)
// - a filename (e.g., 'ToBeD.xlsx') to search for under EventRegistration
// If no selector provided, lists the EXCEL_FILE_PATH and picks a workbook candidate.
export async function checkFileExists(fileSelector) {
	const token = await getToken();
	try {
		// If a fileSelector is provided and looks like an id (no slashes, longer than 8 chars), try GET by id first
		if (fileSelector && typeof fileSelector === 'string' && !fileSelector.includes('/')) {
			try {
				const urlById = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileSelector)}`;
				const res = await graphRequest('get', urlById, token);
				if (res?.data?.id) return res.data.id;
			} catch {
				// not found by id, continue to search by name
			}
		}

		// If a filename is provided, list children under EventRegistration and match by name
		if (fileSelector && typeof fileSelector === 'string') {
			try {
				const parentFolderId = await getEventRegistrationFolderId();
				if (parentFolderId) {
					const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
					const childrenRes = await graphRequest('get', childrenUrl, token);
					const found = (childrenRes.data.value || []).find(it => it.name && it.name.toLowerCase() === fileSelector.toLowerCase());
					if (found) return found.id;
				}
			} catch {
				// ignore and fall back
			}
		}

		// Default behavior: list EXCEL_FILE_PATH and pick a workbook candidate
		const url = `https://graph.microsoft.com/v1.0/me/drive/root/${EXCEL_FILE_PATH}:`;
		const response = await graphRequest('get', url, token);
		const data = response.data || {};

		// response may be a single item or a collection under `value`
		let candidates = [];
		if (Array.isArray(data.value) && data.value.length) {
			candidates = data.value;
		} else if (data.value && typeof data.value === 'object') {
			candidates = [data.value];
		} else if (data && data.id) {
			candidates = [data];
		}

		if (!candidates.length) {
			console.error("No items returned for path", EXCEL_FILE_PATH, data);
			return null;
		}

		// Prefer an actual Excel workbook (file.mimeType) or a .xlsx/.xls name
		const excelItem = candidates.find(it => it.file && it.file.mimeType && /spreadsheet|excel|openxml/i.test(it.file.mimeType))
			|| candidates.find(it => typeof it.name === 'string' && /\.xlsx?$/i.test(it.name))
			|| candidates.find(it => typeof it.name === 'string' && /attend|attendees|registration/i.test(it.name))
			|| candidates[0];

		console.log("File found:", excelItem.name || excelItem.id);
		return excelItem.id;
	} catch (err) {
		console.error("File not found:", err?.response?.data || err?.message || err);
		return null;
	}
}

// Step 2: List worksheets and tables
// (removed: listWorksheetsAndTables - out of scope)

// Step 3: Append row safely and generate Invite_ID + token
// Returns an object { inviteId, token } on success
// Append a row to the Excel table and return invite + row index info
// Returns: { inviteId, token, fileId, rowIndex }
// (removed: appendRowToExcel - out of scope)

// Helper: get (or create) the EventRegistration folder id at root:/EventRegistration
async function getEventRegistrationFolderId() {
	try {
		const token = await getToken();
		// Try to get the folder by path
		const url = `https://graph.microsoft.com/v1.0/me/drive/root:/EventRegistration:`;
		const res = await graphRequest('get', url, token);
		return res.data.id;
	} catch (err) {
		console.warn("EventRegistration folder not found by path, attempting to locate among root children...", err);
		try {
			const token = await getToken();
			const listUrl = `https://graph.microsoft.com/v1.0/me/drive/root/children`;
			const listRes = await graphRequest('get', listUrl, token);
			const folder = listRes.data.value.find(it => it.name === "EventRegistration");
			if (folder) return folder.id;
		} catch (e) {
			console.error("Failed to locate EventRegistration folder:", e?.response?.data || e?.message || e);
		}
		return null;
	}
}

// Search the EVT###_ClientPhotos folder for a file matching Name_Company (sanitized) and return a download URL if found
export async function getClientPhotoUrl(fileId, name, company) {
  try {
    if (!fileId || !name || !company) return null;
    const eventCode = generateEventCode(fileId);
    const folderName = `EVT${eventCode}_ClientPhotos`;
    const parentFolderId = await getEventRegistrationFolderId();
    if (!parentFolderId) return null;
    const token = await getToken();

    const childrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
    const childrenRes = await graphRequest('get', childrenUrl, token);
    const targetFolder = (childrenRes.data.value || []).find(it => it.name === folderName && it.folder);
    if (!targetFolder) return null;

    const folderChildrenUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${targetFolder.id}/children`;
    const folderChildrenRes = await graphRequest('get', folderChildrenUrl, token);
    const items = folderChildrenRes.data.value || [];

    const key = removeDiacriticsAndSanitize(`${name}_${company}`);
    const match = items.find(it => {
      if (!it.name) return false;
      const n = it.name.replace(/\.[^.]+$/, ''); // strip ext
      return n.toLowerCase() === key.toLowerCase() || n.toLowerCase().startsWith(key.toLowerCase());
    });
    if (!match) return null;

    // Try to get a direct downloadUrl via item metadata
    try {
      const itemRes = await graphRequest('get', `https://graph.microsoft.com/v1.0/me/drive/items/${match.id}`, token);
      if (itemRes.data && itemRes.data['@microsoft.graph.downloadUrl']) return itemRes.data['@microsoft.graph.downloadUrl'];
    } catch (e) {
      // fallback to content endpoint (requires auth when fetching)
      return `https://graph.microsoft.com/v1.0/me/drive/items/${match.id}/content`;
    }
    return null;
  } catch (err) {
    console.error('Failed to find client photo:', err?.response?.data || err?.message || err);
    return null;
  }
}


// NEW: Find a table row by Invite_ID and Token values. Returns { row, index, values, rowObject }
export async function findInviteRow(fileIdOrSelector, inviteId, tokenValue, opts = {}) {
	try {
		const fileId = fileIdOrSelector || await checkFileExists(opts.fileSelector);
		if (!fileId) return null;
		const tableName = opts.tableName || opts.tableNameFromConfig || TABLE_NAME;
		const token = await getToken();
		const rowsListUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tableName)}/rows`;
		const rowsRes = await graphRequest('get', rowsListUrl, token);
		const rows = Array.isArray(rowsRes.data.value) ? rowsRes.data.value : [];

		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			// r.values may be an array-of-arrays or nested; normalize to first row
			const vals = Array.isArray(r.values) && Array.isArray(r.values[0]) ? r.values[0] : (Array.isArray(r.values) ? r.values : []);
			if (!vals || !vals.length) continue;
			const hasInvite = vals.includes(inviteId);
			const hasToken = vals.includes(tokenValue);
			if (hasInvite && hasToken) {
				const index = (typeof r.index !== 'undefined' && r.index !== null) ? r.index : i;
				return { rowIndex: index, values: vals, rowObject: r, fileId, tableName };
			}
		}

		return null;
	} catch (err) {
		console.error('Error finding invite row:', err?.response?.data || err?.message || err);
		return null;
	}
}

// NEW: Assign the next incremental Attendance_ID to a specific row index in the table.
// Returns assignedAttendanceId string (e.g., '001') on success.
export async function assignAttendanceId(fileId, tableName, rowIndex) {
	try {
		if (!fileId || typeof rowIndex === 'undefined' || rowIndex === null) throw new Error('fileId and rowIndex required');
		const tName = tableName || TABLE_NAME;
		const token = await getToken();

		// Determine Attendance_ID column index dynamically by reading table columns
		const colsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tName)}/columns`;
		let attendanceColIndex = 7; // default fallback
		try {
			const colsRes = await graphRequest('get', colsUrl, token);
			const cols = Array.isArray(colsRes.data.value) ? colsRes.data.value : [];
			for (let i = 0; i < cols.length; i++) {
				const name = cols[i].name || '';
				if (String(name).toLowerCase() === 'attendance_id' || String(name).toLowerCase() === 'attendanceid') {
					attendanceColIndex = i;
					break;
				}
			}
		} catch (cErr) {
			console.warn('Failed to read table columns, falling back to default Attendance_ID index 7', cErr?.message || cErr);
		}

		const rowsListUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tName)}/rows`;
		const rowsRes = await graphRequest('get', rowsListUrl, token);
		const rows = Array.isArray(rowsRes.data.value) ? rowsRes.data.value : [];

		// Compute current max attendance numeric (>0)
		let max = 0;
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			const vals = Array.isArray(r.values) && Array.isArray(r.values[0]) ? r.values[0] : (Array.isArray(r.values) ? r.values : []);
			const raw = vals[attendanceColIndex];
			const n = raw == null ? -1 : parseInt(String(raw).replace(/^0+/, ''));
			if (!isNaN(n) && n > max) max = n;
		}

		const next = max + 1;
		const nextPadded = String(next).padStart(3, '0');

		// Find the target row object to update full values
		const target = rows.find(r => {
			const idx = (typeof r.index !== 'undefined' && r.index !== null) ? r.index : rows.indexOf(r);
			return idx === rowIndex || rows.indexOf(r) === rowIndex;
		});

		if (!target) throw new Error('Target row not found for update');

		const targetVals = Array.isArray(target.values) && Array.isArray(target.values[0]) ? target.values[0].slice() : (Array.isArray(target.values) ? target.values.slice() : []);
		// Ensure array is long enough
		while (targetVals.length <= attendanceColIndex) targetVals.push('');
		targetVals[attendanceColIndex] = nextPadded;

		// PATCH the row values
		const updateUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${encodeURIComponent(tName)}/rows/${rowIndex}`;
		await graphRequest('patch', updateUrl, token, { values: [ targetVals ] });

		return nextPadded;
	} catch (err) {
		console.error('Failed to assign Attendance_ID:', err?.response?.data || err?.message || err);
		throw err;
	}
}

// NEW: High-level helper to check Invite_ID + token; if found, assign an incremental Attendance_ID
// opts: { fileSelector, fileId, tableName }
export async function checkInInvite(inviteId, tokenValue, opts = {}) {
	try {
		const fileId = opts.fileId || await checkFileExists(opts.fileSelector);
		if (!fileId) return { found: false };
		const tableName = opts.tableName || TABLE_NAME;

		const found = await findInviteRow(fileId, inviteId, tokenValue, { tableName });
		if (!found) return { found: false };

		const assigned = await assignAttendanceId(found.fileId, found.tableName, found.rowIndex);

		// Build result object with common fields
		const vals = found.values || [];
		const result = {
			found: true,
			Invite_ID: inviteId,
			Token: tokenValue,
			Attendance_ID: assigned,
			Name: vals[0] || null,
			Position: vals[1] || null,
			Company: vals[2] || null,
			Email: vals[3] || null,
			Phone: vals[4] || null,
			rowIndex: found.rowIndex,
			fileId: found.fileId,
			tableName: found.tableName,
		};

		// Try to locate a client photo in EVT###_ClientPhotos and attach a download URL if available
		try {
			const photoUrl = await getClientPhotoUrl(found.fileId, result.Name || '', result.Company || '');
			result.photoUri = photoUrl || null;
		} catch (pErr) {
			console.warn('Failed to locate client photo for result', pErr?.message || pErr);
		}

		return result;
	} catch (err) {
		console.error('checkInInvite failed:', err?.response?.data || err?.message || err);
		return { found: false, error: String(err) };
	}
}
