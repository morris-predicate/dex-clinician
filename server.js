/*
 * server.js — Dex backend v2
 *
 * Routes mounted:
 *   /health                            — liveness check
 *   /api/chat                          — Claude proxy
 *   /api/session/complete              — save transcript + extract entities + persist
 *   /api/patients (CRUD + lookups)     — patient management
 *   /api/patients/:id/vitals           — vitals time-series query
 *   /api/validic/provision             — create Validic user + return marketplace URL
 *   /api/validic/webhook               — Validic pushes new vitals here
 *   /api/validic/pull/:patientId       — manual fetch (testing)
 *
 * Deploy: push to GitHub, Railway auto-deploys. Set env vars in Railway → Variables.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

// ─── Validate required env vars at startup ────────────────────────────────────
const REQUIRED = [
  "ANTHROPIC_API_KEY",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET_NAME",
  "VALIDIC_ORG_ID",
  "VALIDIC_ORG_KEY",
];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌  Missing required environment variables:", missing.join(", "));
  console.error("    Add them in Railway → Variables, or in your .env file.");
  process.exit(1);
}

// Soft warnings for optional but recommended vars
if (!process.env.VALIDIC_WEBHOOK_SECRET) {
  console.warn("⚠️   VALIDIC_WEBHOOK_SECRET not set — webhook signatures will not be verified (sandbox only).");
}
if (!process.env.PWA_BASE_URL) {
  console.warn("⚠️   PWA_BASE_URL not set — invite links will use placeholder URL.");
}

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Validic-Signature", "X-Research-Key", "X-Clinician-Key"],
  })
);

// IMPORTANT: Validic webhook must read raw body for HMAC verification.
// Mount it BEFORE the global JSON parser so the raw body isn't consumed.
app.use("/api/validic/webhook", require("./routes/validic"));

// All other routes use parsed JSON
app.use(express.json({ limit: "2mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: ["chat", "sessions", "comprehend-medical", "validic", "dynamodb"],
  });
});

app.use("/api", require("./routes/chat"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/validic", require("./routes/validic"));
app.use("/api/research", require("./routes/research"));
app.use("/api/clinician", require("./routes/clinician"));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅  Dex proxy v2.0.0 running on port ${PORT}`);
  console.log(`    Health check:    http://localhost:${PORT}/health`);
  console.log(`    S3 bucket:       ${process.env.S3_BUCKET_NAME}`);
  console.log(`    AWS region:      ${process.env.AWS_REGION}`);
  console.log(`    Validic base:    ${process.env.VALIDIC_BASE_URL || "https://api.sandbox.validic.com"}`);
  console.log(`    Patients table:  ${process.env.DDB_PATIENTS_TABLE || "dex-patients"}`);
  console.log(`    Vitals table:    ${process.env.DDB_VITALS_TABLE || "dex-vitals"}`);
});
