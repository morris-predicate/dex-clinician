import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OpenDxExplainabilityPanel from "./OpenDxExplainabilityPanel.jsx";
import { fetchOpenDxReasoningLedgers } from "../api.js";

vi.mock("../api.js", () => ({
  fetchOpenDxReasoningLedgers: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OpenDxExplainabilityPanel", () => {
  it("renders empty state", async () => {
    fetchOpenDxReasoningLedgers.mockResolvedValue({ ledgers: [] });

    render(
      <OpenDxExplainabilityPanel
        patientId="patient-123"
        sessionId="session-456"
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(
      await screen.findByText(
        "No OpenDx reasoning ledger is available for this interaction yet."
      )
    ).toBeInTheDocument();
    expect(fetchOpenDxReasoningLedgers).toHaveBeenCalledWith({
      patientId: "patient-123",
      sessionId: "session-456",
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("renders evidence, provenance, generatedAt, and version", async () => {
    fetchOpenDxReasoningLedgers.mockResolvedValue({
      ledgers: [
        {
          capabilitiesUsed: ["voice signal review", "conversation review"],
          longitudinalFindings: ["Symptom burden increased from prior interaction."],
          signalComparisons: ["Heart rate higher than recent range."],
          baselineComparisons: ["Voice energy differs from established baseline."],
          conversationFindings: ["Patient reported dizziness after medication change."],
          unresolvedQuestions: ["Clarify timing of medication change."],
          provenanceSources: ["MILO session session-456", "Apple Health vitals"],
          generatedAt: "2026-07-04T13:15:00.000Z",
          reasoningVersion: "opendx-ledger-v1",
        },
      ],
    });

    render(
      <OpenDxExplainabilityPanel
        patientId="patient-123"
        sessionId="session-456"
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Evidence used")).toBeInTheDocument();
    expect(screen.getByText("voice signal review")).toBeInTheDocument();
    expect(screen.getByText("Signal comparisons")).toBeInTheDocument();
    expect(screen.getByText("Baseline comparisons")).toBeInTheDocument();
    expect(screen.getByText("Unresolved questions")).toBeInTheDocument();
    expect(screen.getByText("Provenance")).toBeInTheDocument();
    expect(screen.getByText("MILO session session-456")).toBeInTheDocument();
    expect(screen.getByText(/Generated Jul 4/)).toBeInTheDocument();
    expect(screen.getByText("Version opendx-ledger-v1")).toBeInTheDocument();
  });

  it("does not render diagnosis, treatment recommendation, or provider opinion copy", async () => {
    fetchOpenDxReasoningLedgers.mockResolvedValue({
      ledger: {
        capabilitiesUsed: ["conversation review"],
        conversationFindings: ["Patient reported dizziness."],
        provenanceSources: ["MILO session session-456"],
        generatedAt: "2026-07-04T13:15:00.000Z",
        reasoningVersion: "opendx-ledger-v1",
      },
    });

    const { container } = render(
      <OpenDxExplainabilityPanel
        patientId="patient-123"
        sessionId="session-456"
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Evidence used")).toBeInTheDocument();
    });

    expect(container).not.toHaveTextContent(/\bdiagnosis\b/i);
    expect(container).not.toHaveTextContent(/treatment recommendation/i);
    expect(container).not.toHaveTextContent(/provider opinion/i);
  });

  it("renders safe access-denied copy for scoped 403s", async () => {
    fetchOpenDxReasoningLedgers.mockRejectedValue({
      status: 403,
      message: "Forbidden for clinician-key and private ledger payload",
    });

    const { container } = render(
      <OpenDxExplainabilityPanel
        patientId="patient-123"
        sessionId="session-456"
        clinicianKey="clinician-key"
      />
    );

    expect(
      await screen.findByText(
        "Access denied for this patient under the current practice context."
      )
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("clinician-key");
    expect(container).not.toHaveTextContent("private ledger payload");
  });
});
