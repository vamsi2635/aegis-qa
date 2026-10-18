import { test as base, expect } from '@playwright/test';
import { PlaywrightHomePage } from '../pages/PlaywrightHomePage';

type AppFixtures = { homePage: PlaywrightHomePage };

export const test = base.extend<AppFixtures>({
  homePage: async ({ page }, use) => {
    await use(new PlaywrightHomePage(page));
  },
});

export { expect };
