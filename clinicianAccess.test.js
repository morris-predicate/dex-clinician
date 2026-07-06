import { describe, expect, it } from "vitest";
import {
  canAccessStatusAudit,
  getConfiguredClinicianRole,
  isPatientEnrollmentSupported,
} from "./clinicianAccess.js";

describe("clinician access helpers", () => {
  it("defaults to normal clinician access", () => {
    expect(getConfiguredClinicianRole({})).toBe("clinician");
    expect(canAccessStatusAudit("clinician")).toBe(false);
  });

  it("allows Predicate internal and admin roles into Status/Audit", () => {
    expect(canAccessStatusAudit("predicate_admin")).toBe(true);
    expect(canAccessStatusAudit("internal_operations")).toBe(true);
    expect(canAccessStatusAudit("admin")).toBe(true);
  });

  it("keeps patient enrollment disabled until a protected route exists", () => {
    expect(isPatientEnrollmentSupported()).toBe(false);
  });
});
