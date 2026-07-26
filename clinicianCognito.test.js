import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginClinicianAuthentication,
  completeClinicianAuthentication,
  getClinicianAccessToken,
  PKCE_KEY,
  resolveClinicianCognitoConfig,
} from "./clinicianCognito.js";

const env = {
  VITE_CLINICIAN_COGNITO_CLIENT_ID: "public-client",
  VITE_CLINICIAN_COGNITO_AUTHORIZATION_ENDPOINT: "https://auth.example.test/oauth2/authorize",
  VITE_CLINICIAN_COGNITO_TOKEN_ENDPOINT: "https://auth.example.test/oauth2/token",
  VITE_CLINICIAN_COGNITO_CALLBACK_URL: "https://dashboard.example.test/auth/callback",
  VITE_CLINICIAN_COGNITO_LOGOUT_URL: "https://dashboard.example.test/",
  VITE_CLINICIAN_COGNITO_SCOPES: "openid email profile",
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("clinician Cognito PKCE", () => {
  it("requires complete HTTPS public-client configuration", () => {
    expect(resolveClinicianCognitoConfig(env).available).toBe(true);
    expect(resolveClinicianCognitoConfig({}).available).toBe(false);
  });

  it("creates Authorization Code + PKCE S256 state without a client secret", async () => {
    const url = new URL(await beginClinicianAuthentication(env));
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(PKCE_KEY)).verifier).toBeTruthy();
  });

  it("exchanges a valid callback and stores only the access token session-side", async () => {
    const authorization = new URL(await beginClinicianAuthentication(env));
    const state = authorization.searchParams.get("state");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "opaque-access-token",
        id_token: "unused-id-token",
        refresh_token: "unused-refresh-token",
        expires_in: 3600,
      }),
    });
    await completeClinicianAuthentication(
      `${env.VITE_CLINICIAN_COGNITO_CALLBACK_URL}?code=authorization-code&state=${state}`,
      { env, fetchImpl }
    );
    expect(getClinicianAccessToken()).toBe("opaque-access-token");
    expect(sessionStorage.getItem(PKCE_KEY)).toBeNull();
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("client_secret");
  });

  it("fails closed on callback state mismatch", async () => {
    await beginClinicianAuthentication(env);
    await expect(
      completeClinicianAuthentication(
        `${env.VITE_CLINICIAN_COGNITO_CALLBACK_URL}?code=authorization-code&state=wrong`,
        { env, fetchImpl: vi.fn() }
      )
    ).rejects.toThrow("CLINICIAN_AUTH_CALLBACK_INVALID");
  });
});
