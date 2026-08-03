import React, { useCallback, useEffect, useState } from "react";
import { enrollManagedPatient, fetchManagedClinicians, fetchManagedPatients, fetchUserAdministrationAudit, inviteManagedClinician, runManagedClinicianAction, runManagedPatientAction } from "./api.js";

const EMPTY_CLINICIAN = { fullName: "", email: "", practiceId: "prerna-health", role: "clinician", group: "clinician", patientAccessScope: "assigned_patients" };
const EMPTY_PATIENT = { mrn: "", email: "", consentConfirmed: false };
const ACTIONS = [["resend", "Resend Invitation"], ["suspend", "Suspend Access"], ["reactivate", "Reactivate Access"], ["revoke_sessions", "Revoke Sessions"]];
const STATUS_LABELS = {
  force_change_password: "Invitation Pending",
  required_pending: "Pending MFA Setup",
  sent: "Invitation Sent",
  resent: "Invitation Resent",
  never: "Not yet",
  active: "Active",
  inactive: "Inactive",
  not_available: "No wearable connected",
  pending: "Awaiting consent",
  invited: "Invitation Pending",
  pending_activation: "Awaiting activation",
  authorized: "Authorized",
  eligible: "Eligible",
  clinician: "Clinician",
  practice_admin: "Practice administrator",
};

function displayStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return STATUS_LABELS[normalized] || (value ? String(value).replaceAll("_", " ") : "Not available");
}

export default function UserAdministration({ clinicianKey, onBack, onLogout }) {
  const [tab, setTab] = useState("clinicians"), [clinicians, setClinicians] = useState([]), [patients, setPatients] = useState([]);
  const [clinicianForm, setClinicianForm] = useState(EMPTY_CLINICIAN), [patientForm, setPatientForm] = useState(EMPTY_PATIENT);
  const [audit, setAudit] = useState([]), [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setError(""); try { const [c,p] = await Promise.all([fetchManagedClinicians({ clinicianKey }), fetchManagedPatients({ clinicianKey })]); setClinicians(c.clinicians || []); setPatients(p.patients || []); } catch (err) { if (err.status === 401) onLogout(); else setError(err.message); } }, [clinicianKey, onLogout]);
  useEffect(() => { load(); }, [load]);
  async function invite(event) { event.preventDefault(); setBusy(true); setError(""); setMessage(""); try { await inviteManagedClinician({ clinicianKey, payload: clinicianForm }); setClinicianForm(EMPTY_CLINICIAN); setMessage("Invitation sent successfully. The clinician will receive an email to create a password and enroll multi-factor authentication."); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function enroll(event) { event.preventDefault(); setBusy(true); setError(""); setMessage(""); try { await enrollManagedPatient({ clinicianKey, payload: patientForm }); setPatientForm(EMPTY_PATIENT); setMessage("Enrollment invitation sent."); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function act(kind, reference, action) { setBusy(true); setError(""); try { await (kind === "clinician" ? runManagedClinicianAction : runManagedPatientAction)({ clinicianKey, reference, action }); setMessage("Administrative action completed."); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function viewAudit(reference) { try { const result = await fetchUserAdministrationAudit({ clinicianKey, reference }); setAudit(result.events || []); } catch (err) { setError(err.message); } }
  return <main className="page user-admin-page">
    <header className="command-topbar"><div><div className="page-title">User Administration</div><div className="page-sub">Governed MILO controlled-Beta access</div></div><div className="command-topbar-actions"><button className="btn-text" onClick={onBack}>Back to dashboard</button><button className="btn-text" onClick={onLogout}>Sign out</button></div></header>
    <div className="user-admin-tabs" role="tablist">{["clinicians","patients"].map((name) => <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</div>
    {error && <div className="banner-error" role="alert">{error}</div>}{message && <div className="user-admin-success" role="status">{message}</div>}
    {tab === "clinicians" ? <><form className="command-module user-admin-form" onSubmit={invite}><h2>Invite clinician</h2>
      <label>Full name<input required value={clinicianForm.fullName} onChange={(e) => setClinicianForm({ ...clinicianForm, fullName: e.target.value })} /></label>
      <label>Professional email<input required type="email" value={clinicianForm.email} onChange={(e) => setClinicianForm({ ...clinicianForm, email: e.target.value })} /></label>
      <label>Practice<select value={clinicianForm.practiceId} onChange={(e) => setClinicianForm({ ...clinicianForm, practiceId: e.target.value })}><option value="prerna-health">Prerna Health</option></select></label>
      <label>Clinician role<select value={clinicianForm.role} onChange={(e) => setClinicianForm({ ...clinicianForm, role: e.target.value, group: e.target.value })}><option value="clinician">Clinician</option><option value="practice_admin">Practice administrator</option></select></label>
      <section className="user-admin-access" aria-label="Patient Access"><span>Patient Access</span><strong>Assigned patients</strong><p>The clinician will only be able to access patients explicitly assigned to them.</p></section>
      <p className="user-admin-helper">MFA is required. MILO sends the invitation; the administrator never selects or sees the permanent password.</p><button className="login-btn" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button></form>
      <AdminTable columns={["Name","Email","Practice","Role","Account","Invitation","MFA","Last sign-in","Access"]} rows={clinicians} kind="clinician" busy={busy} act={act} viewAudit={viewAudit} /></>
      : <><form className="command-module user-admin-form" onSubmit={enroll}><h2>Enroll patient</h2><label>Approved administrative identifier<input required value={patientForm.mrn} onChange={(e) => setPatientForm({ ...patientForm, mrn: e.target.value })} /></label><label>Patient email<input required type="email" value={patientForm.email} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} /></label><label className="enrollment-consent"><input type="checkbox" required checked={patientForm.consentConfirmed} onChange={(e) => setPatientForm({ ...patientForm, consentConfirmed: e.target.checked })} /><span>The patient is authorized to receive governed MILO enrollment.</span></label><button className="login-btn" disabled={busy}>{busy ? "Enrolling…" : "Enroll patient"}</button></form><AdminTable columns={["Patient","Practice","Enrollment","Invitation","Consent","Activation","MFA","Wearables","Access"]} rows={patients} kind="patient" busy={busy} act={act} viewAudit={viewAudit} /></>}
    {audit.length > 0 && <section className="command-module"><h2>Audit history</h2><ul className="user-admin-audit">{audit.map((event, i) => <li key={`${event.correlationId}-${i}`}><strong>{event.action}</strong> · {event.result} · {event.timestamp} · {event.reasonCode || "completed"}</li>)}</ul></section>}
  </main>;
}

function AdminTable({ columns, rows, kind, busy, act, viewAudit }) {
  const fields = kind === "clinician" ? ["name","email","practice","role","accountState","invitationState","mfaState","lastSignInCategory","accessState"] : ["displayName","practice","enrollmentState","invitationState","consentState","activationState","mfaState","wearableSummary","accessState"];
  const statusFields = new Set(kind === "clinician" ? ["accountState", "invitationState", "mfaState", "accessState"] : ["enrollmentState", "invitationState", "consentState", "activationState", "mfaState", "wearableSummary", "accessState"]);
  const emptyMessage = kind === "clinician" ? "No clinicians have been invited yet." : "No patients have been enrolled yet.";
  return <section className="command-module user-admin-list"><h2>{kind === "clinician" ? "Clinicians" : "Patients"}</h2><div className="user-admin-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.reference}>{fields.map((field) => <td key={field}>{statusFields.has(field) ? <span className={`user-admin-badge status-${String(row[field] || "unknown").toLowerCase()}`}>{displayStatus(row[field])}</span> : (field === "lastSignInCategory" || field === "role" ? displayStatus(row[field]) : (row[field] || "Not available"))}</td>)}<td><div className="user-admin-actions">{ACTIONS.map(([action,label]) => <button type="button" key={action} disabled={busy} onClick={() => act(kind, row.reference, action)}>{label}</button>)}<button type="button" onClick={() => viewAudit(row.reference)}>View Audit History</button></div></td></tr>) : <tr><td colSpan={columns.length + 1}>{emptyMessage}</td></tr>}</tbody></table></div></section>;
}
