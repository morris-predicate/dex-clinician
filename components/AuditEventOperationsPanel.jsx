import React, { useEffect, useMemo, useState } from "react";
import { fetchInternalAuditEvents } from "../api.js";
import { getPatientAccessErrorMessage } from "../patientAccess.js";

const UNSAFE_METADATA_KEYS = [
  "address",
  "authorization",
  "body",
  "completion",
  "content",
  "dob",
  "email",
  "fullName",
  "message",
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

export default function AuditEventOperationsPanel({
  clinicianKey,
  clinicId,
  patientId,
  subjectUid,
  sessionId,
  eventType,
  outcome,
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
        const data = await fetchInternalAuditEvents({
          patientId,
          subjectUid,
          sessionId,
          eventType,
          outcome,
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
              "Unable to load internal audit events."
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
  }, [patientId, subjectUid, sessionId, eventType, outcome, limit, clinicianKey, clinicId]);

  const sortedEvents = useMemo(() => [...events].sort(compareCreatedAtDesc), [events]);

  return (
    <section className="audit-events-section" aria-labelledby="audit-events-title">
      <div className="detail-section-title" id="audit-events-title">
        Internal Audit Events
      </div>

      <div className="audit-events-card">
        <div className="audit-events-note">
          Internal operations view. Metadata is sanitized and may omit PHI-heavy details.
        </div>

        {loading ? (
          <div className="empty-state-small">Loading internal audit events…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : sortedEvents.length === 0 ? (
          <div className="empty-state-small">No internal audit events are available yet.</div>
        ) : (
          <div className="audit-events-list">
            {sortedEvents.map((event, index) => (
              <article className="audit-event" key={event.id || `${event.eventType}-${index}`}>
                <div className="audit-event-header">
                  <div>
                    <div className="audit-event-title">
                      {event.eventType || "Audit event"}
                    </div>
                    <div className="audit-event-meta">
                      {event.actorType || "Actor unavailable"} · {formatTimestamp(event.createdAt)}
                    </div>
                  </div>
                  <span className={getOutcomeClassName(event.outcome)}>
                    {formatLabel(event.outcome || "outcome unavailable")}
                  </span>
                </div>

                <div className="audit-event-resource">
                  {event.resourceType || "Resource"}: {event.resourceId || "unavailable"}
                </div>

                <div className="audit-event-trace">
                  {event.patientId && <span>Patient {event.patientId}</span>}
                  {event.subjectUid && <span>Subject {event.subjectUid}</span>}
                  {event.sessionId && <span>Session {event.sessionId}</span>}
                </div>

                <SafeMetadataSummary metadata={event.metadata} />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SafeMetadataSummary({ metadata }) {
  const entries = getSafeMetadataEntries(metadata);

  return (
    <div className="audit-event-metadata" aria-label="Sanitized metadata summary">
      {entries.length === 0 ? (
        <div className="audit-event-metadata-row">
          No sanitized metadata fields available.
        </div>
      ) : (
        entries.map(([key, value]) => (
          <div className="audit-event-metadata-row" key={key}>
            <strong>{formatLabel(key)}</strong>
            <span>{formatMetadataValue(value)}</span>
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
    : Array.isArray(data?.auditEvents)
    ? data.auditEvents
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return events.map((event, index) => ({
    id: event.id || event.auditEventId || event.eventId || `audit-event-${index}`,
    eventType: event.eventType || event.type,
    actorType: event.actorType || event.actor,
    outcome: event.outcome || event.status,
    resourceType: event.resourceType || event.resource?.type,
    resourceId: event.resourceId || event.resource?.id,
    patientId: event.patientId,
    subjectUid: event.subjectUid,
    sessionId: event.sessionId,
    createdAt: event.createdAt || event.timestamp || event.generatedAt,
    metadata: event.safeMetadata || event.metadata || event.details,
  }));
}

function getSafeMetadataEntries(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];

  return Object.entries(metadata)
    .filter(([key]) => !isUnsafeMetadataKey(key))
    .filter(([, value]) => value !== null && value !== undefined)
    .filter(([, value]) => isSafeMetadataValue(value))
    .slice(0, 6);
}

function isUnsafeMetadataKey(key) {
  const normalized = String(key).toLowerCase();
  return UNSAFE_METADATA_KEYS.some((unsafeKey) =>
    normalized.includes(unsafeKey.toLowerCase())
  );
}

function isSafeMetadataValue(value) {
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return true;
  return value && typeof value === "object";
}

function formatMetadataValue(value) {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object") return "object";
  return String(value);
}

function compareCreatedAtDesc(a, b) {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
}

function getOutcomeClassName(outcome) {
  const normalized = String(outcome || "").toLowerCase();
  return normalized.includes("fail") || normalized.includes("error")
    ? "audit-event-outcome failure"
    : "audit-event-outcome";
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
