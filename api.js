/*
 * src/lib/api.js — Clinician dashboard API client.
 * All endpoints require both x-clinician-key (auth) and clinicId (scope).
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "";

async function request(path, { clinicianKey, clinicId } = {}) {
  const url = new URL(`${PROXY_URL}${path}`);
  if (clinicId) url.searchParams.set("clinicId", clinicId);

  const res = await fetch(url.toString(), {
    headers: { "x-clinician-key": clinicianKey || "" },
  });

  if (res.status === 401) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fetchRoster = (opts) => request("/api/clinician/patients", opts);

export const fetchPatient = ({ patientId, ...opts }) =>
  request(`/api/clinician/patients/${encodeURIComponent(patientId)}`, opts);

export const fetchTranscript = ({ patientId, ...opts }) =>
  request(`/api/clinician/patients/${encodeURIComponent(patientId)}/transcript`, opts);

export const fetchPatientBaseline = ({ patientId, ...opts }) =>
  request(`/api/baseline/patient/${encodeURIComponent(patientId)}`, opts);

export const fetchCareTeamUpdates = (opts) =>
  request("/api/clinician/care-team-updates", opts);

export async function fetchPatientVitals({ patientId, subjectUid, clinicianKey, clinicId }) {
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
      const data = await request(path, { clinicianKey, clinicId });

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