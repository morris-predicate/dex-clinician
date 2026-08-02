import React from "react";
import { useCallback, useEffect, useState } from "react";
import Login from "./Login.jsx";
import AuthCallback from "./AuthCallback.jsx";
import Roster from "./Roster.jsx";
import PatientDetail from "./PatientDetail.jsx";
import EnrollPatient from "./EnrollPatient.jsx";
import { DEFAULT_CLINIC_ID, normalizeClinicId } from "./clinicConfig.js";
import StatusAuditPage from "./components/StatusAuditPage.jsx";
import UserAdministration from "./UserAdministration.jsx";
import { fetchUserAdministrationSession } from "./api.js";
import {
  canAccessStatusAudit,
  getConfiguredClinicianRole,
} from "./clinicianAccess.js";
import {
  clearClinicianSession,
  getClinicianAccessToken,
} from "./clinicianCognito.js";

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

  const [accessToken, setAccessToken] = useState(getClinicianAccessToken);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [activeView, setActiveView] = useState("patients");
  const [canManageUsers, setCanManageUsers] = useState(false);
  const clinicianRole = getConfiguredClinicianRole();
  const statusAuditAllowed = canAccessStatusAudit(clinicianRole);
  useEffect(() => { let active = true; if (!accessToken) { setCanManageUsers(false); return undefined; } fetchUserAdministrationSession({ clinicianKey: accessToken }).then((result) => { if (active) setCanManageUsers(result.canManageUsers === true); }).catch(() => { if (active) setCanManageUsers(false); }); return () => { active = false; }; }, [accessToken]);

  const handleAuth = useCallback((token) => setAccessToken(token), []);

  function handleLogout() {
    clearClinicianSession();
    setAccessToken("");
    setSelectedPatientId(null);
    setActiveView("patients");
  }

  // ── No clinicId → show error ────────────────────────────────────────────────
  if (!clinicId) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">D</div>
          <h1 className="login-title">OpenDx™ Signal Intelligence</h1>
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

  if (window.location.pathname === "/auth/callback") {
    return <AuthCallback onAuthenticated={handleAuth} />;
  }

  // ── Not authenticated → Cognito Managed Login ───────────────────────────────
  if (!accessToken) {
    return <Login />;
  }

  if (activeView === "status-audit" && statusAuditAllowed) {
    return (
      <StatusAuditPage
        clinicId={clinicId}
        clinicianKey={accessToken}
        onBack={() => setActiveView("patients")}
        onLogout={handleLogout}
      />
    );
  }

  if (activeView === "enroll") {
    return (
      <EnrollPatient
        clinicId={clinicId}
        clinicianKey={accessToken}
        onBack={() => setActiveView("patients")}
      />
    );
  }
  if (activeView === "user-administration" && canManageUsers) return <UserAdministration clinicianKey={accessToken} onBack={() => setActiveView("patients")} onLogout={handleLogout} />;

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedPatientId) {
    return (
      <PatientDetail
        patientId={selectedPatientId}
        clinicId={clinicId}
        clinicianKey={accessToken}
        onBack={() => setSelectedPatientId(null)}
        onLogout={handleLogout}
      />
    );
  }

  // ── Roster view (default) ───────────────────────────────────────────────────
  return (
    <Roster
      clinicId={clinicId}
      clinicianKey={accessToken}
      canAccessStatusAudit={statusAuditAllowed}
      onOpenStatusAudit={() => setActiveView("status-audit")}
      onEnrollPatient={() => setActiveView("enroll")}
      canManageUsers={canManageUsers}
      onOpenUserAdministration={() => setActiveView("user-administration")}
      onSelectPatient={setSelectedPatientId}
      onLogout={handleLogout}
    />
  );
}
