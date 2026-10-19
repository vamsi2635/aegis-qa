import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('scenario validator flags unknown requirement links', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aegis-catalog-'));
  try {
    await mkdir(path.join(root, 'artifacts', 'aegis'), { recursive: true });
    await writeFile(
      path.join(root, 'artifacts', 'aegis', 'qa-scenarios.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        requirements: [
          { id: 'REQ-A', title: 'Requirement A', source: 'requirements.md', status: 'approved' },
        ],
        scenarios: [
          {
            id: 'TC-A',
            requirementIds: ['REQ-MISSING'],
            title: 'Scenario',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Perform action'],
            expectedResult: 'Approved result',
            priority: 'P1',
            risk: 'high',
            layer: 'api',
            automationStatus: 'candidate',
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve('scripts/aegis-validate-scenarios.mjs'), root],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    const report = await readFile(
      path.join(root, 'artifacts', 'aegis', 'qa-scenario-validation.md'),
      'utf8',
    );
    expect(report).toContain('Unknown requirement ID: REQ-MISSING');
    expect(report).toContain('Requirement REQ-A has no linked scenario.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('risk planner ranks higher risk and priority first', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aegis-plan-'));
  try {
    await mkdir(path.join(root, 'artifacts', 'aegis'), { recursive: true });
    await writeFile(
      path.join(root, 'artifacts', 'aegis', 'qa-scenarios.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        requirements: [
          { id: 'REQ-A', title: 'Requirement A', source: 'requirements.md', status: 'approved' },
        ],
        scenarios: [
          {
            id: 'TC-LOW',
            requirementIds: ['REQ-A'],
            title: 'Low risk',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Do action'],
            expectedResult: 'Result',
            priority: 'P3',
            risk: 'low',
            layer: 'unit',
            automationStatus: 'candidate',
          },
          {
            id: 'TC-HIGH',
            requirementIds: ['REQ-A'],
            title: 'High risk',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Do action'],
            expectedResult: 'Result',
            priority: 'P0',
            risk: 'critical',
            layer: 'api',
            automationStatus: 'candidate',
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve('scripts/aegis-plan-scenarios.mjs'), root],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const report = await readFile(
      path.join(root, 'artifacts', 'aegis', 'risk-ranked-test-plan.md'),
      'utf8',
    );
    expect(report.indexOf('TC-HIGH')).toBeLessThan(report.indexOf('TC-LOW'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('generator creates only approved, linked scaffolds and excludes unapproved scenarios', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aegis-generate-'));
  try {
    await mkdir(path.join(root, 'artifacts', 'aegis'), { recursive: true });
    await writeFile(
      path.join(root, 'artifacts', 'aegis', 'qa-scenarios.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        requirements: [
          {
            id: 'REQ-OK',
            title: 'Approved requirement',
            source: 'requirements.md */ injected',
            status: 'approved',
          },
          {
            id: 'REQ-PENDING',
            title: 'Pending requirement',
            source: 'requirements.md#pending',
            status: 'needs-clarification',
          },
        ],
        scenarios: [
          {
            id: 'TC-OK',
            requirementIds: ['REQ-OK'],
            title: 'Approved login journey',
            role: 'user',
            preconditions: ['Test user exists'],
            testData: ['synthetic user'],
            steps: ['Submit valid login details'],
            expectedResult: 'User reaches account home',
            priority: 'P1',
            risk: 'high',
            layer: 'ui',
            automationStatus: 'candidate',
          },
          {
            id: 'TC-PENDING',
            requirementIds: ['REQ-PENDING'],
            title: 'Pending journey',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Perform action'],
            expectedResult: 'Unknown behavior',
            priority: 'P2',
            risk: 'medium',
            layer: 'api',
            automationStatus: 'candidate',
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve('scripts/aegis-generate-tests.mjs'), root],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const out = path.join(root, 'artifacts', 'aegis', 'generated-tests');
    const files = await readdir(out);
    const scaffoldName = files.find(
      (file) => file.startsWith('tc-ok-') && file.endsWith('.spec.ts'),
    );
    expect(scaffoldName).toBeTruthy();
    expect(
      files.some((file) => file.startsWith('tc-pending-') && file.endsWith('.spec.ts')),
    ).toBeFalsy();
    expect(scaffoldName).toBeDefined();
    if (!scaffoldName) throw new Error('Expected approved scenario scaffold was not generated.');
    const scaffold = await readFile(path.join(out, scaffoldName), 'utf8');
    expect(scaffold).toContain('test.fixme');
    expect(scaffold).toContain('requirements.md * / injected');
    expect(scaffold).not.toContain('requirements.md */ injected');
    expect(scaffold).toContain('expect(true).toBe(false)');
    const manifest = JSON.parse(await readFile(path.join(out, 'generation-manifest.json'), 'utf8'));
    expect(manifest.generatedCount).toBe(1);
    expect(manifest.excludedCount).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release readiness audit blocks failed high-risk scenarios and accepts a reviewed passing catalog', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aegis-readiness-'));
  try {
    await mkdir(path.join(root, 'artifacts', 'aegis'), { recursive: true });
    const catalogPath = path.join(root, 'artifacts', 'aegis', 'qa-scenarios.json');
    const base = {
      schemaVersion: '1.0.0',
      requirements: [
        {
          id: 'REQ-CORE',
          title: 'Core behavior',
          source: 'requirements.md#core',
          status: 'approved',
        },
      ],
      scenarios: [
        {
          id: 'TC-CORE',
          requirementIds: ['REQ-CORE'],
          title: 'Core journey',
          role: 'user',
          preconditions: ['Synthetic account exists'],
          testData: ['synthetic account'],
          steps: ['Complete core journey'],
          expectedResult: 'Core journey succeeds',
          priority: 'P0',
          risk: 'critical',
          layer: 'api',
          automationStatus: 'automated',
          executionStatus: 'failed',
          evidence: ['artifacts/playwright-report/index.html'],
        },
      ],
    };
    await writeFile(catalogPath, JSON.stringify(base));
    const command = path.resolve('scripts/aegis-release-readiness.mjs');
    const failed = spawnSync(process.execPath, [command, root], { encoding: 'utf8' });
    expect(failed.status).toBe(1);
    let report = await readFile(
      path.join(root, 'artifacts', 'aegis', 'release-readiness.md'),
      'utf8',
    );
    expect(report).toContain('NOT READY — BLOCKERS FOUND');
    expect(report).toContain('TC-CORE: execution failed.');
    const coreScenario = base.scenarios[0];
    if (!coreScenario) throw new Error('Expected core scenario fixture.');
    coreScenario.executionStatus = 'passed';
    await writeFile(catalogPath, JSON.stringify(base));
    const passed = spawnSync(process.execPath, [command, root], { encoding: 'utf8' });
    expect(passed.status).toBe(0);
    report = await readFile(path.join(root, 'artifacts', 'aegis', 'release-readiness.md'), 'utf8');
    expect(report).toContain('NO CATALOG-BASED BLOCKERS DETECTED');
    expect(report).toContain('Human release-owner checklist');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release readiness blocks unknown execution statuses', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aegis-invalid-status-'));
  try {
    await mkdir(path.join(root, 'artifacts', 'aegis'), { recursive: true });
    await writeFile(
      path.join(root, 'artifacts', 'aegis', 'qa-scenarios.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        requirements: [
          {
            id: 'REQ-CORE',
            title: 'Core behavior',
            source: 'requirements.md#core',
            status: 'approved',
          },
        ],
        scenarios: [
          {
            id: 'TC-CORE',
            requirementIds: ['REQ-CORE'],
            title: 'Core journey',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Complete journey'],
            expectedResult: 'Journey succeeds',
            priority: 'P3',
            risk: 'low',
            layer: 'api',
            automationStatus: 'automated',
            executionStatus: 'unknown-status',
            evidence: ['artifacts/aegis/playwright-results.json'],
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve('scripts/aegis-release-readiness.mjs'), root],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    const report = await readFile(
      path.join(root, 'artifacts', 'aegis', 'release-readiness.md'),
      'utf8',
    );
    expect(report).toContain('TC-CORE: invalid execution status (unknown-status).');
    expect(report).toContain('NOT READY — BLOCKERS FOUND');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Playwright result importer updates only matched catalog scenarios with real report evidence', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aegis-import-results-'));
  try {
    const dir = path.join(root, 'artifacts', 'aegis');
    await mkdir(dir, { recursive: true });
    const catalogPath = path.join(dir, 'qa-scenarios.json');
    await writeFile(
      catalogPath,
      JSON.stringify({
        schemaVersion: '1.0.0',
        requirements: [
          {
            id: 'REQ-CORE',
            title: 'Core behavior',
            source: 'requirements.md#core',
            status: 'approved',
          },
        ],
        scenarios: [
          {
            id: 'TC-CORE',
            requirementIds: ['REQ-CORE'],
            title: 'Core journey',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Complete journey'],
            expectedResult: 'Journey succeeds',
            priority: 'P1',
            risk: 'high',
            layer: 'api',
            automationStatus: 'automated',
            executionStatus: 'not-run',
            evidence: [],
          },
          {
            id: 'TC-OTHER',
            requirementIds: ['REQ-CORE'],
            title: 'Other journey',
            role: 'user',
            preconditions: [],
            testData: ['synthetic'],
            steps: ['Other journey'],
            expectedResult: 'Other succeeds',
            priority: 'P2',
            risk: 'medium',
            layer: 'api',
            automationStatus: 'candidate',
            executionStatus: 'not-run',
            evidence: [],
          },
        ],
      }),
    );
    await writeFile(
      path.join(dir, 'playwright-results.json'),
      JSON.stringify({
        config: {},
        suites: [
          {
            title: 'API',
            specs: [
              {
                title: '[TC-CORE] core API journey',
                tests: [
                  {
                    title: 'returns expected result',
                    results: [{ status: 'passed', duration: 12 }],
                  },
                ],
              },
            ],
            suites: [],
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [path.resolve('scripts/aegis-import-playwright-results.mjs'), root],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const updated = JSON.parse(await readFile(catalogPath, 'utf8'));
    expect(updated.scenarios[0].executionStatus).toBe('passed');
    expect(updated.scenarios[0].evidence).toContain('artifacts/aegis/playwright-results.json');
    expect(updated.scenarios[1].executionStatus).toBe('not-run');
    expect(updated.scenarios[1].evidence).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
