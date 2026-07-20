import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "./Login.jsx";
import { fetchRoster } from "./api.js";

vi.mock("./api.js", () => ({
  fetchRoster: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("controlled-beta login contexts", () => {
  it("renders only the approved contexts", () => {
    render(<Login clinicId="arbitrary-practice" onAuth={vi.fn()} />);

    expect(screen.getByRole("option", { name: "Prerna Health" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Predicate Admin" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha v1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Production / Demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "July 20 Controlled Beta" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("prerna-health");
  });

  it("submits only an allowlisted display context", async () => {
    fetchRoster.mockResolvedValue({ patients: [] });
    render(<Login clinicId="arbitrary-practice" onAuth={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "controlled-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(fetchRoster).toHaveBeenCalledWith({
        clinicianKey: "controlled-key",
        clinicId: "prerna-health",
      });
    });
  });

  it("uses the same controlled request contract for Predicate Admin", async () => {
    fetchRoster.mockResolvedValue({ patients: [] });
    render(<Login clinicId="predicate-admin" onAuth={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "controlled-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(fetchRoster).toHaveBeenCalledWith({
        clinicianKey: "controlled-key",
        clinicId: "predicate-admin",
      });
    });
  });

  it("distinguishes an HTTP authentication rejection from a network failure", async () => {
    fetchRoster.mockRejectedValueOnce({ status: 401 });
    const { unmount } = render(<Login clinicId="prerna-health" onAuth={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "controlled-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Incorrect access key.")).toBeInTheDocument();

    unmount();
    fetchRoster.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Login clinicId="prerna-health" onAuth={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "controlled-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByText("Couldn't reach the server. Please try again.")
    ).toBeInTheDocument();
  });

  it("opens the authenticated application after a successful HTTP response", async () => {
    const onAuth = vi.fn();
    fetchRoster.mockResolvedValue({ patients: [] });
    render(<Login clinicId="prerna-health" onAuth={onAuth} />);
    fireEvent.change(screen.getByPlaceholderText("Access key"), {
      target: { value: "controlled-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith("controlled-key"));
  });
});
