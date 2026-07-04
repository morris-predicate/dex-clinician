import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AskMiloSessionEventsPanel from "./AskMiloSessionEventsPanel.jsx";
import { fetchChatSessionEvents } from "../api.js";

vi.mock("../api.js", () => ({
  fetchChatSessionEvents: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AskMiloSessionEventsPanel", () => {
  it("renders empty state", async () => {
    fetchChatSessionEvents.mockResolvedValue({ events: [] });

    render(
      <AskMiloSessionEventsPanel
        patientId="patient-123"
        subjectUid="subject-456"
        sessionId="session-789"
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(
      await screen.findByText(
        "No Ask MILO session events are available for this session yet."
      )
    ).toBeInTheDocument();
    expect(fetchChatSessionEvents).toHaveBeenCalledWith({
      patientId: "patient-123",
      subjectUid: "subject-456",
      sessionId: "session-789",
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("renders ordered user and assistant events", async () => {
    fetchChatSessionEvents.mockResolvedValue({
      events: [
        {
          id: "event-2",
          role: "assistant",
          content: "MILO response after patient concern.",
          timestamp: "2026-07-04T13:02:00.000Z",
        },
        {
          id: "event-1",
          role: "user",
          content: "Patient reports dizziness after medication change.",
          timestamp: "2026-07-04T13:01:00.000Z",
        },
      ],
    });

    const { container } = render(
      <AskMiloSessionEventsPanel patientId="patient-123" sessionId="session-789" />
    );

    expect(
      await screen.findByText("Patient reports dizziness after medication change.")
    ).toBeInTheDocument();
    const articles = container.querySelectorAll(".ask-milo-event");
    expect(within(articles[0]).getByText("Patient")).toBeInTheDocument();
    expect(within(articles[1]).getByText("MILO")).toBeInTheDocument();
  });

  it("hides system events", async () => {
    fetchChatSessionEvents.mockResolvedValue({
      events: [
        {
          id: "system-1",
          role: "system",
          content: "Internal system instruction.",
          timestamp: "2026-07-04T13:00:00.000Z",
        },
        {
          id: "event-1",
          role: "user",
          content: "Patient-visible event.",
          timestamp: "2026-07-04T13:01:00.000Z",
        },
      ],
    });

    render(<AskMiloSessionEventsPanel patientId="patient-123" sessionId="session-789" />);

    expect(await screen.findByText("Patient-visible event.")).toBeInTheDocument();
    expect(screen.queryByText("Internal system instruction.")).not.toBeInTheDocument();
  });

  it("shows ledger and care-team update references when present", async () => {
    fetchChatSessionEvents.mockResolvedValue({
      events: [
        {
          id: "event-1",
          role: "assistant",
          content: "MILO prepared traceable dashboard context.",
          timestamp: "2026-07-04T13:02:00.000Z",
          interactionId: "interaction-123",
          reasoningLedgerId: "ledger-456",
          careTeamUpdateId: "update-789",
        },
      ],
    });

    render(<AskMiloSessionEventsPanel patientId="patient-123" sessionId="session-789" />);

    expect(await screen.findByText("Interaction interaction-123")).toBeInTheDocument();
    expect(screen.getByText("Reasoning ledger ledger-456")).toBeInTheDocument();
    expect(screen.getByText("Care-team update update-789")).toBeInTheDocument();
  });

  it("does not render diagnosis or treatment copy", async () => {
    fetchChatSessionEvents.mockResolvedValue({
      events: [
        {
          id: "event-1",
          role: "assistant",
          content: "MILO prepared traceable dashboard context.",
          timestamp: "2026-07-04T13:02:00.000Z",
        },
      ],
    });

    const { container } = render(
      <AskMiloSessionEventsPanel patientId="patient-123" sessionId="session-789" />
    );

    expect(
      await screen.findByText("MILO prepared traceable dashboard context.")
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/\bdiagnosis\b/i);
    expect(container).not.toHaveTextContent(/treatment recommendation/i);
  });
});
