import React from "react";
import { useEffect, useState } from "react";
import Login from "./Login.jsx";
import Roster from "./Roster.jsx";
import PatientDetail from "./PatientDetail.jsx";

const STORAGE_KEY = "dex.clinician.key";

export default function App() {
  // ── Resolve clinicId from URL on first render ───────────────────────────────
  const [clinicId] = useState(() => {
  const params = new URLSearchParams(window.location.search);
  return params.get("clinic") || "alpha-v1";
});

  const [clinicianKey, setClinicianKey] = useState(() =>
    sessionStorage.getItem(STORAGE_KEY)
  );
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  function handleAuth(key) {
    sessionStorage.setItem(STORAGE_KEY, key);
    setClinicianKey(key);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setClinicianKey(null);
    setSelectedPatientId(null);
  }

  // ── No clinicId → show error ────────────────────────────────────────────────
  if (!clinicId) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">D</div>
          <h1 className="login-title">Dex Clinician</h1>
          <div className="login-error">
            No clinic specified. Open this dashboard using the link your administrator
            provided, which should look like
            <br />
            <code style={{ fontSize: 12, color: "#475569" }}>
              dex-clinician.netlify.app/?clinic=YOUR_CLINIC
            </code>
          </div>
        </div>
      </div>
    );
  }

  // ── Not authenticated → login screen ────────────────────────────────────────
  if (!clinicianKey) {
    return <Login clinicId={clinicId} onAuth={handleAuth} />;
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedPatientId) {
    return (
      <PatientDetail
        patientId={selectedPatientId}
        clinicId={clinicId}
        clinicianKey={clinicianKey}
        onBack={() => setSelectedPatientId(null)}
        onLogout={handleLogout}
      />
    );
  }

  // ── Roster view (default) ───────────────────────────────────────────────────
  return (
    <Roster
      clinicId={clinicId}
      clinicianKey={clinicianKey}
      onSelectPatient={setSelectedPatientId}
      onLogout={handleLogout}
    />
  );
}
