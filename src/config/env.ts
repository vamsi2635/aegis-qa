const defaultUiBaseURL = 'https://playwright.dev';
const defaultApiBaseURL = 'https://jsonplaceholder.typicode.com';

function readAllowedTargetOrigins(): Set<string> {
  const raw = process.env.ALLOWED_TARGET_ORIGINS;
  const origins =
    raw === undefined
      ? [new URL(defaultUiBaseURL).origin, new URL(defaultApiBaseURL).origin]
      : raw.split(',').map((origin) => origin.trim());

  if (origins.length === 0 || origins.some((origin) => origin.length === 0)) {
    throw new Error('ALLOWED_TARGET_ORIGINS must contain comma-separated HTTP(S) origins.');
  }

  return new Set(
    origins.map((origin) => {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(
          `ALLOWED_TARGET_ORIGINS must contain valid absolute origins. Received: ${origin}`,
        );
      }

      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error(
          `ALLOWED_TARGET_ORIGINS entries must be HTTP(S) origins without paths or credentials. Received: ${origin}`,
        );
      }

      return parsed.origin;
    }),
  );
}

function readUrl(name: string, fallback: string, allowedOrigins: Set<string>): URL {
  const raw = process.env[name] ?? fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid absolute URL. Received: ${raw}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not include URL credentials.`);
  }
  if (parsed.href.includes('?')) {
    throw new Error(`${name} must not include a query string.`);
  }
  if (parsed.href.includes('#')) {
    throw new Error(`${name} must not include a fragment.`);
  }
  if (!allowedOrigins.has(parsed.origin)) {
    throw new Error(
      `${name} origin "${parsed.origin}" is not listed in ALLOWED_TARGET_ORIGINS. Add only approved non-production origins.`,
    );
  }
  return parsed;
}

const allowedTargetOrigins = readAllowedTargetOrigins();

export const env = {
  uiBaseURL: readUrl('BASE_URL', defaultUiBaseURL, allowedTargetOrigins)
    .toString()
    .replace(/\/$/, ''),
  apiBaseURL: readUrl('API_BASE_URL', defaultApiBaseURL, allowedTargetOrigins)
    .toString()
    .replace(/\/$/, ''),
};
