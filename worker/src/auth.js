const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const tokenCache = new Map();
let cachedServiceAccount;

function getServiceAccount(env) {
  if (cachedServiceAccount) return cachedServiceAccount;
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT Cloudflare secret");
  }

  try {
    cachedServiceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must contain valid JSON");
  }

  if (
    !cachedServiceAccount.client_email ||
    !cachedServiceAccount.private_key ||
    !cachedServiceAccount.project_id
  ) {
    throw new Error("Firebase service account is missing required fields");
  }
  return cachedServiceAccount;
}

function base64UrlEncode(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function getFirebaseProjectId(env) {
  return getServiceAccount(env).project_id;
}

export async function getGoogleAccessToken(env, scope) {
  const cached = tokenCache.get(scope);
  if (cached && Date.now() < cached.expiry - 60_000) {
    return cached.accessToken;
  }

  const account = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: account.client_email,
      scope,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedToken = `${header}.${claims}`;
  const privateKeyBytes = Uint8Array.from(
    atob(
      account.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s/g, ""),
    ),
    (character) => character.charCodeAt(0),
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(
      `Google OAuth failed (${response.status}): ${JSON.stringify(result)}`,
    );
  }

  tokenCache.set(scope, {
    accessToken: result.access_token,
    expiry: Date.now() + result.expires_in * 1000,
  });
  return result.access_token;
}

export const FIRESTORE_SCOPE_VALUE = FIRESTORE_SCOPE;
export const FCM_SCOPE_VALUE = FCM_SCOPE;
