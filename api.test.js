import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("VITE_PROXY_URL", "https://api-beta.predicatelabs.ai");
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ ok: true, patients: [] }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("governed clinician request authority", () => {
  it("uses a bearer token for the server-authorized user administration session", async () => {
    const { fetchUserAdministrationSession } = await importApi();
    await fetchUserAdministrationSession({ clinicianKey: "signed-access-token" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api-beta.predicatelabs.ai/api/user-administration/session",
      expect.objectContaining({ headers: { Authorization: "Bearer signed-access-token" }, method: "GET" })
    );
  });
  it("uses the governed roster route with a Cognito bearer token", async () => {
    const { fetchRoster } = await importApi();
    await fetchRoster({ clinicianKey: "opaque-access-token", clinicId: "prerna-health" });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(
      "https://api-beta.predicatelabs.ai/api/clinician/patients?practiceId=prerna-health&clinicId=prerna-health"
    );
    expect(options.headers).toEqual({
      Authorization: "Bearer opaque-access-token",
    });
  });

  it("never sends legacy key or client-selected actor headers", async () => {
    const { fetchPatient } = await importApi();
    await fetchPatient({
      patientId: "patient-123",
      clinicianKey: "opaque-access-token",
      clinicianId: "spoofed-clinician",
      clinicianRole: "predicate_superadmin",
      practiceId: "spoofed-practice",
      clinicId: "prerna-health",
    });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer opaque-access-token");
    expect(options.headers["x-clinician-key"]).toBeUndefined();
    expect(options.headers["x-clinician-id"]).toBeUndefined();
    expect(options.headers["x-clinician-role"]).toBeUndefined();
    expect(options.headers["x-practice-id"]).toBeUndefined();
  });

  it("uses governed enrollment and roster paths", async () => {
    const { createPatientEnrollment, fetchRoster } = await importApi();
    await createPatientEnrollment({
      clinicianKey: "opaque-access-token",
      clinicId: "prerna-health",
      payload: {
        firstName: "Fabricated",
        lastName: "Patient",
        email: "controlled@example.test",
        authorizedElectronicContact: true,
      },
    });
    await fetchRoster({ clinicianKey: "opaque-access-token", clinicId: "prerna-health" });
    expect(global.fetch.mock.calls[0][0]).toContain("/api/clinician/enrollments");
    expect(global.fetch.mock.calls[1][0]).toContain("/api/clinician/patients");
    expect(global.fetch.mock.calls.flat().join(" ")).not.toContain("/api/controlled-beta/");
  });

  it("sanitizes assignment denial on patient reads", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: "private backend detail" }),
    });
    const { fetchPatient } = await importApi();
    await expect(
      fetchPatient({
        patientId: "patient-123",
        clinicianKey: "opaque-access-token",
        clinicId: "prerna-health",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "Access denied for this patient under the current practice context.",
    });
  });

  it("keeps bearer material out of request URLs and bodies", async () => {
    const { createPatientEnrollment } = await importApi();
    await createPatientEnrollment({
      clinicianKey: "opaque-access-token",
      clinicId: "prerna-health",
      payload: {
        firstName: "Fabricated",
        lastName: "Patient",
        email: "controlled@example.test",
        authorizedElectronicContact: true,
      },
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).not.toContain("opaque-access-token");
    expect(options.body).not.toContain("opaque-access-token");
  });
});

async function importApi() {
  vi.resetModules();
  return import("./api.js");
}
