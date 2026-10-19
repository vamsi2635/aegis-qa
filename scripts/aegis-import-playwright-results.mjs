#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const catalogPath = path.resolve(root, process.argv[3] ?? 'artifacts/aegis/qa-scenarios.json');
const reportPath = path.resolve(root, process.argv[4] ?? 'artifacts/aegis/playwright-results.json');
const insideRoot = (file) => {
  const rel = path.relative(root, file);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
};
if (!insideRoot(catalogPath) || !insideRoot(reportPath)) {
  console.error('Catalog and report paths must remain inside the project root.');
  process.exit(2);
}
let catalog;
let report;
try {
  catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch (error) {
  console.error(
    'Cannot read catalog or Playwright JSON report: ' + (error?.message ?? String(error)),
  );
  process.exit(2);
}
if (!catalog || !Array.isArray(catalog.requirements) || !Array.isArray(catalog.scenarios)) {
  console.error('Catalog must contain requirements and scenarios arrays.');
  process.exit(2);
}
if (!report || !Array.isArray(report.suites)) {
  console.error('Expected a Playwright JSON reporter document with a suites array.');
  process.exit(2);
}

const observed = new Map();
const walk = (suites) => {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const title = [spec.title, ...(test.title ? [test.title] : [])].join(' ');
        const ids = [
          ...new Set(
            [...title.matchAll(/\b(TC-[A-Z0-9][A-Z0-9._-]*)\b/g)].map((match) => match[1]),
          ),
        ];
        if (!ids.length) continue;
        const results = Array.isArray(test.results) ? test.results : [];
        const finalResult = results.at(-1);
        let status = 'inconclusive';
        if (!finalResult) status = 'not-run';
        else if (finalResult.status === 'skipped') status = 'blocked';
        else if (finalResult.status === 'passed') {
          status = results.some((result) =>
            ['failed', 'timedOut', 'interrupted'].includes(result.status),
          )
            ? 'inconclusive'
            : 'passed';
        } else if (['failed', 'timedOut', 'interrupted'].includes(finalResult.status))
          status = 'failed';
        for (const id of ids) {
          const entries = observed.get(id) ?? [];
          entries.push({ status, title, resultStatus: finalResult?.status ?? 'no-result' });
          observed.set(id, entries);
        }
      }
    }
    walk(suite.suites);
  }
};
walk(report.suites);

const known = new Set(
  catalog.scenarios.map((scenario) => scenario?.id).filter((id) => typeof id === 'string'),
);
const unknown = [...observed.keys()].filter((id) => !known.has(id));
if (unknown.length) {
  console.error(
    'Playwright report contains scenario IDs missing from the catalog: ' + unknown.join(', '),
  );
  console.error('No catalog changes were written. Reconcile IDs and retry.');
  process.exit(1);
}
const updated = [];
for (const scenario of catalog.scenarios) {
  const entries = observed.get(scenario?.id);
  if (!entries) continue;
  const statuses = new Set(entries.map((entry) => entry.status));
  let status;
  if (statuses.has('failed')) status = 'failed';
  else if (statuses.has('inconclusive')) status = 'inconclusive';
  else if (statuses.has('blocked')) status = 'blocked';
  else if (statuses.size === 1) status = [...statuses][0];
  else status = 'inconclusive';
  scenario.executionStatus = status;
  const refs = Array.isArray(scenario.evidence)
    ? scenario.evidence.filter((item) => typeof item === 'string')
    : [];
  const evidenceRef = path.relative(root, reportPath).split(path.sep).join('/');
  if (!refs.includes(evidenceRef)) refs.push(evidenceRef);
  scenario.evidence = refs;
  scenario.notes = [
    scenario.notes,
    'Imported from Playwright JSON report; matched test(s): ' +
      entries.map((entry) => entry.title).join('; '),
  ]
    .filter(Boolean)
    .join(' | ');
  updated.push({ id: scenario.id, status, count: entries.length });
}
if (updated.length === 0) {
  console.error(
    'No Playwright tests matched catalog scenario IDs (expected test titles to include IDs such as [TC-AUTH-001]).',
  );
  console.error('No catalog changes were written.');
  process.exit(1);
}
await mkdir(path.dirname(catalogPath), { recursive: true });
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log('Imported Playwright results for ' + updated.length + ' scenario(s).');
for (const item of updated)
  console.log('- ' + item.id + ': ' + item.status + ' (' + item.count + ' matching test(s))');
console.log('Catalog updated: ' + path.relative(root, catalogPath));
console.log('Evidence reference recorded: ' + path.relative(root, reportPath));
console.log(
  'Status mapping is conservative: retry-flaky results are inconclusive; skipped tests are blocked. Verify the report before release review.',
);
