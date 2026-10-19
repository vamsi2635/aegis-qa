/* global document, window */
#!/usr/bin/env node
import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const manifestPath = path.resolve(process.argv[2] ?? 'docs/application-onboarding.example.json');
const outputDir = path.resolve(process.argv[3] ?? 'artifacts/aegis/app-exploration');

function fail(message) {
  console.error('Aegis application exploration blocked: ' + message);
  process.exit(2);
}

function parseHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(label + ' must be an absolute URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    fail(label + ' must use HTTP(S) and must not contain credentials.');
  }
  return parsed;
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  fail(
    'Cannot read onboarding manifest: ' + (error instanceof Error ? error.message : String(error)),
  );
}

if (manifest.schemaVersion !== '1.0.0' || !manifest.application || !manifest.safety) {
  fail('Manifest is missing schemaVersion 1.0.0, application, or safety settings.');
}

const target = parseHttpUrl(manifest.application.baseUrl, 'application.baseUrl');
const authorizedOrigins = new Set(
  (manifest.safety.authorizedOrigins ?? []).map(
    (value) => parseHttpUrl(value, 'authorized origin').origin,
  ),
);
if (!authorizedOrigins.has(target.origin)) {
  fail('The application origin is not in safety.authorizedOrigins.');
}
if (
  manifest.safety.environmentType === 'production' ||
  manifest.safety.environmentType === 'unknown'
) {
  console.warn('Environment is production/unknown: passive read-only inspection only.');
}
if (
  manifest.safety.allowWriteActions === true ||
  manifest.safety.allowDestructiveActions === true
) {
  console.warn(
    'This explorer intentionally ignores write/destructive permissions and remains passive.',
  );
}

const maxPages = Math.min(500, Math.max(1, Number(manifest.safety.maxPages ?? 50)));
const maxDurationSeconds = Math.min(
  3600,
  Math.max(10, Number(manifest.safety.maxDurationSeconds ?? 300)),
);
const timeoutMs = Math.min(
  30_000,
  Math.max(2_000, Number(process.env.AEGIS_EXPLORER_TIMEOUT_MS ?? 15_000)),
);
const statePath =
  manifest.authentication?.strategy === 'storageState' && manifest.authentication?.storageStatePath
    ? path.resolve(path.dirname(manifestPath), manifest.authentication.storageStatePath)
    : null;

if (statePath && !statePath.startsWith(path.resolve(path.dirname(manifestPath)) + path.sep)) {
  fail(
    'storageStatePath must be inside the manifest directory tree. Keep storage-state files local and ignored.',
  );
}

const startedAt = Date.now();
const queue = [target.toString()];
const visited = new Set();
const pages = [];
const errors = [];
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...(statePath ? { storageState: statePath } : {}),
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(timeoutMs);
  page.setDefaultTimeout(Math.min(timeoutMs, 10_000));

  page.on('pageerror', (error) => {
    errors.push({
      route: safeRoute(page.url()),
      type: 'pageerror',
      message: redact(error.message).slice(0, 500),
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push({
        route: safeRoute(page.url()),
        type: 'console-error',
        message: redact(message.text()).slice(0, 500),
      });
    }
  });

  while (
    queue.length &&
    visited.size < maxPages &&
    Date.now() - startedAt < maxDurationSeconds * 1000
  ) {
    const next = queue.shift();
    const url = parseHttpUrl(next, 'queued URL');
    const routeKey = url.origin + url.pathname;
    if (visited.has(routeKey) || !authorizedOrigins.has(url.origin)) continue;
    visited.add(routeKey);

    try {
      const response = await page.goto(url.origin + url.pathname, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
      const finalUrl = parseHttpUrl(page.url(), 'final page URL');
      if (!authorizedOrigins.has(finalUrl.origin)) {
        errors.push({
          route: routeKey,
          type: 'safety-stop',
          message: 'Cross-origin redirect blocked.',
        });
        break;
      }

      const snapshot = await page.evaluate(() => {
        const clean = (value, limit = 240) =>
          String(value ?? '')
            .replace(/\\s+/g, ' ')
            .trim()
            .slice(0, limit);
        const safeHref = (href) => {
          try {
            const url = new URL(href, window.location.href);
            return url.origin + url.pathname;
          } catch {
            return '';
          }
        };
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map((anchor) => ({
            text: clean(anchor.innerText || anchor.getAttribute('aria-label')),
            href: safeHref(anchor.href),
            sameOrigin: (() => {
              try {
                return new URL(anchor.href).origin === window.location.origin;
              } catch {
                return false;
              }
            })(),
          }))
          .filter((item) => item.href)
          .slice(0, 250);
        const forms = Array.from(document.querySelectorAll('form')).map((form, index) => ({
          index,
          method: clean(form.getAttribute('method') || 'get').toLowerCase(),
          action: safeHref(form.action || window.location.href),
          fields: Array.from(form.querySelectorAll('input,select,textarea,button')).map(
            (field) => ({
              tag: field.tagName.toLowerCase(),
              type: clean(field.type || field.tagName.toLowerCase(), 40),
              name: clean(field.name, 100),
              id: clean(field.id, 100),
              label: clean(
                field.labels
                  ? Array.from(field.labels)
                      .map((label) => label.innerText)
                      .join(' ')
                  : '',
              ),
              required: Boolean(field.required),
              autocomplete: clean(field.autocomplete, 60),
            }),
          ),
        }));
        return {
          title: clean(document.title),
          description: clean(document.querySelector('meta[name="description"]')?.content),
          language: document.documentElement.lang || null,
          headings: Array.from(document.querySelectorAll('h1,h2,h3'))
            .map((node) => ({
              level: node.tagName.toLowerCase(),
              text: clean(node.textContent),
            }))
            .filter((item) => item.text)
            .slice(0, 100),
          links,
          forms,
          buttons: Array.from(
            document.querySelectorAll(
              'button,[role="button"],input[type="button"],input[type="submit"]',
            ),
          )
            .map((node) => clean(node.innerText || node.value || node.getAttribute('aria-label')))
            .filter(Boolean)
            .slice(0, 150),
          landmarks: Array.from(
            document.querySelectorAll('main,nav,header,footer,[role="main"],[role="navigation"]'),
          )
            .map((node) => ({
              tag: node.tagName.toLowerCase(),
              role: clean(node.getAttribute('role')),
              label: clean(node.getAttribute('aria-label')),
            }))
            .slice(0, 50),
          imagesWithoutAlt: document.querySelectorAll('img:not([alt]),img[alt=""]').length,
          passwordFieldCount: document.querySelectorAll('input[type="password"]').length,
        };
      });

      const route = safeRoute(finalUrl.toString());
      pages.push({ route, status: response?.status() ?? null, title: snapshot.title, ...snapshot });

      for (const link of snapshot.links) {
        if (!link.sameOrigin || !authorizedOrigins.has(new URL(link.href).origin)) continue;
        if (!visited.has(link.href)) queue.push(link.href);
      }
    } catch (error) {
      errors.push({
        route: routeKey,
        type: 'navigation-error',
        message: redact(error instanceof Error ? error.message : String(error)).slice(0, 500),
      });
    }
  }

  await mkdir(outputDir, { recursive: true });
  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    application: manifest.application.name,
    startOrigin: target.origin,
    mode: 'bounded passive same-origin crawl',
    environmentType: manifest.safety.environmentType,
    pagesVisited: pages.length,
    pageBudget: maxPages,
    durationBudgetSeconds: maxDurationSeconds,
    durationMs: Date.now() - startedAt,
    pages,
    errors,
    safety: {
      formsSubmitted: false,
      buttonsClicked: false,
      linksFollowedByNavigation: false,
      onlySameOriginPagesQueued: true,
      credentialsOrFieldValuesCollected: false,
      writesPerformed: false,
      destructiveActionsPerformed: false,
      storageStateUsed: Boolean(statePath),
    },
    limitations: [
      'This is passive DOM reconnaissance, not functional testing or proof of complete coverage.',
      'It does not click controls, submit forms, infer expected business behavior, or exercise hidden JavaScript states.',
      'Authenticated discovery requires an owner-approved local storage-state file or a separate reviewed authentication fixture.',
      'API coverage requires an approved OpenAPI specification, API documentation, or repository evidence.',
      'Dynamic routes, inaccessible links, role-specific views, and server-side rules may not be discoverable from a crawl.',
      'Review generated artifacts for sensitive application text before sharing them.',
    ],
  };
  const jsonPath = path.join(outputDir, 'app-exploration.json');
  const mdPath = path.join(outputDir, 'app-exploration.md');
  const lines = [
    '# Aegis QA — Application Exploration',
    '',
    '- Application: ' + redact(report.application),
    '- Origin: ' + report.startOrigin,
    '- Generated: ' + report.generatedAt,
    '- Environment: ' + report.environmentType,
    '- Mode: bounded passive same-origin crawl',
    '- Pages visited: ' + report.pagesVisited + ' / ' + report.pageBudget,
    '- Duration: ' + report.durationMs + ' ms',
    '- Forms submitted: no',
    '- Buttons clicked: no',
    '- Writes performed: no',
    '',
    '## Discovered pages',
    '',
    ...(pages.length
      ? pages.map(
          (p) =>
            '- ' +
            p.status +
            ' — ' +
            p.route +
            ' — ' +
            (p.title || '(untitled)') +
            ' — headings: ' +
            p.headings.length +
            ', links: ' +
            p.links.length +
            ', forms: ' +
            p.forms.length +
            ', buttons: ' +
            p.buttons.length,
        )
      : ['- No pages were successfully inspected.']),
    '',
    '## Observed browser errors',
    '',
    ...(errors.length
      ? errors.map((e) => '- ' + e.type + ' at ' + e.route + ': ' + e.message)
      : ['- No browser errors observed during this run.']),
    '',
    '## Limitations',
    '',
    ...report.limitations.map((item) => '- ' + item),
    '',
  ];
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(mdPath, lines.join('\n'), 'utf8');
  console.log('Aegis passive exploration completed.');
  console.log('Pages inspected: ' + pages.length);
  console.log('JSON report: ' + jsonPath);
  console.log('Markdown report: ' + mdPath);
} catch (error) {
  console.error(
    'Aegis exploration failed: ' + redact(error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}

function safeRoute(value) {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return '(unknown route)';
  }
}

function redact(value) {
  return String(value)
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
      try {
        const url = new URL(match);
        return url.origin + url.pathname;
      } catch {
        return '[url]';
      }
    })
    .replace(/(bearer\s+)[a-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(
      /(token|password|secret|authorization|cookie)(\s*[:=]\s*)[^\s,;]+/gi,
      '$1$2[REDACTED]',
    );
}
