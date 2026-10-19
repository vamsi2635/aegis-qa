#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const input = path.resolve(root, process.argv[3] ?? "artifacts/aegis/qa-scenarios.json");
const output = path.resolve(root, process.argv[4] ?? "artifacts/aegis/release-readiness.md");
const insideRoot = (file) => {
  const rel = path.relative(root, file);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
};
if (!insideRoot(input) || !insideRoot(output)) {
  console.error("Input and output paths must remain inside the project root.");
  process.exit(2);
}
let catalog;
try {
  catalog = JSON.parse(await readFile(input, "utf8"));
} catch (error) {
  console.error("Cannot read scenario catalog: " + (error?.message ?? String(error)));
  process.exit(2);
}
if (!catalog || !Array.isArray(catalog.requirements) || !Array.isArray(catalog.scenarios)) {
  console.error("Catalog must contain requirements and scenarios arrays.");
  process.exit(2);
}
const requirements = new Map();
for (const req of catalog.requirements) {
  if (req && typeof req.id === "string" && !requirements.has(req.id)) requirements.set(req.id, req);
}
const scenarios = catalog.scenarios.filter((tc) => tc && typeof tc === "object" && !Array.isArray(tc));
const blockers = [];
const warnings = [];
const counts = { passed: 0, failed: 0, blocked: 0, inconclusive: 0, "not-run": 0, unspecified: 0 };
const highRisk = (tc) => ["P0", "P1"].includes(tc.priority) || ["critical", "high"].includes(tc.risk);
for (const [index, tc] of catalog.scenarios.entries()) {
  if (!tc || typeof tc !== "object" || Array.isArray(tc)) {
    blockers.push("Scenario at index " + index + " is not a valid object.");
    continue;
  }
  const status = tc.executionStatus ?? "not-run";
  if (Object.hasOwn(counts, status)) counts[status]++;
  else counts.unspecified++;
  const id = typeof tc.id === "string" && tc.id.trim() ? tc.id : "Scenario at index " + index;
  const linked = Array.isArray(tc.requirementIds) ? tc.requirementIds : [];
  const invalidLinks = linked.filter((reqId) => !requirements.has(reqId));
  if (linked.length === 0 || invalidLinks.length) blockers.push(id + ": missing or invalid requirement traceability" + (invalidLinks.length ? " (" + invalidLinks.join(", ") + ")" : "") + ".");
  const unapproved = linked.filter((reqId) => requirements.has(reqId) && requirements.get(reqId).status !== "approved");
  if (unapproved.length) blockers.push(id + ": linked requirements are not approved (" + unapproved.join(", ") + ").");
  if (status === "failed") blockers.push(id + ": execution failed.");
  if (highRisk(tc) && status !== "passed") blockers.push(id + ": high-priority/high-risk scenario is not passed (status: " + status + ").");
  if (status === "blocked" || status === "inconclusive" || status === "not-run") warnings.push(id + ": execution status is " + status + ".");
  if (["P0", "P1"].includes(tc.priority) && (!Array.isArray(tc.evidence) || tc.evidence.length === 0)) warnings.push(id + ": no execution evidence reference recorded.");
}
const linkedReqIds = new Set(scenarios.flatMap((tc) => Array.isArray(tc.requirementIds) ? tc.requirementIds : []).filter((id) => requirements.has(id)));
for (const [id, req] of requirements) {
  if (!linkedReqIds.has(id)) blockers.push("Requirement " + id + " has no linked scenario.");
  if (req.status !== "approved") blockers.push("Requirement " + id + " is not approved (" + req.status + ").");
}
if (requirements.size === 0) blockers.push("No requirements are present in the catalog.");
if (scenarios.length === 0) blockers.push("No scenarios are present in the catalog.");
const uniqueBlockers = [...new Set(blockers)];
const uniqueWarnings = [...new Set(warnings)];
const passed = uniqueBlockers.length === 0;
const esc = (v) => String(v ?? "—").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
const lines = [
  "# Aegis QA — Release Readiness Evidence Report", "",
  "- **Generated:** " + new Date().toISOString(),
  "- **Assessment:** " + (passed ? "NO CATALOG-BASED BLOCKERS DETECTED — HUMAN REVIEW REQUIRED" : "NOT READY — BLOCKERS FOUND"),
  "- **Requirements:** " + requirements.size,
  "- **Scenarios:** " + scenarios.length,
  "- **Blocking items:** " + uniqueBlockers.length,
  "- **Warnings:** " + uniqueWarnings.length, "",
  "> This is a deterministic catalog audit, not an autonomous release decision. It trusts the recorded execution statuses and evidence references; it does not verify test runs, inspect CI, prove coverage, or establish that the product is defect-free. A human release owner must review the actual evidence and residual risks.", "",
  "## Execution status counts", "",
  "| Status | Count |", "|---|---:|",
  ...Object.entries(counts).map(([status, count]) => "| " + status + " | " + count + " |"),
  "", "## Blocking items", "",
  ...(uniqueBlockers.length ? uniqueBlockers.map((item) => "- " + item) : ["No catalog-based blockers detected."]),
  "", "## Warnings", "",
  ...(uniqueWarnings.length ? uniqueWarnings.map((item) => "- " + item) : ["None detected."]),
  "", "## Scenario review", "",
  "| Scenario | Priority | Risk | Status | Evidence references |",
  "|---|---|---|---|---|",
  ...scenarios.map((tc) => "| " + esc((tc.id ?? "Unknown ID") + " — " + (tc.title ?? "Untitled")) + " | " + esc(tc.priority) + " | " + esc(tc.risk) + " | " + esc(tc.executionStatus ?? "not-run") + " | " + esc(Array.isArray(tc.evidence) && tc.evidence.length ? tc.evidence.join("; ") : "—") + " |"),
  "", "## Human release-owner checklist", "",
  "- [ ] Verify evidence references point to real, current test runs and reports.",
  "- [ ] Review open defects, failed checks, environment limitations, and residual risks.",
  "- [ ] Confirm scope, exclusions, and requirement approvals with product/QA owners.",
  "- [ ] Confirm CI/CD and security checks appropriate to this release actually ran.",
  "- [ ] Record the final decision and approver outside this generated report.", ""
];
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, lines.join("\n"), "utf8");
console.log("Release readiness audit: " + (passed ? "NO CATALOG-BASED BLOCKERS DETECTED (human review still required)" : "NOT READY"));
console.log("Requirements: " + requirements.size + "; scenarios: " + scenarios.length + "; blockers: " + uniqueBlockers.length + "; warnings: " + uniqueWarnings.length);
console.log("Report written to: " + path.relative(root, output));
if (!passed) process.exitCode = 1;
