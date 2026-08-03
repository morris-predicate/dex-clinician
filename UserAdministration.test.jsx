import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserAdministration from "./UserAdministration.jsx";
import * as api from "./api.js";

vi.mock("./api.js", () => ({
  fetchManagedClinicians: vi.fn(), fetchManagedPatients: vi.fn(), inviteManagedClinician: vi.fn(),
  enrollManagedPatient: vi.fn(), runManagedClinicianAction: vi.fn(), runManagedPatientAction: vi.fn(), fetchUserAdministrationAudit: vi.fn(),
}));

describe("User Administration", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    api.fetchManagedClinicians.mockResolvedValue({ clinicians: [] });
    api.fetchManagedPatients.mockResolvedValue({ patients: [] });
    api.inviteManagedClinician.mockResolvedValue({ clinician: { invitationState: "sent" } });
  });

  it("offers governed clinician and patient tabs without infrastructure controls", async () => {
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    expect(await screen.findByRole("heading", { name: "Invite clinician" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Patients" })).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByLabelText(/trusted cognito group/i)).toBeNull();
    expect(screen.queryByLabelText(/patient-access scope/i)).toBeNull();
    expect(screen.getByText("Assigned patients")).toBeTruthy();
    expect(screen.getByText(/administrator never selects or sees the permanent password/i)).toBeTruthy();
  });

  it("submits the approved clinician role and shows a clinician-friendly invitation confirmation", async () => {
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Example Clinician" } });
    fireEvent.change(screen.getByLabelText("Professional email"), { target: { value: "clinician@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(api.inviteManagedClinician).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ role: "clinician", group: "clinician", practiceId: "prerna-health" }) })));
    expect(await screen.findByText(/Invitation sent successfully/)).toBeTruthy();
  });

  it("renders friendly status badges and empty-state copy instead of backend enums", async () => {
    api.fetchManagedClinicians.mockResolvedValue({ clinicians: [{ reference: "clin-safe", name: "Example", email: "clinician@example.test", practice: "Prerna Health", role: "clinician", accountState: "FORCE_CHANGE_PASSWORD", invitationState: "sent", mfaState: "required_pending", lastSignInCategory: "never", accessState: "active" }] });
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    expect(await screen.findByText("Invitation Pending")).toBeTruthy();
    expect(screen.getByText("Invitation Sent")).toBeTruthy();
    expect(screen.getByText("Pending MFA Setup")).toBeTruthy();
    expect(screen.getByText("Not yet")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.queryByText("FORCE_CHANGE_PASSWORD")).toBeNull();
  });

  it("does not falsely render a patient as a clinician", async () => {
    api.fetchManagedPatients.mockResolvedValue({ patients: [{ reference: "enr-safe", displayName: "Approved identifier", practice: "Prerna Health", enrollmentState: "invited" }] });
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Patients" }));
    expect(await screen.findByText("Approved identifier")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Patients" })).toBeTruthy();
  });
});
