import React from "react";
import { useEffect, useState } from "react";
import {
  fetchPatient,
  fetchTranscript,
  fetchPatientBaseline,
} from "./api.js";

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

function titleCase(value) {
  if (!value) return "Stable";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n}%`;
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
  const [baseline, setBaseline] = useState(null);
  const [showBaselineDetails, setShowBaselineDetails] = useState(false);

  const voiceDeviation =
    baseline?.voiceFeatures?.latest?.payload?.features?.voiceDeviation || null;
  // Transcript state: defaulted closed, loaded on demand.
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
  fetchPatient({ patientId, clinicianKey, clinicId }),
  fetchPatientBaseline({ patientId, clinicianKey, clinicId }),
])
  .then(([patientData, baselineData]) => {
  setData(patientData);
  setBaseline(baselineData);
})
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
      {getPatientAge(patient) && (
        <span>Age {getPatientAge(patient)}</span>
      )}

      {patient.sex && <span>{prettySex(patient.sex)}</span>}

      {patient.subjectUid && (
        <span>Subject ID {patient.subjectUid}</span>
      )}
     </div>
        <div className="detail-status">
          {patient.latestSessionAt ? (
            <>Last session: {formatDateTime(patient.latestSessionAt)}</>
          ) : (
            <>No Dex session yet</>
          )}
        </div>
      </div>
     {/* ── Baseline status ───────────────────────────────────────────── */}
<section className="detail-section">
  <div className="detail-section-title">
    Baseline Status
  </div>

  <div className="detail-card">
    {!baseline ? (
      <div className="empty-state-small">
        Loading baseline…
      </div>
    ) : (
      <>
        <div style={{ marginBottom: 8 }}>
          <strong>Status:</strong>{" "}
          {baseline.baselineStatus === "voice_baseline_ready"
            ? "✓ Voice baseline ready"
            : baseline.baselineStatus === "multimodal_baseline_ready"
            ? "✓ Multimodal baseline ready"
            : baseline.baselineStatus === "wearable_enabled"
            ? "✓ Wearable connected"
            : "Voice-only monitoring"}
        </div>

        <div className="muted">
          Wearable:{" "}
          {baseline.wearableConnected
            ? "Connected"
            : "Not connected"}
        </div>

        {baseline.voiceBaseline?.exists && (
  <>
    <button
      className="btn-text"
      style={{
        padding: 0,
        border: "none",
        background: "transparent",
      }}
      onClick={() =>
        setShowBaselineDetails(!showBaselineDetails)
      }
    >
      Voice baseline: Available{" "}
      {showBaselineDetails ? "▲" : "▼"}
    </button>

    {showBaselineDetails && (
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div className="muted">
          <strong>Baseline established:</strong>{" "}
          {formatDateTime(
            baseline.voiceBaseline.latestBaselineAt
          )}
        </div>

        <div className="muted">
          <strong>Protocol:</strong>{" "}
          {baseline.voiceBaseline.protocol ||
            "voice-baseline-v2-en"}
        </div>

        <div style={{ marginTop: 10 }}>
          <strong>Tasks completed</strong>

          <div className="muted">
            ✓ Standardized reading
          </div>

          <div className="muted">
            ✓ Guided speech
          </div>

          <div className="muted">
            ✓ Sustained vowel
          </div>

          <div className="muted">
            ✓ Counting task
          </div>
        </div>

       <div
  style={{
    marginTop: 10,
    fontWeight: 600,
  }}
>
  Ready for longitudinal comparison
</div>

{baseline.voiceFeatures && (
  <div
    style={{
      marginTop: 16,
      paddingTop: 12,
      borderTop: "1px solid #E5E7EB",
    }}
  >
    <div
      style={{
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      Voice Feature Metadata
    </div>

    <div className="muted">
      <strong>Feature files:</strong>{" "}
      {baseline.voiceFeatures.count ?? 0}
    </div>

    <div className="muted">
  <strong>Latest file:</strong>{" "}
  {baseline.voiceFeatures.latest?.key
    ? baseline.voiceFeatures.latest.key.split("/").pop()
    : "Not available"}
</div>

<div className="muted">
  <strong>Latest extracted:</strong>{" "}
  {baseline.voiceFeatures.latest?.lastModified
    ? formatDateTime(baseline.voiceFeatures.latest.lastModified)
    : "Not available"}
</div>

{voiceDeviation && (
  <div
    style={{
      marginTop: 16,
      padding: 12,
      border: "1px solid #E5E7EB",
      borderRadius: 10,
      background: "#F9FAFB",
    }}
  >
    <div
      style={{
        fontWeight: 700,
        marginBottom: 4,
      }}
    >
      Voice Deviation Intelligence
    </div>

    <div className="muted" style={{ marginBottom: 8 }}>
      Compared to personal baseline
    </div>

    <div className="muted">
      <strong>Overall deviation:</strong>{" "}
      {titleCase(voiceDeviation.deviationLevel)}
    </div>

    <div className="muted">
      <strong>Compared at:</strong>{" "}
      {voiceDeviation.comparedAt
        ? formatDateTime(voiceDeviation.comparedAt)
        : "Not available"}
    </div>

    {voiceDeviation.features?.map((feature) => (
      <div
        key={feature.metric}
        className="muted"
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 0",
          borderTop: "1px solid #E5E7EB",
          marginTop: 6,
        }}
      >
        <span>{feature.label}</span>

        <span>
          {titleCase(feature.severity)} ·{" "}
          {titleCase(feature.direction)} ·{" "}
          {formatPercent(feature.percentChange)}
        </span>
      </div>
    ))}
  </div>
)}
  </div>
)}
      </div>
    )}
  </>
)}
      </>
    )}
  </div>
</section> 
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
              No wearable connected.
              <span className="muted-inline">
                {" "}Voice-only monitoring active
              </span>
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
function getPatientAge(patient) {
  if (patient.age) return patient.age;

  if (patient.dob) {
    return Math.floor(
      (Date.now() - new Date(patient.dob)) / 31557600000
    );
  }

  return null;
}
