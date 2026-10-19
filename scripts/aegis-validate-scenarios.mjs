#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const input = path.resolve(root, process.argv[3] ?? "artifacts/aegis/qa-scenarios.json");
const reportPath = path.resolve(root, process.argv[4] ?? "artifacts/aegis/qa-scenario-validation.md");
const issues = [];
const warnings = [];
const insideRoot = (file) => {
  const rel = path.relative(root, file);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
};
const issue = (where, message) => issues.push({ where, message });
const isText = (v) => typeof v === "string" && v.trim().length > 0;

if (!insideRoot(input) || !insideRoot(reportPath)) {
  console.error("Input and report paths must remain inside the project root.");
  process.exit(2);
}

let catalog;
try {
  catalog = JSON.parse(await readFile(input, "utf8"));
} catch (error) {
  console.error("Cannot read scenario catalog: " + (error?.message ?? String(error)));
  console.error("Create artifacts/aegis/qa-scenarios.json from the documented template, then retry.");
  process.exit(2);
}

if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
  issue("$", "Catalog must be a JSON object.");
} else {
  for (const key of ["schemaVersion", "requirements", "scenarios"]) {
    if (!(key in catalog)) issue("$", "Missing required property: " + key);
  }
  for (const key of Object.keys(catalog)) {
    if (!["schemaVersion", "requirements", "scenarios"].includes(key)) issue("$", "Unexpected property: " + key);
  }
  if (catalog.schemaVersion !== "1.0.0") issue("$.schemaVersion", "Expected schemaVersion 1.0.0.");
  for (const key of ["requirements", "scenarios"]) {
    if (!Array.isArray(catalog[key])) issue("$." + key, "Must be an array.");
  }
}

const requirements = Array.isArray(catalog?.requirements) ? catalog.requirements : [];
const scenarios = Array.isArray(catalog?.scenarios) ? catalog.scenarios : [];
const requirementIds = new Set();
const scenarioIds = new Set();
const linkedRequirementIds = new Set();
const requirementStatuses = new Map();
const enums = {
  "requirements.status": ["approved", "needs-clarification", "assumption"],
  "scenarios.priority": ["P0", "P1", "P2", "P3"],
  "scenarios.risk": ["critical", "high", "medium", "low"],
  "scenarios.layer": ["unit", "integration", "api", "ui", "e2e", "accessibility", "performance", "security", "manual"],
  "scenarios.automationStatus": ["candidate", "automated", "manual", "blocked", "not-applicable"],
  "scenarios.executionStatus": ["not-run", "passed", "failed", "blocked", "inconclusive"]
};

for (const [i, req] of requirements.entries()) {
  const at = "$.requirements[" + i + "]";
  if (!req || typeof req !== "object" || Array.isArray(req)) { issue(at, "Must be an object."); continue; }
  for (const key of ["id", "title", "source", "status"]) if (!(key in req)) issue(at, "Missing required property: " + key);
  for (const key of Object.keys(req)) if (!["id", "title", "source", "status", "notes"].includes(key)) issue(at, "Unexpected property: " + key);
  if (!isText(req.id) || !/^REQ-[A-Z0-9][A-Z0-9._-]*$/.test(req.id)) issue(at + ".id", "Use a stable ID like REQ-AUTH-001.");
  else if (requirementIds.has(req.id)) issue(at + ".id", "Duplicate requirement ID: " + req.id);
  else { requirementIds.add(req.id); requirementStatuses.set(req.id, req.status); }
  for (const key of ["title", "source"]) if (!isText(req[key])) issue(at + "." + key, "Must be a non-empty string.");
  if (!enums["requirements.status"].includes(req.status)) issue(at + ".status", "Unsupported status.");
}

for (const [i, tc] of scenarios.entries()) {
  const at = "$.scenarios[" + i + "]";
  if (!tc || typeof tc !== "object" || Array.isArray(tc)) { issue(at, "Must be an object."); continue; }
  const required = ["id", "requirementIds", "title", "role", "preconditions", "testData", "steps", "expectedResult", "priority", "risk", "layer", "automationStatus"];
  const allowed = [...required, "executionStatus", "evidence", "notes"];
  for (const key of required) if (!(key in tc)) issue(at, "Missing required property: " + key);
  for (const key of Object.keys(tc)) if (!allowed.includes(key)) issue(at, "Unexpected property: " + key);
  if (!isText(tc.id) || !/^TC-[A-Z0-9][A-Z0-9._-]*$/.test(tc.id)) issue(at + ".id", "Use a stable ID like TC-AUTH-001.");
  else if (scenarioIds.has(tc.id)) issue(at + ".id", "Duplicate scenario ID: " + tc.id);
  else scenarioIds.add(tc.id);
  for (const key of ["title", "role", "expectedResult"]) if (!isText(tc[key])) issue(at + "." + key, "Must be a non-empty string.");
  for (const key of ["preconditions", "testData", "steps"]) {
    if (!Array.isArray(tc[key])) issue(at + "." + key, "Must be an array.");
    else if (tc[key].some((v) => !isText(v))) issue(at + "." + key, "Every item must be a non-empty string.");
  }
  if (Array.isArray(tc.steps) && tc.steps.length === 0) issue(at + ".steps", "At least one step is required.");
  if (!Array.isArray(tc.requirementIds) || tc.requirementIds.length === 0) issue(at + ".requirementIds", "Link at least one requirement.");
  else {
    if (new Set(tc.requirementIds).size !== tc.requirementIds.length) issue(at + ".requirementIds", "Duplicate requirement links.");
    for (const id of tc.requirementIds) {
      if (!isText(id) || !/^REQ-[A-Z0-9][A-Z0-9._-]*$/.test(id)) issue(at + ".requirementIds", "Invalid requirement ID: " + String(id));
      else if (!requirementIds.has(id)) issue(at + ".requirementIds", "Unknown requirement ID: " + id);
      else linkedRequirementIds.add(id);
    }
  }
  for (const [key, allowedValues] of Object.entries(enums)) {
    const field = key.split(".")[1];
    if (key.startsWith("scenarios.") && tc[field] !== undefined && !allowedValues.includes(tc[field])) issue(at + "." + field, "Unsupported value: " + String(tc[field]));
  }
  if (tc.executionStatus !== undefined && !enums["scenarios.executionStatus"].includes(tc.executionStatus)) issue(at + ".executionStatus", "Unsupported value.");
  for (const key of ["evidence"]) if (tc[key] !== undefined && (!Array.isArray(tc[key]) || tc[key].some((v) => !isText(v)))) issue(at + "." + key, "Must be an array of non-empty strings.");
  if (Array.isArray(tc.testData) && tc.testData.some((v) => /\b(password|secret|token|api[_ -]?key)\s*[:=]\s*\S+/i.test(v))) warnings.push(at + ".testData may contain a credential-like value; use a secret-free test-data reference.");
}

for (const id of requirementIds) {
  if (!linkedRequirementIds.has(id)) warnings.push("Requirement " + id + " has no linked scenario.");
  if (requirementStatuses.get(id) !== "approved") warnings.push("Requirement " + id + " is not approved (" + requirementStatuses.get(id) + "); expected behavior needs human confirmation.");
}
if (requirements.length === 0) warnings.push("No requirements supplied; traceability cannot be meaningfully assessed.");
if (scenarios.length === 0) warnings.push("No scenarios supplied; planning is incomplete.");
const passed = issues.length === 0;
const lines = [
  "# Aegis QA — Scenario Catalog Validation", "",
  "- **Catalog:** " + path.relative(root, input).split(path.sep).join("/"),
  "- **Result:** " + (passed ? "STRUCTURE VALID" : "INVALID"),
  "- **Requirements:** " + requirements.length,
  "- **Scenarios:** " + scenarios.length,
  "- **Linked requirements:** " + linkedRequirementIds.size + " / " + requirementIds.size,
  "- **Errors:** " + issues.length,
  "- **Warnings:** " + warnings.length, "",
  "## Validation errors", "",
  ...(issues.length ? issues.map((v) => "- **" + v.where + "** — " + v.message) : ["None."]),
  "", "## Traceability and safety warnings", "",
  ...(warnings.length ? warnings.map((v) => "- " + v) : ["None."]),
  "", "## Interpretation", "",
  "A structurally valid catalog is not proof that requirements are correct, scenarios are sufficient, or the product is defect-free.",
  "Unlinked requirements and unapproved/assumed requirements require review before release decisions.", ""
];
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, lines.join("\n"), "utf8");
console.log("Scenario catalog validation: " + (passed ? "STRUCTURE VALID" : "INVALID"));
console.log("Requirements: " + requirements.length + "; scenarios: " + scenarios.length + "; errors: " + issues.length + "; warnings: " + warnings.length);
console.log("Report written to: " + path.relative(root, reportPath));
if (!passed) process.exitCode = 1;
