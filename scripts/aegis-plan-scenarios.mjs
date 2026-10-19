#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const input = path.resolve(root, process.argv[3] ?? "artifacts/aegis/qa-scenarios.json");
const output = path.resolve(root, process.argv[4] ?? "artifacts/aegis/risk-ranked-test-plan.md");
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

const reqs = new Map();
for (const req of catalog.requirements) {
  if (req && typeof req.id === "string" && !reqs.has(req.id)) reqs.set(req.id, req);
}
const scoreRisk = { critical: 4, high: 3, medium: 2, low: 1 };
const scorePriority = { P0: 4, P1: 3, P2: 2, P3: 1 };
const scoreLayer = { security: 4, api: 3, e2e: 3, ui: 2, integration: 2, accessibility: 2, performance: 2, unit: 1, manual: 1 };
const seen = new Set();
const scenarios = [];
const warnings = [];
for (const [index, tc] of catalog.scenarios.entries()) {
  if (!tc || typeof tc !== "object" || Array.isArray(tc)) {
    warnings.push("Scenario at index " + index + " is not an object; omitted from ranked plan.");
    continue;
  }
  const id = typeof tc.id === "string" && tc.id.trim() ? tc.id : "UNIDENTIFIED-" + (index + 1);
  if (seen.has(id)) warnings.push("Duplicate scenario ID " + id + "; retained both rows for review.");
  seen.add(id);
  const linked = Array.isArray(tc.requirementIds) ? tc.requirementIds : [];
  const missing = linked.filter((rid) => !reqs.has(rid));
  const unapproved = linked.filter((rid) => reqs.has(rid) && reqs.get(rid).status !== "approved");
  const risk = scoreRisk[tc.risk] ?? 0;
  const priority = scorePriority[tc.priority] ?? 0;
  const score = risk * 10 + priority * 5 + (scoreLayer[tc.layer] ?? 0);
  const gaps = [];
  if (!linked.length) gaps.push("no requirement links");
  if (missing.length) gaps.push("unknown requirements: " + missing.join(", "));
  if (unapproved.length) gaps.push("unapproved/assumed requirements: " + unapproved.join(", "));
  if (!tc.expectedResult || !String(tc.expectedResult).trim()) gaps.push("expected result missing");
  if (!Array.isArray(tc.steps) || tc.steps.length === 0) gaps.push("steps missing");
  if (gaps.length) warnings.push(id + ": " + gaps.join("; "));
  scenarios.push({ ...tc, _id: id, _score: score, _gaps: gaps, _linked: linked });
}
scenarios.sort((a, b) => b._score - a._score || String(a._id).localeCompare(String(b._id)));
const riskCounts = Object.fromEntries(["critical", "high", "medium", "low"].map((risk) => [risk, scenarios.filter((tc) => tc.risk === risk).length]));
const priorityCounts = Object.fromEntries(["P0", "P1", "P2", "P3"].map((priority) => [priority, scenarios.filter((tc) => tc.priority === priority).length]));
const linkedReqs = new Set(scenarios.flatMap((tc) => tc._linked).filter((id) => reqs.has(id)));
const unlinkedReqs = [...reqs.keys()].filter((id) => !linkedReqs.has(id));
const lines = [
  "# Aegis QA — Risk-ranked Test Plan", "",
  "- **Generated:** " + new Date().toISOString(),
  "- **Requirements in catalog:** " + reqs.size,
  "- **Scenarios ranked:** " + scenarios.length,
  "- **Requirements linked to at least one scenario:** " + linkedReqs.size + " / " + reqs.size,
  "- **Planning state:** " + (warnings.length || unlinkedReqs.length ? "REVIEW REQUIRED" : "NO STRUCTURAL GAPS DETECTED"), "",
  "> Ranking is a transparent heuristic based on declared risk, priority, and test layer. It is not a probability of failure or an AI assessment of business impact. Confirm priorities with the product and quality owners.", "",
  "## Scenario distribution", "",
  "| Dimension | Count |", "|---|---:|",
  ...Object.entries(riskCounts).map(([key, value]) => ["Risk: " + key, value]).map(([k,v]) => "| " + k + " | " + v + " |"),
  ...Object.entries(priorityCounts).map(([key, value]) => ["Priority: " + key, value]).map(([k,v]) => "| " + k + " | " + v + " |"),
  "", "## Ranked scenarios", "",
  "| Rank | Scenario | Priority | Risk | Layer | Requirement links | Execution | Review notes |",
  "|---:|---|---|---|---|---|---|---|"
];
for (const [i, tc] of scenarios.entries()) {
  const esc = (v) => String(v ?? "—").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  lines.push("| " + (i + 1) + " | " + esc(tc._id + " — " + (tc.title ?? "Untitled")) + " | " + esc(tc.priority) + " | " + esc(tc.risk) + " | " + esc(tc.layer) + " | " + esc(tc._linked.join(", ")) + " | " + esc(tc.executionStatus ?? "not-run") + " | " + esc(tc._gaps.join("; ") || "—") + " |");
}
lines.push("", "## Unlinked requirements", "");
if (unlinkedReqs.length) lines.push(...unlinkedReqs.map((id) => "- **" + id + "** — " + (reqs.get(id).title ?? "Untitled") + " (needs scenario or explicit out-of-scope rationale)"));
else lines.push("None detected.");
lines.push("", "## Warnings and review items", "");
if (warnings.length) lines.push(...warnings.map((warning) => "- " + warning));
else lines.push("None detected by the planning heuristics.");
lines.push("", "## Next actions", "",
  "1. Resolve requirement links and confirm every expected result against an approved source.",
  "2. Review P0/P1 and critical/high-risk scenarios with the product owner and QA lead.",
  "3. Mark candidates suitable for automation only after confirming test data, environment, and cleanup strategy.",
  "4. Generate/execute tests in small reviewed batches; record actual outcomes and evidence in the catalog.",
  "5. Do not interpret this generated plan as proof of coverage or release readiness.", ""
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, lines.join("\n"), "utf8");
console.log("Risk-ranked plan generated for " + scenarios.length + " scenarios.");
console.log("Requirements linked: " + linkedReqs.size + "/" + reqs.size + "; review warnings: " + warnings.length + "; unlinked requirements: " + unlinkedReqs.length);
console.log("Report written to: " + path.relative(root, output));
