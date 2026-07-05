import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BackupRestoreEvidencePanel from "./BackupRestoreEvidencePanel.jsx";
import {
  createBackupRestoreEvidence,
  fetchBackupRestoreEvidence,
} from "../api.js";

vi.mock("../api.js", () => ({
  createBackupRestoreEvidence: vi.fn(),
  fetchBackupRestoreEvidence: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BackupRestoreEvidencePanel", () => {
  it("renders existing evidence", async () => {
    fetchBackupRestoreEvidence.mockResolvedValue({
      evidence: [
        {
          id: "evidence-1",
          evidenceType: "restore_drill",
          subsystem: "database",
          status: "verified",
          verifiedAt: "2026-07-04T16:30:00.000Z",
          verifiedBy: "ops-clinician",
          notes: "Restore drill completed against staging snapshot.",
        },
      ],
    });

    render(
      <BackupRestoreEvidencePanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Backup Restore Evidence")).toBeInTheDocument();
    expect(screen.getByText("restore_drill")).toBeInTheDocument();
    expect(screen.getByText(/database/)).toBeInTheDocument();
    expect(screen.getAllByText("Verified")).toHaveLength(2);
    expect(screen.getByText(/Verified Jul 4/)).toBeInTheDocument();
    expect(screen.getByText("Verified by ops-clinician")).toBeInTheDocument();
    expect(
      screen.getByText("Restore drill completed against staging snapshot.")
    ).toBeInTheDocument();
    expect(fetchBackupRestoreEvidence).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("can submit new evidence", async () => {
    fetchBackupRestoreEvidence.mockResolvedValue({ evidence: [] });
    createBackupRestoreEvidence.mockResolvedValue({
      evidence: {
        id: "evidence-2",
        evidenceType: "backup_integrity",
        subsystem: "storage",
        status: "verified",
        verifiedAt: "2026-07-04T17:00:00.000Z",
        verifiedBy: "ops-user",
        notes: "Checksum verified for backup manifest.",
      },
    });

    render(
      <BackupRestoreEvidencePanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    await screen.findByText("No backup restore evidence is recorded yet.");

    fireEvent.change(screen.getByLabelText("Evidence type"), {
      target: { value: "backup_integrity" },
    });
    fireEvent.change(screen.getByLabelText("Subsystem"), {
      target: { value: "storage" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "verified" },
    });
    fireEvent.change(screen.getByLabelText("Verified by"), {
      target: { value: "ops-user" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Checksum verified for backup manifest." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record evidence" }));

    await waitFor(() => {
      expect(createBackupRestoreEvidence).toHaveBeenCalledWith({
        clinicianKey: "clinician-key",
        clinicId: "alpha-v1",
        payload: {
          evidenceType: "backup_integrity",
          subsystem: "storage",
          status: "verified",
          verifiedBy: "ops-user",
          notes: "Checksum verified for backup manifest.",
        },
      });
    });
    expect(await screen.findByText("backup_integrity")).toBeInTheDocument();
    expect(screen.getByText("Verified by ops-user")).toBeInTheDocument();
  });

  it("does not display PHI-heavy notes", async () => {
    fetchBackupRestoreEvidence.mockResolvedValue({
      evidence: [
        {
          id: "evidence-3",
          evidenceType: "restore_drill",
          subsystem: "database",
          status: "needs_verification",
          verifiedBy: "ops-user",
          notes: "Patient Jane Example MRN 123 was included in the restore sample.",
        },
      ],
    });

    const { container } = render(<BackupRestoreEvidencePanel />);

    expect(await screen.findByText("restore_drill")).toBeInTheDocument();
    expect(
      screen.getByText("Notes omitted because they may contain PHI or secrets.")
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Jane Example");
    expect(container).not.toHaveTextContent("MRN 123");
  });

  it("renders the empty state", async () => {
    fetchBackupRestoreEvidence.mockResolvedValue({ evidence: [] });

    render(<BackupRestoreEvidencePanel />);

    expect(
      await screen.findByText("No backup restore evidence is recorded yet.")
    ).toBeInTheDocument();
  });

  it("does not overclaim production readiness", async () => {
    fetchBackupRestoreEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: "restore_drill",
          subsystem: "database",
          status: "verified",
          verifiedBy: "ops-user",
        },
      ],
    });

    const { container } = render(<BackupRestoreEvidencePanel />);

    expect(await screen.findByText("restore_drill")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/production-ready/i);
    expect(container).not.toHaveTextContent(/ready for production/i);
    expect(container).not.toHaveTextContent(/production approved/i);
  });
});
