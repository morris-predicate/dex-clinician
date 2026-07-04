import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PilotGoNoGoPanel from "./PilotGoNoGoPanel.jsx";
import { fetchPilotGoNoGoChecklist } from "../api.js";

vi.mock("../api.js", () => ({
  fetchPilotGoNoGoChecklist: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PilotGoNoGoPanel", () => {
  it("renders not_ready decision", async () => {
    fetchPilotGoNoGoChecklist.mockResolvedValue({
      decision: "not_ready",
      generatedAt: "2026-07-04T15:00:00.000Z",
      categories: [],
      requiredLaunchItems: [],
      notes: [],
    });

    render(
      <PilotGoNoGoPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Launch decision: not ready")).toBeInTheDocument();
    expect(screen.getByText("Pilot launch is not approved yet.")).toBeInTheDocument();
    expect(screen.getByText(/Generated Jul 4/)).toBeInTheDocument();
    expect(fetchPilotGoNoGoChecklist).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("required needs_verification blocks launch", async () => {
    fetchPilotGoNoGoChecklist.mockResolvedValue({
      decision: "not_ready",
      requiredLaunchItems: [
        {
          category: "Clinical operations",
          label: "Confirm clinician escalation owner.",
          status: "needs_verification",
        },
      ],
    });

    render(<PilotGoNoGoPanel />);

    expect(await screen.findByText("Pilot launch is not approved yet.")).toBeInTheDocument();
    expect(screen.getByText("Confirm clinician escalation owner.")).toBeInTheDocument();
    expect(screen.getByText("Needs verification")).toBeInTheDocument();
  });

  it("renders categories, required launch items, and notes", async () => {
    fetchPilotGoNoGoChecklist.mockResolvedValue({
      decision: "not_ready",
      categories: {
        data_quality: "go",
        operational_support: "no_go",
      },
      requiredLaunchItems: {
        launch_controls: [
          { label: "Validate rollback owner.", status: "no_go" },
          { label: "Confirm monitoring cadence.", status: "go" },
        ],
      },
      notes: ["Use internal dashboard review only until launch decision changes."],
    });

    render(<PilotGoNoGoPanel />);

    expect(await screen.findByText("Data Quality")).toBeInTheDocument();
    expect(screen.getByText("Operational Support")).toBeInTheDocument();
    expect(screen.getByText("Launch Controls")).toBeInTheDocument();
    expect(screen.getByText("Validate rollback owner.")).toBeInTheDocument();
    expect(screen.getByText("Confirm monitoring cadence.")).toBeInTheDocument();
    expect(
      screen.getByText("Use internal dashboard review only until launch decision changes.")
    ).toBeInTheDocument();
  });

  it("does not overclaim launch approval when decision is not_ready", async () => {
    fetchPilotGoNoGoChecklist.mockResolvedValue({
      decision: "not_ready",
      categories: [],
      requiredLaunchItems: [],
      notes: [],
    });

    const { container } = render(<PilotGoNoGoPanel />);

    expect(await screen.findByText("Pilot launch is not approved yet.")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/launch approved/i);
    expect(container).not.toHaveTextContent(/approved for launch/i);
    expect(container).not.toHaveTextContent(/ready to launch/i);
  });
});
