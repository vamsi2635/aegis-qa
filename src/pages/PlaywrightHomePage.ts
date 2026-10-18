import type { Locator, Page } from '@playwright/test';

export class PlaywrightHomePage {
  readonly page: Page;
  readonly mainHeading: Locator;
  readonly getStartedLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.mainHeading = page.getByRole('heading', {
      name: /playwright enables reliable web automation for testing/i,
    });

    this.getStartedLink = page.getByRole('link', {
      name: /get started/i,
    });
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  async openGettingStarted(): Promise<void> {
    await this.getStartedLink.click();
  }
}
