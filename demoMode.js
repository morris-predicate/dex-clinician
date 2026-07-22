const DEMO_PATIENTS = Object.freeze([
  {
    patientId: "pt_demo_avery",
    subjectUid: "subj_demo_avery",
    name: "Avery Synthetic",
    age: 52,
    sex: "female",
    status: "active",
    latestSessionId: "session_demo_avery",
    latestSessionAt: "2026-07-22T13:15:00.000Z",
    latestEntities: [{ type: "symptom", value: "fatigue" }],
    latestVitals: { restingHeartRate: 78, sleepHours: 5.7, steps: 4210 },
    abnormalSignals: ["resting heart rate", "sleep duration"],
    hasConvergentSignals: true,
  },
  {
    patientId: "pt_demo_jordan",
    subjectUid: "subj_demo_jordan",
    name: "Jordan Example",
    age: 44,
    sex: "nonbinary",
    status: "active",
    latestSessionId: "session_demo_jordan",
    latestSessionAt: "2026-07-21T20:40:00.000Z",
    latestEntities: [{ type: "symptom", value: "tiredness" }],
    latestVitals: { restingHeartRate: 66, sleepHours: 7.1, steps: 7840 },
  },
  {
    patientId: "pt_demo_riley",
    subjectUid: "subj_demo_riley",
    name: "Riley Sample",
    age: 61,
    sex: "male",
    status: "active",
    latestSessionId: "session_demo_riley",
    latestSessionAt: "2026-07-20T15:05:00.000Z",
    latestEntities: [],
    latestVitals: { restingHeartRate: 70, sleepHours: 7.5, steps: 6950 },
  },
]);

const DEMO_UPDATES = Object.freeze([
  {
    id: "update_demo_avery",
    patientId: "pt_demo_avery",
    subjectUid: "subj_demo_avery",
    sessionId: "session_demo_avery",
    triggerMessage: "Fabricated participant reported increased fatigue after routine activity.",
    summaryDraft: "Synthetic signals show lower sleep duration and a resting heart-rate change for clinician review.",
    timestamp: "2026-07-22T13:16:00.000Z",
    status: "dashboard_ready",
  },
]);

export function isClinicianDemoMode(windowObject = globalThis.window) {
  return Boolean(windowObject?.__DEX_CURRENT_UI_DEMO__);
}

export function installClinicianDemoMode(windowObject = globalThis.window) {
  if (!windowObject) return;
  windowObject.__DEX_CURRENT_UI_DEMO__ = true;
  if (windowObject.__DEX_CURRENT_UI_DEMO_GUARD__) return;
  windowObject.__DEX_CURRENT_UI_DEMO_GUARD__ = true;
  const originalFetch = windowObject.fetch?.bind(windowObject);
  if (!originalFetch) return;
  windowObject.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input?.url;
    const url = new URL(String(raw || ""), windowObject.location?.origin || "http://localhost");
    if (url.pathname.startsWith("/api/") || /(^|\.)api-beta\.predicatelabs\.ai$/i.test(url.hostname)) {
      return Promise.reject(Object.assign(new Error("Live services are disabled in synthetic demo mode."), { code: "DEMO_NETWORK_BLOCKED" }));
    }
    return originalFetch(input, init);
  };
}

export function resolveDemoApiRequest(path, { method = "GET" } = {}) {
  const pathname = new URL(String(path), "https://demo.invalid").pathname;
  if (pathname === "/api/clinician/patients") {
    return { patients: DEMO_PATIENTS, count: DEMO_PATIENTS.length, clinicId: "prerna-health-demo" };
  }
  if (pathname === "/api/clinician/care-team-updates") {
    return { updates: DEMO_UPDATES, count: DEMO_UPDATES.length };
  }
  if (/^\/api\/clinician\/care-team-updates\/[^/]+\/review$/.test(pathname) && method === "POST") {
    return { ...DEMO_UPDATES[0], status: "reviewed_in_dashboard", reviewedAt: new Date().toISOString() };
  }
  const patientMatch = pathname.match(/^\/api\/clinician\/patients\/([^/]+)$/);
  if (patientMatch) {
    const patient = DEMO_PATIENTS.find((item) => item.patientId === decodeURIComponent(patientMatch[1]));
    if (!patient) throw Object.assign(new Error("Synthetic patient not found."), { status: 404 });
    return { patient, vitals: [], sessions: [], observations: [] };
  }
  if (/\/transcript$/.test(pathname)) return { events: [], transcript: [] };
  if (/\/signals$/.test(pathname)) return { ok: true, signals: [], status: "synthetic_demo" };
  if (/^\/api\/baseline\/patient\//.test(pathname)) return { status: "not_available" };
  if (/^\/api\/(chat\/session-events|opendx\/reasoning-ledgers|opendx\/interaction-trace)/.test(pathname)) return { events: [], items: [], ledgers: [] };
  throw Object.assign(new Error("This live service is unavailable in synthetic demo mode."), { code: "DEMO_NETWORK_BLOCKED" });
}

export { DEMO_PATIENTS, DEMO_UPDATES };
