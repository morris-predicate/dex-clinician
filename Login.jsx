import React from "react";
import { useState } from "react";
import { fetchRoster } from "./api.js";

export default function Login({ clinicId, onAuth }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      // Verify by hitting the roster endpoint — cheap, validates auth + clinic.
      await fetchRoster({ clinicianKey: password.trim(), clinicId });
      onAuth(password.trim());
    } catch (err) {
      if (err.status === 401) setError("Incorrect access key.");
      else if (err.status === 403) setError("Access denied for this clinic.");
      else setError("Couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">D</div>
        <h1 className="login-title">Dex Clinician</h1>
        <p className="login-meta">
          Clinic: <strong>{clinicId}</strong>
        </p>

        <input
          type="password"
          className="login-input"
          placeholder="Access key"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="off"
          disabled={busy}
        />

        {error && <div className="login-error">{error}</div>}

        <button
          type="submit"
          className="login-btn"
          disabled={!password.trim() || busy}
        >
          {busy ? "Verifying…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
