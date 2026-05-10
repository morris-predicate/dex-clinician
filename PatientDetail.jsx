import React from "react";
import { useEffect, useState } from "react";
import { fetchPatient, fetchTranscript } from "./api.js";

// Same display order + labels as the patient PWA's done screen, for consistency.
const DISPLAY_CATEGORIES = [
  { key: "MEDICAL_CONDITION", label: "Symptoms" },
  { key: "ANATOMY", label: "Body location" },
  { key: "MEDICATION", label: "Medications" },
  { key: "TIME_EXPRESSION", label: "Timing" },
];

function classForCategory(c) {
  return {
    MEDICAL_CONDITION: "condition",
    MEDICATION: "medication",
    ANATOMY: "anatomy",
    TIME_EXPRESSION: "time",
  }[c] || "other";
}

export default function PatientDetail({
  patientId,
  clinicId,
  clinicianKey,
  onBack,
  onLogout,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Transcript state: defaulted closed, loaded on demand.
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPatient({ patientId, clinicianKey, clinicId })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onLogout();
        else setError(err.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, clinicId, clinicianKey, onLogout]);

  async function handleToggleTranscript() {
    if (showTranscript) {
      setShowTranscript(false);
      return;
    }
    if (transcript) {
      setShowTranscript(true);
      return;
    }
    setTranscriptLoading(true);
    setTranscriptError(null);
    try {
      const t = await fetchTranscript({ patientId, clinicianKey, clinicId });
      setTranscript(t);
      setShowTranscript(true);
    } catch (err) {
      setTranscriptError(err.message);
    } finally {
      setTranscriptLoading(false);
    }
  }

  if (loading) return <div className="page-loading">Loading patient…</div>;
  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="btn-text" onClick={onBack}>‹ Back to roster</button>
        </header>
        <div className="banner-error">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const { patient, vitals } = data;
  const entities = patient.latestEntities || [];
  const buckets = DISPLAY_CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    items: entities.filter((e) => e.category === key),
  })).filter((b) => b.items.length > 0);

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-text" onClick={onBack}>‹ Back to roster</button>
        <button className="btn-text" onClick={onLogout}>Sign out</button>
      </header>

      {/* ── Patient header card ──────────────────────────────────────────── */}
      <div className="detail-header-card">
        <div className="detail-name">{patient.name || "Unnamed patient"}</div>
        <div className="detail-meta">
          {patient.dob && <span>DOB {patient.dob}</span>}
          {patient.sex && <span>{prettySex(patient.sex)}</span>}
          {patient.email && <span>{patient.email}</span>}
          {patient.phone && <span>{patient.phone}</span>}
        </div>
        <div className="detail-status">
          {patient.latestSessionAt ? (
            <>Last session: {formatDateTime(patient.latestSessionAt)}</>
          ) : (
            <>No Dex session yet</>
          )}
        </div>
      </div>

      {/* ── What patient reported (filtered entities) ────────────────────── */}
      <section className="detail-section">
        <div className="detail-section-title">What this patient reported</div>

        {buckets.length === 0 ? (
          <div className="empty-state-small">
            No clinical entities extracted from the most recent session.
          </div>
        ) : (
          <div className="detail-card">
            {buckets.map(({ key, label, items }) => (
              <div key={key} className="detail-bucket">
                <div className="detail-bucket-label">{label}</div>
                <div className="detail-bucket-tags">
                  {items.map((e, i) => (
                    <span
                      key={i}
                      className={`entity-tag entity-${classForCategory(key)}`}
                    >
                      {e.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Vitals (placeholder until Validic is live) ───────────────────── */}
      <section className="detail-section">
        <div className="detail-section-title">Vitals</div>
        <div className="detail-card">
          {vitals && vitals.length > 0 ? (
            <VitalsTable vitals={vitals} />
          ) : (
            <div className="empty-state-small">
              No wearable data connected.
              <span className="muted-inline"> (Validic integration pending)</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Transcript toggle ─────────────────────────────────────────────── */}
      <section className="detail-section">
        <div className="detail-section-title-row">
          <div className="detail-section-title">Conversation transcript</div>
          {patient.latestSessionId && (
            <button
              className="btn-secondary-small"
              onClick={handleToggleTranscript}
              disabled={transcriptLoading}
            >
              {transcriptLoading
                ? "Loading…"
                : showTranscript
                ? "Hide"
                : "Show transcript"}
            </button>
          )}
        </div>

        {transcriptError && (
          <div className="banner-error">{transcriptError}</div>
        )}

        {showTranscript && transcript && (
          <div className="detail-card">
            <div className="transcript-meta">
              {formatDateTime(transcript.capturedAt)} ·{" "}
              {transcript.messages.length} messages
            </div>
            <div className="transcript">
              {transcript.messages.map((m, i) => (
                <div
                  key={i}
                  className={`transcript-msg transcript-msg-${
                    m.role === "user" ? "patient" : "dex"
                  }`}
                >
                  <div className="transcript-role">
                    {m.role === "user" ? "Patient" : "Dex"}
                  </div>
                  <div className="transcript-content">{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function VitalsTable({ vitals }) {
  return (
    <table className="vitals-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Value</th>
          <th>When</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {vitals.slice(0, 20).map((v, i) => (
          <tr key={i}>
            <td>{prettyVitalType(v.type)}</td>
            <td>
              {v.value} {v.unit}
            </td>
            <td>{formatDateTime(v.timestamp)}</td>
            <td className="muted">{v.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function prettySex(s) {
  return {
    F: "Female", M: "Male",
    female: "Female", male: "Male",
    nonbinary: "Non-binary",
    prefer_not_to_say: "Not specified",
  }[s] || s;
}

function prettyVitalType(t) {
  return {
    heart_rate: "Heart rate",
    hrv: "HRV",
    sleep_duration: "Sleep",
    steps: "Steps",
    blood_pressure_systolic: "BP (systolic)",
    blood_pressure_diastolic: "BP (diastolic)",
    glucose: "Glucose",
    weight: "Weight",
    oxygen_saturation: "SpO₂",
    body_temperature: "Body temp",
    respiratory_rate: "Resp rate",
  }[t] || t;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
