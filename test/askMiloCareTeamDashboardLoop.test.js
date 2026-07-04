import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Roster from "../Roster.jsx";
import {
  fetchCareTeamUpdates,
  fetchRoster,
  markCareTeamUpdateReviewed,
} from "../api.js";

vi.mock("../api.js", () => ({
  fetchCareTeamUpdates: vi.fn(),
  fetchRoster: vi.fn(),
  markCareTeamUpdateReviewed: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Ask MILO care-team dashboard loop", () => {
  it("loads a dashboard-ready update, marks it reviewed, and preserves alpha-safe copy", async () => {
    fetchRoster.mockResolvedValue({
      patients: [
        {
          patientId: "patient-123",
          name: "Test Patient",
          latestSessionId: "session-789",
          latestSessionAt: "2026-07-04T12:00:00.000Z",
        },
      ],
    });
    fetchCareTeamUpdates.mockResolvedValue({
      updates: [
        {
          id: "update-ready-1",
          patientId: "patient-123",
          subjectUid: "subject-456",
          sessionId: "session-789",
          triggerMessage: "Patient reported worsening dizziness after medication change.",
          summaryDraft:
            "Patient describes increased dizziness after a recent medication change; review context and timing.",
          status: "dashboard_ready",
          timestamp: "2026-07-04T12:00:00.000Z",
        },
        {
          id: "update-reviewed-1",
          patientId: "patient-456",
          triggerMessage: "Previously reviewed concern.",
          summaryDraft: "Previously reviewed draft.",
          status: "reviewed_in_dashboard",
          timestamp: "2026-07-03T12:00:00.000Z",
          reviewedAt: "2026-07-03T13:00:00.000Z",
        },
      ],
    });
    markCareTeamUpdateReviewed.mockResolvedValue({
      update: {
        id: "update-ready-1",
        status: "reviewed_in_dashboard",
        reviewedAt: "2026-07-04T13:15:00.000Z",
      },
    });

    const { container } = render(
      React.createElement(Roster, {
        clinicId: "alpha-v1",
        clinicianKey: "clinician-key",
        onSelectPatient: vi.fn(),
        onLogout: vi.fn(),
      })
    );

    expect(await screen.findByText("Ask MILO Care Team Updates")).toBeInTheDocument();
    expect(screen.getByText("Patient patient-123")).toBeInTheDocument();
    expect(screen.getByText(/Session session-789/)).toBeInTheDocument();
    expect(
      screen.getByText("Patient reported worsening dizziness after medication change.")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark reviewed" })).toHaveLength(1);
    expect(fetchCareTeamUpdates).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() => {
      expect(markCareTeamUpdateReviewed).toHaveBeenCalledWith({
        id: "update-ready-1",
        clinicianKey: "clinician-key",
        clinicId: "alpha-v1",
      });
    });
    await waitFor(() => {
      expect(screen.getAllByText("Reviewed in dashboard")).toHaveLength(2);
    });

    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
    expect(screen.getByText(/Jul 4, 9:15 AM/)).toBeInTheDocument();
    expect(container).toHaveTextContent("Not sent outside MILO");
    expect(container).not.toHaveTextContent("provider recommendation received");
    expect(container).not.toHaveTextContent("Provider recommendation received");
    expect(container).not.toHaveTextContent("Sent outside MILO");
    expect(container).not.toHaveTextContent("message read");
    expect(container).not.toHaveTextContent("Message read");
  });
});
