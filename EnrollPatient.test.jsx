import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EnrollPatient from "./EnrollPatient.jsx";
import { createPatientEnrollment } from "./api.js";

vi.mock("./api.js", () => ({
  createPatientEnrollment: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function completeForm() {
  fireEvent.change(screen.getByLabelText("Patient MRN / Enrollment Identifier"), {
    target: { value: "STAGING-001" },
  });
  fireEvent.change(screen.getByLabelText("Patient email"), {
    target: { value: "controlled@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Confirm patient email"), {
    target: { value: "controlled@example.invalid" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("governed patient enrollment", () => {
  it("shows the required governed fields without unnecessary patient names", () => {
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    expect(screen.getByLabelText("Patient MRN / Enrollment Identifier")).toBeRequired();
    expect(screen.getByLabelText("Patient email")).toBeRequired();
    expect(screen.getByLabelText("Confirm patient email")).toBeRequired();
    expect(screen.getByRole("checkbox")).toBeRequired();
    expect(screen.queryByLabelText("Patient first name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Patient last name")).not.toBeInTheDocument();
  });

  it("requires MRN, valid matching email confirmation, and enrollment authorization", () => {
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    const submit = screen.getByRole("button", { name: "Enroll patient" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Patient MRN / Enrollment Identifier"), {
      target: { value: "STAGING-001" },
    });
    fireEvent.change(screen.getByLabelText("Patient email"), {
      target: { value: "controlled@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Confirm patient email"), {
      target: { value: "different@example.invalid" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    completeForm();
    expect(submit).toBeEnabled();
  });

  it("sends only the governed enrollment contract", async () => {
    createPatientEnrollment.mockResolvedValue({
      enrollment: {
        idempotent: false,
        state: "invited",
        activationStatus: "pending_activation",
        invitationStatus: "sent",
      },
    });
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    await screen.findByText("Patient enrolled");
    expect(createPatientEnrollment).toHaveBeenCalledWith({
      clinicianKey: "access-token",
      clinicId: "prerna-health",
      payload: {
        mrn: "STAGING-001",
        email: "controlled@example.invalid",
        consentConfirmed: true,
      },
    });
    const payload = createPatientEnrollment.mock.calls[0][0].payload;
    expect(payload).not.toHaveProperty("firstName");
    expect(payload).not.toHaveProperty("lastName");
    expect(payload).not.toHaveProperty("emailConfirmation");
    expect(payload).not.toHaveProperty("electronicContactAuthorized");
  });

  it("shows safe lifecycle state but never displays credentials or internal identity", async () => {
    createPatientEnrollment.mockResolvedValue({
      enrollment: {
        idempotent: false,
        state: "invited",
        activationStatus: "pending_activation",
        invitationStatus: "sent",
      },
    });
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    await waitFor(() => expect(screen.getByText("pending_activation")).toBeInTheDocument());
    expect(screen.getByText("sent")).toBeInTheDocument();
    expect(screen.queryByText(/temporary password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/subject uid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/enrollment code:/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate clicks while the governed request is pending", async () => {
    let resolveEnrollment;
    createPatientEnrollment.mockReturnValue(new Promise((resolve) => {
      resolveEnrollment = resolve;
    }));
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    completeForm();
    const submit = screen.getByRole("button", { name: "Enroll patient" });
    fireEvent.click(submit);
    expect(screen.getByRole("button", { name: "Creating patient identity…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Creating patient identity…" }));
    expect(createPatientEnrollment).toHaveBeenCalledTimes(1);
    resolveEnrollment({
      enrollment: {
        idempotent: false,
        state: "invited",
        activationStatus: "pending_activation",
        invitationStatus: "sent",
      },
    });
    await screen.findByText("Patient enrolled");
  });

  it("displays safe backend validation errors without logging patient data", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createPatientEnrollment.mockRejectedValue(new Error("A valid enrollment identifier is required"));
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    expect(await screen.findByText("A valid enrollment identifier is required")).toBeInTheDocument();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
