/*
 * src/lib/api.js — Clinician dashboard API client.
 * Controlled-beta endpoints receive only the access key from the browser.
 * Practice and actor authority are derived by the backend runtime.
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
  if (!CONTROLLED_BETA && clinicId) url.searchParams.set("clinicId", clinicId);
  const headers = CONTROLLED_BETA
    ? { "x-clinician-key": clinicianKey || "" }
    : buildClinicianHeaders({
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

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error(data.error || "Unauthorized");
    err.status = 401;
    err.code = data.code;
    throw err;
  }
  if (!res.ok) {
    const message =
      patientScoped && res.status === 403
        ? PATIENT_ACCESS_DENIED_MESSAGE
        : data.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

async function controlledBetaClinicianRequest(
  path,
  { clinicianKey, method = "GET", patientScoped = false, body } = {}
) {
  const headers = { "x-clinician-key": clinicianKey || "" };
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(
    new URL(`${PROXY_URL}/api/controlled-beta/clinician${path}`).toString(),
    {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error(data.error || "Unauthorized");
    err.status = 401;
    err.code = data.code;
    throw err;
  }
  if (!res.ok) {
    const message =
      patientScoped && res.status === 403
        ? PATIENT_ACCESS_DENIED_MESSAGE
        : data.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

async function userAdministrationRequest(path, { clinicianKey, method = "GET", body } = {}) {
  const res = await fetch(new URL(`${PROXY_URL}/api/user-administration${path}`).toString(), {
    method,
    headers: { Authorization: `Bearer ${clinicianKey || ""}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const error = new Error(data.error || "User administration is unavailable"); error.status = res.status; error.code = data.code; throw error; }
  return data;
}

export const fetchUserAdministrationSession = (opts) => userAdministrationRequest("/session", opts);
export const fetchManagedClinicians = (opts) => userAdministrationRequest("/clinicians", opts);
export const inviteManagedClinician = ({ payload, ...opts }) => userAdministrationRequest("/clinicians", { ...opts, method: "POST", body: payload });
export const runManagedClinicianAction = ({ reference, action, ...opts }) => userAdministrationRequest(`/clinicians/${encodeURIComponent(reference)}/${encodeURIComponent(action)}`, { ...opts, method: "POST", body: {} });
export const fetchManagedPatients = (opts) => userAdministrationRequest("/patients", opts);
export const enrollManagedPatient = ({ payload, ...opts }) => userAdministrationRequest("/patients", { ...opts, method: "POST", body: payload });
export const runManagedPatientAction = ({ reference, action, ...opts }) => userAdministrationRequest(`/patients/${encodeURIComponent(reference)}/${encodeURIComponent(action)}`, { ...opts, method: "POST", body: {} });
export const fetchUserAdministrationAudit = ({ reference, ...opts } = {}) => userAdministrationRequest(`/audit${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`, opts);

export const fetchRoster = (opts) => controlledBetaClinicianRequest("/patients", opts);

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
  controlledBetaClinicianRequest(`/patients/${encodeURIComponent(patientId)}`, {
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
  const data = await controlledBetaClinicianRequest(
    `/patients/${encodeURIComponent(patientId)}`,
    { ...opts, patientScoped: true }
  );
  return {
    ok: true,
    signals: data.vitals || [],
    status: data.vitals?.length ? "available" : "no_monitoring_data",
  };
};

export const fetchCareTeamUpdates = (opts) =>
  controlledBetaClinicianRequest("/care-team-updates", {
    ...opts,
    patientScoped: true,
  });

export const markCareTeamUpdateReviewed = ({ id, ...opts }) =>
  controlledBetaClinicianRequest(`/care-team-updates/${encodeURIComponent(id)}/review`, {
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
  const data = await controlledBetaClinicianRequest(
    `/patients/${encodeURIComponent(patientId)}`,
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
