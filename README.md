# OpenDx Signal Intelligence Dashboard

The clinician-facing view of patient records. Each clinic accesses via a URL containing their `clinicId`. Server-side tenant isolation prevents one clinic from seeing another's patients even if they share the password.

**What clinicians see:**
- **Roster** — list of their enrolled patients, sorted by most recent Dex session
- **Patient detail** — demographics, "What this patient reported" entity tags by category, vitals (Validic placeholder), and a default-closed transcript toggle
- **Conversation transcript** — full Dex/patient dialogue, fetched on demand from S3

**What's deliberately scoped out:**
- No anonymous research patients (those are fenced off server-side; clinics can never see them)
- No editing — read-only view
- No clinical notes / charting — this is a signal-intelligence dashboard, not an EHR
- No patient identifying info beyond what the clinic already has

---

## Deploy (10 min)

### Step 1 — Set the dashboard password in Railway

Railway → `dex-proxy` → Variables, add:

```
CLINICIAN_DASHBOARD_KEY=<a strong random string — generate with: openssl rand -hex 16>
```

This is the shared password. The same value works for all clinics; clinic separation is enforced by the URL `?clinic=` parameter and a server-side tenant check.

Railway redeploys automatically.

### Step 2 — Push to GitHub

```bash
cd dex-clinician
git init
git add .
git commit -m "clinician dashboard"
git remote add origin https://github.com/YOUR_USERNAME/dex-clinician.git
git push -u origin main
```

This is the **fourth** repo (`dex-proxy`, `dex-pwa`, `dex-research`, `dex-clinician`). Each deploys independently.

### Step 3 — Deploy on Netlify

1. **app.netlify.com** → Add new site → Import from Git → select `dex-clinician`
2. Netlify auto-detects Vite (settings come from `netlify.toml`)
3. Add environment variable before deploy:
   - **Key:** `VITE_PROXY_URL`
   - **Value:** your Railway URL (no trailing slash)
4. Deploy
5. Site settings → Change site name → set to `dex-clinician`
   - Final URL: `https://dex-clinician.netlify.app`

### Step 4 — Update CORS

Railway → `dex-proxy` → Variables → update `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=https://dex-patient-pilot.netlify.app,https://dex-research.netlify.app,https://dex-clinician.netlify.app
```

---

## Sharing access with a clinic

The URL **must** include the clinic's identifier. For your concierge pilot:

```
https://dex-clinician.netlify.app/?clinic=concierge-pilot-1
```

That `clinic=concierge-pilot-1` value must match the `clinicId` you used when enrolling those patients via `POST /api/patients`.

Send the clinic two things:
1. The clinic-specific URL above
2. The access key (the value of `CLINICIAN_DASHBOARD_KEY`)

If you onboard a second clinic later, they get a different URL (`?clinic=clinic-b`) but the same password works. Server-side scoping ensures each only sees their own patients.

---

## End-to-end test

1. Enroll a patient via curl with `clinicId: "concierge-pilot-1"` (or whatever your real clinic ID is)
2. Open the patient invite link on your phone, run a Dex session
3. Open `https://dex-clinician.netlify.app/?clinic=concierge-pilot-1`, enter the password
4. The patient should appear at the top of the roster with their entity count
5. Click their row → see demographics + "What this patient reported" tags
6. Click "Show transcript" → see the full conversation

---

## Files

```
dex-clinician/
├── src/
│   ├── main.jsx            # Entry
│   ├── styles.css          # All styles
│   ├── lib/
│   │   └── api.js          # fetchRoster, fetchPatient, fetchTranscript
│   └── components/
│       ├── App.jsx         # Top-level: clinic param + auth + view routing
│       ├── Login.jsx       # Single-password gate
│       ├── Roster.jsx      # Patient list + search + new-session indicator
│       └── PatientDetail.jsx  # Demographics, entities, vitals, transcript toggle
├── index.html
├── package.json
├── vite.config.js
└── netlify.toml
```
