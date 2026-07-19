/*
 * src/lib/api.js — Clinician dashboard API client.
 * All endpoints require both x-clinician-key (auth) and clinicId (scope).
 */

import { PATIENT_ACCESS_DENIED_MESSAGE } from "./patientAccess.js";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "";
const CONTROLLED_BETA = import.meta.env.VITE_CONTROLLED_BETA === "true";
const DEFAULT_CLINICIAN_ID = "unknown_clinician";
const DEFAULT_CLINICIAN_ROLE = "clinician";
const DEFAULT_PRACTICE_ID = "unknown_practice";

function resolveClinicianActorIdentity({
  clinicianId,
  clinicianRole,
  practiceId,
  clinicId,
} = {}) {
  return {
    clinicianId:
      clinicianId ||
      import.meta.env.VITE_CLINICIAN_ID ||
      DEFAULT_CLINICIAN_ID,
    clinicianRole:
      clinicianRole ||
      import.meta.env.VITE_CLINICIAN_ROLE ||
      DEFAULT_CLINICIAN_ROLE,
    practiceId:
      practiceId ||
      import.meta.env.VITE_PRACTICE_ID ||
      clinicId ||
      DEFAULT_PRACTICE_ID,
  };
}

export function buildClinicianHeaders({
  clinicianKey,
  clinicianId,
  clinicianRole,
  practiceId,
  clinicId,
} = {}) {
  const actor = resolveClinicianActorIdentity({
    clinicianId,
    clinicianRole,
    practiceId,
    clinicId,
  });

  return {
    "x-clinician-key": clinicianKey || "",
    "x-clinician-id": actor.clinicianId,
    "x-clinician-role": actor.clinicianRole,
    "x-practice-id": actor.practiceId,
  };
}

async function request(
  path,
  {
    clinicianKey,
    clinicianId,
    clinicianRole,
    practiceId,
    clinicId,
    method = "GET",
    patientScoped = false,
    body,
  } = {}
) {
  const url = new URL(`${PROXY_URL}${path}`);
  if (clinicId) url.searchParams.set("clinicId", clinicId);
  const headers = buildClinicianHeaders({
    clinicianKey,
    clinicianId,
    clinicianRole,
    practiceId,
    clinicId,
  });
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(url.toString(), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      patientScoped && res.status === 403
        ? PATIENT_ACCESS_DENIED_MESSAGE
        : data.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fetchRoster = (opts) => request("/api/controlled-beta/clinician/patients", opts);

export const createPatientEnrollment = ({ payload, ...opts }) =>
  request("/api/clinician/enrollments", {
    ...opts,
    method: "POST",
    body: payload,
  });

export const fetchPatientEnrollments = (opts) =>
  request("/api/clinician/enrollments", opts);

export const regeneratePatientTemporaryPassword = ({ enrollmentId, ...opts }) =>
  request(`/api/clinician/enrollments/${encodeURIComponent(enrollmentId)}/regenerate-temporary-password`, {
    ...opts,
    method: "POST",
    body: {},
  });

export const fetchPatient = ({ patientId, ...opts }) =>
  request(`/api/controlled-beta/clinician/patients/${encodeURIComponent(patientId)}`, {
    ...opts,
    patientScoped: true,
  });

export const fetchTranscript = ({ patientId, ...opts }) =>
  request(`/api/clinician/patients/${encodeURIComponent(patientId)}/transcript`, {
    ...opts,
    patientScoped: true,
  });

export const fetchPatientBaseline = ({ patientId, ...opts }) =>
  CONTROLLED_BETA
    ? Promise.resolve({
        status: "not_available",
        patientId,
        message: "No baseline data yet",
      })
    : request(`/api/baseline/patient/${encodeURIComponent(patientId)}`, {
        ...opts,
        patientScoped: true,
      });

export const fetchPatientSignals = async ({ patientId, ...opts }) => {
  if (CONTROLLED_BETA) {
    const data = await request(
      `/api/controlled-beta/clinician/patients/${encodeURIComponent(patientId)}`,
      { ...opts, patientScoped: true }
    );
    return {
      ok: true,
      signals: data.vitals || [],
      status: data.vitals?.length ? "available" : "no_monitoring_data",
    };
  }
  return request(`/api/clinician/patients/${encodeURIComponent(patientId)}/signals`, {
    ...opts,
    patientScoped: true,
  });
};

export const fetchCareTeamUpdates = (opts) =>
  request("/api/controlled-beta/clinician/care-team-updates", {
    ...opts,
    patientScoped: true,
  });

export const markCareTeamUpdateReviewed = ({ id, ...opts }) =>
  request(`/api/controlled-beta/clinician/care-team-updates/${encodeURIComponent(id)}/review`, {
    ...opts,
    method: "POST",
    patientScoped: true,
  });

export const fetchOpenDxReasoningLedgers = ({ patientId, sessionId, ...opts }) => {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (sessionId) params.set("sessionId", sessionId);

  const query = params.toString();
  const path = query
    ? `/api/opendx/reasoning-ledgers?${query}`
    : "/api/opendx/reasoning-ledgers";

  return request(path, {
    ...opts,
    patientScoped: Boolean(patientId || sessionId),
  });
};

export const fetchPilotReadyV1Readiness = (opts) =>
  request("/api/pilot-ready-v1/readiness", opts);

export const fetchPilotGoNoGoChecklist = (opts) =>
  request("/api/pilot-ready-v1/go-no-go", opts);

export const fetchPilotEnvironmentValidation = (opts) =>
  request("/api/pilot-ready-v1/environment", opts);

export const fetchBackupRestoreEvidence = (opts) =>
  request("/api/pilot-ready-v1/backup-restore-evidence", opts);

export const createBackupRestoreEvidence = ({ payload, ...opts } = {}) =>
  request("/api/pilot-ready-v1/backup-restore-evidence", {
    ...opts,
    method: "POST",
    body: sanitizeBackupRestoreEvidencePayload(payload),
  });

export const fetchClinicalGovernanceEvidence = (opts) =>
  request("/api/pilot-ready-v1/clinical-governance-evidence", opts);

export const createClinicalGovernanceEvidence = ({ payload, ...opts } = {}) =>
  request("/api/pilot-ready-v1/clinical-governance-evidence", {
    ...opts,
    method: "POST",
    body: sanitizeClinicalGovernanceEvidencePayload(payload),
  });

export const fetchChatSessionEvents = ({
  patientId,
  subjectUid,
  sessionId,
  ...opts
}) => {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (subjectUid) params.set("subjectUid", subjectUid);
  if (sessionId) params.set("sessionId", sessionId);

  const query = params.toString();
  const path = query
    ? `/api/chat/session-events?${query}`
    : "/api/chat/session-events";

  return request(path, {
    ...opts,
    patientScoped: Boolean(patientId || subjectUid || sessionId),
  });
};

export const fetchOpenDxInteractionTrace = ({
  patientId,
  subjectUid,
  sessionId,
  interactionId,
  ...opts
}) => {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (subjectUid) params.set("subjectUid", subjectUid);
  if (sessionId) params.set("sessionId", sessionId);
  if (interactionId) params.set("interactionId", interactionId);

  const query = params.toString();
  const path = query
    ? `/api/opendx/interaction-trace?${query}`
    : "/api/opendx/interaction-trace";

  return request(path, {
    ...opts,
    patientScoped: Boolean(patientId || subjectUid || sessionId || interactionId),
  });
};

export const fetchInternalAuditEvents = ({
  patientId,
  subjectUid,
  sessionId,
  eventType,
  outcome,
  limit,
  ...opts
} = {}) => {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (subjectUid) params.set("subjectUid", subjectUid);
  if (sessionId) params.set("sessionId", sessionId);
  if (eventType) params.set("eventType", eventType);
  if (outcome) params.set("outcome", outcome);
  if (limit) params.set("limit", String(limit));

  const query = params.toString();
  const path = query
    ? `/api/internal/audit-events?${query}`
    : "/api/internal/audit-events";

  return request(path, {
    ...opts,
    patientScoped: Boolean(patientId || subjectUid || sessionId),
  });
};

export const fetchInternalMonitoringEvents = ({
  subsystem,
  severity,
  outcome,
  patientId,
  subjectUid,
  sessionId,
  limit,
  ...opts
} = {}) => {
  const params = new URLSearchParams();
  if (subsystem) params.set("subsystem", subsystem);
  if (severity) params.set("severity", severity);
  if (outcome) params.set("outcome", outcome);
  if (patientId) params.set("patientId", patientId);
  if (subjectUid) params.set("subjectUid", subjectUid);
  if (sessionId) params.set("sessionId", sessionId);
  if (limit) params.set("limit", String(limit));

  const query = params.toString();
  const path = query
    ? `/api/internal/monitoring-events?${query}`
    : "/api/internal/monitoring-events";

  return request(path, {
    ...opts,
    patientScoped: Boolean(patientId || subjectUid || sessionId),
  });
};

function sanitizeBackupRestoreEvidencePayload(payload = {}) {
  return {
    evidenceType: payload.evidenceType || "",
    subsystem: payload.subsystem || "",
    status: payload.status || "",
    verifiedBy: payload.verifiedBy || "",
    notes: sanitizeInternalEvidenceNotes(payload.notes || ""),
  };
}

function sanitizeClinicalGovernanceEvidencePayload(payload = {}) {
  return {
    evidenceType: payload.evidenceType || "",
    status: payload.status || "",
    reviewedBy: payload.reviewedBy || "",
    reviewerRole: payload.reviewerRole || "",
    notes: sanitizeInternalEvidenceNotes(payload.notes || ""),
  };
}

function sanitizeInternalEvidenceNotes(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const unsafePatterns = [
    /patient\s+[a-z]/i,
    /\bmrn\b/i,
    /\bdob\b/i,
    /\bssn\b/i,
    /\bsecret\b/i,
    /\btoken\b/i,
    /\bpassword\b/i,
    /\bapi[_ -]?key\b/i,
    /bearer\s+\S+/i,
  ];

  return unsafePatterns.some((pattern) => pattern.test(text))
    ? "Notes omitted because they may contain PHI or secrets."
    : text;
}

export async function fetchPatientVitals({
  patientId,
  subjectUid,
  clinicianKey,
  clinicianId,
  clinicianRole,
  practiceId,
  clinicId,
}) {
  if (CONTROLLED_BETA) {
    const data = await request(
      `/api/controlled-beta/clinician/patients/${encodeURIComponent(patientId)}`,
      {
        clinicianKey,
        clinicianId,
        clinicianRole,
        practiceId,
        clinicId,
        patientScoped: true,
      }
    );
    return Array.isArray(data?.vitals) ? data.vitals : [];
  }
  const candidatePaths = [
    patientId
      ? `/api/patients/${encodeURIComponent(patientId)}/vitals`
      : null,

    patientId
      ? `/api/clinician/patients/${encodeURIComponent(patientId)}/vitals`
      : null,

    subjectUid
      ? `/api/patients/${encodeURIComponent(subjectUid)}/vitals`
      : null,

    subjectUid
      ? `/api/patients/${encodeURIComponent(subjectUid)}/vitals?subjectUid=${encodeURIComponent(subjectUid)}`
      : null,

    subjectUid
      ? `/api/vitals?subjectUid=${encodeURIComponent(subjectUid)}`
      : null,

    subjectUid
      ? `/api/signals/vitals?subjectUid=${encodeURIComponent(subjectUid)}`
      : null,
  ].filter(Boolean);

  let firstSuccessfulEmpty = [];

  for (const path of candidatePaths) {
    try {
      const data = await request(path, {
        clinicianKey,
        clinicianId,
        clinicianRole,
        practiceId,
        clinicId,
        patientScoped: true,
      });

      const candidate =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.vitals)
          ? data.vitals
          : Array.isArray(data?.readings)
          ? data.readings
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.results)
          ? data.results
          : [];

      if (candidate.length > 0) {
  console.log("[fetchPatientVitals] found vitals", {
    path,
    count: candidate.length,
  });
}

      if (candidate.length > 0) {
        return candidate;
      }

      firstSuccessfulEmpty = candidate;
    } catch (err) {
      console.warn("[fetchPatientVitals] candidate failed", path, err.message);
    }
  }

  return firstSuccessfulEmpty;
}
