import React, { useEffect, useMemo, useState } from "react";
import { fetchPilotReadyV1Readiness } from "../api.js";

const STATUS_LABELS = {
  ready: "Complete",
  complete: "Complete",
  partial: "Partial",
  needs_verification: "Needs verification",
  needsVerification: "Needs verification",
  blocked: "Needs verification",
  incomplete: "Needs verification",
};

export default function PilotReadyV1ReadinessPanel({ clinicianKey, clinicId }) {
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReadiness() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchPilotReadyV1Readiness({ clinicianKey, clinicId });
        if (!cancelled) setReadiness(normalizeReadiness(data));
      } catch (err) {
        if (!cancelled) {
          setReadiness(null);
          setError(err.message || "Unable to load Pilot-Ready v1 status.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [clinicianKey, clinicId]);

  const groupedItems = useMemo(
    () => groupItemsByCategory(readiness?.items || []),
    [readiness]
  );

  return (
    <section className="pilot-readiness-section" aria-labelledby="pilot-readiness-title">
      <div className="detail-section-title" id="pilot-readiness-title">
        Pilot-Ready v1 status
      </div>

      <div className="pilot-readiness-card">
        {loading ? (
          <div className="empty-state-small">Loading Pilot-Ready v1 status…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : !readiness ? (
          <div className="empty-state-small">Pilot-Ready v1 status is unavailable.</div>
        ) : (
          <>
            <div className="pilot-readiness-summary">
              <div>
                <div className="pilot-readiness-milestone">
                  {readiness.milestone || "Pilot-Ready v1"}
                </div>
                <div className="pilot-readiness-generated">
                  {formatGeneratedAt(readiness.generatedAt)}
                </div>
              </div>
              <span className={getStatusClassName(readiness.overallStatus)}>
                {formatStatus(readiness.overallStatus)}
              </span>
            </div>

            <div className="pilot-readiness-categories">
              {readiness.categories.map((category) => (
                <div className="pilot-readiness-category" key={category.name}>
                  <span>{category.name}</span>
                  <strong>{formatStatus(category.status)}</strong>
                </div>
              ))}
            </div>

            {readiness.blockers.length > 0 && (
              <div className="pilot-readiness-blockers">
                <div className="pilot-readiness-subtitle">Blockers</div>
                <ul>
                  {readiness.blockers.map((blocker, index) => (
                    <li key={`blocker-${index}`}>{formatItem(blocker)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pilot-readiness-items">
              {groupedItems.map((group) => (
                <div className="pilot-readiness-item-group" key={group.category}>
                  <div className="pilot-readiness-subtitle">{group.category}</div>
                  <ul>
                    {group.items.map((item, index) => (
                      <li key={`${group.category}-${index}`}>
                        <span>{formatItem(item)}</span>
                        {getItemStatus(item) && (
                          <strong>{formatStatus(getItemStatus(item))}</strong>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function normalizeReadiness(data) {
  const source = data?.readiness || data?.pilotReadyV1 || data;
  if (!source || typeof source !== "object") return null;

  const categories = normalizeCategories(source.categoryStatuses || source.categories);
  const items = normalizeItems(source.items || source.checks || source.requirements);

  return {
    milestone: source.milestone || source.name || "Pilot-Ready v1",
    overallStatus: source.overallStatus || source.status || source.readinessStatus,
    generatedAt: source.generatedAt || source.createdAt || source.timestamp,
    categories,
    blockers: normalizeList(source.blockers || source.openBlockers),
    items,
  };
}

function normalizeCategories(value) {
  if (Array.isArray(value)) {
    return value.map((category) => ({
      name: category.name || category.category || category.label || "Readiness",
      status: category.status || category.readinessStatus || category.state,
    }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, status]) => ({
      name: formatCategoryName(name),
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
          ? { category: formatCategoryName(category), ...item }
          : { category: formatCategoryName(category), label: item }
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
      "Readiness items";
    const name = formatCategoryName(category);

    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  });

  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }));
}

function formatStatus(status) {
  if (!status) return "Needs verification";

  const key = String(status).trim();
  return STATUS_LABELS[key] || STATUS_LABELS[key.toLowerCase()] || formatCategoryName(key);
}

function getStatusClassName(status) {
  const label = formatStatus(status).toLowerCase();

  if (label === "complete") return "pilot-readiness-status complete";
  if (label === "partial") return "pilot-readiness-status partial";
  return "pilot-readiness-status needs-verification";
}

function getItemStatus(item) {
  return item && typeof item === "object"
    ? item.status || item.readinessStatus || item.state
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
    "Readiness item"
  );
}

function formatCategoryName(value) {
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
