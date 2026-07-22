import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const main = readFileSync(resolve(process.cwd(), "main.jsx"), "utf8");
const portal = readFileSync(resolve(process.cwd(), "DemoPortal.jsx"), "utf8");

describe("guarded clinician demo route", () => {
  it("selects demo only for the exact /demo pathname", () => {
    expect(main).toMatch(/window\.location\.pathname === "\/demo" \? DemoPortal : App/);
  });
  it("uses only the isolated synthetic clinician runtime", () => {
    expect(portal).toMatch(/https:\/\/demo-dex-clinician\.netlify\.app\//);
    expect(portal).toMatch(/SYNTHETIC DEMO/);
    expect(portal).not.toMatch(/api-beta|Authorization|clinicianKey|accessToken/);
  });
});
