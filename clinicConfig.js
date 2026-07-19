export const DEFAULT_CLINIC_ID =
  import.meta.env.VITE_DEFAULT_CLINIC_ID || "alpha-v1";
export const PILOT_CLINIC_ID = "predicate-pilot";

const LEGACY_CLINIC_ALIASES = {
  "production-v1": PILOT_CLINIC_ID,
};

export const CLINICS = [
  { value: DEFAULT_CLINIC_ID, label: "Alpha v1" },
  { value: PILOT_CLINIC_ID, label: "Production / Demo" },
];

export function normalizeClinicId(value) {
  const clinicId = value || DEFAULT_CLINIC_ID;
  return LEGACY_CLINIC_ALIASES[clinicId] || clinicId;
}
