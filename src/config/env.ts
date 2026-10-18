function readUrl(name: string, fallback: string): URL {
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
  return parsed;
}

export const env = {
  baseURL: readUrl('BASE_URL', 'https://playwright.dev').toString().replace(/\/$/, ''),
  apiBaseURL: readUrl('API_BASE_URL', 'https://jsonplaceholder.typicode.com')
    .toString()
    .replace(/\/$/, ''),
};
