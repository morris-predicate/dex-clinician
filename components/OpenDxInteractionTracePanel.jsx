import React, { useEffect, useState } from "react";
import { fetchOpenDxInteractionTrace } from "../api.js";

export default function OpenDxInteractionTracePanel({
  patientId,
  subjectUid,
  sessionId,
  interactionId,
  clinicianKey,
  clinicId,
}) {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(Boolean(interactionId || sessionId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTrace() {
      if (!patientId && !subjectUid && !sessionId && !interactionId) {
        setTrace(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchOpenDxInteractionTrace({
          patientId,
          subjectUid,
          sessionId,
          interactionId,
          clinicianKey,
          clinicId,
        });

        if (!cancelled) setTrace(normalizeTrace(data));
      } catch (err) {
        if (!cancelled) {
          setTrace(null);
          setError(err.message || "Unable to load OpenDx interaction trace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTrace();

    return () => {
      cancelled = true;
    };
  }, [patientId, subjectUid, sessionId, interactionId, clinicianKey, clinicId]);

  return (
    <section className="opendx-interaction-trace-panel">
      <div className="opendx-trace-title">OpenDx interaction trace</div>
      <div className="opendx-trace-card">
        {loading ? (
          <div className="empty-state-small">Loading OpenDx interaction trace…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : !trace ? (
          <div className="empty-state-small">
            No OpenDx interaction trace is available for this interaction yet.
          </div>
        ) : (
          <>
            <div className="opendx-trace-summary">
              <div>
                <div className="opendx-trace-interaction">
                  Interaction {trace.interactionId || interactionId || "unavailable"}
                </div>
                <div className="opendx-trace-muted">
                  Trace {trace.traceComplete ? "complete" : "needs verification"}
                </div>
              </div>
              <span className={trace.traceComplete ? "opendx-trace-status complete" : "opendx-trace-status partial"}>
                {trace.traceComplete ? "Complete" : "Needs verification"}
              </span>
            </div>

            {trace.missingArtifacts.length > 0 && (
              <div className="opendx-trace-missing">
                <div className="opendx-trace-subtitle">Missing artifacts</div>
                <ul>
                  {trace.missingArtifacts.map((artifact) => (
                    <li key={artifact}>{artifact}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="opendx-trace-grid">
              <TraceMetric label="Chat events" value={trace.chatEventCount} />
              <TraceMetric
                label="Reasoning ledger"
                value={trace.reasoningLedgerPresent ? "Present" : "Missing"}
              />
              <TraceMetric
                label="Longitudinal observations"
                value={trace.longitudinalObservationCount}
              />
              <TraceMetric
                label="Care-team update"
                value={trace.careTeamUpdatePresent ? "Present" : "Missing"}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function TraceMetric({ label, value }) {
  return (
    <div className="opendx-trace-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function normalizeTrace(data) {
  const source = data?.trace || data?.interactionTrace || data;
  if (!source || typeof source !== "object") return null;

  const missingArtifacts =
    source.missingArtifacts ||
    source.missing ||
    source.artifacts?.missing ||
    [];

  return {
    interactionId: source.interactionId || source.interaction_id,
    traceComplete: Boolean(source.traceComplete ?? source.complete),
    missingArtifacts: Array.isArray(missingArtifacts)
      ? missingArtifacts.map(formatArtifact)
      : [formatArtifact(missingArtifacts)],
    chatEventCount:
      source.chatEventCount ??
      source.chatEventsCount ??
      source.chatEvents?.length ??
      source.events?.length ??
      0,
    reasoningLedgerPresent: Boolean(
      source.reasoningLedgerPresent ??
        source.reasoningLedger?.present ??
        source.reasoningLedgerId
    ),
    longitudinalObservationCount:
      source.longitudinalObservationCount ??
      source.longitudinalObservationsCount ??
      source.longitudinalObservations?.length ??
      0,
    careTeamUpdatePresent: Boolean(
      source.careTeamUpdatePresent ??
        source.careTeamUpdate?.present ??
        source.careTeamUpdateId
    ),
  };
}

function formatArtifact(value) {
  if (value === null || value === undefined) return "Unknown artifact";
  if (typeof value === "string") return formatLabel(value);

  return (
    value.label ||
    value.name ||
    value.type ||
    value.artifact ||
    "Unknown artifact"
  );
}

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
