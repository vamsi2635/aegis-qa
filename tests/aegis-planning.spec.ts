import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("scenario validator flags unknown requirement links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aegis-catalog-"));
  try {
    await mkdir(path.join(root, "artifacts", "aegis"), { recursive: true });
    await writeFile(path.join(root, "artifacts", "aegis", "qa-scenarios.json"), JSON.stringify({
      schemaVersion: "1.0.0",
      requirements: [{ id: "REQ-A", title: "Requirement A", source: "requirements.md", status: "approved" }],
      scenarios: [{ id: "TC-A", requirementIds: ["REQ-MISSING"], title: "Scenario", role: "user", preconditions: [], testData: ["synthetic"], steps: ["Perform action"], expectedResult: "Approved result", priority: "P1", risk: "high", layer: "api", automationStatus: "candidate" }]
    }));
    const result = spawnSync(process.execPath, [path.resolve("scripts/aegis-validate-scenarios.mjs"), root], { encoding: "utf8" });
    expect(result.status).toBe(1);
    const report = await readFile(path.join(root, "artifacts", "aegis", "qa-scenario-validation.md"), "utf8");
    expect(report).toContain("Unknown requirement ID: REQ-MISSING");
    expect(report).toContain("Requirement REQ-A has no linked scenario.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("risk planner ranks higher risk and priority first", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aegis-plan-"));
  try {
    await mkdir(path.join(root, "artifacts", "aegis"), { recursive: true });
    await writeFile(path.join(root, "artifacts", "aegis", "qa-scenarios.json"), JSON.stringify({
      schemaVersion: "1.0.0",
      requirements: [{ id: "REQ-A", title: "Requirement A", source: "requirements.md", status: "approved" }],
      scenarios: [
        { id: "TC-LOW", requirementIds: ["REQ-A"], title: "Low risk", role: "user", preconditions: [], testData: ["synthetic"], steps: ["Do action"], expectedResult: "Result", priority: "P3", risk: "low", layer: "unit", automationStatus: "candidate" },
        { id: "TC-HIGH", requirementIds: ["REQ-A"], title: "High risk", role: "user", preconditions: [], testData: ["synthetic"], steps: ["Do action"], expectedResult: "Result", priority: "P0", risk: "critical", layer: "api", automationStatus: "candidate" }
      ]
    }));
    const result = spawnSync(process.execPath, [path.resolve("scripts/aegis-plan-scenarios.mjs"), root], { encoding: "utf8" });
    expect(result.status).toBe(0);
    const report = await readFile(path.join(root, "artifacts", "aegis", "risk-ranked-test-plan.md"), "utf8");
    expect(report.indexOf("TC-HIGH")).toBeLessThan(report.indexOf("TC-LOW"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
