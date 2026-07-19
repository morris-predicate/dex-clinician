import React, { useState } from "react";
import { createPatientEnrollment, regeneratePatientTemporaryPassword } from "./api.js";

const LOGIN_URL = "https://dex-pwa.netlify.app";

function instructions(result) {
  return [
    "Welcome to the MILO Beta Program.",
    `Open ${result.loginUrl || LOGIN_URL}`,
    `Username: ${result.enrollment.patientUsername}`,
    `Temporary password: ${result.temporaryPassword}`,
    "Sign in and choose a new password when prompted. Patient MFA is not required.",
    "This temporary credential expires. Contact your MILO clinician if it is lost or expired.",
  ].join("\n");
}

export default function EnrollPatient({ clinicianKey, clinicId, onBack, onComplete }) {
  const [form, setForm] = useState({ mrn: "", email: "", patientInitials: "", consentConfirmed: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await createPatientEnrollment({
        clinicianKey,
        clinicId,
        payload: form,
      });
      setResult(created);
      onComplete?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value) {
    await navigator.clipboard.writeText(value);
  }

  async function recover() {
    setBusy(true);
    setError("");
    try {
      const recovered = await regeneratePatientTemporaryPassword({
        enrollmentId: result.enrollment.enrollmentId,
        clinicianKey,
        clinicId,
      });
      setResult({ ...recovered, idempotent: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const enrollment = result.enrollment;
    return (
      <main className="page">
        <button className="btn-text" type="button" onClick={onBack}>← Monitored Patients</button>
        <section className="command-module enrollment-confirmation">
          <h1>Patient enrolled</h1>
          {result.idempotent ? (
            <>
              <div className="banner-error">
                This patient was already enrolled. No new identity or temporary password was created.
              </div>
              <button type="button" disabled={busy} onClick={recover}>
                {busy ? "Regenerating…" : "Regenerate temporary password"}
              </button>
            </>
          ) : (
            <div className="banner-warning">
              One-time secret: copy the temporary password now. It will disappear after refresh or navigation.
              Send it only through the practice’s approved patient communication channel.
            </div>
          )}
          <dl>
            <dt>MRN</dt><dd>{enrollment.mrn}</dd>
            <dt>Username</dt><dd>{enrollment.patientUsername || "Pending"}</dd>
            <dt>Subject UID</dt><dd>{enrollment.subjectUid}</dd>
            <dt>Invitation</dt><dd>{enrollment.invitationStatus}</dd>
          </dl>
          {!result.idempotent && result.temporaryPassword && (
            <>
              <label className="form-label">Temporary password</label>
              <input className="login-input" readOnly value={result.temporaryPassword} />
              <div className="command-topbar-actions">
                <button type="button" onClick={() => copy(enrollment.patientUsername)}>Copy username</button>
                <button type="button" onClick={() => copy(result.temporaryPassword)}>Copy temporary password</button>
                <button type="button" onClick={() => copy(result.loginUrl || LOGIN_URL)}>Copy login URL</button>
                <button type="button" onClick={() => copy(instructions(result))}>Copy complete patient instructions</button>
              </div>
            </>
          )}
          <button className="login-btn" type="button" onClick={onBack}>Return to dashboard</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <button className="btn-text" type="button" onClick={onBack}>← Monitored Patients</button>
      <form className="command-module enrollment-form" onSubmit={submit}>
        <h1>Enroll New Patient</h1>
        <p>Controlled MILO Beta enrollment. The MRN is scoped to this practice.</p>
        <label className="form-label" htmlFor="mrn">Patient MRN</label>
        <input id="mrn" className="login-input" required value={form.mrn}
          onChange={(e) => setForm({ ...form, mrn: e.target.value })} />
        <label className="form-label" htmlFor="email">Patient email</label>
        <input id="email" type="email" className="login-input" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} />
        <label className="form-label" htmlFor="initials">First name or initials (optional)</label>
        <input id="initials" className="login-input" value={form.patientInitials}
          onChange={(e) => setForm({ ...form, patientInitials: e.target.value })} />
        <label>
          <input type="checkbox" required checked={form.consentConfirmed}
            onChange={(e) => setForm({ ...form, consentConfirmed: e.target.checked })} />
          The patient is authorized or has consented to receive MILO Beta access.
        </label>
        {error && <div className="banner-error">{error}</div>}
        <button className="login-btn" disabled={busy}>
          {busy ? "Creating patient identity…" : "Enroll patient"}
        </button>
      </form>
    </main>
  );
}
