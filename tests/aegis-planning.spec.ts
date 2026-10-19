import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

test("test generator creates only approved, linked scaffolds and excludes unapproved scenarios", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aegis-generate-"));
  try {
    await mkdir(path.join(root, "artifacts", "aegis"), { recursive: true });
    await writeFile(path.join(root, "artifacts", "aegis", "qa-scenarios.json"), JSON.stringify({
      schemaVersion: "1.0.0",
      requirements: [
        { id: "REQ-OK", title: "Approved requirement", source: "requirements.md#approved", status: "approved" },
        { id: "REQ-PENDING", title: "Pending requirement", source: "requirements.md#pending", status: "needs-clarification" }
      ],
      scenarios: [
        { id: "TC-OK", requirementIds: ["REQ-OK"], title: "Approved login journey", role: "user", preconditions: ["Test user exists"], testData: ["synthetic user"], steps: ["Submit valid login details"], expectedResult: "User reaches account home", priority: "P1", risk: "high", layer: "ui", automationStatus: "candidate" },
        { id: "TC-PENDING", requirementIds: ["REQ-PENDING"], title: "Pending journey", role: "user", preconditions: [], testData: ["synthetic"], steps: ["Perform action"], expectedResult: "Unknown behavior", priority: "P2", risk: "medium", layer: "api", automationStatus: "candidate" }
      ]
    }));
    const result = spawnSync(process.execPath, [path.resolve("scripts/aegis-generate-tests.mjs"), root], { encoding: "utf8" });
    expect(result.status).toBe(0);
    const out = path.join(root, "artifacts", "aegis", "generated-tests");
    const files = await readdir(out);
    const scaffoldName = files.find((file) => file.startsWith("tc-ok-") && file.endsWith(".spec.ts"));
    expect(scaffoldName).toBeTruthy();
    expect(files.some((file) => file.startsWith("tc-pending-") && file.endsWith(".spec.ts"))).toBeFalsy();
    const scaffold = await readFile(path.join(out, scaffoldName), "utf8");
    expect(scaffold).toContain("test.fixme");
    expect(scaffold).toContain("expect(true).toBe(false)");
    const manifest = JSON.parse(await readFile(path.join(out, "generation-manifest.json"), "utf8"));
    expect(manifest.generatedCount).toBe(1);
    expect(manifest.excludedCount).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
