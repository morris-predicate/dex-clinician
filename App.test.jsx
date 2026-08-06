import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { fetchRoster, fetchUserAdministrationSession } from "./api.js";

vi.mock("./api.js", () => ({
  fetchRoster: vi.fn(),
  fetchUserAdministrationSession: vi.fn(),
}));

vi.mock("./Roster.jsx", () => ({
  default: () => <div>Controlled-beta roster</div>,
}));

vi.mock("./PatientDetail.jsx", () => ({ default: () => null }));
vi.mock("./UserAdministration.jsx", () => ({ default: () => null }));
vi.mock("./components/StatusAuditPage.jsx", () => ({ default: () => null }));

const KEY_STORAGE = "dex.clinician.key";
const MODE_STORAGE = "dex.clinician.auth-mode";

beforeEach(() => {
  window.history.replaceState({}, "", "/?clinic=predicate-admin");
  sessionStorage.clear();
  fetchRoster.mockResolvedValue({ patients: [] });
  fetchUserAdministrationSession.mockResolvedValue({ canManageUsers: true });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("authenticated clinician mode", () => {
  it("does not request a governed user-administration session after controlled-beta access-key login", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "controlled-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Controlled-beta roster")).toBeInTheDocument();
    await waitFor(() => expect(fetchUserAdministrationSession).not.toHaveBeenCalled());
  });

  it("retains the governed user-administration session check for an explicit Cognito mode", async () => {
    sessionStorage.setItem(KEY_STORAGE, "governed-access-token");
    sessionStorage.setItem(MODE_STORAGE, "governed-cognito");

    render(<App />);

    await waitFor(() => {
      expect(fetchUserAdministrationSession).toHaveBeenCalledWith({
        clinicianKey: "governed-access-token",
      });
    });
  });

  it("fails closed without probing governed administration for a legacy stored access-key session", async () => {
    sessionStorage.setItem(KEY_STORAGE, "controlled-key");

    render(<App />);

    expect(await screen.findByText("Controlled-beta roster")).toBeInTheDocument();
    expect(fetchUserAdministrationSession).not.toHaveBeenCalled();
  });
});
