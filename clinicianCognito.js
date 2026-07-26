const SESSION_KEY = "dex.clinician.session";
const PKCE_KEY = "dex.clinician.pkce";

function clean(value) {
  return String(value || "").trim();
}

function sessionStorageRef() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomValue(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

export function resolveClinicianCognitoConfig(env = import.meta.env) {
  const config = Object.freeze({
    clientId: clean(env.VITE_CLINICIAN_COGNITO_CLIENT_ID),
    authorizationEndpoint: clean(env.VITE_CLINICIAN_COGNITO_AUTHORIZATION_ENDPOINT),
    tokenEndpoint: clean(env.VITE_CLINICIAN_COGNITO_TOKEN_ENDPOINT),
    callbackUrl: clean(env.VITE_CLINICIAN_COGNITO_CALLBACK_URL),
    logoutUrl: clean(env.VITE_CLINICIAN_COGNITO_LOGOUT_URL),
    scopes: clean(env.VITE_CLINICIAN_COGNITO_SCOPES || "openid email profile"),
  });
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  for (const key of [
    "authorizationEndpoint",
    "tokenEndpoint",
    "callbackUrl",
    "logoutUrl",
  ]) {
    try {
      if (config[key] && new URL(config[key]).protocol !== "https:") {
        missing.push(`${key}:https`);
      }
    } catch {
      missing.push(`${key}:url`);
    }
  }
  return Object.freeze({
    available: missing.length === 0,
    config,
    missing: Object.freeze([...new Set(missing)]),
  });
}

export async function beginClinicianAuthentication(env = import.meta.env) {
  const resolved = resolveClinicianCognitoConfig(env);
  if (!resolved.available) throw new Error("CLINICIAN_AUTH_CONFIGURATION_UNAVAILABLE");
  const verifier = randomValue(48);
  const state = randomValue(32);
  const challenge = await challengeFor(verifier);
  sessionStorageRef()?.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const url = new URL(resolved.config.authorizationEndpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: resolved.config.clientId,
    redirect_uri: resolved.config.callbackUrl,
    scope: resolved.config.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export async function completeClinicianAuthentication(
  callbackUrl,
  { env = import.meta.env, fetchImpl = globalThis.fetch } = {}
) {
  const resolved = resolveClinicianCognitoConfig(env);
  if (!resolved.available) throw new Error("CLINICIAN_AUTH_CONFIGURATION_UNAVAILABLE");
  let transaction = null;
  try {
    transaction = JSON.parse(sessionStorageRef()?.getItem(PKCE_KEY) || "null");
  } catch {
    transaction = null;
  }
  sessionStorageRef()?.removeItem(PKCE_KEY);
  const callback = new URL(callbackUrl, resolved.config.callbackUrl);
  const code = callback.searchParams.get("code") || "";
  const state = callback.searchParams.get("state") || "";
  if (!code || !transaction?.verifier || !transaction?.state || state !== transaction.state) {
    throw new Error("CLINICIAN_AUTH_CALLBACK_INVALID");
  }
  const response = await fetchImpl(resolved.config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: resolved.config.clientId,
      code,
      code_verifier: transaction.verifier,
      redirect_uri: resolved.config.callbackUrl,
    }).toString(),
  });
  const data = await response.json().catch(() => ({}));
  const expiresIn = Number(data.expires_in);
  if (!response.ok || !data.access_token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("CLINICIAN_TOKEN_EXCHANGE_FAILED");
  }
  const session = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  sessionStorageRef()?.setItem(SESSION_KEY, JSON.stringify(session));
  return session.accessToken;
}

export function getClinicianAccessToken() {
  try {
    const session = JSON.parse(sessionStorageRef()?.getItem(SESSION_KEY) || "null");
    if (!session?.accessToken || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      sessionStorageRef()?.removeItem(SESSION_KEY);
      return "";
    }
    return session.accessToken;
  } catch {
    sessionStorageRef()?.removeItem(SESSION_KEY);
    return "";
  }
}

export function clearClinicianSession() {
  sessionStorageRef()?.removeItem(SESSION_KEY);
  sessionStorageRef()?.removeItem(PKCE_KEY);
}

export { PKCE_KEY, SESSION_KEY };
