import React from "react";
import { useEffect, useState, useCallback } from "react";
import {
  fetchCareTeamUpdates,
  fetchRoster,
  markCareTeamUpdateReviewed,
} from "./api.js";

const REFRESH_MS = 60_000;

export default function Roster({ clinicId, clinicianKey, onSelectPatient, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [careTeamUpdates, setCareTeamUpdates] = useState([]);
  const [careTeamUpdatesLoading, setCareTeamUpdatesLoading] = useState(true);
  const [careTeamUpdatesError, setCareTeamUpdatesError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [rosterResult, careTeamUpdatesResult] = await Promise.allSettled([
        fetchRoster({ clinicianKey, clinicId }),
        fetchCareTeamUpdates({ clinicianKey, clinicId }),
      ]);

      if (rosterResult.status === "rejected") {
        throw rosterResult.reason;
      }

      const { patients } = rosterResult.value;
      setPatients(patients);
      setError(null);

      if (careTeamUpdatesResult.status === "fulfilled") {
        setCareTeamUpdates(normalizeCareTeamUpdates(careTeamUpdatesResult.value));
        setCareTeamUpdatesError(null);
      } else {
        setCareTeamUpdates([]);
        setCareTeamUpdatesError("Ask MILO care-team updates are unavailable right now.");
      }

      setLastUpdated(new Date());
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setLoading(false);
      setCareTeamUpdatesLoading(false);
    }
  }, [clinicianKey, clinicId, onLogout]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handleMarkCareTeamUpdateReviewed = useCallback(
    async (updateId) => {
      const data = await markCareTeamUpdateReviewed({
        id: updateId,
        clinicianKey,
        clinicId,
      });
      const [reviewedUpdate] = normalizeCareTeamUpdates(data);

      setCareTeamUpdates((current) =>
        current.map((update) =>
          update.id === updateId
            ? {
                ...update,
                ...reviewedUpdate,
                id: reviewedUpdate?.id || update.id,
                status: reviewedUpdate?.status || "reviewed_in_dashboard",
              }
            : update
        )
      );

      return reviewedUpdate;
    },
    [clinicianKey, clinicId]
  );

  const normalizedSearch = search.toLowerCase().trim();

const filtered = patients.filter((p) => {
  if (!normalizedSearch) return true;

  return [
    p.name,
    p.patientId,
    p.subjectUid,
    p.sex,
    p.status,
  ]
    .filter(Boolean)
    .some((value) =>
      String(value).toLowerCase().includes(normalizedSearch)
    );
});

const prioritizedPatients = [...filtered].sort((a, b) => {
  const scoreDelta = computePatientPriority(b) - computePatientPriority(a);

  if (scoreDelta !== 0) return scoreDelta;

  const bTime = b.latestSessionAt ? new Date(b.latestSessionAt).getTime() : 0;
  const aTime = a.latestSessionAt ? new Date(a.latestSessionAt).getTime() : 0;

  return bTime - aTime;
});

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
    placeholder="Search by name, patient ID, or subject ID…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
</div>

<div className="roster-status-legend">
  <span>
    <strong>Review first</strong> meaningful signal changes or convergence
  </span>
  <span>
    <strong>Watch closely</strong> recent session or moderate signal context
  </span>
  <span>
    <strong>Near usual</strong> no noteworthy signal changes detected
  </span>
  <span>
    <strong>Awaiting session</strong> no patient voice session yet
  </span>
</div>

      {error && (
        <div className="banner-error">{error}</div>
      )}

      <CareTeamUpdatesSection
        updates={careTeamUpdates}
        loading={careTeamUpdatesLoading}
        error={careTeamUpdatesError}
        onMarkReviewed={handleMarkCareTeamUpdateReviewed}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          {search ? "No patients match your search." : "No patients enrolled in this clinic yet."}
        </div>
      ) : (
        <div className="patient-list">
  {prioritizedPatients.map((p) => (
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

export function CareTeamUpdatesSection({
  updates,
  loading = false,
  error = null,
  onMarkReviewed,
}) {
  const [reviewingIds, setReviewingIds] = useState([]);
  const [reviewErrors, setReviewErrors] = useState({});

  async function handleMarkReviewed(updateId) {
    if (!onMarkReviewed) return;

    setReviewingIds((ids) => [...ids, updateId]);
    setReviewErrors(({ [updateId]: _removed, ...rest }) => rest);

    try {
      await onMarkReviewed(updateId);
    } catch (err) {
      setReviewErrors((current) => ({
        ...current,
        [updateId]: err.message || "Could not mark this update reviewed.",
      }));
    } finally {
      setReviewingIds((ids) => ids.filter((id) => id !== updateId));
    }
  }

  return (
    <section className="care-team-updates-section" aria-labelledby="care-team-updates-title">
      <div className="detail-section-title" id="care-team-updates-title">
        Ask MILO Care Team Updates
      </div>

      <div className="care-team-updates-card">
        {loading ? (
          <div className="empty-state-small">Loading Ask MILO care-team updates…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : updates.length === 0 ? (
          <div className="empty-state-small">
            No Ask MILO care-team updates are ready for review yet.
          </div>
        ) : (
          <div className="care-team-updates-list">
            {updates.map((update) => (
              <article className="care-team-update" key={update.id}>
                <div className="care-team-update-header">
                  <div>
                    <div className="care-team-update-patient">
                      Patient {update.patientId || "Unknown"}
                    </div>
                    <div className="care-team-update-meta">
                      {update.subjectUid && <>Subject {update.subjectUid}</>}
                      {update.sessionId && (
                        <>
                          {update.subjectUid && " · "}
                          Session {update.sessionId}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="care-team-update-status">
                    <span>{formatCareTeamStatus(update.status)}</span>
                    <span>{formatCareTeamTimestamp(getCareTeamStatusTime(update))}</span>
                  </div>
                </div>

                <div className="care-team-update-body">
                  <div>
                    <div className="care-team-update-label">Trigger message</div>
                    <p>{update.triggerMessage || "No trigger message provided."}</p>
                  </div>

                  <div>
                    <div className="care-team-update-label">Clinician-ready summary draft</div>
                    <p>{update.summaryDraft || "No summary draft provided."}</p>
                  </div>
                </div>

                <div className="care-team-update-delivery">
                  <span>Not sent outside MILO</span>
                  <span>Prepared for clinician dashboard review</span>
                </div>

                {update.status === "dashboard_ready" && onMarkReviewed && (
                  <div className="care-team-update-actions">
                    <button
                      className="btn-secondary-small"
                      type="button"
                      onClick={() => handleMarkReviewed(update.id)}
                      disabled={reviewingIds.includes(update.id)}
                    >
                      {reviewingIds.includes(update.id) ? "Marking reviewed…" : "Mark reviewed"}
                    </button>
                    {reviewErrors[update.id] && (
                      <span className="care-team-update-error">{reviewErrors[update.id]}</span>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeCareTeamUpdates(data) {
  const updates = Array.isArray(data)
    ? data
    : Array.isArray(data?.updates)
    ? data.updates
    : Array.isArray(data?.careTeamUpdates)
    ? data.careTeamUpdates
    : Array.isArray(data?.items)
    ? data.items
    : data?.update
    ? [data.update]
    : data?.careTeamUpdate
    ? [data.careTeamUpdate]
    : data?.id || data?.updateId || data?.careTeamUpdateId
    ? [data]
    : [];

  return updates.map((update, index) => ({
    id:
      update.id ||
      update.updateId ||
      update.careTeamUpdateId ||
      `${update.patientId || update.subjectUid || "care-team-update"}-${update.sessionId || index}`,
    patientId: update.patientId || update.patient_id || update.profileId,
    subjectUid: update.subjectUid || update.subject_uid || update.subjectId,
    sessionId: update.sessionId || update.session_id || update.latestSessionId,
    triggerMessage:
      update.triggerMessage ||
      update.trigger_message ||
      update.message ||
      update.trigger?.message ||
      update.trigger?.text,
    summaryDraft:
      update.summaryDraft ||
      update.clinicianSummaryDraft ||
      update.clinicianReadySummaryDraft ||
      update.summary ||
      update.draft,
    timestamp:
      update.timestamp ||
      update.createdAt ||
      update.updatedAt ||
      update.preparedAt ||
      update.latestSessionAt,
    reviewedAt: update.reviewedAt || update.reviewed_at,
    status: update.status || update.reviewStatus || update.state,
  }));
}

function getAbnormalSignals(patient) {
  const candidates =
    patient.abnormalSignals ||
    patient.signalEvidence ||
    patient.currentSignals ||
    patient.changedSignals ||
    patient.latestSignalEvidence ||
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates.filter(Boolean);
}

function hasConvergentSignals(patient) {
  return (
    Boolean(patient.hasConvergentSignals) ||
    Boolean(patient.signalAlignment?.hasConvergence) ||
    Boolean(patient.convergence) ||
    Boolean(patient.crossDomainConvergence) ||
    Boolean(patient.fusionScore?.crossDomainConvergence)
  );
}

function computePatientPriority(patient) {
  const hasSession = !!patient.latestSessionId;
  const entityCount = (patient.latestEntities || []).length;
  const abnormalSignals = getAbnormalSignals(patient);
  const abnormalCount = abnormalSignals.length;
  const hasConvergence = hasConvergentSignals(patient);

  const sessionBonus = hasSession ? 2 : 0;
  const entityBonus = Math.min(entityCount, 5);
  const abnormalBonus = abnormalCount * 4;
  const convergenceBonus = hasConvergence ? 6 : 0;

  return sessionBonus + entityBonus + abnormalBonus + convergenceBonus;
}

function getReviewStatus(patient) {
  const score = computePatientPriority(patient);

  if (!patient.latestSessionId) {
    return {
      label: "Awaiting session",
      className: "badge badge-pending",
    };
  }

  if (score >= 10) {
    return {
      label: "Review first",
      className: "badge badge-review-now",
    };
  }

  if (score >= 5) {
    return {
      label: "Watch closely",
      className: "badge badge-watch",
    };
  }

  return {
    label: "Near usual",
    className: "badge badge-stable",
  };
}

function getReviewStatusDescription(label) {
  const descriptions = {
    "Review first":
      "Meaningful signal changes or cross-domain convergence may warrant timely review.",
    "Watch closely":
      "Recent session or moderate signal context. Continue review if clinically relevant.",
    "Near usual":
      "No noteworthy signal changes detected from available roster data.",
    "Awaiting session":
      "No patient voice session has been completed yet.",
  };

  return descriptions[label] || "Roster status based on available signal context.";
}

function getSignalChipLabel(signal) {
  const label = signal.label || signal.name || signal.signal || signal.type || "Signal";
  const direction = String(signal.direction || signal.trend || "").toLowerCase();

  if (
    direction.includes("increase") ||
    direction.includes("higher") ||
    direction.includes("up")
  ) {
    return `${label} ↑`;
  }

  if (
    direction.includes("decrease") ||
    direction.includes("lower") ||
    direction.includes("down")
  ) {
    return `${label} ↓`;
  }

  return label;
}

function getPatientLatestVitals(patient) {
  const candidates =
    patient.latestVitals ||
    patient.currentVitals ||
    patient.vitals ||
    patient.vitalsSummary ||
    patient.latestReadings ||
    [];

  if (Array.isArray(candidates)) {
    return candidates;
  }

  if (candidates && typeof candidates === "object") {
    return Object.entries(candidates).map(([type, value]) => ({
      type,
      value:
        value && typeof value === "object"
          ? value.value ?? value.latest ?? value.current
          : value,
      unit: value && typeof value === "object" ? value.unit : undefined,
      trend:
        value && typeof value === "object"
          ? value.trend || value.direction
          : undefined,
      timestamp:
        value && typeof value === "object"
          ? value.timestamp || value.updatedAt || value.observedAt
          : undefined,
      source:
        value && typeof value === "object"
          ? value.source || value.source_device || value.device
          : undefined,
    }));
  }

  return [];
}

function normalizeRosterVitalType(type) {
  if (!type) return "";

  const raw = String(type);
  const lower = raw.toLowerCase();

  const aliases = {
    heart_rate: "heart_rate",
    "heart rate": "heart_rate",
    hr: "heart_rate",
    heartrate: "heart_rate",

    hrv: "hrv_sdnn",
    hrv_sdnn: "hrv_sdnn",
    "heart rate variability": "hrv_sdnn",
    heart_rate_variability: "hrv_sdnn",

    respiratory_rate: "respiratory_rate",
    "respiratory rate": "respiratory_rate",
    rr: "respiratory_rate",

    spo2: "spo2",
    sp_o2: "spo2",
    "spo₂": "spo2",
    "spO₂": "spo2",
    "SpO₂": "spo2",
    oxygen_saturation: "spo2",
    "oxygen saturation": "spo2",

    temperature: "temperature",
    temp: "temperature",
    body_temperature: "temperature",
    wrist_temperature: "temperature",
  };

  return aliases[raw] || aliases[lower] || lower;
}

function getRosterVitalValue(patient, metricType) {
  const vitals = getPatientLatestVitals(patient);
  const normalizedMetric = normalizeRosterVitalType(metricType);

  const direct = vitals.find(
    (v) =>
      normalizeRosterVitalType(
        v.type || v.metric || v.name || v.vitalType || v.parameter
      ) === normalizedMetric
  );

  if (direct) return direct;

  const signal = getAbnormalSignals(patient).find(
    (s) =>
      normalizeRosterVitalType(s.signal || s.type || s.metric || s.label) ===
      normalizedMetric
  );

  if (signal) {
    return {
      type: metricType,
      value: signal.value ?? signal.latestValue ?? signal.currentValue,
      unit: signal.unit,
      trend: signal.direction || signal.trend,
      abnormal: true,
    };
  }

  return null;
}

function getRosterMetricConfig(patient) {
  return [
    {
      id: "heart_rate",
      label: "HR",
      unit: "bpm",
      icon: "♡",
      value: getRosterVitalValue(patient, "heart_rate"),
    },
    {
      id: "hrv_sdnn",
      label: "HRV",
      unit: "ms",
      icon: "⌁",
      value: getRosterVitalValue(patient, "hrv_sdnn"),
    },
    {
      id: "spo2",
      label: "SpO₂",
      unit: "%",
      icon: "≋",
      value: getRosterVitalValue(patient, "spo2"),
    },
    {
      id: "respiratory_rate",
      label: "RR",
      unit: "br/min",
      icon: "≋",
      value: getRosterVitalValue(patient, "respiratory_rate"),
    },
    {
      id: "temperature",
      label: "Temp",
      unit: "°C",
      icon: "°",
      value: getRosterVitalValue(patient, "temperature"),
    },
  ];
}

function formatRosterMetricValue(metric) {
  const raw = metric.value?.value;

  if (raw === null || raw === undefined || raw === "") {
    return "—";
  }

  const n = Number(raw);

  if (!Number.isFinite(n)) {
    return raw;
  }

  if (metric.id === "spo2" && n > 0 && n <= 1) {
    return Math.round(n * 100);
  }

  if (metric.id === "heart_rate" || metric.id === "respiratory_rate") {
    return Math.round(n);
  }

  if (metric.id === "hrv_sdnn" || metric.id === "temperature") {
    return n.toFixed(1).replace(".0", "");
  }

  return n;
}

function getRosterTrendSymbol(metric) {
  const trend = String(metric.value?.trend || "").toLowerCase();

  if (
    trend.includes("increase") ||
    trend.includes("higher") ||
    trend.includes("up")
  ) {
    return "↗";
  }

  if (
    trend.includes("decrease") ||
    trend.includes("lower") ||
    trend.includes("down")
  ) {
    return "↘";
  }

  return "–";
}

function getMetricCardClass(metric) {
  if (metric.value?.abnormal) {
    return "roster-metric-card abnormal";
  }

  const trend = String(metric.value?.trend || "").toLowerCase();

  if (
    trend.includes("increase") ||
    trend.includes("higher") ||
    trend.includes("decrease") ||
    trend.includes("lower") ||
    trend.includes("up") ||
    trend.includes("down")
  ) {
    return "roster-metric-card watch";
  }

  return "roster-metric-card";
}

function getLatestDataTime(patient) {
  const vitals = getPatientLatestVitals(patient);

  const times = [
    patient.latestVitalsAt,
    patient.latestWearableAt,
    patient.latestSessionAt,
    ...vitals.map((v) => v.timestamp || v.updatedAt || v.observedAt),
  ]
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t));

  if (!times.length) return null;

  return formatRelativeDate(new Date(Math.max(...times)).toISOString());
}

function getRosterSources(patient) {
  const sources =
    patient.sources ||
    patient.dataSources ||
    patient.connectedSources ||
    patient.latestSources ||
    [];

  if (Array.isArray(sources) && sources.length > 0) {
    return sources;
  }

  const vitals = getPatientLatestVitals(patient);
  const vitalSources = vitals
    .map((v) => v.source || v.source_device || v.device)
    .filter(Boolean);

  return Array.from(new Set(vitalSources));
}

function formatRosterSourceLabel(source) {
  const value = String(source || "").toLowerCase();

  if (
    value === "health_auto_export" ||
    value === "health-auto-export" ||
    value.includes("apple health")
  ) {
    return "Apple Health";
  }

  if (value.includes("validic")) {
    return "Connected Device";
  }

  return String(source || "Unknown source")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function hasRosterMetricValue(metric) {
  const raw = metric?.value?.value;

  return raw !== null && raw !== undefined && raw !== "";
}
function PatientRow({ patient, onClick }) {
  const hasSession = !!patient.latestSessionId;
  const entityCount = (patient.latestEntities || []).length;
  const lastSession = patient.latestSessionAt
    ? formatRelativeDate(patient.latestSessionAt)
    : null;

  const abnormalSignals = getAbnormalSignals(patient);
  const reviewStatus = getReviewStatus(patient);
  const hasConvergence = hasConvergentSignals(patient);
  const metrics = getRosterMetricConfig(patient);
  const latestDataTime = getLatestDataTime(patient);
  const sources = getRosterSources(patient);

  return (
    <button className="patient-row patient-card-row" onClick={onClick}>
      <div className="patient-card-topline">
        <div>
          <div className="patient-row-name patient-card-name">
            {patient.name || "Unnamed patient"}

            <span
  className={reviewStatus.className}
  title={getReviewStatusDescription(reviewStatus.label)}
>
  {reviewStatus.label}
</span>

            {hasConvergence && (
              <span className="badge badge-convergence">
                Voice + vitals
              </span>
            )}
          </div>

          <div className="patient-row-meta">
            {patient.dob && <>DOB {patient.dob}</>}
            {patient.sex && <> · {patient.sex}</>}

            {patient.subjectUid && (
              <>
                {" "}· Subject {patient.subjectUid.slice(-6)}
              </>
            )}

            {patient.patientId && (
              <>
                {" "}· Profile {patient.patientId.slice(-6)}
              </>
            )}

            {patient.status && <> · {patient.status}</>}
          </div>
        </div>

        <div className="patient-card-recency">
          {latestDataTime || lastSession || "No session yet"}
          <span className="patient-row-chevron">›</span>
        </div>
      </div>

      <div className="roster-metric-grid">
        {metrics.map((metric) => (
          <div key={metric.id} className={getMetricCardClass(metric)}>
            <div className="roster-metric-label">
              <span className="roster-metric-icon">{metric.icon}</span>
              {metric.label}
            </div>

            <div
  className={
    hasRosterMetricValue(metric)
      ? "roster-metric-value"
      : "roster-metric-value no-data"
  }
>
  {hasRosterMetricValue(metric) ? (
    <>
      {formatRosterMetricValue(metric)}
      <span>{metric.unit}</span>
      <em>{getRosterTrendSymbol(metric)}</em>
    </>
  ) : (
    <span>No data</span>
  )}
</div>
          </div>
        ))}
      </div>

      <div className="patient-card-voice-row">
        <div className="patient-card-voice-left">
          <span className="voice-dot">⌕</span>

          {hasSession ? (
            <>
              Latest voice entry:
              <strong>{lastSession || "recent"}</strong>
            </>
          ) : (
            <>
              Voice entry:
              <strong>not yet available</strong>
            </>
          )}
        </div>

        <div className="patient-card-voice-right">
          {entityCount > 0 ? (
            <>
              {entityCount} {entityCount === 1 ? "entity" : "entities"}
            </>
          ) : (
            <>No symptom entities yet</>
          )}
        </div>
      </div>

      {abnormalSignals.length > 0 && (
        <div className="patient-row-signal-chips">
          {abnormalSignals.slice(0, 4).map((signal, index) => (
            <span
              key={`${signal.signal || signal.label || signal.type || "signal"}-${index}`}
              className="patient-signal-chip"
            >
              {getSignalChipLabel(signal)}
            </span>
          ))}

          {abnormalSignals.length > 4 && (
            <span className="patient-signal-chip muted-chip">
              +{abnormalSignals.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className="patient-card-footer">
        <div>
          Sources:
          {sources.length > 0 ? (
  sources.slice(0, 4).map((source) => (
    <span key={source} className="source-pill">
      {formatRosterSourceLabel(source)}
    </span>
  ))
) : (
  <span className="source-pill muted-source">
    Not connected
  </span>
)}
        </div>

        {hasSession && (
  <div className="patient-row-priority-score">
    Sorted by signal context
  </div>
)}
      </div>
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

function formatCareTeamTimestamp(value) {
  if (!value) return "Timestamp unavailable";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCareTeamStatus(status) {
  const labels = {
    dashboard_ready: "Prepared for clinician dashboard review",
    reviewed_in_dashboard: "Reviewed in dashboard",
  };

  return labels[status] || status || "Ready for review";
}

function getCareTeamStatusTime(update) {
  if (update.status === "reviewed_in_dashboard") {
    return update.reviewedAt || update.timestamp;
  }

  return update.timestamp;
}
