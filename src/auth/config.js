import Constants from 'expo-constants';

// Expo/React Native does not include Node standard libs (fs/path/etc.).
// Instead of using `dotenv` (Node-only), read environment values from
// `app.json`/`app.config.js` `extra` values or `process.env` when available.
const getEnv = () => {
    // `expo` v45+ places runtime config under `expoConfig` for the new config system.
    const expoConfig = Constants.expoConfig || Constants.manifest || {};
    const extra = (expoConfig && expoConfig.extra) || {};
    return {
        MS_CLIENT_ID: extra.MS_CLIENT_ID || process.env.MS_CLIENT_ID,
        MS_TENANT_ID: extra.MS_TENANT_ID || process.env.MS_TENANT_ID,
        REDIRECT_URI: extra.REDIRECT_URI || process.env.REDIRECT_URI,
    };
};

const env = getEnv();

export const msalConfig = {
    auth: {
        clientId: env.MS_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${env.MS_TENANT_ID}`,
        redirectUri: env.REDIRECT_URI,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ['Files.ReadWrite', 'User.Read'],
};
