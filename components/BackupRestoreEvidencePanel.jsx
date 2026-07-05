import React, { useEffect, useMemo, useState } from "react";
import {
  createBackupRestoreEvidence,
  fetchBackupRestoreEvidence,
} from "../api.js";

const EMPTY_FORM = {
  evidenceType: "",
  subsystem: "",
  status: "",
  verifiedBy: "",
  notes: "",
};

export default function BackupRestoreEvidencePanel({ clinicianKey, clinicId }) {
  const [evidence, setEvidence] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvidence() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchBackupRestoreEvidence({ clinicianKey, clinicId });
        if (!cancelled) setEvidence(normalizeEvidenceList(data));
      } catch (err) {
        if (!cancelled) {
          setEvidence([]);
          setError(err.message || "Unable to load backup restore evidence.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvidence();

    return () => {
      cancelled = true;
    };
  }, [clinicianKey, clinicId]);

  const sortedEvidence = useMemo(
    () => [...evidence].sort(compareVerifiedAtDesc),
    [evidence]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload = sanitizeEvidencePayload(form);

    try {
      const data = await createBackupRestoreEvidence({
        payload,
        clinicianKey,
        clinicId,
      });
      const created = normalizeEvidenceList(data);

      setEvidence((current) => [...created, ...current]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setSubmitError(err.message || "Unable to record backup restore evidence.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <section
      className="backup-restore-section"
      aria-labelledby="backup-restore-title"
    >
      <div className="detail-section-title" id="backup-restore-title">
        Backup Restore Evidence
      </div>

      <div className="backup-restore-card">
        <div className="backup-restore-note">
          Internal operations evidence. Do not include PHI or secrets in notes.
        </div>

        <form className="backup-restore-form" onSubmit={handleSubmit}>
          <label>
            <span>Evidence type</span>
            <input
              name="evidenceType"
              value={form.evidenceType}
              onChange={handleFieldChange}
              required
            />
          </label>
          <label>
            <span>Subsystem</span>
            <input
              name="subsystem"
              value={form.subsystem}
              onChange={handleFieldChange}
              required
            />
          </label>
          <label>
            <span>Status</span>
            <select
              name="status"
              value={form.status}
              onChange={handleFieldChange}
              required
            >
              <option value="">Select status</option>
              <option value="verified">Verified</option>
              <option value="needs_verification">Needs verification</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label>
            <span>Verified by</span>
            <input
              name="verifiedBy"
              value={form.verifiedBy}
              onChange={handleFieldChange}
              required
            />
          </label>
          <label className="backup-restore-notes-field">
            <span>Notes</span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleFieldChange}
              rows={3}
            />
          </label>
          <button className="btn-secondary-small" type="submit" disabled={submitting}>
            {submitting ? "Recording..." : "Record evidence"}
          </button>
          {submitError && <div className="backup-restore-error">{submitError}</div>}
        </form>

        {loading ? (
          <div className="empty-state-small">Loading backup restore evidence…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : sortedEvidence.length === 0 ? (
          <div className="empty-state-small">
            No backup restore evidence is recorded yet.
          </div>
        ) : (
          <div className="backup-restore-list">
            {sortedEvidence.map((item, index) => (
              <article className="backup-restore-item" key={item.id || index}>
                <div className="backup-restore-item-header">
                  <div>
                    <div className="backup-restore-item-title">
                      {item.evidenceType || "Backup restore evidence"}
                    </div>
                    <div className="backup-restore-item-meta">
                      {item.subsystem || "Subsystem unavailable"} ·{" "}
                      {formatTimestamp(item.verifiedAt)}
                    </div>
                  </div>
                  <span className={getStatusClassName(item.status)}>
                    {formatLabel(item.status || "status unavailable")}
                  </span>
                </div>

                <div className="backup-restore-verified-by">
                  Verified by {item.verifiedBy || "unavailable"}
                </div>

                {item.notes && (
                  <div className="backup-restore-notes">{item.notes}</div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeEvidenceList(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.evidence)
    ? data.evidence
    : Array.isArray(data?.items)
    ? data.items
    : data?.evidence
    ? [data.evidence]
    : data?.item
    ? [data.item]
    : data && typeof data === "object" && hasEvidenceFields(data)
    ? [data]
    : [];

  return items.map((item, index) => ({
    id: item.id || item.evidenceId || `backup-restore-evidence-${index}`,
    evidenceType: item.evidenceType || item.type,
    subsystem: item.subsystem || item.service || item.component,
    status: item.status || item.outcome,
    verifiedAt: item.verifiedAt || item.createdAt || item.timestamp,
    verifiedBy: sanitizeIdentity(item.verifiedBy || item.actor || item.createdBy),
    notes: sanitizeEvidenceNotes(item.notes || item.summary || ""),
  }));
}

function sanitizeEvidencePayload(payload) {
  return {
    evidenceType: payload.evidenceType.trim(),
    subsystem: payload.subsystem.trim(),
    status: payload.status.trim(),
    verifiedBy: sanitizeIdentity(payload.verifiedBy),
    notes: sanitizeEvidenceNotes(payload.notes),
  };
}

function hasEvidenceFields(value) {
  return Boolean(value.evidenceType || value.subsystem || value.status || value.verifiedAt);
}

function sanitizeIdentity(value) {
  const text = String(value || "").trim();
  return hasUnsafeText(text) ? "Internal operator" : text;
}

function sanitizeEvidenceNotes(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return hasUnsafeText(text)
    ? "Notes omitted because they may contain PHI or secrets."
    : text;
}

function hasUnsafeText(value) {
  return [
    /patient\s+[a-z]/i,
    /\bmrn\b/i,
    /\bdob\b/i,
    /\bssn\b/i,
    /\bsecret\b/i,
    /\btoken\b/i,
    /\bpassword\b/i,
    /\bapi[_ -]?key\b/i,
    /bearer\s+\S+/i,
  ].some((pattern) => pattern.test(value));
}

function compareVerifiedAtDesc(a, b) {
  const aTime = a.verifiedAt ? new Date(a.verifiedAt).getTime() : 0;
  const bTime = b.verifiedAt ? new Date(b.verifiedAt).getTime() : 0;
  return bTime - aTime;
}

function getStatusClassName(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("fail")) return "backup-restore-status failed";
  if (normalized.includes("verified")) return "backup-restore-status verified";
  return "backup-restore-status pending";
}

function formatTimestamp(value) {
  if (!value) return "Verified time unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `Verified ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
