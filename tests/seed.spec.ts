import { expect, test } from '@playwright/test';

test('seed: application is reachable', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Playwright/i);
});
