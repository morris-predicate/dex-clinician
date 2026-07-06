import React from "react";
import AuditEventOperationsPanel from "./AuditEventOperationsPanel.jsx";
import BackupRestoreEvidencePanel from "./BackupRestoreEvidencePanel.jsx";
import ClinicalGovernanceEvidencePanel from "./ClinicalGovernanceEvidencePanel.jsx";
import MonitoringEventOperationsPanel from "./MonitoringEventOperationsPanel.jsx";
import PilotEnvironmentValidationPanel from "./PilotEnvironmentValidationPanel.jsx";
import PilotGoNoGoPanel from "./PilotGoNoGoPanel.jsx";
import PilotReadyV1ReadinessPanel from "./PilotReadyV1ReadinessPanel.jsx";

export default function StatusAuditPage({ clinicianKey, clinicId, onBack, onLogout }) {
  return (
    <div className="page page-operations">
      <header className="page-header">
        <div>
          <div className="page-title">Status/Audit</div>
          <div className="page-sub">
            Internal Predicate operations view for {clinicId}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn-secondary-small" type="button" onClick={onBack}>
            Patients
          </button>
          <button className="btn-text" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="operations-note">
        Internal operations and audit surfaces. Do not use this page as patient-facing
        clinical workflow.
      </div>

      <PilotReadyV1ReadinessPanel clinicianKey={clinicianKey} clinicId={clinicId} />
      <PilotGoNoGoPanel clinicianKey={clinicianKey} clinicId={clinicId} />
      <PilotEnvironmentValidationPanel clinicianKey={clinicianKey} clinicId={clinicId} />
      <BackupRestoreEvidencePanel clinicianKey={clinicianKey} clinicId={clinicId} />
      <ClinicalGovernanceEvidencePanel clinicianKey={clinicianKey} clinicId={clinicId} />
      <MonitoringEventOperationsPanel
        clinicianKey={clinicianKey}
        clinicId={clinicId}
        limit={25}
      />
      <AuditEventOperationsPanel
        clinicianKey={clinicianKey}
        clinicId={clinicId}
        limit={25}
      />
    </div>
  );
}
