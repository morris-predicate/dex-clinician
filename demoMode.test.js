import { describe, expect, it } from "vitest";
import { DEMO_PATIENTS, installDemoNetworkGuard, isIsolatedDemoRuntime } from "./demoMode.js";

describe("isolated clinician demo", () => {
  it("requires both the build flag and exact demo host", () => {
    expect(isIsolatedDemoRuntime({ env: { VITE_ISOLATED_DEMO: "true" }, location: { hostname: "demo-dex-clinician.netlify.app" } })).toBe(true);
    expect(isIsolatedDemoRuntime({ env: { VITE_ISOLATED_DEMO: "true" }, location: { hostname: "dex-clinician.netlify.app" } })).toBe(false);
    expect(isIsolatedDemoRuntime({ env: {}, location: { hostname: "demo-dex-clinician.netlify.app" } })).toBe(true);
  });
  it("contains only explicitly fabricated patients", () => {
    expect(DEMO_PATIENTS).toHaveLength(3);
    expect(DEMO_PATIENTS.every((patient) => patient.id.startsWith("pt_demo_"))).toBe(true);
  });
  it("blocks protected API requests", async () => {
    const windowObject = { location: { origin: "https://demo-dex-clinician.netlify.app" }, fetch: async () => ({ ok: true }) };
    installDemoNetworkGuard(windowObject);
    await expect(windowObject.fetch("/api/clinician/patients")).rejects.toMatchObject({ code: "DEMO_NETWORK_BLOCKED" });
    await expect(windowObject.fetch("/predicate-logo-light.png")).resolves.toMatchObject({ ok: true });
  });
});
