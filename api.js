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
