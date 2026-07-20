import { describe, expect, it } from "vitest";
import {
  CLINICS,
  DEFAULT_CLINIC_ID,
  normalizeClinicId,
  PREDICATE_ADMIN_CONTEXT,
  PRERNA_HEALTH_CONTEXT,
} from "./clinicConfig.js";

describe("clinician dashboard clinic config", () => {
  it("renders only the two approved display contexts", () => {
    expect(CLINICS).toEqual([
      { value: PRERNA_HEALTH_CONTEXT, label: "Prerna Health" },
      { value: PREDICATE_ADMIN_CONTEXT, label: "Predicate Admin" },
    ]);
    expect(CLINICS.map(({ label }) => label)).not.toEqual(
      expect.arrayContaining(["Alpha v1", "Production / Demo", "July 20 Controlled Beta"])
    );
  });

  it("rejects arbitrary and obsolete values to the approved default", () => {
    expect(DEFAULT_CLINIC_ID).toBe(PRERNA_HEALTH_CONTEXT);
    expect(normalizeClinicId("arbitrary-practice")).toBe(PRERNA_HEALTH_CONTEXT);
    expect(normalizeClinicId("alpha-v1")).toBe(PRERNA_HEALTH_CONTEXT);
    expect(normalizeClinicId(PREDICATE_ADMIN_CONTEXT)).toBe(PREDICATE_ADMIN_CONTEXT);
  });
});
