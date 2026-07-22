const DEMO_HOST = "demo-dex-clinician.netlify.app";

export function isIsolatedDemoRuntime({ env = import.meta.env, location = globalThis.location } = {}) {
  const flag = String(env?.VITE_ISOLATED_DEMO || "").toLowerCase() === "true";
  const host = String(location?.hostname || "").toLowerCase();
  return flag && (host === DEMO_HOST || host === "localhost" || host === "127.0.0.1");
}

export function installDemoNetworkGuard(windowObject = globalThis.window) {
  if (!windowObject || windowObject.__DEX_CLINICIAN_DEMO__) return;
  windowObject.__DEX_CLINICIAN_DEMO__ = true;
  const originalFetch = windowObject.fetch?.bind(windowObject);
  if (!originalFetch) return;
  windowObject.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input?.url;
    const url = new URL(String(raw || ""), windowObject.location?.origin || "http://localhost");
    if (url.pathname.startsWith("/api/") || /(^|\.)api-beta\.predicatelabs\.ai$/i.test(url.hostname)) {
      return Promise.reject(Object.assign(new Error("Protected APIs are disabled in synthetic demo mode."), {
        code: "DEMO_NETWORK_BLOCKED",
      }));
    }
    return originalFetch(input, init);
  };
}

export const DEMO_PATIENTS = Object.freeze([
  {
    id: "pt_demo_avery",
    name: "Avery Synthetic",
    age: 52,
    status: "Review first",
    trend: "Recovery signals changed over the last 48 hours",
    lastCheckIn: "Today, 9:15 AM",
    summary: "Reports increased fatigue after routine activity. Resting heart rate is above the fabricated personal baseline; sleep duration was lower for two nights.",
    signals: [
      ["Resting heart rate", "78 bpm", "+8 vs synthetic baseline"],
      ["Sleep duration", "5h 42m", "−1h 18m vs synthetic baseline"],
      ["Daily steps", "4,210", "−28% over 7 days"],
    ],
    careNote: "Review hydration, sleep disruption, recent activity, and any new symptoms. This demo does not diagnose a condition.",
  },
  {
    id: "pt_demo_jordan",
    name: "Jordan Example",
    age: 44,
    status: "Watch closely",
    trend: "Stable overall with a mild voice-energy change",
    lastCheckIn: "Yesterday, 4:40 PM",
    summary: "Synthetic check-in indicates mild tiredness without urgent warning signs. Wearable measures remain near the fabricated baseline.",
    signals: [
      ["Resting heart rate", "66 bpm", "+1 vs synthetic baseline"],
      ["Sleep duration", "7h 06m", "Near synthetic baseline"],
      ["Daily steps", "7,840", "+4% over 7 days"],
    ],
    careNote: "Continue routine monitoring and review the next scheduled MILO check-in.",
  },
  {
    id: "pt_demo_riley",
    name: "Riley Sample",
    age: 61,
    status: "Stable",
    trend: "No meaningful change detected in the fabricated window",
    lastCheckIn: "Monday, 11:05 AM",
    summary: "Synthetic voice, activity, and sleep measures are consistent with the fabricated personal baseline.",
    signals: [
      ["Resting heart rate", "70 bpm", "At synthetic baseline"],
      ["Sleep duration", "7h 31m", "+12m vs synthetic baseline"],
      ["Daily steps", "6,950", "Near 7-day average"],
    ],
    careNote: "No immediate review priority in this synthetic demonstration.",
  },
]);
