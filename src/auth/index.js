import * as AuthSession from 'expo-auth-session';
import * as Random from 'expo-random';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { msalConfig, loginRequest } from './config.js';

// A small, Expo-friendly implementation of the OAuth2 Authorization Code + PKCE
// flow against Microsoft identity platform. This replaces the browser-only
// `@azure/msal-browser` which relies on `window.crypto.subtle` and other browser
// APIs not available in native runtimes.

const REFRESH_TOKEN_KEY = 'msal_refresh_token_v1';

function base64UrlEncode(str) {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeVerifier() {
    const bytes = await Random.getRandomBytesAsync(32);
    // Convert to base64
    const b64 = Buffer.from(bytes).toString('base64');
    return base64UrlEncode(b64);
}

async function generateCodeChallenge(verifier) {
    // SHA256 and base64-url encode
    const digestB64 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
    );
    return base64UrlEncode(digestB64);
}

function buildAuthEndpoints() {
    const authority = (msalConfig && msalConfig.auth && msalConfig.auth.authority) || '';
    const base = authority.replace(/\/+$/, '');
    return {
        authorizeEndpoint: `${base}/oauth2/v2.0/authorize`,
        tokenEndpoint: `${base}/oauth2/v2.0/token`,
    };
}

async function tryRefreshToken(refreshToken) {
    if (!refreshToken) return null;
    const { tokenEndpoint } = buildAuthEndpoints();
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: msalConfig.auth.clientId,
        refresh_token: refreshToken,
        scope:
            (loginRequest && loginRequest.scopes && loginRequest.scopes.join(' ')) ||
            'openid profile',
    });

    try {
        const res = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const json = await res.json();
        if (json.access_token) {
            if (json.refresh_token)
                await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, json.refresh_token);
            return json.access_token;
        }
    } catch (e) {
        console.warn('Refresh token exchange failed:', e?.message || e);
    }
    return null;
}

export async function loginAndGetToken() {
    // Try refresh token first
    try {
        const stored = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (stored) {
            const refreshed = await tryRefreshToken(stored);
            if (refreshed) return refreshed;
        }
    } catch (e) {
        console.warn('Failed reading refresh token:', e?.message || e);
    }

    // Interactive auth using PKCE
    const clientId = msalConfig?.auth?.clientId;
    if (!clientId) throw new Error('MSAL clientId not configured');

    const redirectUri =
        msalConfig?.auth?.redirectUri || AuthSession.makeRedirectUri({ useProxy: true });
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    const { authorizeEndpoint, tokenEndpoint } = buildAuthEndpoints();

    const scope = encodeURIComponent(
        ((loginRequest && loginRequest.scopes) || ['openid', 'profile']).join(' '),
    );

    const authUrl = `${authorizeEndpoint}?client_id=${encodeURIComponent(
        clientId,
    )}&response_type=code&redirect_uri=${encodeURIComponent(
        redirectUri,
    )}&response_mode=query&scope=${scope}&code_challenge=${encodeURIComponent(
        challenge,
    )}&code_challenge_method=S256`;

    // Open system browser / web view for user to authenticate
    const result = await AuthSession.startAsync({ authUrl });
    if (!result || result.type !== 'success' || !result.params || !result.params.code) {
        throw new Error('Authentication cancelled or failed');
    }

    const code = result.params.code;

    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
    });

    const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenJson || !tokenJson.access_token) {
        throw new Error('Token exchange failed: ' + JSON.stringify(tokenJson));
    }

    if (tokenJson.refresh_token) {
        try {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenJson.refresh_token);
        } catch (e) {
            console.warn('Failed saving refresh token:', e?.message || e);
        }
    }

    return tokenJson.access_token;
}
