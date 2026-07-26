import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "./Login.jsx";
import { beginClinicianAuthentication } from "./clinicianCognito.js";

vi.mock("./clinicianCognito.js", () => ({
  beginClinicianAuthentication: vi.fn(),
  resolveClinicianCognitoConfig: vi.fn(() => ({
    available: true,
    config: {},
    missing: [],
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("governed clinician login", () => {
  it("contains no clinic selector or access-key field", () => {
    render(<Login />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/access key/i)).not.toBeInTheDocument();
    expect(screen.getByText(/software-token MFA/i)).toBeInTheDocument();
  });

  it("opens Cognito Authorization Code with PKCE", async () => {
    beginClinicianAuthentication.mockResolvedValue(
      "https://clinician.auth.test/oauth2/authorize?code_challenge=challenge"
    );
    const navigateTo = vi.fn();
    render(<Login navigateTo={navigateTo} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue securely" }));

    await waitFor(() => expect(beginClinicianAuthentication).toHaveBeenCalledTimes(1));
    expect(navigateTo).toHaveBeenCalledWith(
      "https://clinician.auth.test/oauth2/authorize?code_challenge=challenge"
    );
  });
});
