import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClinicalGovernanceEvidencePanel from "./ClinicalGovernanceEvidencePanel.jsx";
import {
  createClinicalGovernanceEvidence,
  fetchClinicalGovernanceEvidence,
} from "../api.js";

vi.mock("../api.js", () => ({
  createClinicalGovernanceEvidence: vi.fn(),
  fetchClinicalGovernanceEvidence: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ClinicalGovernanceEvidencePanel", () => {
  it("renders existing evidence", async () => {
    fetchClinicalGovernanceEvidence.mockResolvedValue({
      evidence: [
        {
          id: "governance-1",
          evidenceType: "clinical_review",
          status: "approved",
          reviewedBy: "clinical-lead",
          reviewerRole: "Medical Director",
          reviewedAt: "2026-07-04T16:30:00.000Z",
          notes: "Governance review completed for pilot criteria.",
        },
      ],
    });

    render(
      <ClinicalGovernanceEvidencePanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    expect(await screen.findByText("Clinical Governance Evidence")).toBeInTheDocument();
    expect(screen.getByText("clinical_review")).toBeInTheDocument();
    expect(screen.getAllByText("Approved")).toHaveLength(2);
    expect(screen.getByText("Reviewed by clinical-lead")).toBeInTheDocument();
    expect(screen.getByText(/Medical Director/)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed Jul 4/)).toBeInTheDocument();
    expect(
      screen.getByText("Governance review completed for pilot criteria.")
    ).toBeInTheDocument();
    expect(fetchClinicalGovernanceEvidence).toHaveBeenCalledWith({
      clinicianKey: "clinician-key",
      clinicId: "alpha-v1",
    });
  });

  it("can submit new evidence", async () => {
    fetchClinicalGovernanceEvidence.mockResolvedValue({ evidence: [] });
    createClinicalGovernanceEvidence.mockResolvedValue({
      evidence: {
        id: "governance-2",
        evidenceType: "clinical_review",
        status: "needs_review",
        reviewedAt: "2026-07-04T17:00:00.000Z",
        reviewedBy: "reviewer-1",
        reviewerRole: "Clinical Safety",
        notes: "Clinical review queued for final confirmation.",
      },
    });

    render(
      <ClinicalGovernanceEvidencePanel
        clinicianKey="clinician-key"
        clinicId="alpha-v1"
      />
    );

    await screen.findByText("No clinical governance evidence is recorded yet.");

    fireEvent.change(screen.getByLabelText("Evidence type"), {
      target: { value: "clinical_review" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "needs_review" },
    });
    fireEvent.change(screen.getByLabelText("Reviewed by"), {
      target: { value: "reviewer-1" },
    });
    fireEvent.change(screen.getByLabelText("Reviewer role"), {
      target: { value: "Clinical Safety" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Clinical review queued for final confirmation." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record evidence" }));

    await waitFor(() => {
      expect(createClinicalGovernanceEvidence).toHaveBeenCalledWith({
        clinicianKey: "clinician-key",
        clinicId: "alpha-v1",
        payload: {
          evidenceType: "clinical_review",
          status: "needs_review",
          reviewedBy: "reviewer-1",
          reviewerRole: "Clinical Safety",
          notes: "Clinical review queued for final confirmation.",
        },
      });
    });
    expect(await screen.findByText("clinical_review")).toBeInTheDocument();
    expect(screen.getByText("Reviewed by reviewer-1")).toBeInTheDocument();
  });

  it("shows approved launch signoff when explicitly present", async () => {
    fetchClinicalGovernanceEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: "launch_signoff",
          status: "approved",
          reviewedBy: "clinical-lead",
          reviewerRole: "Medical Director",
          reviewedAt: "2026-07-04T18:00:00.000Z",
        },
      ],
    });

    render(<ClinicalGovernanceEvidencePanel />);

    expect(await screen.findByText("launch_signoff")).toBeInTheDocument();
    expect(screen.getByText("Launch signoff approved.")).toBeInTheDocument();
  });

  it("does not display PHI or secret-heavy notes", async () => {
    fetchClinicalGovernanceEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: "clinical_review",
          status: "needs_review",
          reviewedBy: "clinical-lead",
          reviewerRole: "Medical Director",
          notes: "Patient Jane Example MRN 123 token secret-value was discussed.",
        },
      ],
    });

    const { container } = render(<ClinicalGovernanceEvidencePanel />);

    expect(await screen.findByText("clinical_review")).toBeInTheDocument();
    expect(
      screen.getByText("Notes omitted because they may contain PHI or secrets.")
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Jane Example");
    expect(container).not.toHaveTextContent("MRN 123");
    expect(container).not.toHaveTextContent("secret-value");
  });

  it("does not imply launch approval for non-signoff evidence", async () => {
    fetchClinicalGovernanceEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: "clinical_review",
          status: "approved",
          reviewedBy: "clinical-lead",
          reviewerRole: "Medical Director",
        },
      ],
    });

    const { container } = render(<ClinicalGovernanceEvidencePanel />);

    expect(await screen.findByText("clinical_review")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Launch signoff approved.");
    expect(container).not.toHaveTextContent(/launch approved/i);
    expect(container).not.toHaveTextContent(/approved for launch/i);
    expect(container).not.toHaveTextContent(/ready to launch/i);
  });
});
