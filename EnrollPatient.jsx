import React, { useState } from "react";
import { createPatientEnrollment, resendPatientEnrollment } from "./api.js";

const LOGIN_URL = "https://dex-pwa.netlify.app";

function instructions() {
  return [
    "Welcome to the MILO Beta Program.",
    `Open ${LOGIN_URL}`,
    "Enter the enrollment code from your MILO email.",
    "Then complete the secure Cognito password and software-token MFA steps.",
    "The enrollment code expires. Contact your MILO clinician if it is lost or expired.",
  ].join("\n");
}

export default function EnrollPatient({ clinicianKey, clinicId, onBack, onComplete }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    emailConfirmation: "",
    electronicContactAuthorized: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const canSubmit =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    emailIsValid &&
    form.email === form.emailConfirmation &&
    form.electronicContactAuthorized &&
    !busy;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
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

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const recovered = await resendPatientEnrollment({
        enrollmentId: result.enrollment.enrollmentId,
        clinicianKey,
        clinicId,
      });
      setResult(recovered);
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
                This exact enrollment already exists. No duplicate identity or invitation was created.
              </div>
              <button type="button" disabled={busy} onClick={resend}>
                {busy ? "Resending…" : "Resend governed invitation"}
              </button>
            </>
          ) : (
            <div className="banner-warning">
              Cognito and MILO enrollment instructions are sent directly through the approved email channel.
              No password or enrollment code is displayed in the dashboard.
            </div>
          )}
          <dl>
            <dt>Enrollment ID</dt><dd>{enrollment.enrollmentId}</dd>
            <dt>Status</dt><dd>{enrollment.status}</dd>
            <dt>Email delivery</dt><dd>{enrollment.emailDeliveryState}</dd>
          </dl>
          <div className="command-topbar-actions">
            <button type="button" onClick={() => copy(LOGIN_URL)}>Copy patient login URL</button>
            <button type="button" onClick={() => copy(instructions())}>Copy patient instructions</button>
          </div>
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
        <p>Controlled MILO Beta enrollment. Identity and practice authority are verified by the server.</p>
        <label className="form-label" htmlFor="first-name">Patient first name</label>
        <input id="first-name" className="login-input" required value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <label className="form-label" htmlFor="last-name">Patient last name</label>
        <input id="last-name" className="login-input" required value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <label className="form-label" htmlFor="email">Patient email</label>
        <input id="email" type="email" className="login-input" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} />
        <label className="form-label" htmlFor="email-confirmation">Confirm patient email</label>
        <input id="email-confirmation" type="email" className="login-input" required value={form.emailConfirmation}
          onChange={(e) => setForm({ ...form, emailConfirmation: e.target.value.trim() })} />
        <label className="enrollment-consent">
          <input className="enrollment-consent-checkbox" type="checkbox" required checked={form.electronicContactAuthorized}
            onChange={(e) => setForm({ ...form, electronicContactAuthorized: e.target.checked })} />
          <span>The patient is authorized or has consented to receive MILO Beta access.</span>
        </label>
        {error && <div className="banner-error">{error}</div>}
        <button className="login-btn enrollment-submit" disabled={!canSubmit}>
          {busy ? "Creating patient identity…" : "Enroll patient"}
        </button>
      </form>
    </main>
  );
}
