import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StatusAuditPage from "./StatusAuditPage.jsx";

vi.mock("./PilotReadyV1ReadinessPanel.jsx", () => ({
  default: () => <section>Pilot-Ready v1 Status</section>,
}));
vi.mock("./PilotGoNoGoPanel.jsx", () => ({
  default: () => <section>Pilot Go/No-Go Checklist</section>,
}));
vi.mock("./PilotEnvironmentValidationPanel.jsx", () => ({
  default: () => <section>Pilot Environment Validation</section>,
}));
vi.mock("./BackupRestoreEvidencePanel.jsx", () => ({
  default: () => <section>Backup Restore Evidence</section>,
}));
vi.mock("./ClinicalGovernanceEvidencePanel.jsx", () => ({
  default: () => <section>Clinical Governance Evidence</section>,
}));
vi.mock("./MonitoringEventOperationsPanel.jsx", () => ({
  default: () => <section>Internal Monitoring Events</section>,
}));
vi.mock("./AuditEventOperationsPanel.jsx", () => ({
  default: () => <section>Internal Audit Events</section>,
}));

afterEach(() => {
  cleanup();
});

describe("StatusAuditPage", () => {
  it("contains the internal readiness and audit panels", () => {
    render(
      <StatusAuditPage
        clinicianKey="clinician-key"
        clinicId="predicate-pilot"
        onBack={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText("Status/Audit")).toBeInTheDocument();
    expect(screen.getByText("Pilot-Ready v1 Status")).toBeInTheDocument();
    expect(screen.getByText("Pilot Go/No-Go Checklist")).toBeInTheDocument();
    expect(screen.getByText("Pilot Environment Validation")).toBeInTheDocument();
    expect(screen.getByText("Backup Restore Evidence")).toBeInTheDocument();
    expect(screen.getByText("Clinical Governance Evidence")).toBeInTheDocument();
    expect(screen.getByText("Internal Monitoring Events")).toBeInTheDocument();
    expect(screen.getByText("Internal Audit Events")).toBeInTheDocument();
  });
});
