export const PRERNA_HEALTH_CONTEXT = "prerna-health";
export const PREDICATE_ADMIN_CONTEXT = "predicate-admin";
export const DEFAULT_CLINIC_ID = PRERNA_HEALTH_CONTEXT;

export const CLINICS = [
  { value: PRERNA_HEALTH_CONTEXT, label: "Prerna Health" },
  { value: PREDICATE_ADMIN_CONTEXT, label: "Predicate Admin" },
];

export function normalizeClinicId(value) {
  return CLINICS.some((clinic) => clinic.value === value)
    ? value
    : DEFAULT_CLINIC_ID;
}
