import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OpenDxInteractionTracePanel from "./OpenDxInteractionTracePanel.jsx";
import { fetchOpenDxInteractionTrace } from "../api.js";

vi.mock("../api.js", () => ({
  fetchOpenDxInteractionTrace: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OpenDxInteractionTracePanel", () => {
  it("renders complete trace", async () => {
    fetchOpenDxInteractionTrace.mockResolvedValue({
      trace: {
        interactionId: "interaction-123",
        traceComplete: true,
        missingArtifacts: [],
        chatEventCount: 2,
        reasoningLedgerPresent: true,
        longitudinalObservationCount: 3,
        careTeamUpdatePresent: true,
      },
    });

    render(
      <OpenDxInteractionTracePanel
        patientId="patient-123"
        subjectUid="subject-456"
        sessionId="session-789"
        interactionId="interaction-123"
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Interaction interaction-123")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Chat events")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("Present")).toHaveLength(2);
    expect(screen.getByText("Longitudinal observations")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(fetchOpenDxInteractionTrace).toHaveBeenCalledWith({
      patientId: "patient-123",
      subjectUid: "subject-456",
      sessionId: "session-789",
      interactionId: "interaction-123",
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("renders missing artifacts", async () => {
    fetchOpenDxInteractionTrace.mockResolvedValue({
      interactionId: "interaction-123",
      traceComplete: false,
      missingArtifacts: ["reasoning_ledger", "care_team_update"],
      chatEventCount: 1,
      reasoningLedgerPresent: false,
      longitudinalObservationCount: 0,
      careTeamUpdatePresent: false,
    });

    render(<OpenDxInteractionTracePanel interactionId="interaction-123" />);

    expect(await screen.findByText("Missing artifacts")).toBeInTheDocument();
    expect(screen.getByText("Reasoning Ledger")).toBeInTheDocument();
    expect(screen.getByText("Care Team Update")).toBeInTheDocument();
    expect(screen.getAllByText("Missing")).toHaveLength(2);
    expect(screen.getByText("Needs verification")).toBeInTheDocument();
  });

  it("handles empty trace", async () => {
    fetchOpenDxInteractionTrace.mockResolvedValue(null);

    render(<OpenDxInteractionTracePanel interactionId="interaction-123" />);

    expect(
      await screen.findByText(
        "No OpenDx interaction trace is available for this interaction yet."
      )
    ).toBeInTheDocument();
  });

  it("does not render diagnosis or treatment copy", async () => {
    fetchOpenDxInteractionTrace.mockResolvedValue({
      trace: {
        interactionId: "interaction-123",
        traceComplete: true,
        chatEventCount: 1,
        reasoningLedgerPresent: true,
        longitudinalObservationCount: 0,
        careTeamUpdatePresent: false,
      },
    });

    const { container } = render(
      <OpenDxInteractionTracePanel interactionId="interaction-123" />
    );

    expect(await screen.findByText("Interaction interaction-123")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/\bdiagnosis\b/i);
    expect(container).not.toHaveTextContent(/treatment recommendation/i);
  });

  it("renders safe access-denied copy for scoped 403s", async () => {
    fetchOpenDxInteractionTrace.mockRejectedValue({
      status: 403,
      message: "Forbidden for clinician-key and private trace payload",
    });

    const { container } = render(
      <OpenDxInteractionTracePanel
        patientId="patient-123"
        sessionId="session-789"
        interactionId="interaction-123"
        clinicianKey="clinician-key"
      />
    );

    expect(
      await screen.findByText(
        "Access denied for this patient under the current practice context."
      )
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("clinician-key");
    expect(container).not.toHaveTextContent("private trace payload");
  });
});
