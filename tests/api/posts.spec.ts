import { test, expect } from '@playwright/test';
import { env } from '../../src/config/env';

test.describe('Demo API contract', () => {
  test('returns a post with the expected basic schema @smoke', async ({ request }) => {
    const response = await request.get(`${env.apiBaseURL}/posts/1`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      userId: expect.any(Number),
      id: 1,
      title: expect.any(String),
      body: expect.any(String),
    });
  });
});
