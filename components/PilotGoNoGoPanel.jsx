import React, { useEffect, useMemo, useState } from "react";
import { fetchPilotGoNoGoChecklist } from "../api.js";

const STATUS_LABELS = {
  go: "Go",
  no_go: "No-go",
  noGo: "No-go",
  needs_verification: "Needs verification",
  needsVerification: "Needs verification",
};

export default function PilotGoNoGoPanel({ clinicianKey, clinicId }) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChecklist() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchPilotGoNoGoChecklist({ clinicianKey, clinicId });
        if (!cancelled) setChecklist(normalizeChecklist(data));
      } catch (err) {
        if (!cancelled) {
          setChecklist(null);
          setError(err.message || "Unable to load pilot go/no-go checklist.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChecklist();

    return () => {
      cancelled = true;
    };
  }, [clinicianKey, clinicId]);

  const groupedItems = useMemo(
    () => groupItemsByCategory(checklist?.requiredLaunchItems || []),
    [checklist]
  );

  return (
    <section className="pilot-go-no-go-section" aria-labelledby="pilot-go-no-go-title">
      <div className="detail-section-title" id="pilot-go-no-go-title">
        Pilot go/no-go checklist
      </div>

      <div className="pilot-go-no-go-card">
        {loading ? (
          <div className="empty-state-small">Loading pilot go/no-go checklist…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : !checklist ? (
          <div className="empty-state-small">Pilot go/no-go checklist is unavailable.</div>
        ) : (
          <>
            <div className="pilot-go-no-go-summary">
              <div>
                <div className="pilot-go-no-go-decision">
                  {formatDecision(checklist.decision)}
                </div>
                <div className="pilot-go-no-go-generated">
                  {formatGeneratedAt(checklist.generatedAt)}
                </div>
              </div>
              <span className={getDecisionClassName(checklist.decision)}>
                {checklist.decision === "go" ? "Go" : "Not approved"}
              </span>
            </div>

            {checklist.decision !== "go" && (
              <div className="pilot-go-no-go-notice">
                Pilot launch is not approved yet.
              </div>
            )}

            <div className="pilot-go-no-go-categories">
              {checklist.categories.map((category) => (
                <div className="pilot-go-no-go-category" key={category.name}>
                  <span>{category.name}</span>
                  <strong>{formatItemStatus(category.status)}</strong>
                </div>
              ))}
            </div>

            <div className="pilot-go-no-go-items">
              {groupedItems.map((group) => (
                <div className="pilot-go-no-go-item-group" key={group.category}>
                  <div className="pilot-go-no-go-subtitle">{group.category}</div>
                  <ul>
                    {group.items.map((item, index) => (
                      <li key={`${group.category}-${index}`}>
                        <span>{formatItem(item)}</span>
                        <strong>{formatItemStatus(getItemStatus(item))}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {checklist.notes.length > 0 && (
              <div className="pilot-go-no-go-notes">
                <div className="pilot-go-no-go-subtitle">Notes</div>
                <ul>
                  {checklist.notes.map((note, index) => (
                    <li key={`note-${index}`}>{formatItem(note)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function normalizeChecklist(data) {
  const source = data?.checklist || data?.goNoGo || data;
  if (!source || typeof source !== "object") return null;

  return {
    decision: source.decision || source.status || "not_ready",
    generatedAt: source.generatedAt || source.createdAt || source.timestamp,
    categories: normalizeCategories(source.categories || source.categoryStatuses),
    requiredLaunchItems: normalizeItems(
      source.requiredLaunchItems ||
        source.launchItems ||
        source.items ||
        source.requirements
    ),
    notes: normalizeList(source.notes || source.summaryNotes),
  };
}

function normalizeCategories(value) {
  if (Array.isArray(value)) {
    return value.map((category) => ({
      name: category.name || category.category || category.label || "Launch readiness",
      status: category.status || category.state || category.decision,
    }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, status]) => ({
      name: formatLabel(name),
      status: typeof status === "object" ? status.status || status.state : status,
    }));
  }

  return [];
}

function normalizeItems(value) {
  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([category, items]) =>
      normalizeList(items).map((item) =>
        typeof item === "object"
          ? { category: formatLabel(category), ...item }
          : { category: formatLabel(category), label: item }
      )
    );
  }

  return [];
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function groupItemsByCategory(items) {
  const groups = new Map();

  items.forEach((item) => {
    const category =
      item?.category ||
      item?.group ||
      item?.area ||
      item?.domain ||
      "Required launch items";
    const label = formatLabel(category);

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });

  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }));
}

function formatDecision(decision) {
  if (decision === "go") return "Launch decision: go";
  if (decision === "not_ready") return "Launch decision: not ready";
  return `Launch decision: ${formatLabel(decision || "not_ready")}`;
}

function formatItemStatus(status) {
  if (!status) return "Needs verification";

  const key = String(status).trim();
  return STATUS_LABELS[key] || STATUS_LABELS[key.toLowerCase()] || formatLabel(key);
}

function getDecisionClassName(decision) {
  return decision === "go"
    ? "pilot-go-no-go-status go"
    : "pilot-go-no-go-status not-approved";
}

function getItemStatus(item) {
  return item && typeof item === "object"
    ? item.status || item.state || item.decision
    : null;
}

function formatItem(item) {
  if (item === null || item === undefined) return "Not available";
  if (typeof item === "string" || typeof item === "number") return String(item);

  return (
    item.label ||
    item.name ||
    item.title ||
    item.summary ||
    item.description ||
    "Required launch item"
  );
}

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatGeneratedAt(value) {
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
