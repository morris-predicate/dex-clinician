import React, { useEffect, useMemo, useState } from "react";
import { fetchInternalMonitoringEvents } from "../api.js";
import { getPatientAccessErrorMessage } from "../patientAccess.js";

const UNSAFE_DETAIL_KEYS = [
  "address",
  "authorization",
  "body",
  "completion",
  "content",
  "credential",
  "dob",
  "email",
  "fullName",
  "messageBody",
  "messages",
  "mrn",
  "name",
  "password",
  "patientName",
  "phone",
  "prompt",
  "raw",
  "rawPayload",
  "response",
  "secret",
  "ssn",
  "text",
  "token",
  "transcript",
];

export default function MonitoringEventOperationsPanel({
  clinicianKey,
  clinicId,
  subsystem,
  severity,
  outcome,
  patientId,
  subjectUid,
  sessionId,
  limit = 25,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchInternalMonitoringEvents({
          subsystem,
          severity,
          outcome,
          patientId,
          subjectUid,
          sessionId,
          limit,
          clinicianKey,
          clinicId,
        });

        if (!cancelled) setEvents(normalizeEvents(data));
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(
            getPatientAccessErrorMessage(
              err,
              "Unable to load internal monitoring events."
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [
    subsystem,
    severity,
    outcome,
    patientId,
    subjectUid,
    sessionId,
    limit,
    clinicianKey,
    clinicId,
  ]);

  const sortedEvents = useMemo(() => [...events].sort(compareCreatedAtDesc), [events]);

  return (
    <section
      className="monitoring-events-section"
      aria-labelledby="monitoring-events-title"
    >
      <div className="detail-section-title" id="monitoring-events-title">
        Internal Monitoring Events
      </div>

      <div className="monitoring-events-card">
        {loading ? (
          <div className="empty-state-small">Loading internal monitoring events…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : sortedEvents.length === 0 ? (
          <div className="empty-state-small">
            No internal monitoring events are available yet.
          </div>
        ) : (
          <div className="monitoring-events-list">
            {sortedEvents.map((event, index) => (
              <article
                className="monitoring-event"
                key={event.id || `${event.eventType}-${index}`}
              >
                <div className="monitoring-event-header">
                  <div>
                    <div className="monitoring-event-title">
                      {event.eventType || "Monitoring event"}
                    </div>
                    <div className="monitoring-event-meta">
                      {event.subsystem || "Subsystem unavailable"} ·{" "}
                      {formatTimestamp(event.createdAt)}
                    </div>
                  </div>
                  <div className="monitoring-event-badges">
                    <span className={getSeverityClassName(event.severity)}>
                      {formatLabel(event.severity || "severity unavailable")}
                    </span>
                    <span className={getOutcomeClassName(event.outcome)}>
                      {formatLabel(event.outcome || "outcome unavailable")}
                    </span>
                  </div>
                </div>

                <div className="monitoring-event-resource">
                  {event.resourceType || "Resource"}: {event.resourceId || "unavailable"}
                </div>

                <SafeDetailSummary detail={event.detail} />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SafeDetailSummary({ detail }) {
  const entries = getSafeDetailEntries(detail);

  return (
    <div className="monitoring-event-detail" aria-label="Safe monitoring detail">
      {entries.length === 0 ? (
        <div className="monitoring-event-detail-row">
          No safe detail fields available.
        </div>
      ) : (
        entries.map(([key, value]) => (
          <div className="monitoring-event-detail-row" key={key}>
            <strong>{formatLabel(key)}</strong>
            <span>{formatDetailValue(value)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function normalizeEvents(data) {
  const events = Array.isArray(data)
    ? data
    : Array.isArray(data?.events)
    ? data.events
    : Array.isArray(data?.monitoringEvents)
    ? data.monitoringEvents
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return events.map((event, index) => ({
    id: event.id || event.monitoringEventId || event.eventId || `monitoring-event-${index}`,
    eventType: event.eventType || event.type,
    subsystem: event.subsystem || event.service || event.component,
    severity: event.severity || event.level,
    outcome: event.outcome || event.status,
    resourceType: event.resourceType || event.resource?.type,
    resourceId: event.resourceId || event.resource?.id,
    createdAt: event.createdAt || event.timestamp || event.generatedAt,
    detail: event.safeDetail || event.detail || event.details || event.metadata,
  }));
}

function getSafeDetailEntries(detail) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return [];

  return Object.entries(detail)
    .filter(([key]) => !isUnsafeDetailKey(key))
    .filter(([, value]) => value !== null && value !== undefined)
    .filter(([, value]) => isSafeDetailValue(value))
    .slice(0, 6);
}

function isUnsafeDetailKey(key) {
  const normalized = String(key).toLowerCase();
  return UNSAFE_DETAIL_KEYS.some((unsafeKey) =>
    normalized.includes(unsafeKey.toLowerCase())
  );
}

function isSafeDetailValue(value) {
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return true;
  return value && typeof value === "object";
}

function formatDetailValue(value) {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object") return "object";
  return String(value);
}

function compareCreatedAtDesc(a, b) {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
}

function getSeverityClassName(severity) {
  const normalized = String(severity || "").toLowerCase();
  return normalized.includes("critical") || normalized.includes("high")
    ? "monitoring-event-severity critical"
    : "monitoring-event-severity";
}

function getOutcomeClassName(outcome) {
  const normalized = String(outcome || "").toLowerCase();
  return normalized.includes("fail") || normalized.includes("error")
    ? "monitoring-event-outcome failure"
    : "monitoring-event-outcome";
}

function formatTimestamp(value) {
  if (!value) return "Created time unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
