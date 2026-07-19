import { describe, expect, it, vi } from "vitest";
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

it("uses the controlled build-time practice when no clinic is supplied", async () => {
  vi.stubEnv("VITE_DEFAULT_CLINIC_ID", "predicate-july20-controlled-beta");
  vi.resetModules();
  const { DEFAULT_CLINIC_ID, normalizeClinicId: normalizeConfiguredClinicId } =
    await import("./clinicConfig.js");

  expect(DEFAULT_CLINIC_ID).toBe("predicate-july20-controlled-beta");
  expect(normalizeConfiguredClinicId()).toBe("predicate-july20-controlled-beta");
  const { CLINICS: configuredClinics } = await import("./clinicConfig.js");
  expect(configuredClinics).toContainEqual({
    value: "predicate-july20-controlled-beta",
    label: "July 20 Controlled Beta",
  });
  expect(
    configuredClinics.find((clinic) => clinic.label === "Alpha v1")?.value
  ).toBe("alpha-v1");
});
