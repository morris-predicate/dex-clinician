import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EnrollPatient from "./EnrollPatient.jsx";
import { createPatientEnrollment } from "./api.js";

vi.mock("./api.js", () => ({
  createPatientEnrollment: vi.fn(),
  resendPatientEnrollment: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function completeForm() {
  fireEvent.change(screen.getByLabelText("Patient first name"), {
    target: { value: "Fabricated" },
  });
  fireEvent.change(screen.getByLabelText("Patient last name"), {
    target: { value: "Acceptance" },
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
  it("requires name, matching email confirmation, and electronic-contact authorization", () => {
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    const submit = screen.getByRole("button", { name: "Enroll patient" });
    expect(submit).toBeDisabled();
    completeForm();
    expect(submit).toBeEnabled();
  });

  it("sends only the governed enrollment contract", async () => {
    createPatientEnrollment.mockResolvedValue({
      enrollment: {
        enrollmentId: "enr_fabricated",
        status: "provisioned",
        emailDeliveryState: "sent",
      },
      idempotent: false,
    });
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    await screen.findByText("Patient enrolled");
    expect(createPatientEnrollment).toHaveBeenCalledWith({
      clinicianKey: "access-token",
      clinicId: "prerna-health",
      payload: {
        firstName: "Fabricated",
        lastName: "Acceptance",
        email: "controlled@example.invalid",
        emailConfirmation: "controlled@example.invalid",
        electronicContactAuthorized: true,
      },
    });
  });

  it("shows delivery state but never displays credentials, code, username, or subject", async () => {
    createPatientEnrollment.mockResolvedValue({
      enrollment: {
        enrollmentId: "enr_fabricated",
        status: "provisioned",
        emailDeliveryState: "sent",
      },
      idempotent: false,
    });
    render(<EnrollPatient clinicianKey="access-token" clinicId="prerna-health" onBack={() => {}} />);
    completeForm();
    fireEvent.click(screen.getByRole("button", { name: "Enroll patient" }));
    await waitFor(() => expect(screen.getByText("enr_fabricated")).toBeInTheDocument());
    expect(screen.getByText("sent")).toBeInTheDocument();
    expect(screen.queryByText(/temporary password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/subject uid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/enrollment code:/i)).not.toBeInTheDocument();
  });
});
