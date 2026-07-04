import React, { useEffect, useMemo, useState } from "react";
import { fetchChatSessionEvents } from "../api.js";
import OpenDxInteractionTracePanel from "./OpenDxInteractionTracePanel.jsx";

const DISPLAY_ROLES = new Set(["user", "patient", "assistant", "milo"]);

export default function AskMiloSessionEventsPanel({
  patientId,
  subjectUid,
  sessionId,
  clinicianKey,
  clinicId,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(Boolean(patientId || subjectUid || sessionId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      if (!patientId && !subjectUid && !sessionId) {
        setEvents([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchChatSessionEvents({
          patientId,
          subjectUid,
          sessionId,
          clinicianKey,
          clinicId,
        });

        if (!cancelled) setEvents(normalizeEvents(data));
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(err.message || "Unable to load Ask MILO session events.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [patientId, subjectUid, sessionId, clinicianKey, clinicId]);

  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => DISPLAY_ROLES.has(normalizeRole(event.role)))
        .sort(compareEvents),
    [events]
  );

  return (
    <section className="detail-section ask-milo-session-events-panel">
      <div className="detail-section-title">Ask MILO session events</div>
      <div className="detail-card">
        {loading ? (
          <div className="empty-state-small">Loading Ask MILO session events…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : visibleEvents.length === 0 ? (
          <div className="empty-state-small">
            No Ask MILO session events are available for this session yet.
          </div>
        ) : (
          <div className="ask-milo-events-list">
            {visibleEvents.map((event, index) => (
              <article className="ask-milo-event" key={event.id || index}>
                <div className="ask-milo-event-header">
                  <span>{formatRole(event.role)}</span>
                  <span>{formatTimestamp(event.timestamp)}</span>
                </div>

                <div className="ask-milo-event-content">
                  {event.content || "No event content recorded."}
                </div>

                <div className="ask-milo-event-references">
                  {event.interactionId && (
                    <span>Interaction {event.interactionId}</span>
                  )}
                  {event.reasoningLedgerId && (
                    <span>Reasoning ledger {event.reasoningLedgerId}</span>
                  )}
                  {event.careTeamUpdateId && (
                    <span>Care-team update {event.careTeamUpdateId}</span>
                  )}
                </div>

                {event.interactionId && (
                  <OpenDxInteractionTracePanel
                    patientId={patientId}
                    subjectUid={subjectUid}
                    sessionId={sessionId}
                    interactionId={event.interactionId}
                    clinicianKey={clinicianKey}
                    clinicId={clinicId}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeEvents(data) {
  const events = Array.isArray(data)
    ? data
    : Array.isArray(data?.events)
    ? data.events
    : Array.isArray(data?.sessionEvents)
    ? data.sessionEvents
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return events.map((event, index) => ({
    id: event.id || event.eventId || event.messageId || `${event.role || "event"}-${index}`,
    role: event.role || event.actor || event.type,
    content:
      event.content ||
      event.text ||
      event.message ||
      event.body ||
      event.payload?.content ||
      event.payload?.text,
    timestamp:
      event.timestamp ||
      event.createdAt ||
      event.capturedAt ||
      event.occurredAt,
    sequence: event.sequence || event.sequenceNumber || event.turnIndex || index,
    interactionId: event.interactionId || event.interaction_id,
    reasoningLedgerId: event.reasoningLedgerId || event.reasoning_ledger_id,
    careTeamUpdateId: event.careTeamUpdateId || event.care_team_update_id,
  }));
}

function compareEvents(a, b) {
  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : NaN;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : NaN;

  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }

  return Number(a.sequence || 0) - Number(b.sequence || 0);
}

function normalizeRole(role) {
  return String(role || "").toLowerCase();
}

function formatRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === "user" || normalized === "patient") return "Patient";
  if (normalized === "assistant" || normalized === "milo") return "MILO";
  return "Interaction event";
}

function formatTimestamp(value) {
  if (!value) return "Timestamp unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
