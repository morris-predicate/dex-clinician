import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const main = readFileSync(resolve(process.cwd(), "main.jsx"), "utf8");
const app = readFileSync(resolve(process.cwd(), "App.jsx"), "utf8");
const api = readFileSync(resolve(process.cwd(), "api.js"), "utf8");
const demo = readFileSync(resolve(process.cwd(), "demoMode.js"), "utf8");

describe("current clinician UI demo route", () => {
  it("renders the normal App with a demo session only on exact /demo", () => {
    expect(main).toMatch(/window\.location\.pathname === "\/demo"/);
    expect(main).toMatch(/<App demoMode=\{demoMode\} \/>/);
    expect(app).toMatch(/demoMode \? "synthetic-demo-session"/);
    expect(main).not.toMatch(/DemoPortal|demo-dex-clinician/);
  });

  it("uses only the shared synthetic API and blocks live protected APIs", () => {
    expect(api).toMatch(/resolveClinicianDemoApiPath/);
    expect(demo).toMatch(/\/api\/demo\/clinician\/patients/);
    expect(demo).toMatch(/!url\.pathname\.startsWith\("\/api\/demo\/"\)/);
    expect(demo).not.toMatch(/Authorization|Bearer|accessToken/);
  });
});
