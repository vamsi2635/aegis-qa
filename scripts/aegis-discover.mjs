#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const output = path.resolve(root, process.argv[3] ?? "artifacts/aegis/project-discovery.md");
const excluded = new Set([".git", "node_modules", "dist", "build", "coverage", "playwright-report", "test-results", "vendor", ".next", "artifacts"]);
const secretNames = new Set([".env", ".env.local", ".env.production", ".npmrc", ".pypirc"]);
const files = [];
const warnings = [];
const maxFiles = 12000;

function relative(file) { return path.relative(root, file).split(path.sep).join("/"); }
function isInsideRoot(file) {
  const rel = path.relative(root, file);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}
async function scan(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { warnings.push("Unreadable directory: " + relative(dir)); return; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (files.length >= maxFiles) { warnings.push("Reached scan safety limit of " + maxFiles + " files."); return; }
    if (entry.isDirectory() && (excluded.has(entry.name) || (entry.name.startsWith(".") && ![".github", ".vscode"].includes(entry.name)))) continue;
    const full = path.join(dir, entry.name);
    if (!isInsideRoot(full)) continue;
    if (entry.isDirectory()) await scan(full);
    else if (entry.isFile() && !secretNames.has(entry.name) && !/\.(lock|png|jpe?g|webp|pdf|zip)$/i.test(entry.name)) files.push(full);
  }
}
function category(file) {
  const name = path.basename(file).toLowerCase();
  if (/^(package\.json|pnpm-workspace\.yaml|angular\.json|pom\.xml|build\.gradle|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml|composer\.json|gemfile)$/.test(name)) return "Manifests and build";
  if (/^\.github\/workflows\//i.test(file) || /(^|\/)(jenkinsfile|azure-pipelines\.ya?ml|\.gitlab-ci\.ya?ml)$/i.test(file)) return "CI/CD";
  if (/^tests?\//i.test(file) || /(^|\/)(__tests__|e2e|cypress|specs?)\//i.test(file) || /\.(spec|test)\.[cm]?[jt]sx?$/i.test(file)) return "Existing tests";
  if (/openapi|swagger|postman|collection/i.test(file)) return "API contracts and collections";
  if (/route|router|controller|endpoint|page\.(tsx?|jsx?)$|app\.(tsx?|jsx?)$/i.test(file)) return "Possible routes and application entry points";
  if (/readme|requirements|acceptance|user.?stor|product.?spec|architecture|adr/i.test(file)) return "Requirements and documentation";
  if (/playwright\.config|cypress\.config|vitest\.config|jest\.config|eslint\.config|tsconfig|\.env\.example/i.test(file)) return "Test and quality configuration";
  return null;
}

await scan(root);
files.sort((a, b) => relative(a).localeCompare(relative(b)));
const groups = new Map();
for (const file of files) {
  const kind = category(relative(file));
  if (kind) groups.set(kind, [...(groups.get(kind) ?? []), relative(file)]);
}
let pkg = null;
try { pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")); } catch {}
const lines = [
  "# Aegis QA — Project Discovery Inventory", "",
  "- **Root:** " + root,
  "- **Generated:** " + new Date().toISOString(),
  "- **Files inspected:** " + files.length,
  "- **Mode:** read-only inventory; application files are not modified.",
  "- **Evidence:** file paths and declared scripts are discovery signals, not proof of runtime behavior.", "",
  "## Project identity", "",
  "- **Package:** " + (pkg?.name ?? "No root package.json detected"),
  "- **Package manager:** " + (pkg?.packageManager ?? "Not declared"), "",
  "## Evidence inventory", ""
];
if (!groups.size) lines.push("No recognized files were detected by the built-in filename heuristics.", "");
for (const [kind, paths] of groups) {
  lines.push("### " + kind, "");
  for (const file of paths.slice(0, 100)) lines.push("- " + file);
  if (paths.length > 100) lines.push("- …and " + (paths.length - 100) + " more");
  lines.push("");
}
if (pkg?.scripts) {
  lines.push("## Declared package scripts", "");
  for (const [name, command] of Object.entries(pkg.scripts)) lines.push("- npm run " + name + " → " + String(command));
  lines.push("");
}
lines.push(
  "## Questions for analyst and product owner", "",
  "- Where are the authoritative business requirements and acceptance criteria?",
  "- Which user roles, critical journeys, and state transitions are in scope?",
  "- Which UI/API origins and test accounts are approved for non-production testing?",
  "- What test-data isolation and cleanup rules apply?",
  "- Which external integrations and failure modes are business-critical?",
  "- Which quality checks and approvals are required before release?", "",
  "## Limits and next step", "",
  "- This tool does not execute the application, infer confirmed business rules, or prove route/API coverage.",
  "- Dependency/build/report/artifact folders, common secret files, and most hidden directories are intentionally excluded.",
  "- Review this inventory and correlate source code with supplied requirements before generating risk-ranked scenarios.", ""
);
if (warnings.length) lines.push("## Scan warnings", "", ...warnings.map((item) => "- " + item), "");
if (!isInsideRoot(output)) { console.error("Output path must remain inside the project root."); process.exit(2); }
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, lines.join("\n"), "utf8");
console.log("Aegis discovery complete: inspected " + files.length + " files.");
console.log("Inventory written to: " + relative(output));
console.log("Review the inventory before planning or generating tests.");
