import React from "react";
import { useState } from "react";
import { fetchRoster } from "./api.js";
import { CLINICS, normalizeClinicId } from "./clinicConfig.js";

export function getLoginErrorMessage(error = {}) {
  if (error.status === 401) return "Incorrect access key.";
  if (error.status === 403) return "Access denied for this clinic.";
  if (error.status === 404) {
    return "Clinician service configuration is unavailable. Please contact support.";
  }
  if (Number(error.status) >= 500) {
    return "The clinician service is temporarily unavailable. Please try again.";
  }
  if (error.status) return "Unable to verify access right now. Please try again.";
  return "Couldn't reach the server. Please try again.";
}

export default function Login({ clinicId, onAuth }) {
  const [password, setPassword] = useState("");
  const [selectedClinic, setSelectedClinic] = useState(
    normalizeClinicId(clinicId)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function handleClinicChange(e) {
    const nextClinic = normalizeClinicId(e.target.value);
    setSelectedClinic(nextClinic);

    const url = new URL(window.location.href);
    url.searchParams.set("clinic", nextClinic);
    window.history.replaceState({}, "", url.toString());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      await fetchRoster({
        clinicianKey: password.trim(),
        clinicId: selectedClinic,
      });

      onAuth(password.trim());
    } catch (err) {
      setError(getLoginErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <img
          src="/predicate-logo-light.png"
          alt="Predicate"
          className="login-logo-image"
        />

        <h1 className="login-title">OpenDx™ Signal Intelligence</h1>

        <label className="form-label">Clinic</label>
        <select
          className="login-input"
          value={selectedClinic}
          onChange={handleClinicChange}
          disabled={busy}
        >
          {CLINICS.map((clinic) => (
            <option key={clinic.value} value={clinic.value}>
              {clinic.label}
            </option>
          ))}
        </select>

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
