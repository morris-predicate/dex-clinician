import React from "react";
import { useState } from "react";
import { fetchRoster } from "./api.js";

const CLINICS = [
  { value: "alpha-v1", label: "Alpha v1" },
  { value: "production-v1", label: "Production / Demo" },
];

export default function Login({ clinicId, onAuth }) {
  const [password, setPassword] = useState("");
  const [selectedClinic, setSelectedClinic] = useState(
    clinicId || "alpha-v1"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function handleClinicChange(e) {
    const nextClinic = e.target.value;
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
      if (err.status === 401) setError("Incorrect access key.");
      else if (err.status === 403) setError("Access denied for this clinic.");
      else setError("Couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/ao-logo.png" alt="Aō" className="login-logo-image" />

        <h1 className="login-title">Dex Clinician</h1>

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