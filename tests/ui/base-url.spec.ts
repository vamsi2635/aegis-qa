import { expect, test } from '../../src/fixtures/test';

test.describe('UI navigation under a base path', () => {
  test.use({ baseURL: 'https://qa.example.com/qa-app/' });

  test('opens the base path and app-relative routes', async ({ homePage, page }) => {
    await page.route('**/*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }),
    );

    await homePage.open('/');
    await expect(page).toHaveURL('https://qa.example.com/qa-app/');

    await homePage.open('/login');
    await expect(page).toHaveURL('https://qa.example.com/qa-app/login');
  });
});

test.describe('UI navigation at an origin root', () => {
  test.use({ baseURL: 'https://qa.example.com/' });

  test('preserves root-hosted navigation', async ({ homePage, page }) => {
    await page.route('**/*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }),
    );

    await homePage.open('/');
    await expect(page).toHaveURL('https://qa.example.com/');

    await homePage.open('/login');
    await expect(page).toHaveURL('https://qa.example.com/login');
  });
});
