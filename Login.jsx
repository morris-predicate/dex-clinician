import React from "react";
import { useState } from "react";
import {
  beginClinicianAuthentication,
  resolveClinicianCognitoConfig,
} from "./clinicianCognito.js";

export default function Login({
  navigateTo = (url) => window.location.assign(url),
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const status = resolveClinicianCognitoConfig();

  async function handleSubmit() {
    if (busy || !status.available) return;
    setBusy(true);
    setError(null);
    try {
      navigateTo(await beginClinicianAuthentication());
    } catch {
      setError("Secure clinician sign-in is temporarily unavailable.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img
          src="/predicate-logo-light.png"
          alt="Predicate"
          className="login-logo-image"
        />

        <h1 className="login-title">OpenDx™ Signal Intelligence</h1>

        <p className="login-meta">Use your approved clinician account and software-token MFA.</p>
        {!status.available && (
          <div className="login-error">Secure clinician sign-in is not configured on this build.</div>
        )}
        {error && <div className="login-error">{error}</div>}
        <button
          type="button"
          className="login-btn"
          disabled={!status.available || busy}
          onClick={handleSubmit}
        >
          {busy ? "Opening secure sign-in…" : "Continue securely"}
        </button>
      </div>
    </div>
  );
}
