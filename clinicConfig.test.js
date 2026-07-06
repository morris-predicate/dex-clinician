import { describe, expect, it } from "vitest";
import { CLINICS, normalizeClinicId, PILOT_CLINIC_ID } from "./clinicConfig.js";

describe("clinician dashboard clinic config", () => {
  it("maps Production / Demo to the controlled pilot practice scope", () => {
    const productionDemo = CLINICS.find((clinic) => clinic.label === "Production / Demo");

    expect(productionDemo).toMatchObject({
      value: PILOT_CLINIC_ID,
      label: "Production / Demo",
    });
  });

  it("normalizes legacy production-v1 links to predicate-pilot", () => {
    expect(normalizeClinicId("production-v1")).toBe(PILOT_CLINIC_ID);
  });
});
