import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Roster, { CareTeamUpdatesSection } from "./Roster.jsx";
import { fetchCareTeamUpdates, fetchRoster } from "./api.js";

vi.mock("./api.js", () => ({
  fetchCareTeamUpdates: vi.fn(),
  fetchRoster: vi.fn(),
  markCareTeamUpdateReviewed: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockRosterLoads({ patients = [], updates = [] } = {}) {
  fetchRoster.mockResolvedValue({ patients, count: patients.length, clinicId: "predicate-pilot" });
  fetchCareTeamUpdates.mockResolvedValue({ updates, count: updates.length });
}

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

  it("renders safe access-denied copy when review is denied", async () => {
    const onMarkReviewed = vi.fn().mockRejectedValue({
      status: 403,
      message: "Forbidden for clinician-key and private update payload",
    });

    const { container } = render(
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
        onMarkReviewed={onMarkReviewed}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    expect(
      await screen.findByText(
        "Access denied for this patient under the current practice context."
      )
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("clinician-key");
    expect(container).not.toHaveTextContent("private update payload");
  });
});

describe("Roster", () => {
  it("keeps the default clinician dashboard patient-first without internal status panels", async () => {
    mockRosterLoads();

    const { container } = render(
      <Roster
        clinicId="predicate-pilot"
        clinicianKey="clinician-key"
        onSelectPatient={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(await screen.findByText("No patients enrolled in this clinic yet.")).toBeInTheDocument();
    expect(container).toHaveTextContent("Ask MILO Care Team Updates");
    expect(container).not.toHaveTextContent("Pilot-Ready v1 status");
    expect(container).not.toHaveTextContent("Pilot go/no-go checklist");
    expect(container).not.toHaveTextContent("Pilot environment validation");
    expect(container).not.toHaveTextContent("Backup Restore Evidence");
    expect(container).not.toHaveTextContent("Clinical Governance Evidence");
    expect(container).not.toHaveTextContent("Internal Monitoring Events");
    expect(container).not.toHaveTextContent("Internal Audit Events");
    expect(screen.queryByRole("button", { name: "Status/Audit" })).not.toBeInTheDocument();
  });

  it("shows Status/Audit navigation only for internal users", async () => {
    const onOpenStatusAudit = vi.fn();
    mockRosterLoads();

    render(
      <Roster
        clinicId="predicate-pilot"
        clinicianKey="clinician-key"
        canAccessStatusAudit
        onOpenStatusAudit={onOpenStatusAudit}
        onSelectPatient={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const button = await screen.findByRole("button", { name: "Status/Audit" });
    fireEvent.click(button);

    expect(onOpenStatusAudit).toHaveBeenCalledTimes(1);
  });

  it("does not expose enrollment actions in the clinician triage dashboard", async () => {
    mockRosterLoads();

    render(
      <Roster
        clinicId="predicate-pilot"
        clinicianKey="clinician-key"
        onSelectPatient={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(await screen.findByText("No patients enrolled in this clinic yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enroll Patient" })).not.toBeInTheDocument();
  });
});
