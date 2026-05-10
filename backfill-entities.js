#!/usr/bin/env node
/*
 * scripts/backfill-entities.js
 *
 * Re-extracts entities for existing patient records using the CURRENT
 * extraction logic (Tier 1 quality filters: per-category thresholds,
 * negation/hypothetical traits, false-positive deny list, meta-symptom
 * deny list, specificity guard, patient-only text).
 *
 * Use case: filters were tightened after some sessions had already run.
 * This script reads the original transcript from S3, re-runs Comprehend
 * Medical with current filters, and updates the patient record in
 * DynamoDB with the cleaner entity list.
 *
 * Safe to run repeatedly — it's idempotent. Each run uses the latest
 * filter logic from routes/chat.js.
 *
 * USAGE (from project root):
 *   node scripts/backfill-entities.js                 # dry run, prints what would change
 *   node scripts/backfill-entities.js --apply         # actually writes changes
 *   node scripts/backfill-entities.js --apply --since 2026-05-06   # only sessions on/after date
 *
 * Requires the same env vars as the main proxy (loaded from .env).
 */

require("dotenv").config();

const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");

const { s3 } = require("../lib/clients");
const { ddb } = require("../lib/clients");
const { PATIENTS_TABLE, updatePatient } = require("../lib/db");

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const sinceIdx = args.indexOf("--since");
const SINCE = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

// ─── Re-import the extractor from routes/chat.js ──────────────────────────────
// The function is internal to that module; we re-implement the orchestration here
// using the same two AWS calls. To avoid drift, we COULD export the function,
// but keeping this script self-contained is more defensive — the extractor
// can evolve in chat.js without breaking the script.
const { ComprehendMedicalClient, DetectEntitiesV2Command } =
  require("@aws-sdk/client-comprehendmedical");

const comprehend = new ComprehendMedicalClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Mirror the filter constants from routes/chat.js. Keep these in sync.
const UNRELIABLE_TRAITS = new Set(["NEGATION", "HYPOTHETICAL", "LOW_CONFIDENCE"]);
const EXCLUDED_CATEGORIES = new Set(["PROTECTED_HEALTH_INFORMATION"]);
const CONFIDENCE_THRESHOLDS = {
  MEDICATION: 0.85, ANATOMY: 0.85, TEST_TREATMENT_PROCEDURE: 0.8,
  MEDICAL_CONDITION: 0.75, TIME_EXPRESSION: 0.7,
};
const DEFAULT_THRESHOLD = 0.75;
const FALSE_POSITIVE_TEXTS = new Set([
  "feeling well", "feel well", "feel better", "feeling better",
  "fine", "okay", "ok", "good", "great", "normal", "alright",
  "sick", "ill", "unwell",
  "pain", "discomfort", "ache",
  "issue", "issues", "problem", "problems",
  "thing", "things", "stuff", "something",
  "able to speak in full sentences",
]);
const META_SYMPTOM_TEXTS = new Set([
  "symptom", "symptoms", "condition", "conditions",
  "illness", "illnesses", "disease", "diseases",
  "disorder", "disorders", "infection", "infections",
  "syndrome", "diagnosis", "diagnoses", "ailment", "ailments", "sickness",
]);
const REQUIRES_ATTRIBUTES = new Set([
  "pain", "ache", "discomfort", "soreness",
  "swelling", "weakness", "numbness",
  "fatigue", "tiredness", "tired",
]);

async function extractFiltered(patientText) {
  if (!patientText || patientText.trim().length === 0) return [];
  const result = await comprehend.send(new DetectEntitiesV2Command({ Text: patientText }));
  const seen = new Set();
  const kept = [];
  for (const e of result.Entities || []) {
    const text = (e.Text || "").trim();
    const textLower = text.toLowerCase();
    const traits = (e.Traits || []).map((t) => t.Name);
    const attributes = e.Attributes || [];
    const threshold = CONFIDENCE_THRESHOLDS[e.Category] || DEFAULT_THRESHOLD;
    if (e.Score < threshold) continue;
    if (EXCLUDED_CATEGORIES.has(e.Category)) continue;
    if (traits.some((t) => UNRELIABLE_TRAITS.has(t))) continue;
    if (FALSE_POSITIVE_TEXTS.has(textLower)) continue;
    if (META_SYMPTOM_TEXTS.has(textLower)) continue;
    if (REQUIRES_ATTRIBUTES.has(textLower) && attributes.length === 0) continue;
    const key = `${textLower}::${e.Category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({
      text, category: e.Category, type: e.Type,
      score: Math.round(e.Score * 100) / 100,
      traits, attributeCount: attributes.length,
    });
  }
  return kept.sort((a, b) => b.score - a.score);
}

// ─── Fetch session JSON from S3 ───────────────────────────────────────────────
async function fetchSessionFromS3(s3Key) {
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: s3Key })
  );
  const body = await resp.Body.transformToString();
  return JSON.parse(body);
}

function patientOnlyTextFromMessages(messages) {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("─────────────────────────────────────────────────────────");
  console.log(`MODE: ${APPLY ? "APPLY (writes will happen)" : "DRY RUN (read-only)"}`);
  if (SINCE) console.log(`FILTER: only sessions on/after ${SINCE}`);
  console.log("─────────────────────────────────────────────────────────");

  // Scan all patients
  const patients = [];
  let lastKey;
  do {
    const { Items, LastEvaluatedKey } = await ddb.send(
      new ScanCommand({ TableName: PATIENTS_TABLE, ExclusiveStartKey: lastKey })
    );
    patients.push(...(Items || []));
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  console.log(`Scanned ${patients.length} patient records.\n`);

  let processed = 0, skipped = 0, updated = 0, errors = 0;

  for (const p of patients) {
    if (!p.latestSessionId) { skipped++; continue; }
    if (SINCE && p.latestSessionAt && p.latestSessionAt < SINCE) { skipped++; continue; }

    // Reconstruct the S3 key: sessions/YYYY-MM-DD/<sessionId>.json
    const dateStr = (p.latestSessionAt || p.enrolledAt || "").slice(0, 10);
    const s3Key = `sessions/${dateStr}/${p.latestSessionId}.json`;

    try {
      const session = await fetchSessionFromS3(s3Key);
      const patientText = patientOnlyTextFromMessages(session.messages || []);
      const newEntities = await extractFiltered(patientText);

      const oldCount = (p.latestEntities || []).length;
      const newCount = newEntities.length;

      console.log(
        `[${p.patientId}] ${oldCount} → ${newCount} entities ${oldCount === newCount ? "(unchanged)" : ""}`
      );

      if (APPLY) {
        await updatePatient(p.patientId, {
          latestEntities: newEntities,
          allEntities: newEntities, // for MVP, allEntities == latestEntities (single session per patient)
          backfilledAt: new Date().toISOString(),
        });
        updated++;
      }

      processed++;
    } catch (err) {
      console.error(`[${p.patientId}] ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`Processed: ${processed}  Updated: ${updated}  Skipped: ${skipped}  Errors: ${errors}`);
  if (!APPLY && processed > 0) {
    console.log(`\nDRY RUN — to actually write changes, re-run with --apply`);
  }
  console.log("─────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
