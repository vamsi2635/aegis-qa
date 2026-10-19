#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const manifestPath = path.resolve(process.argv[2] ?? 'docs/application-onboarding.example.json');
const outputPath = path.resolve(process.argv[3] ?? 'tests/generated/aegis-api-contract.spec.ts');
const fail = (message) => {
  console.error('Aegis API generation blocked: ' + message);
  process.exit(2);
};

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  fail('Cannot read onboarding manifest: ' + (error instanceof Error ? error.message : String(error)));
}
const specRef = manifest.application?.openApiSpec;
if (!specRef) fail('Set application.openApiSpec to a reviewed local OpenAPI JSON/YAML file. Remote specs are not fetched by this generator.');
const specPath = path.resolve(path.dirname(manifestPath), specRef);
if (!specPath.startsWith(path.resolve(path.dirname(manifestPath)) + path.sep)) {
  fail('OpenAPI spec path must be within the manifest directory tree.');
}
let spec;
try {
  const raw = await readFile(specPath, 'utf8');
  try {
    spec = JSON.parse(raw);
  } catch {
    fail('This first version accepts OpenAPI JSON only. Convert YAML to JSON before generation.');
  }
} catch (error) {
  fail('Cannot read OpenAPI spec: ' + (error instanceof Error ? error.message : String(error)));
}
if (!['3.0.0','3.0.1','3.0.2','3.0.3','3.1.0','3.1.1'].includes(spec.openapi)) {
  fail('Expected a supported OpenAPI 3.x JSON document.');
}
const paths = spec.paths ?? {};
const operations = [];
for (const [route, pathItem] of Object.entries(paths)) {
  if (!pathItem || typeof pathItem !== 'object') continue;
  const operation = pathItem.get;
  if (!operation) continue;
  const responses = operation.responses ?? {};
  const success = Object.keys(responses).filter((code) => /^2\d\d$/.test(code)).sort();
  if (!success.length) continue;
  const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map((p) => ({ name: p.name, in: p.in, required: Boolean(p.required) }));
  if (parameters.some((p) => p.required)) continue;
  operations.push({
    id: String(operation.operationId ?? 'GET_' + route).replace(/[^a-zA-Z0-9_-]/g, '_'),
    route,
    summary: String(operation.summary ?? operation.operationId ?? route).replace(/\s+/g, ' ').slice(0, 180),
    success,
    security: operation.security ?? spec.security ?? [],
    parameters,
  });
}
if (!operations.length) fail('No GET operations with documented 2xx responses found.');
const safe = (value) => JSON.stringify(value);
const lines = [
  'import { test, expect } from "@playwright/test";',
  '',
  '// Generated from a reviewed OpenAPI contract. Review server URL, required parameters, and auth before running.',
  '// This file includes GET requests only; mutation methods are intentionally excluded.',
  'const baseURL = process.env.AEGIS_API_BASE_URL;',
  'const token = process.env.AEGIS_API_TOKEN;',
  '',
  'test.describe("Aegis generated OpenAPI GET contract checks", () => {',
  '  test.beforeEach(() => {',
  '    expect(baseURL, "Set AEGIS_API_BASE_URL to an approved test API origin").toBeTruthy();',
  '  });',
  ...operations.flatMap((op) => [
    '  test(' + safe('[API-' + op.id + '] ' + op.summary) + ', async ({ request }) => {',
    '    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};',
    '    const response = await request.get(new URL(' + safe(op.route.replace(/\{([^}]+)\}/g, ':$1')) + '.replace(/:([a-zA-Z0-9_]+)/g, "undefined"), baseURL).toString(), { headers });',
    '    expect([' + op.success.map(Number).join(', ') + ']).toContain(response.status());',
    '  });',
  ]),
  '});',
  '',
];
const output = lines.join('\n');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, 'utf8');
const inventoryPath = outputPath.replace(/\.ts$/, '.inventory.json');
await writeFile(inventoryPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: path.relative(process.cwd(), specPath),
  openapi: spec.openapi,
  totalPaths: Object.keys(paths).length,
  getOperationsGenerated: operations.length,
  excludedMethods: ['post', 'put', 'patch', 'delete', 'options', 'head'],
  operations,
  limitations: [
    'Only GET operations with documented 2xx responses are generated.',
    'Operations with required parameters are excluded until a reviewed parameter-value strategy is implemented.',
    'This first generator checks documented success status codes only; it does not yet validate response schemas or business expectations.',
    'Authentication is optional bearer token via AEGIS_API_TOKEN; configure the target environment and token securely.',
    'Review generated output before execution; run only against an authorized test environment.',
  ],
}, null, 2) + '\n', 'utf8');
console.log('Generated ' + operations.length + ' GET contract checks at ' + outputPath);
console.log('Inventory: ' + inventoryPath);
