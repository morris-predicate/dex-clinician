import React, { useEffect, useMemo, useState } from "react";
import {
  createClinicalGovernanceEvidence,
  fetchClinicalGovernanceEvidence,
} from "../api.js";

const EMPTY_FORM = {
  evidenceType: "",
  status: "",
  reviewedBy: "",
  reviewerRole: "",
  notes: "",
};

export default function ClinicalGovernanceEvidencePanel({ clinicianKey, clinicId }) {
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
        const data = await fetchClinicalGovernanceEvidence({ clinicianKey, clinicId });
        if (!cancelled) setEvidence(normalizeEvidenceList(data));
      } catch (err) {
        if (!cancelled) {
          setEvidence([]);
          setError(err.message || "Unable to load clinical governance evidence.");
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
    () => [...evidence].sort(compareReviewedAtDesc),
    [evidence]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload = sanitizeEvidencePayload(form);

    try {
      const data = await createClinicalGovernanceEvidence({
        payload,
        clinicianKey,
        clinicId,
      });
      const created = normalizeEvidenceList(data);

      setEvidence((current) => [...created, ...current]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setSubmitError(err.message || "Unable to record clinical governance evidence.");
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
      className="clinical-governance-section"
      aria-labelledby="clinical-governance-title"
    >
      <div className="detail-section-title" id="clinical-governance-title">
        Clinical Governance Evidence
      </div>

      <div className="clinical-governance-card">
        <div className="clinical-governance-note">
          Internal operations evidence. Do not include PHI or secrets in notes.
        </div>

        <form className="clinical-governance-form" onSubmit={handleSubmit}>
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
            <span>Status</span>
            <select
              name="status"
              value={form.status}
              onChange={handleFieldChange}
              required
            >
              <option value="">Select status</option>
              <option value="approved">Approved</option>
              <option value="needs_review">Needs review</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            <span>Reviewed by</span>
            <input
              name="reviewedBy"
              value={form.reviewedBy}
              onChange={handleFieldChange}
              required
            />
          </label>
          <label>
            <span>Reviewer role</span>
            <input
              name="reviewerRole"
              value={form.reviewerRole}
              onChange={handleFieldChange}
              required
            />
          </label>
          <label className="clinical-governance-notes-field">
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
          {submitError && <div className="clinical-governance-error">{submitError}</div>}
        </form>

        {loading ? (
          <div className="empty-state-small">Loading clinical governance evidence…</div>
        ) : error ? (
          <div className="empty-state-small">{error}</div>
        ) : sortedEvidence.length === 0 ? (
          <div className="empty-state-small">
            No clinical governance evidence is recorded yet.
          </div>
        ) : (
          <div className="clinical-governance-list">
            {sortedEvidence.map((item, index) => (
              <article className="clinical-governance-item" key={item.id || index}>
                <div className="clinical-governance-item-header">
                  <div>
                    <div className="clinical-governance-item-title">
                      {item.evidenceType || "Clinical governance evidence"}
                    </div>
                    <div className="clinical-governance-item-meta">
                      {item.reviewerRole || "Reviewer role unavailable"} ·{" "}
                      {formatTimestamp(item.reviewedAt)}
                    </div>
                  </div>
                  <span className={getStatusClassName(item.status)}>
                    {formatLabel(item.status || "status unavailable")}
                  </span>
                </div>

                <div className="clinical-governance-reviewed-by">
                  Reviewed by {item.reviewedBy || "unavailable"}
                </div>

                {isLaunchSignoffApproved(item) && (
                  <div className="clinical-governance-launch-signoff">
                    Launch signoff approved.
                  </div>
                )}

                {item.notes && (
                  <div className="clinical-governance-notes">{item.notes}</div>
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
    id: item.id || item.evidenceId || `clinical-governance-evidence-${index}`,
    evidenceType: item.evidenceType || item.type,
    status: item.status || item.outcome,
    reviewedBy: sanitizeIdentity(item.reviewedBy || item.actor || item.createdBy),
    reviewerRole: sanitizeIdentity(item.reviewerRole || item.role),
    reviewedAt: item.reviewedAt || item.createdAt || item.timestamp,
    notes: sanitizeEvidenceNotes(item.notes || item.summary || ""),
  }));
}

function sanitizeEvidencePayload(payload) {
  return {
    evidenceType: payload.evidenceType.trim(),
    status: payload.status.trim(),
    reviewedBy: sanitizeIdentity(payload.reviewedBy),
    reviewerRole: sanitizeIdentity(payload.reviewerRole),
    notes: sanitizeEvidenceNotes(payload.notes),
  };
}

function hasEvidenceFields(value) {
  return Boolean(value.evidenceType || value.status || value.reviewedAt || value.reviewedBy);
}

function sanitizeIdentity(value) {
  const text = String(value || "").trim();
  return hasUnsafeText(text) ? "Internal reviewer" : text;
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

function compareReviewedAtDesc(a, b) {
  const aTime = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
  const bTime = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
  return bTime - aTime;
}

function isLaunchSignoffApproved(item) {
  return (
    String(item.evidenceType || "").toLowerCase() === "launch_signoff" &&
    String(item.status || "").toLowerCase() === "approved"
  );
}

function getStatusClassName(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("reject")) return "clinical-governance-status rejected";
  if (normalized.includes("approved")) return "clinical-governance-status approved";
  return "clinical-governance-status pending";
}

function formatTimestamp(value) {
  if (!value) return "Reviewed time unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `Reviewed ${date.toLocaleString([], {
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
