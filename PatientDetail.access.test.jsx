import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PatientDetail from "./PatientDetail.jsx";
import {
  fetchPatient,
  fetchPatientBaseline,
} from "./api.js";

vi.mock("highcharts", () => ({
  default: {},
}));

vi.mock("highcharts-react-official", () => ({
  default: () => null,
}));

vi.mock("react-force-graph-2d", () => ({
  default: () => null,
}));

vi.mock("./components/AskMiloSessionEventsPanel.jsx", () => ({
  default: () => null,
}));

vi.mock("./components/OpenDxExplainabilityPanel.jsx", () => ({
  default: () => null,
}));

vi.mock("./api.js", () => ({
  buildClinicianHeaders: vi.fn(() => ({
    "x-clinician-key": "clinician-key",
    "x-clinician-id": "unknown_clinician",
    "x-clinician-role": "clinician",
    "x-practice-id": "alpha-v1",
  })),
  fetchPatient: vi.fn(),
  fetchPatientBaseline: vi.fn(),
  fetchPatientVitals: vi.fn(),
  fetchPatientSignals: vi.fn(),
  fetchTranscript: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PatientDetail access scoping", () => {
  it("renders safe access-denied copy for patient 403s", async () => {
    fetchPatient.mockRejectedValue({
      status: 403,
      message: "Forbidden for clinician-key and private patient payload",
    });
    fetchPatientBaseline.mockResolvedValue({});

    const { container } = render(
      <PatientDetail
        patientId="patient-123"
        clinicId="alpha-v1"
        clinicianKey="clinician-key"
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(
      await screen.findByText(
        "Access denied for this patient under the current practice context."
      )
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("clinician-key");
    expect(container).not.toHaveTextContent("private patient payload");
    expect(fetchPatient).toHaveBeenCalledWith({
      patientId: "patient-123",
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });
});
