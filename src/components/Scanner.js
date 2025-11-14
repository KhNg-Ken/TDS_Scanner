import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, Button, Image, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// In production this uses the server-side Microsoft Graph check. We no longer
// use a local `invite_list.json` fallback — the code will return `null` when
// the Graph lookup fails or the invite isn't found.
import { checkInInvite } from '../services/graphApi';

function parseInvitePayload(scannedString) {
  // Try JSON first
  try {
    const obj = JSON.parse(scannedString);
    return { inviteId: obj.Invite_ID || obj.inviteId || obj.invite_id, token: obj.token };
  } catch (e) {
    // Fallback to regex: look for Invite_ID and token patterns (accept _ or -)
    const idMatch = scannedString.match(/(EVT\d{3}[_-]\d{3})/i);
    const tokenMatch = scannedString.match(/token[:=]\s*([A-Za-z0-9-_]+)/i);
    return {
      inviteId: idMatch ? idMatch[1] : undefined,
      token: tokenMatch ? tokenMatch[1] : undefined,
    };
  }
}

export default function Scanner() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  // rawData removed (not needed) to avoid unused state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const lookupInvite = async (inviteId, token) => {
    setLoading(true);
    try {
      if (!inviteId || !token) return null;

      // Only attempt server-side Graph check. If it fails or is not found,
      // we return null so the UI shows "not found".
      try {
        if (typeof checkInInvite === 'function') {
          const remote = await checkInInvite(inviteId, token);
          if (remote && remote.found) {
            return {
              Name: remote.Name,
              Company: remote.Company,
              Position: remote.Position,
              Phone: remote.Phone,
              Email: remote.Email,
              photoUri: remote.photoUri || null,
              Attendance_ID: remote.Attendance_ID || null,
            };
          }
        }
      } catch (gerr) {
        // Graph failed — no local fallback per latest requirement.
        console.warn('Graph API check failed (no local fallback).', gerr?.message || gerr);
      }

      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = useCallback(
    async ({ data }) => {
      if (scanned) return;
      setScanned(true);
      const { inviteId, token } = parseInvitePayload(data);

      const info = await lookupInvite(inviteId, token);
      if (info) {
        setResult({ found: true, inviteId, token, ...info });
      } else {
        setResult({ found: false, inviteId, token });
      }
    },
    [scanned]
  );

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  // UI for showing verified invite info
  const ResultView = () => {
    if (loading) return <ActivityIndicator size="large" color="#E10600" />;

    if (!result) return null;

    if (!result.found) {
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.notFoundText}>Invite not found or invalid token.</Text>
          <Text style={styles.smallText}>Invite: {result.inviteId || '—'}</Text>
          <Button
            title="Scan Again"
            onPress={() => {
              setScanned(false);
              setResult(null);
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.resultContainer}>
        {result.photoUri ? (
          <Image source={{ uri: result.photoUri }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}

        <Text style={styles.nameText}>{result.Name}</Text>
        <Text style={styles.companyText}>{result.Company}</Text>
        {result.Attendance_ID ? (
          <Text style={[styles.infoText, { fontWeight: '700' }]}>Attendance ID: {result.Attendance_ID}</Text>
        ) : null}
        <Text style={styles.positionText}>{result.Position}</Text>
        <Text style={styles.infoText}>Phone: {result.Phone}</Text>
        <Text style={styles.infoText}>Email: {result.Email}</Text>

        <View style={{ height: 18 }} />
        <Button
          title="Scan Again"
          onPress={() => {
            setScanned(false);
            setResult(null);
            // setRawData(''); // Removed as it's no longer needed
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barCodeTypes: ['qr'],
        }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* When scanned, overlay the result UI centered on screen */}
      {scanned && (
        <View style={[styles.overlay, { paddingBottom: insets.bottom }]}> 
          <ResultView />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  resultContainer: {
    width: '88%',
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  companyText: {
    color: '#E10600',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  positionText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  notFoundText: {
    color: '#ff6b6b',
    fontSize: 18,
    marginBottom: 6,
  },
  smallText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 12,
  },
});