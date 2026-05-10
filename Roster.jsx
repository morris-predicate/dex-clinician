import React from "react";
import { useEffect, useState, useCallback } from "react";
import { fetchRoster } from "./api.js";

const REFRESH_MS = 60_000;

export default function Roster({ clinicId, clinicianKey, onSelectPatient, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const { patients } = await fetchRoster({ clinicianKey, clinicId });
      setPatients(patients);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clinicianKey, clinicId, onLogout]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = patients.filter((p) =>
    !search.trim() ||
    (p.name || "").toLowerCase().includes(search.toLowerCase().trim())
  );

  const withSessions = filtered.filter((p) => p.latestSessionId).length;

  if (loading && patients.length === 0) {
    return <div className="page-loading">Loading roster…</div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="page-title">Patients</div>
          <div className="page-sub">
            {clinicId} · {patients.length} enrolled · {withSessions} with sessions
            {lastUpdated && <> · updated {formatTime(lastUpdated)}</>}
          </div>
        </div>
        <button className="btn-text" onClick={onLogout}>Sign out</button>
      </header>

      <div className="page-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="banner-error">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          {search ? "No patients match your search." : "No patients enrolled in this clinic yet."}
        </div>
      ) : (
        <div className="patient-list">
          {filtered.map((p) => (
            <PatientRow
              key={p.patientId}
              patient={p}
              onClick={() => onSelectPatient(p.patientId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PatientRow({ patient, onClick }) {
  const hasSession = !!patient.latestSessionId;
  const entityCount = (patient.latestEntities || []).length;
  const lastSession = patient.latestSessionAt
    ? formatRelativeDate(patient.latestSessionAt)
    : null;

  return (
    <button className="patient-row" onClick={onClick}>
      <div className="patient-row-main">
        <div className="patient-row-name">
          {patient.name || "Unnamed patient"}
          {!hasSession && <span className="badge badge-pending">Awaiting session</span>}
        </div>
        <div className="patient-row-meta">
          {patient.dob && <>DOB {patient.dob}</>}
          {patient.sex && <> · {patient.sex}</>}
          {patient.status && <> · {patient.status}</>}
        </div>
      </div>

      <div className="patient-row-session">
        {hasSession ? (
          <>
            <div className="patient-row-session-time">{lastSession}</div>
            <div className="patient-row-entity-count">
              {entityCount} {entityCount === 1 ? "entity" : "entities"}
            </div>
          </>
        ) : (
          <div className="patient-row-session-time muted">No session yet</div>
        )}
      </div>

      <div className="patient-row-chevron">›</div>
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRelativeDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
