export const PATIENT_ACCESS_DENIED_MESSAGE =
  "Access denied for this patient under the current practice context.";

export function getPatientAccessErrorMessage(err, fallback) {
  if (err?.status === 403) return PATIENT_ACCESS_DENIED_MESSAGE;
  return err?.message || fallback;
}
