import { test, expect } from '../../src/fixtures/test';

test.describe('Playwright documentation landing page', () => {
  test('shows the main heading and a getting started path @smoke', async ({ homePage, page }) => {
    await homePage.open();
    await expect(page).toHaveTitle(/Playwright/);
    await expect(homePage.mainHeading).toBeVisible();
    await expect(homePage.getStartedLink).toBeVisible();
  });

  test('opens the getting started documentation', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.openGettingStarted();
    await expect(page).toHaveURL(/.*docs\/intro/);
    await expect(page.getByRole('heading', { name: /installation/i })).toBeVisible();
  });
});
