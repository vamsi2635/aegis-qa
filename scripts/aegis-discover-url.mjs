#!/usr/bin/env node
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const rawTarget = process.env.BASE_URL ?? 'https://playwright.dev';
const allowedOrigins = new Set(
  (process.env.ALLOWED_TARGET_ORIGINS ?? 'https://playwright.dev,https://jsonplaceholder.typicode.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
        throw new Error('ALLOWED_TARGET_ORIGINS entries must be HTTP(S) origins without paths or credentials.');
      }
      return parsed.origin;
    }),
);
let target;
try {
  target = new URL(rawTarget);
} catch {
  console.error('BASE_URL must be a valid absolute URL.');
  process.exit(2);
}
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
  console.error('BASE_URL must use HTTP(S) and must not contain credentials, a query string, or a fragment.');
  process.exit(2);
}
if (!allowedOrigins.has(target.origin)) {
  console.error('Target origin is not allowlisted. Add only an approved non-production origin to ALLOWED_TARGET_ORIGINS.');
  process.exit(2);
}

const outputDir = path.resolve(process.argv[2] ?? 'artifacts/aegis');
const timeoutMs = Number(process.env.AEGIS_DISCOVERY_TIMEOUT_MS ?? 20_000);

if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
  console.error('AEGIS_DISCOVERY_TIMEOUT_MS must be between 1000 and 60000.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: false });
  page.setDefaultNavigationTimeout(timeoutMs);
  page.setDefaultTimeout(Math.min(timeoutMs, 10_000));

  const response = await page.goto(target.toString(), {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await page.locator('body').waitFor({ state: 'attached', timeout: timeoutMs });

  const snapshot = await page.evaluate(() => {
    const cleanText = (value) =>
      (value ?? '').replace(/\\s+/g, ' ').trim().slice(0, 300);

    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((anchor) => {
        const element = anchor;
        return {
          text: cleanText(element.innerText || element.getAttribute('aria-label')),
          href: element.href,
          sameOrigin: element.origin === window.location.origin,
        };
      })
      .filter((link) => link.href.startsWith('http:') || link.href.startsWith('https:'))
      .slice(0, 200);

    const forms = Array.from(document.querySelectorAll('form')).map((form, index) => ({
      index,
      method: (form.getAttribute('method') ?? 'get').toLowerCase(),
      action: form.action || window.location.href,
      fields: Array.from(form.querySelectorAll('input, select, textarea, button')).map((field) => {
        const element = field;
        return {
          tag: element.tagName.toLowerCase(),
          type: cleanText(element.type || element.tagName.toLowerCase()),
          name: cleanText(element.name),
          id: cleanText(element.id),
          label: cleanText(
            element.labels ? Array.from(element.labels).map((label) => label.innerText).join(' ') : '',
          ),
          required: element.required,
        };
      }),
    }));

    return {
      title: cleanText(document.title),
      description: cleanText(document.querySelector('meta[name="description"]')?.getAttribute('content')),
      language: document.documentElement.lang || null,
      headings: Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((heading) => ({
          level: heading.tagName.toLowerCase(),
          text: cleanText(heading.textContent),
        }))
        .filter((heading) => heading.text)
        .slice(0, 100),
      links,
      forms,
      buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
        .map((button) => cleanText(button.innerText || button.value || button.getAttribute('aria-label')))
        .filter(Boolean)
        .slice(0, 100),
      imagesWithoutAlt: document.querySelectorAll('img:not([alt]), img[alt=""]').length,
      passwordFieldCount: document.querySelectorAll('input[type="password"]').length,
    };
  });

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    mode: 'read-only single-page inspection',
    target: target.origin,
    finalUrl: new URL(page.url()).origin === target.origin ? page.url() : '[redirected to a different origin; details withheld]',
    httpStatus: response?.status() ?? null,
    page: snapshot,
    safety: {
      formsSubmitted: false,
      linksFollowed: false,
      credentialsCollected: false,
      inputValuesCollected: false,
      applicationFilesModified: false,
    },
    limitations: [
      'Inspects only the initial page; links are inventoried but never followed automatically.',
      'JavaScript interactions, authenticated routes, APIs, business rules, and hidden states are not inferred.',
      'Use only an approved non-production target. A same-origin allowlist is a guardrail, not proof that a target is safe.',
      'Review the inventory and confirm requirements before creating or executing functional tests.',
    ],
  };

  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'url-discovery.json');
  const mdPath = path.join(outputDir, 'url-discovery.md');
  const lines = [
    '# Aegis QA — URL Discovery',
    '',
    '- Target origin: ' + report.target,
    '- Final URL: ' + report.finalUrl,
    '- Generated: ' + report.generatedAt,
    '- HTTP status: ' + (report.httpStatus ?? 'unknown'),
    '- Mode: read-only single-page inspection',
    '- Forms submitted: no',
    '- Links followed: no',
    '',
    '## Page overview',
    '',
    '- Title: ' + (snapshot.title || '(no title found)'),
    '- Description: ' + (snapshot.description || '(no description found)'),
    '- Language: ' + (snapshot.language || '(not declared)'),
    '- Password fields: ' + snapshot.passwordFieldCount,
    '- Images missing alt text: ' + snapshot.imagesWithoutAlt,
    '',
    '## Headings',
    '',
    ...(snapshot.headings.length ? snapshot.headings.map((heading) => '- ' + heading.level + ': ' + heading.text) : ['- No headings found']),
    '',
    '## Buttons',
    '',
    ...(snapshot.buttons.length ? snapshot.buttons.map((button) => '- ' + button) : ['- No buttons found']),
    '',
    '## Forms (metadata only; no field values collected)',
    '',
    ...(snapshot.forms.length
      ? snapshot.forms.flatMap((form) => [
          '- Form ' + form.index + ': method=' + form.method + ', action=' + form.action,
          ...form.fields.map((field) => '  - ' + field.tag + ' type=' + field.type + ' name=' + (field.name || '(unnamed)') + ' id=' + (field.id || '(no id)') + ' required=' + field.required),
        ])
      : ['- No forms found']),
    '',
    '## Links (inventory only; not followed)',
    '',
    ...(snapshot.links.length
      ? snapshot.links.map((link) => '- [' + (link.text || 'untitled link') + '](' + link.href + ') — ' + (link.sameOrigin ? 'same origin' : 'external origin'))
      : ['- No links found']),
    '',
    '## Limitations and review required',
    '',
    ...report.limitations.map((item) => '- ' + item),
    '',
  ];

  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(mdPath, lines.join('\n'), 'utf8');
  console.log('Aegis URL discovery completed.');
  console.log('Markdown report: ' + mdPath);
  console.log('JSON report: ' + jsonPath);
  console.log('Review the reports before planning tests. No forms were submitted and no links were followed.');
} catch (error) {
  console.error('Aegis URL discovery failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
