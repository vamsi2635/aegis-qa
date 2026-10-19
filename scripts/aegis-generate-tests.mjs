#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const input = path.resolve(root, process.argv[3] ?? 'artifacts/aegis/qa-scenarios.json');
const outputDir = path.resolve(root, process.argv[4] ?? 'artifacts/aegis/generated-tests');
const insideRoot = (file) => {
  const rel = path.relative(root, file);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
};
if (!insideRoot(input) || !insideRoot(outputDir)) {
  console.error('Input and output paths must remain inside the project root.');
  process.exit(2);
}
let catalog;
try {
  catalog = JSON.parse(await readFile(input, 'utf8'));
} catch (error) {
  console.error('Cannot read scenario catalog: ' + (error?.message ?? String(error)));
  process.exit(2);
}
if (!catalog || !Array.isArray(catalog.requirements) || !Array.isArray(catalog.scenarios)) {
  console.error('Catalog must contain requirements and scenarios arrays.');
  process.exit(2);
}
const requirements = new Map();
for (const req of catalog.requirements) {
  if (req && typeof req.id === 'string' && !requirements.has(req.id)) requirements.set(req.id, req);
}
const eligibleLayers = new Set(['api', 'ui', 'e2e']);
const generated = [];
const excluded = [];
const seen = new Set();
const safeName = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'scenario';
const quote = (value) => JSON.stringify(String(value ?? ''));
const commentText = (value) =>
  String(value ?? '')
    .replace(/\*\//g, '* /')
    .replace(/[\\r\\n]+/g, ' ');
for (const [index, scenario] of catalog.scenarios.entries()) {
  const id = scenario && typeof scenario.id === 'string' ? scenario.id : '';
  const reason = [];
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario))
    reason.push('not an object');
  if (!/^TC-[A-Z0-9][A-Z0-9._-]*$/.test(id)) reason.push('invalid or missing TC- ID');
  if (seen.has(id)) reason.push('duplicate scenario ID');
  if (id) seen.add(id);
  if (!Array.isArray(scenario?.requirementIds) || scenario.requirementIds.length === 0)
    reason.push('no requirement links');
  else {
    for (const reqId of scenario.requirementIds) {
      const req = requirements.get(reqId);
      if (!req) reason.push('unknown requirement ' + reqId);
      else if (req.status !== 'approved') reason.push('requirement ' + reqId + ' is not approved');
    }
  }
  if (!eligibleLayers.has(scenario?.layer))
    reason.push('unsupported automation layer ' + String(scenario?.layer));
  if (!['candidate', 'automated'].includes(scenario?.automationStatus))
    reason.push('automationStatus is not candidate/automated');
  if (typeof scenario?.title !== 'string' || !scenario.title.trim()) reason.push('missing title');
  if (typeof scenario?.expectedResult !== 'string' || !scenario.expectedResult.trim())
    reason.push('missing expected result');
  if (
    !Array.isArray(scenario?.steps) ||
    scenario.steps.length === 0 ||
    scenario.steps.some((step) => typeof step !== 'string' || !step.trim())
  )
    reason.push('missing valid steps');
  if (reason.length) {
    excluded.push({ id: id || 'scenario-index-' + index, reason: [...new Set(reason)] });
    continue;
  }
  const fileName = safeName(id + '-' + scenario.title) + '.spec.ts';
  const requirementRefs = scenario.requirementIds.map(
    (reqId) => commentText(requirements.get(reqId).source) + ' (' + reqId + ')',
  );
  const lines = [
    'import { test, expect } from "@playwright/test";',
    '',
    '/**',
    ' * GENERATED SCAFFOLD — not a completed automated test.',
    ' * Scenario: ' + id,
    ' * Requirements: ' + scenario.requirementIds.join(', '),
    ' * Source evidence: ' + requirementRefs.join('; '),
    ' * Layer: ' +
      commentText(scenario.layer) +
      '; priority: ' +
      commentText(scenario.priority) +
      '; risk: ' +
      commentText(scenario.risk),
    ' *',
    ' * TODO: Implement real setup, selectors/API requests, synthetic test data, cleanup,',
    ' * and assertions against the approved expected result. Never replace the fixme with',
    ' * a trivial assertion just to make this test pass.',
    ' */',
    'test.fixme(' + quote('[' + id + '] ' + scenario.title) + ', async ({ page }) => {',
    '  // TODO: Add deterministic setup for the approved non-production environment.',
    '  await test.step(' +
      quote('Preconditions: ' + (scenario.preconditions.join('; ') || 'confirm preconditions')) +
      ', async () => {',
    '    // TODO: Establish preconditions using project fixtures or API helpers.',
    '  });',
    ...scenario.steps.map(
      (step, i) =>
        '  await test.step(' +
        quote('Step ' + (i + 1) + ': ' + step) +
        ', async () => {\n    // TODO: Implement this action using stable, user-observable behavior.\n  });',
    ),
    '  await test.step(' + quote('Expected result: ' + scenario.expectedResult) + ', async () => {',
    '    // TODO: Add an assertion that proves the approved expected result.',
    '    expect(true).toBe(false); // Deliberate failing placeholder: replace with a real assertion before enabling.',
    '  });',
    '});',
    '',
  ];
  generated.push({ id, fileName, content: lines.join('\n') });
}
await mkdir(outputDir, { recursive: true });
const manifest = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  mode: 'review-required-scaffold',
  generatedCount: generated.length,
  excludedCount: excluded.length,
  generated: generated.map(({ id, fileName }) => ({ id, file: fileName })),
  excluded,
};
for (const item of generated)
  await writeFile(path.join(outputDir, item.fileName), item.content, 'utf8');
await writeFile(
  path.join(outputDir, 'generation-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8',
);
const lines = [
  '# Aegis QA — Generated Test Scaffolds',
  '',
  '- **Generated:** ' + manifest.generatedAt,
  '- **Mode:** review-required scaffolds; not ready to run as real tests',
  '- **Generated:** ' + generated.length,
  '- **Excluded:** ' + excluded.length,
  '',
  '## Generated scaffolds',
  '',
  ...(generated.length
    ? generated.map(
        (item) =>
          '- **' + item.id + '** — `' + item.fileName + '` (contains `test.fixme` and TODOs)',
      )
    : ['None.']),
  '',
  '## Excluded scenarios',
  '',
  ...(excluded.length
    ? excluded.map((item) => '- **' + item.id + '** — ' + item.reason.join('; '))
    : ['None.']),
  '',
  '## Required human work',
  '',
  '1. Confirm selectors/API contracts and test environment.',
  '2. Implement real actions, deterministic test data, cleanup, and assertions.',
  '3. Remove the deliberate failing placeholder only after a meaningful assertion exists.',
  '4. Run each test against an approved non-production environment and attach evidence.',
  '5. Do not treat generated scaffolds as coverage or passing tests.',
  '',
];
await writeFile(path.join(outputDir, 'README.md'), lines.join('\n'), 'utf8');
console.log(
  'Generated ' +
    generated.length +
    ' review-required test scaffold(s); excluded ' +
    excluded.length +
    ' scenario(s).',
);
console.log('Output directory: ' + path.relative(root, outputDir));
console.log(
  'Scaffolds are deliberately disabled with test.fixme and contain TODO assertions; they are not production-ready tests.',
);
