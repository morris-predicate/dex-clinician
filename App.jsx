import React from "react";
import { useState } from "react";
import Login from "./Login.jsx";
import Roster from "./Roster.jsx";
import PatientDetail from "./PatientDetail.jsx";
import { DEFAULT_CLINIC_ID, normalizeClinicId } from "./clinicConfig.js";
import StatusAuditPage from "./components/StatusAuditPage.jsx";
import {
  canAccessStatusAudit,
  getConfiguredClinicianRole,
  isPatientEnrollmentSupported,
} from "./clinicianAccess.js";

const STORAGE_KEY = "dex.clinician.key";

export default function App() {
  // ── Resolve clinicId from URL on first render ───────────────────────────────
  const [clinicId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const rawClinicId = params.get("clinic") || DEFAULT_CLINIC_ID;
    const normalizedClinicId = normalizeClinicId(rawClinicId);

    if (normalizedClinicId !== rawClinicId) {
      params.set("clinic", normalizedClinicId);
      const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }

    return normalizedClinicId;
  });

  const [clinicianKey, setClinicianKey] = useState(() =>
    sessionStorage.getItem(STORAGE_KEY)
  );
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [activeView, setActiveView] = useState("patients");
  const clinicianRole = getConfiguredClinicianRole();
  const statusAuditAllowed = canAccessStatusAudit(clinicianRole);

  function handleAuth(key) {
    sessionStorage.setItem(STORAGE_KEY, key);
    setClinicianKey(key);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setClinicianKey(null);
    setSelectedPatientId(null);
    setActiveView("patients");
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

  if (activeView === "status-audit" && statusAuditAllowed) {
    return (
      <StatusAuditPage
        clinicId={clinicId}
        clinicianKey={clinicianKey}
        onBack={() => setActiveView("patients")}
        onLogout={handleLogout}
      />
    );
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
      canAccessStatusAudit={statusAuditAllowed}
      patientEnrollmentSupported={isPatientEnrollmentSupported()}
      onOpenStatusAudit={() => setActiveView("status-audit")}
      onSelectPatient={setSelectedPatientId}
      onLogout={handleLogout}
    />
  );
}
