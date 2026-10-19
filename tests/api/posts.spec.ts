import { test, expect } from '@playwright/test';
import { env } from '../../src/config/env';

type PostResponse = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

test.describe('Demo API contract', () => {
  test('returns a post with valid required fields @smoke', async ({ request }) => {
    const response = await request.get(`${env.apiBaseURL}/posts/1`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const post = (await response.json()) as PostResponse;

    expect(post).toMatchObject({
      userId: expect.any(Number),
      id: 1,
      title: expect.any(String),
      body: expect.any(String),
    });

    expect(Number.isInteger(post.userId)).toBe(true);
    expect(post.userId).toBeGreaterThan(0);
    expect(post.title.trim().length).toBeGreaterThan(0);
    expect(post.body.trim().length).toBeGreaterThan(0);
  });

  test('returns a collection of posts with valid required fields', async ({ request }) => {
    const response = await request.get(`${env.apiBaseURL}/posts`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const posts: unknown = await response.json();

    expect(Array.isArray(posts)).toBe(true);
    expect(posts).not.toHaveLength(0);

    const firstPost = (posts as PostResponse[])[0];
    if (!firstPost) throw new Error("Expected the posts API to return at least one post.");

    expect(firstPost).toMatchObject({
      userId: expect.any(Number),
      id: expect.any(Number),
      title: expect.any(String),
      body: expect.any(String),
    });
    expect(Number.isInteger(firstPost.userId)).toBe(true);
    expect(firstPost.userId).toBeGreaterThan(0);
    expect(Number.isInteger(firstPost.id)).toBe(true);
    expect(firstPost.id).toBeGreaterThan(0);
    expect(firstPost.title.trim().length).toBeGreaterThan(0);
    expect(firstPost.body.trim().length).toBeGreaterThan(0);
  });

  test('returns 404 for an unknown API route', async ({ request }) => {
    const response = await request.get(`${env.apiBaseURL}/unknown-resource`);

    expect(response.status()).toBe(404);
  });
});
