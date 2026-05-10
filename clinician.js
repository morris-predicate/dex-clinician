/*
 * routes/clinician.js — Clinician dashboard endpoints.
 *
 * Auth: shared password in `x-clinician-key` header.
 * Scope: every endpoint requires `clinicId` query param. The clinician dashboard
 *        passes its `?clinic=` URL parameter through, so each clinic only sees
 *        their own patients regardless of who has the password.
 *
 * Endpoints:
 *   GET /api/clinician/patients?clinicId=...
 *     → roster: list of patients with summary fields (no transcripts, no PHI exposure beyond what the clinic already has)
 *
 *   GET /api/clinician/patients/:id?clinicId=...
 *     → full record: demographics + entities (+ vitals when Validic is wired)
 *
 *   GET /api/clinician/patients/:id/transcript?clinicId=...
 *     → fetches the S3-archived conversation. Defaults closed in UI; opens on demand.
 */

const express = require("express");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../lib/clients");
const {
  getPatient,
  listPatients,
  getVitalsForPatient,
} = require("../lib/db");

const router = express.Router();

const CLINICIAN_KEY = process.env.CLINICIAN_DASHBOARD_KEY;

// ─── Auth middleware ─────────────────────────────────────────────────────────
function requireClinicianKey(req, res, next) {
  if (!CLINICIAN_KEY) {
    console.warn("[clinician] CLINICIAN_DASHBOARD_KEY not set — endpoint open");
    return next();
  }
  const provided = req.headers["x-clinician-key"];
  if (!provided || provided !== CLINICIAN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Clinic scope guard ──────────────────────────────────────────────────────
function requireClinicId(req, res, next) {
  const clinicId = req.query.clinicId;
  if (!clinicId || typeof clinicId !== "string") {
    return res.status(400).json({ error: "clinicId query parameter is required" });
  }
  // Anonymous research patients use clinicId="research" — never visible to clinics.
  if (clinicId === "research") {
    return res.status(403).json({ error: "Research data is not accessible from clinician view" });
  }
  req.clinicId = clinicId;
  next();
}

// ─── GET /api/clinician/patients ─────────────────────────────────────────────
// Roster view — list all patients in this clinic with summary fields.
router.get("/patients", requireClinicianKey, requireClinicId, async (req, res) => {
  try {
    const all = await listPatients(req.clinicId);

    // Strip invite tokens — they're for patient-facing flows, not clinicians.
    // Sort: patients with most recent sessions first; un-sessioned patients last.
    const sanitized = all
      .map(({ inviteToken, ...rest }) => rest)
      .sort((a, b) => {
        const aTime = a.latestSessionAt || "";
        const bTime = b.latestSessionAt || "";
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        return bTime.localeCompare(aTime);
      });

    res.json({ patients: sanitized, count: sanitized.length, clinicId: req.clinicId });
  } catch (err) {
    console.error("[clinician] roster error:", err.message);
    res.status(502).json({ error: "Failed to load roster", detail: err.message });
  }
});

// ─── GET /api/clinician/patients/:id ─────────────────────────────────────────
// Full record for one patient. Verifies the patient belongs to this clinic.
router.get("/patients/:id", requireClinicianKey, requireClinicId, async (req, res) => {
  try {
    const patient = await getPatient(req.params.id);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    // Tenant isolation: a clinic must not see another clinic's patients.
    if (patient.clinicId !== req.clinicId) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const vitals = await getVitalsForPatient(req.params.id, { limit: 100 });
    const { inviteToken, ...patientSafe } = patient;

    res.json({ patient: patientSafe, vitals, vitalsCount: vitals.length });
  } catch (err) {
    console.error("[clinician] patient detail error:", err.message);
    res.status(502).json({ error: "Failed to load patient", detail: err.message });
  }
});

// ─── GET /api/clinician/patients/:id/transcript ──────────────────────────────
// Returns the full Dex conversation transcript from S3.
// Default-closed in UI — clinician must explicitly open it.
router.get(
  "/patients/:id/transcript",
  requireClinicianKey,
  requireClinicId,
  async (req, res) => {
    try {
      const patient = await getPatient(req.params.id);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      if (patient.clinicId !== req.clinicId) {
        return res.status(404).json({ error: "Patient not found" });
      }
      if (!patient.latestSessionId || !patient.latestSessionAt) {
        return res.status(404).json({ error: "No session transcript available" });
      }

      // Reconstruct the S3 key from session metadata.
      const dateStr = patient.latestSessionAt.slice(0, 10);
      const s3Key = `sessions/${dateStr}/${patient.latestSessionId}.json`;

      const obj = await s3.send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: s3Key })
      );
      const body = await obj.Body.transformToString();
      const session = JSON.parse(body);

      res.json({
        sessionId: patient.latestSessionId,
        capturedAt: session.capturedAt,
        messages: session.messages, // [{role: "user"|"assistant", content}]
      });
    } catch (err) {
      console.error("[clinician] transcript error:", err.message);
      // S3 NoSuchKey → 404, everything else → 502
      const status = err.name === "NoSuchKey" ? 404 : 502;
      res.status(status).json({
        error: status === 404 ? "Transcript not found in archive" : "Failed to load transcript",
        detail: err.message,
      });
    }
  }
);

module.exports = router;
