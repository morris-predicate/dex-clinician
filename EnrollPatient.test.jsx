import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EnrollPatient from "./EnrollPatient.jsx";
import { createPatientEnrollment } from "./api.js";

vi.mock("./api.js", () => ({
  createPatientEnrollment: vi.fn(),
  regeneratePatientTemporaryPassword: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function completeForm() {
  fireEvent.change(screen.getByLabelText("Patient MRN"), { target: { value: "MRN-001" } });
  fireEvent.change(screen.getByLabelText("Patient email"), { target: { value: "patient@example.invalid" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("controlled beta enrollment", () => {
  it("requires the minimum fields and consent and protects against repeat submit", async () => {
    let resolve;
    createPatientEnrollment.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<EnrollPatient clinicianKey="key" clinicId="practice-a" onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "Enroll New Patient" })).toBeInTheDocument();
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    expect(screen.getByRole("button", { name: "Creating patient identity…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Creating patient identity…" }));
    expect(createPatientEnrollment).toHaveBeenCalledTimes(1);
    resolve({
      enrollment: {
        mrn: "MRN-001",
        patientUsername: "patient@example.invalid",
        subjectUid: "subj-1",
        invitationStatus: "credentials_generated",
      },
      temporaryPassword: "Temporary!7Password",
      loginUrl: "https://dex-pwa.netlify.app",
      idempotent: false,
    });
    await screen.findByText("Patient enrolled");
  });

  it("shows one-time credentials and complete copy controls only for a new provisioning result", async () => {
    createPatientEnrollment.mockResolvedValue({
      enrollment: {
        mrn: "MRN-001",
        patientUsername: "patient@example.invalid",
        subjectUid: "subj-1",
        invitationStatus: "credentials_generated",
      },
      temporaryPassword: "Temporary!7Password",
      loginUrl: "https://dex-pwa.netlify.app",
      idempotent: false,
    });
    render(<EnrollPatient clinicianKey="key" clinicId="practice-a" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    await waitFor(() => expect(screen.getByDisplayValue("Temporary!7Password")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Copy username" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy temporary password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy login URL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy complete patient instructions" })).toBeInTheDocument();
    expect(screen.getByText(/will disappear after refresh or navigation/i)).toBeInTheDocument();
  });

  it("never re-displays a password for an idempotent duplicate", async () => {
    createPatientEnrollment.mockResolvedValue({
      enrollment: {
        mrn: "MRN-001",
        patientUsername: "patient@example.invalid",
        subjectUid: "subj-1",
        invitationStatus: "credentials_generated",
      },
      idempotent: true,
    });
    render(<EnrollPatient clinicianKey="key" clinicId="practice-a" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    await screen.findByText(/already enrolled/i);
    expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate temporary password" })).toBeInTheDocument();
  });
});
