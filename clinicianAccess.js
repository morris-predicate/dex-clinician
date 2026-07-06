const INTERNAL_ROLE_PATTERNS = [
  /admin/i,
  /internal/i,
  /predicate/i,
  /operations?/i,
  /\bops\b/i,
];

export function getConfiguredClinicianRole(env = import.meta.env) {
  return env?.VITE_CLINICIAN_ROLE || "clinician";
}

export function canAccessStatusAudit(role = getConfiguredClinicianRole()) {
  return INTERNAL_ROLE_PATTERNS.some((pattern) => pattern.test(String(role || "")));
}

export function isPatientEnrollmentSupported() {
  return false;
}
