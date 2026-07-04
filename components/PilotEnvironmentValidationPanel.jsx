import React, { useEffect, useState } from "react";
import { fetchPilotEnvironmentValidation } from "../api.js";

const SECRET_KEY_PATTERNS = [
  "key",
  "secret",
  "token",
  "password",
  "credential",
  "authorization",
  "private",
];

export default function PilotEnvironmentValidationPanel({ clinicianKey, clinicId }) {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadValidation() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchPilotEnvironmentValidation({ clinicianKey, clinicId });
        if (!cancelled) setValidation(normalizeValidation(data));
      } catch (err) {
        if (!cancelled) {
          setValidation(null);
          setError(err.message || "Unable to load pilot environment validation.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadValidation();

    return () => {
      cancelled = true;
    };
  }, [clinicianKey, clinicId]);

  return (
    <section
      className="pilot-environment-section"
      aria-labelledby="pilot-environment-title"
    >
      <div className="detail-section-title" id="pilot-environment-title">
        Pilot environment validation
      </div>

      <div className="pilot-environment-card">
        {loading ? (
          <div className="empty-state-small">Loading pilot environment validation…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : !validation ? (
          <div className="empty-state-small">
            Pilot environment validation is unavailable.
          </div>
        ) : (
          <>
            <div className="pilot-environment-summary">
              <div>
                <div className="pilot-environment-title">
                  {validation.valid ? "Environment valid" : "Environment invalid"}
                </div>
                <div className="pilot-environment-checked">
                  {formatCheckedAt(validation.checkedAt)}
                </div>
              </div>
              <span
                className={
                  validation.valid
                    ? "pilot-environment-status valid"
                    : "pilot-environment-status invalid"
                }
              >
                {validation.valid ? "Valid" : "Invalid"}
              </span>
            </div>

            <div className="pilot-environment-grid">
              <div className="pilot-environment-group">
                <div className="pilot-environment-subtitle">
                  Missing configuration
                </div>
                {validation.missingConfigNames.length > 0 ? (
                  <ul>
                    {validation.missingConfigNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state-small">No missing config names reported.</div>
                )}
              </div>

              <div className="pilot-environment-group">
                <div className="pilot-environment-subtitle">Warnings</div>
                {validation.warnings.length > 0 ? (
                  <ul>
                    {validation.warnings.map((warning, index) => (
                      <li key={`warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state-small">No environment warnings reported.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function normalizeValidation(data) {
  const source = data?.environment || data?.validation || data?.result || data;
  if (!source || typeof source !== "object") return null;

  return {
    valid: Boolean(source.valid ?? source.ok ?? source.isValid),
    checkedAt:
      source.checkedAt ||
      source.generatedAt ||
      source.createdAt ||
      source.timestamp,
    missingConfigNames: normalizeConfigNames(
      source.missingConfigNames ||
        source.missingConfig ||
        source.missingConfigs ||
        source.missing ||
        source.missingEnvironment
    ),
    warnings: normalizeWarnings(source.warnings || source.warningNames),
  };
}

function normalizeConfigNames(value) {
  const items = normalizeList(value);

  return items
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (!item || typeof item !== "object") return null;
      return item.name || item.key || item.configName || item.envName || item.variable;
    })
    .filter(Boolean)
    .map(String);
}

function normalizeWarnings(value) {
  return normalizeList(value)
    .map((warning) => {
      if (typeof warning === "string" || typeof warning === "number") {
        return String(warning);
      }

      if (!warning || typeof warning !== "object") return null;

      return (
        warning.name ||
        warning.code ||
        warning.summary ||
        warning.message ||
        warning.label ||
        null
      );
    })
    .filter(Boolean)
    .map((warning) => sanitizeDisplayText(String(warning)));
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "object") {
    return Object.entries(value).map(([name, entry]) =>
      entry && typeof entry === "object" ? { name, ...entry } : name
    );
  }
  return [value];
}

function sanitizeDisplayText(value) {
  if (!value) return value;
  if (SECRET_KEY_PATTERNS.some((pattern) => value.toLowerCase().includes(pattern))) {
    return value.replace(/:\s*\S+/g, "");
  }
  return value;
}

function formatCheckedAt(value) {
  if (!value) return "Checked time unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `Checked ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
