import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MonitoringEventOperationsPanel from "./MonitoringEventOperationsPanel.jsx";
import { fetchInternalMonitoringEvents } from "../api.js";

vi.mock("../api.js", () => ({
  fetchInternalMonitoringEvents: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MonitoringEventOperationsPanel", () => {
  it("renders monitoring events", async () => {
    fetchInternalMonitoringEvents.mockResolvedValue({
      events: [
        {
          id: "monitor-1",
          eventType: "pilot_monitoring_check",
          subsystem: "readiness",
          severity: "info",
          outcome: "success",
          resourceType: "environment",
          resourceId: "pilot-v1",
          createdAt: "2026-07-04T15:20:00.000Z",
          detail: {
            checkCount: 4,
            source: "pilot-monitor",
          },
        },
      ],
    });

    render(
      <MonitoringEventOperationsPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Internal Monitoring Events")).toBeInTheDocument();
    expect(screen.getByText("pilot_monitoring_check")).toBeInTheDocument();
    expect(screen.getByText(/readiness/)).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("environment: pilot-v1")).toBeInTheDocument();
    expect(screen.getByText("pilot-monitor")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("makes critical and failure events visible", async () => {
    fetchInternalMonitoringEvents.mockResolvedValue({
      events: [
        {
          id: "monitor-2",
          eventType: "pilot_monitoring_failed",
          subsystem: "audit",
          severity: "critical",
          outcome: "failure",
          resourceType: "audit_stream",
          resourceId: "audit-stream-1",
          createdAt: "2026-07-04T15:25:00.000Z",
        },
      ],
    });

    render(<MonitoringEventOperationsPanel />);

    expect(await screen.findByText("pilot_monitoring_failed")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Failure")).toBeInTheDocument();
    expect(screen.getByText("audit_stream: audit-stream-1")).toBeInTheDocument();
  });

  it("passes filters and limit to the API helper", async () => {
    fetchInternalMonitoringEvents.mockResolvedValue({ events: [] });

    render(
      <MonitoringEventOperationsPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
        subsystem="opendx"
        severity="critical"
        outcome="failure"
        patientId="patient-1"
        subjectUid="subject-1"
        sessionId="session-1"
        limit={10}
      />
    );

    await screen.findByText("No internal monitoring events are available yet.");

    expect(fetchInternalMonitoringEvents).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
      subsystem: "opendx",
      severity: "critical",
      outcome: "failure",
      patientId: "patient-1",
      subjectUid: "subject-1",
      sessionId: "session-1",
      limit: 10,
    });
  });

  it("renders the empty state", async () => {
    fetchInternalMonitoringEvents.mockResolvedValue({ events: [] });

    render(<MonitoringEventOperationsPanel />);

    expect(
      await screen.findByText("No internal monitoring events are available yet.")
    ).toBeInTheDocument();
  });

  it("does not display secrets or PHI-heavy detail", async () => {
    fetchInternalMonitoringEvents.mockResolvedValue({
      events: [
        {
          id: "monitor-3",
          eventType: "detail_sanitized",
          subsystem: "care-team",
          severity: "warning",
          outcome: "success",
          detail: {
            token: "secret-token",
            password: "secret-password",
            patientName: "Jane Example",
            transcript: "Patient reports chest pain and dizziness.",
            retryCount: 2,
            endpoint: "/api/internal/monitoring-events",
          },
        },
      ],
    });

    const { container } = render(<MonitoringEventOperationsPanel />);

    expect(await screen.findByText("detail_sanitized")).toBeInTheDocument();
    expect(screen.getByText("/api/internal/monitoring-events")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("secret-token");
    expect(container).not.toHaveTextContent("secret-password");
    expect(container).not.toHaveTextContent("Jane Example");
    expect(container).not.toHaveTextContent("Patient reports chest pain and dizziness.");
  });
});
