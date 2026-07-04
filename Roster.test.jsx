import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CareTeamUpdatesSection } from "./Roster.jsx";

afterEach(() => {
  cleanup();
});

describe("CareTeamUpdatesSection", () => {
  it("renders empty state", () => {
    render(<CareTeamUpdatesSection updates={[]} />);

    expect(screen.getByText("Ask MILO Care Team Updates")).toBeInTheDocument();
    expect(
      screen.getByText("No Ask MILO care-team updates are ready for review yet.")
    ).toBeInTheDocument();
  });

  it("renders returned update", () => {
    render(
      <CareTeamUpdatesSection
        updates={[
          {
            id: "update-1",
            patientId: "patient-123",
            subjectUid: "subject-456",
            sessionId: "session-789",
            triggerMessage: "Patient reported worsening dizziness after medication change.",
            summaryDraft:
              "Patient describes increased dizziness after a recent medication change; review context and timing.",
            timestamp: "2026-07-03T14:30:00.000Z",
            status: "Ready for review",
          },
        ]}
      />
    );

    expect(screen.getByText("Patient patient-123")).toBeInTheDocument();
    expect(screen.getByText(/Subject subject-456/)).toBeInTheDocument();
    expect(screen.getByText(/Session session-789/)).toBeInTheDocument();
    expect(
      screen.getByText("Patient reported worsening dizziness after medication change.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Patient describes increased dizziness after a recent medication change; review context and timing."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
    expect(screen.getByText("Not sent outside MILO")).toBeInTheDocument();
    expect(screen.getByText("Prepared for clinician dashboard review")).toBeInTheDocument();
  });

  it("copy does not imply real external delivery", () => {
    const { container } = render(
      <CareTeamUpdatesSection
        updates={[
          {
            id: "update-1",
            patientId: "patient-123",
            triggerMessage: "Please review elevated symptom concern.",
            summaryDraft: "Draft for clinician review.",
            timestamp: "2026-07-03T14:30:00.000Z",
            status: "dashboard_ready",
          },
        ]}
      />
    );

    expect(container).toHaveTextContent("Not sent outside MILO");
    expect(container).toHaveTextContent("Prepared for clinician dashboard review");
    expect(container).not.toHaveTextContent(/provider response/i);
    expect(container).not.toHaveTextContent(/read receipt/i);
    expect(container).not.toHaveTextContent(/outbound messaging/i);
    expect(container).not.toHaveTextContent(/\bSMS\b/i);
    expect(container).not.toHaveTextContent(/\bemail\b/i);
    expect(container).not.toHaveTextContent(/\bportal\b/i);
    expect(container).not.toHaveTextContent(/\bdelivered\b/i);
    expect(container).not.toHaveTextContent(/provider recommendation/i);
    expect(container).not.toHaveTextContent(/\brecommendation\b/i);
  });

  it("button appears for dashboard_ready", () => {
    render(
      <CareTeamUpdatesSection
        updates={[
          {
            id: "update-1",
            patientId: "patient-123",
            triggerMessage: "Please review elevated symptom concern.",
            summaryDraft: "Draft for clinician review.",
            status: "dashboard_ready",
          },
        ]}
        onMarkReviewed={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeInTheDocument();
  });

  it("button does not appear for reviewed_in_dashboard", () => {
    render(
      <CareTeamUpdatesSection
        updates={[
          {
            id: "update-1",
            patientId: "patient-123",
            triggerMessage: "Please review elevated symptom concern.",
            summaryDraft: "Draft for clinician review.",
            status: "reviewed_in_dashboard",
            reviewedAt: "2026-07-04T13:00:00.000Z",
          },
        ]}
        onMarkReviewed={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
    expect(screen.getByText("Reviewed in dashboard")).toBeInTheDocument();
  });

  it("successful review updates UI", async () => {
    function ReviewHarness() {
      const [updates, setUpdates] = React.useState([
        {
          id: "update-1",
          patientId: "patient-123",
          triggerMessage: "Please review elevated symptom concern.",
          summaryDraft: "Draft for clinician review.",
          status: "dashboard_ready",
          timestamp: "2026-07-04T12:00:00.000Z",
        },
      ]);

      async function handleMarkReviewed(updateId) {
        setUpdates((current) =>
          current.map((update) =>
            update.id === updateId
              ? {
                  ...update,
                  status: "reviewed_in_dashboard",
                  reviewedAt: "2026-07-04T13:00:00.000Z",
                }
              : update
          )
        );
      }

      return (
        <CareTeamUpdatesSection
          updates={updates}
          onMarkReviewed={handleMarkReviewed}
        />
      );
    }

    render(<ReviewHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() => {
      expect(screen.getByText("Reviewed in dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
    expect(screen.getByText(/Jul 4/)).toBeInTheDocument();
  });
});
