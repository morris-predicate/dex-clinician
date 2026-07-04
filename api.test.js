import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("VITE_PROXY_URL", "https://proxy.test");
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ ok: true }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("clinician actor headers", () => {
  it("sends actor headers with clinician review actions", async () => {
    const { markCareTeamUpdateReviewed } = await importApi();

    await markCareTeamUpdateReviewed({
      id: "update-1",
      clinicianKey: "dashboard-secret",
      clinicianId: "clinician-123",
      clinicianRole: "reviewing_clinician",
      practiceId: "practice-456",
      clinicId: "alpha-v1",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/clinician/care-team-updates/update-1/review?clinicId=alpha-v1",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-clinician-key": "dashboard-secret",
          "x-clinician-id": "clinician-123",
          "x-clinician-role": "reviewing_clinician",
          "x-practice-id": "practice-456",
        },
      })
    );
  });

  it("uses safe actor defaults when identity is unset", async () => {
    const { fetchInternalAuditEvents } = await importApi();

    await fetchInternalAuditEvents({
      clinicianKey: "dashboard-secret",
      limit: 10,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/internal/audit-events?limit=10",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-clinician-key": "dashboard-secret",
          "x-clinician-id": "unknown_clinician",
          "x-clinician-role": "clinician",
          "x-practice-id": "unknown_practice",
        }),
      })
    );
  });

  it("uses env actor identity for protected operations views", async () => {
    vi.stubEnv("VITE_CLINICIAN_ID", "env-clinician");
    vi.stubEnv("VITE_CLINICIAN_ROLE", "ops_reviewer");
    vi.stubEnv("VITE_PRACTICE_ID", "env-practice");
    const { fetchPilotReadyV1Readiness, fetchPilotGoNoGoChecklist } = await importApi();

    await fetchPilotReadyV1Readiness({
      clinicianKey: "dashboard-secret",
      clinicId: "alpha-v1",
    });
    await fetchPilotGoNoGoChecklist({
      clinicianKey: "dashboard-secret",
      clinicId: "alpha-v1",
    });

    const [, readinessOptions] = global.fetch.mock.calls[0];
    const [, goNoGoOptions] = global.fetch.mock.calls[1];

    expect(readinessOptions.headers).toMatchObject({
      "x-clinician-key": "dashboard-secret",
      "x-clinician-id": "env-clinician",
      "x-clinician-role": "ops_reviewer",
      "x-practice-id": "env-practice",
    });
    expect(goNoGoOptions.headers).toMatchObject({
      "x-clinician-key": "dashboard-secret",
      "x-clinician-id": "env-clinician",
      "x-clinician-role": "ops_reviewer",
      "x-practice-id": "env-practice",
    });
  });

  it("keeps clinician key separate from actor identity", async () => {
    const { buildClinicianHeaders, fetchInternalAuditEvents } = await importApi();

    const headers = buildClinicianHeaders({
      clinicianKey: "dashboard-secret",
      clinicId: "alpha-v1",
    });

    expect(headers["x-clinician-key"]).toBe("dashboard-secret");
    expect(headers["x-clinician-id"]).not.toBe("dashboard-secret");
    expect(headers["x-clinician-role"]).not.toBe("dashboard-secret");
    expect(headers["x-practice-id"]).toBe("alpha-v1");

    await fetchInternalAuditEvents({
      clinicianKey: "dashboard-secret",
      clinicId: "alpha-v1",
      limit: 5,
    });

    expect(global.fetch.mock.calls[0][0]).not.toContain("dashboard-secret");
  });
});

async function importApi() {
  vi.resetModules();
  return import("./api.js");
}
