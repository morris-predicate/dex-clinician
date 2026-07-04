import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PilotReadyV1ReadinessPanel from "./PilotReadyV1ReadinessPanel.jsx";
import { fetchPilotReadyV1Readiness } from "../api.js";

vi.mock("../api.js", () => ({
  fetchPilotReadyV1Readiness: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PilotReadyV1ReadinessPanel", () => {
  it("renders milestone and status", async () => {
    fetchPilotReadyV1Readiness.mockResolvedValue({
      milestone: "Pilot-Ready v1",
      overallStatus: "partial",
      generatedAt: "2026-07-04T14:30:00.000Z",
      categories: [],
      blockers: [],
      items: [],
    });

    render(
      <PilotReadyV1ReadinessPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Pilot-Ready v1")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getByText(/Generated Jul 4/)).toBeInTheDocument();
    expect(fetchPilotReadyV1Readiness).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("renders categories", async () => {
    fetchPilotReadyV1Readiness.mockResolvedValue({
      milestone: "Pilot-Ready v1",
      overallStatus: "needs_verification",
      categoryStatuses: {
        ask_milo_loop: "complete",
        clinician_dashboard: "partial",
        deployment_checks: "needs_verification",
      },
      blockers: [],
      items: [],
    });

    render(<PilotReadyV1ReadinessPanel />);

    expect(await screen.findByText("Ask Milo Loop")).toBeInTheDocument();
    expect(screen.getByText("Clinician Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Deployment Checks")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getAllByText("Needs verification").length).toBeGreaterThan(0);
  });

  it("renders blockers and grouped items", async () => {
    fetchPilotReadyV1Readiness.mockResolvedValue({
      milestone: "Pilot-Ready v1",
      overallStatus: "partial",
      blockers: ["Confirm clinician auth configuration."],
      items: [
        {
          category: "Data freshness",
          label: "Verify readiness endpoint is connected to current deployment.",
          status: "needs_verification",
        },
      ],
    });

    render(<PilotReadyV1ReadinessPanel />);

    expect(await screen.findByText("Blockers")).toBeInTheDocument();
    expect(screen.getByText("Confirm clinician auth configuration.")).toBeInTheDocument();
    expect(screen.getByText("Data Freshness")).toBeInTheDocument();
    expect(
      screen.getByText("Verify readiness endpoint is connected to current deployment.")
    ).toBeInTheDocument();
  });

  it("does not overclaim production readiness when status is not ready", async () => {
    fetchPilotReadyV1Readiness.mockResolvedValue({
      milestone: "Pilot-Ready v1",
      overallStatus: "partial",
      categories: [],
      blockers: [],
      items: [],
    });

    const { container } = render(<PilotReadyV1ReadinessPanel />);

    expect(await screen.findByText("Partial")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/production-ready/i);
    expect(container).not.toHaveTextContent(/production ready/i);
    expect(container).not.toHaveTextContent(/ready for production/i);
  });
});
