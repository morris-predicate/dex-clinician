import React, { useEffect, useMemo, useState } from "react";
import { fetchOpenDxReasoningLedgers } from "../api.js";

export default function OpenDxExplainabilityPanel({
  patientId,
  sessionId,
  clinicianKey,
  clinicId,
}) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(Boolean(patientId || sessionId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLedger() {
      if (!patientId && !sessionId) {
        setLedger(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchOpenDxReasoningLedgers({
          patientId,
          sessionId,
          clinicianKey,
          clinicId,
        });

        if (!cancelled) {
          setLedger(normalizeLedger(data));
        }
      } catch (err) {
        if (!cancelled) {
          setLedger(null);
          setError(err.message || "Unable to load OpenDx reasoning ledger.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLedger();

    return () => {
      cancelled = true;
    };
  }, [patientId, sessionId, clinicianKey, clinicId]);

  const sections = useMemo(() => getLedgerSections(ledger), [ledger]);

  return (
    <section className="detail-section opendx-explainability-panel">
      <div className="detail-section-title">OpenDx Explainability</div>
      <div className="detail-card">
        {loading ? (
          <div className="empty-state-small">Loading OpenDx reasoning ledger…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : !ledger ? (
          <div className="empty-state-small">
            No OpenDx reasoning ledger is available for this interaction yet.
          </div>
        ) : (
          <>
            <div className="opendx-ledger-meta">
              <span>{formatTimestamp(ledger.generatedAt)}</span>
              {ledger.reasoningVersion && <span>Version {ledger.reasoningVersion}</span>}
            </div>

            <div className="opendx-ledger-grid">
              {sections.map((section) => (
                <LedgerSection
                  key={section.title}
                  title={section.title}
                  items={section.items}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function LedgerSection({ title, items }) {
  return (
    <div className="opendx-ledger-section">
      <div className="opendx-ledger-section-title">{title}</div>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{formatLedgerItem(item)}</li>
          ))}
        </ul>
      ) : (
        <div className="empty-state-small">No entries recorded.</div>
      )}
    </div>
  );
}

function normalizeLedger(data) {
  const candidate = Array.isArray(data)
    ? data[0]
    : Array.isArray(data?.ledgers)
    ? data.ledgers[0]
    : Array.isArray(data?.reasoningLedgers)
    ? data.reasoningLedgers[0]
    : Array.isArray(data?.items)
    ? data.items[0]
    : data?.ledger || data?.reasoningLedger || data;

  if (!candidate || typeof candidate !== "object") return null;

  return {
    capabilitiesUsed:
      candidate.capabilitiesUsed ||
      candidate.capabilities ||
      candidate.evidenceUsed?.capabilities ||
      [],
    longitudinalFindings:
      candidate.longitudinalFindings ||
      candidate.findings?.longitudinal ||
      [],
    signalComparisons:
      candidate.signalComparisons ||
      candidate.comparisons?.signals ||
      [],
    baselineComparisons:
      candidate.baselineComparisons ||
      candidate.comparisons?.baseline ||
      [],
    conversationFindings:
      candidate.conversationFindings ||
      candidate.findings?.conversation ||
      [],
    unresolvedQuestions:
      candidate.unresolvedQuestions ||
      candidate.questions ||
      [],
    provenanceSources:
      candidate.provenanceSources ||
      candidate.provenance ||
      candidate.sources ||
      [],
    generatedAt: candidate.generatedAt || candidate.createdAt || candidate.timestamp,
    reasoningVersion:
      candidate.reasoningVersion ||
      candidate.version ||
      candidate.openDxReasoningVersion,
  };
}

function getLedgerSections(ledger) {
  if (!ledger) return [];

  return [
    { title: "Evidence used", items: ledger.capabilitiesUsed },
    { title: "Longitudinal findings", items: ledger.longitudinalFindings },
    { title: "Signal comparisons", items: ledger.signalComparisons },
    { title: "Baseline comparisons", items: ledger.baselineComparisons },
    { title: "Conversation findings", items: ledger.conversationFindings },
    { title: "Unresolved questions", items: ledger.unresolvedQuestions },
    { title: "Provenance", items: ledger.provenanceSources },
  ];
}

function formatLedgerItem(item) {
  if (item === null || item === undefined) return "Not available";
  if (typeof item === "string" || typeof item === "number") return String(item);

  if (Array.isArray(item)) {
    return item.map(formatLedgerItem).join(", ");
  }

  if (typeof item === "object") {
    return (
      item.label ||
      item.name ||
      item.title ||
      item.summary ||
      item.description ||
      item.source ||
      Object.entries(item)
        .map(([key, value]) => `${formatKey(key)}: ${formatLedgerItem(value)}`)
        .join("; ")
    );
  }

  return String(item);
}

function formatKey(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimestamp(value) {
  if (!value) return "Generated time unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `Generated ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
