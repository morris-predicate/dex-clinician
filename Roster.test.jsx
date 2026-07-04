import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CareTeamUpdatesSection } from "./Roster.jsx";

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
            status: "Ready for review",
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
  });
});
