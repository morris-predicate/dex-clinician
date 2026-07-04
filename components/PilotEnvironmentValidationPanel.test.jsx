import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PilotEnvironmentValidationPanel from "./PilotEnvironmentValidationPanel.jsx";
import { fetchPilotEnvironmentValidation } from "../api.js";

vi.mock("../api.js", () => ({
  fetchPilotEnvironmentValidation: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PilotEnvironmentValidationPanel", () => {
  it("renders valid state", async () => {
    fetchPilotEnvironmentValidation.mockResolvedValue({
      valid: true,
      checkedAt: "2026-07-04T18:30:00.000Z",
      missingConfigNames: [],
      warnings: [],
    });

    render(
      <PilotEnvironmentValidationPanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Environment valid")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText(/Checked Jul 4/)).toBeInTheDocument();
    expect(screen.getByText("No missing config names reported.")).toBeInTheDocument();
    expect(fetchPilotEnvironmentValidation).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("renders missing config names", async () => {
    fetchPilotEnvironmentValidation.mockResolvedValue({
      valid: false,
      checkedAt: "2026-07-04T18:30:00.000Z",
      missingConfig: [
        { name: "OPENAI_API_KEY", value: "sk-secret-value" },
        { configName: "CLINICIAN_DASHBOARD_KEY", secret: "dashboard-secret" },
      ],
      warnings: [],
    });

    const { container } = render(<PilotEnvironmentValidationPanel />);

    expect(await screen.findByText("Environment invalid")).toBeInTheDocument();
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.getByText("OPENAI_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("CLINICIAN_DASHBOARD_KEY")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("sk-secret-value");
    expect(container).not.toHaveTextContent("dashboard-secret");
  });

  it("renders warnings", async () => {
    fetchPilotEnvironmentValidation.mockResolvedValue({
      valid: false,
      checkedAt: "2026-07-04T18:30:00.000Z",
      warnings: [
        "Optional telemetry sink is not configured.",
        { code: "LOW_RATE_LIMIT", value: "secret-warning-value" },
      ],
    });

    const { container } = render(<PilotEnvironmentValidationPanel />);

    expect(
      await screen.findByText("Optional telemetry sink is not configured.")
    ).toBeInTheDocument();
    expect(screen.getByText("LOW_RATE_LIMIT")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("secret-warning-value");
  });

  it("never displays secret values", async () => {
    fetchPilotEnvironmentValidation.mockResolvedValue({
      validation: {
        valid: false,
        checkedAt: "2026-07-04T18:30:00.000Z",
        missingConfigs: {
          STRIPE_SECRET_KEY: "stripe-secret-value",
          DATABASE_URL: { value: "postgres://secret-db-url" },
        },
        warnings: [
          {
            message: "API key: should-not-render",
            token: "warning-token-secret",
          },
        ],
      },
    });

    const { container } = render(<PilotEnvironmentValidationPanel />);

    expect(await screen.findByText("STRIPE_SECRET_KEY")).toBeInTheDocument();
    expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("stripe-secret-value");
    expect(container).not.toHaveTextContent("postgres://secret-db-url");
    expect(container).not.toHaveTextContent("should-not-render");
    expect(container).not.toHaveTextContent("warning-token-secret");
  });

  it("does not overclaim production readiness", async () => {
    fetchPilotEnvironmentValidation.mockResolvedValue({
      valid: true,
      checkedAt: "2026-07-04T18:30:00.000Z",
    });

    const { container } = render(<PilotEnvironmentValidationPanel />);

    expect(await screen.findByText("Environment valid")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/production-ready/i);
    expect(container).not.toHaveTextContent(/ready for production/i);
    expect(container).not.toHaveTextContent(/production approved/i);
  });
});
