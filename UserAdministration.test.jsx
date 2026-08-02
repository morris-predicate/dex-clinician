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

  it("offers governed clinician and patient tabs without credential fields", async () => {
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    expect(await screen.findByRole("heading", { name: "Invite clinician" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Patients" })).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.getByText(/administrator never selects or sees the permanent password/i)).toBeTruthy();
  });

  it("submits the approved clinician role and trusted group then shows invitation sent", async () => {
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Example Clinician" } });
    fireEvent.change(screen.getByLabelText("Professional email"), { target: { value: "clinician@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(api.inviteManagedClinician).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ role: "clinician", group: "clinician", practiceId: "prerna-health" }) })));
    expect(await screen.findByText(/Invitation sent/)).toBeTruthy();
  });

  it("does not falsely render a patient as a clinician", async () => {
    api.fetchManagedPatients.mockResolvedValue({ patients: [{ reference: "enr-safe", displayName: "Approved identifier", practice: "Prerna Health", enrollmentState: "invited" }] });
    render(<UserAdministration clinicianKey="token" onBack={() => {}} onLogout={() => {}} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Patients" }));
    expect(await screen.findByText("Approved identifier")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Patients" })).toBeTruthy();
  });
});
