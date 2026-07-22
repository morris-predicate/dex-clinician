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
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/demo/")) {
      return Promise.reject(Object.assign(new Error("Live services are disabled in synthetic demo mode."), { code: "DEMO_NETWORK_BLOCKED" }));
    }
    return originalFetch(input, init);
  };
}

export function resolveClinicianDemoApiPath(path) {
  const value = String(path || "");
  if (value.startsWith("/api/clinician/patients")) {
    return value.replace("/api/clinician/patients", "/api/demo/clinician/patients");
  }
  if (value.startsWith("/api/clinician/care-team-updates")) {
    return value.replace("/api/clinician/care-team-updates", "/api/demo/clinician/care-team-updates");
  }
  if (value.startsWith("/api/baseline/patient/")) {
    return value.replace("/api/baseline/patient/", "/api/demo/clinician/patients/");
  }
  return value;
}
