import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("VITE_PROXY_URL", "https://proxy.test");
  vi.stubEnv("VITE_CONTROLLED_BETA", "true");
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

describe("controlled-beta request authority", () => {
  it("does not send client-selected practice or actor authority on patient reads", async () => {
    const { fetchPatient } = await importApi();

    await fetchPatient({
      patientId: "patient-123",
      clinicianKey: "dashboard-secret",
      clinicianId: "clinician-123",
      clinicianRole: "reviewing_clinician",
      clinicId: "alpha-v1",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/controlled-beta/clinician/patients/patient-123",
      expect.objectContaining({
        headers: {
          "x-clinician-key": "dashboard-secret",
        },
      })
    );
  });

  it("sanitizes 403 errors for patient-specific reads", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({
        error: "Forbidden for dashboard-secret and patient private payload",
      }),
    });
    const { fetchPatient } = await importApi();

    await expect(
      fetchPatient({
        patientId: "patient-123",
        clinicianKey: "dashboard-secret",
        clinicId: "alpha-v1",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "Access denied for this patient under the current practice context.",
    });
  });

  it("does not send client-selected practice or actor authority on review actions", async () => {
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
      "https://proxy.test/api/controlled-beta/clinician/care-team-updates/update-1/review",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-clinician-key": "dashboard-secret",
        },
      })
    );
  });

  it("routes controlled care-team updates through the shared-key staging endpoint", async () => {
    const { fetchCareTeamUpdates } = await importApi();

    await fetchCareTeamUpdates({
      clinicianKey: "dashboard-secret",
      clinicId: "predicate-july20-controlled-beta",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/controlled-beta/clinician/care-team-updates",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-clinician-key": "dashboard-secret",
        }),
      })
    );
  });

  it("uses only the controlled patient detail endpoint for beta vitals", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ vitals: [] }),
    });
    const { fetchPatientVitals } = await importApi();

    await fetchPatientVitals({
      patientId: "patient-123",
      clinicianKey: "dashboard-secret",
      clinicId: "predicate-july20-controlled-beta",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(
      "https://proxy.test/api/controlled-beta/clinician/patients/patient-123"
    );
  });

  it("omits browser-derived actor defaults", async () => {
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
        }),
      })
    );
  });

  it("does not transmit build-time actor identity for protected operations views", async () => {
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

    expect(readinessOptions.headers).toEqual({ "x-clinician-key": "dashboard-secret" });
    expect(goNoGoOptions.headers).toEqual({ "x-clinician-key": "dashboard-secret" });
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

  it("does not allow the selector value to alter roster authority", async () => {
    const { fetchRoster } = await importApi();

    await fetchRoster({
      clinicianKey: "dashboard-secret",
      clinicId: "predicate-pilot",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/controlled-beta/clinician/patients",
      expect.objectContaining({
        headers: {
          "x-clinician-key": "dashboard-secret",
        },
      })
    );
  });

  it("does not use the legacy production-v1 scope for pilot roster requests", async () => {
    const { fetchRoster } = await importApi();

    await fetchRoster({
      clinicianKey: "dashboard-secret",
      clinicId: "predicate-pilot",
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).not.toContain("production-v1");
    expect(url).not.toContain("clinicId");
    expect(options.headers["x-practice-id"]).not.toBe("production-v1");
  });

  it("posts sanitized backup restore evidence", async () => {
    const { createBackupRestoreEvidence } = await importApi();

    await createBackupRestoreEvidence({
      clinicianKey: "dashboard-secret",
      clinicId: "alpha-v1",
      payload: {
        evidenceType: "restore_drill",
        subsystem: "database",
        status: "verified",
        verifiedBy: "ops-user",
        notes: "Patient Jane Example token secret-value was present.",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/pilot-ready-v1/backup-restore-evidence",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-clinician-key": "dashboard-secret",
        }),
        body: JSON.stringify({
          evidenceType: "restore_drill",
          subsystem: "database",
          status: "verified",
          verifiedBy: "ops-user",
          notes: "Notes omitted because they may contain PHI or secrets.",
        }),
      })
    );
  });

  it("posts sanitized clinical governance evidence", async () => {
    const { createClinicalGovernanceEvidence } = await importApi();

    await createClinicalGovernanceEvidence({
      clinicianKey: "dashboard-secret",
      clinicId: "alpha-v1",
      payload: {
        evidenceType: "clinical_review",
        status: "approved",
        reviewedBy: "reviewer-1",
        reviewerRole: "Medical Director",
        notes: "Patient Jane Example API key secret-value was discussed.",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://proxy.test/api/pilot-ready-v1/clinical-governance-evidence",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-clinician-key": "dashboard-secret",
        }),
        body: JSON.stringify({
          evidenceType: "clinical_review",
          status: "approved",
          reviewedBy: "reviewer-1",
          reviewerRole: "Medical Director",
          notes: "Notes omitted because they may contain PHI or secrets.",
        }),
      })
    );
  });
});

async function importApi() {
  vi.resetModules();
  return import("./api.js");
}
