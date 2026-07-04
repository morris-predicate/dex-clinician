import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuditEventOperationsPanel from "./AuditEventOperationsPanel.jsx";
import { fetchInternalAuditEvents } from "../api.js";

vi.mock("../api.js", () => ({
  fetchInternalAuditEvents: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuditEventOperationsPanel", () => {
  it("renders audit events", async () => {
    fetchInternalAuditEvents.mockResolvedValue({
      events: [
        {
          id: "audit-1",
          eventType: "pilot_readiness_checked",
          actorType: "clinician_dashboard",
          outcome: "success",
          resourceType: "readiness_report",
          resourceId: "ready-1",
          patientId: "patient-1",
          subjectUid: "subject-1",
          sessionId: "session-1",
          createdAt: "2026-07-04T15:20:00.000Z",
          metadata: {
            source: "pilot-ready-v1",
            itemCount: 3,
          },
        },
      ],
    });

    render(
      <AuditEventOperationsPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Internal Audit Events")).toBeInTheDocument();
    expect(
      screen.getByText("Internal operations view. Metadata is sanitized and may omit PHI-heavy details.")
    ).toBeInTheDocument();
    expect(screen.getByText("pilot_readiness_checked")).toBeInTheDocument();
    expect(screen.getByText(/clinician_dashboard/)).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("readiness_report: ready-1")).toBeInTheDocument();
    expect(screen.getByText("Patient patient-1")).toBeInTheDocument();
    expect(screen.getByText("Subject subject-1")).toBeInTheDocument();
    expect(screen.getByText("Session session-1")).toBeInTheDocument();
    expect(screen.getByText("pilot-ready-v1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("makes failure events visible", async () => {
    fetchInternalAuditEvents.mockResolvedValue({
      events: [
        {
          id: "audit-2",
          eventType: "care_team_update_review_failed",
          actorType: "system",
          outcome: "failure",
          resourceType: "care_team_update",
          resourceId: "update-1",
          createdAt: "2026-07-04T15:25:00.000Z",
        },
      ],
    });

    render(<AuditEventOperationsPanel />);

    expect(await screen.findByText("care_team_update_review_failed")).toBeInTheDocument();
    expect(screen.getByText("Failure")).toBeInTheDocument();
    expect(screen.getByText("care_team_update: update-1")).toBeInTheDocument();
  });

  it("passes filters and limit to the API helper", async () => {
    fetchInternalAuditEvents.mockResolvedValue({ events: [] });

    render(
      <AuditEventOperationsPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
        patientId="patient-1"
        subjectUid="subject-1"
        sessionId="session-1"
        eventType="pilot_readiness_checked"
        outcome="failure"
        limit={10}
      />
    );

    await screen.findByText("No internal audit events are available yet.");

    expect(fetchInternalAuditEvents).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
      patientId: "patient-1",
      subjectUid: "subject-1",
      sessionId: "session-1",
      eventType: "pilot_readiness_checked",
      outcome: "failure",
      limit: 10,
    });
  });

  it("does not display PHI-heavy metadata fields", async () => {
    fetchInternalAuditEvents.mockResolvedValue({
      events: [
        {
          id: "audit-3",
          eventType: "metadata_sanitized",
          actorType: "system",
          outcome: "success",
          metadata: {
            message: "Patient reports chest pain and dizziness.",
            transcript: "Raw transcript body",
            token: "secret-token",
            patientName: "Jane Example",
            endpoint: "/api/internal/audit-events",
            retryCount: 2,
          },
        },
      ],
    });

    const { container } = render(<AuditEventOperationsPanel />);

    expect(await screen.findByText("metadata_sanitized")).toBeInTheDocument();
    expect(screen.getByText("/api/internal/audit-events")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Patient reports chest pain and dizziness.");
    expect(container).not.toHaveTextContent("Raw transcript body");
    expect(container).not.toHaveTextContent("secret-token");
    expect(container).not.toHaveTextContent("Jane Example");
  });

  it("renders the empty state", async () => {
    fetchInternalAuditEvents.mockResolvedValue({ events: [] });

    render(<AuditEventOperationsPanel />);

    expect(
      await screen.findByText("No internal audit events are available yet.")
    ).toBeInTheDocument();
  });
});
