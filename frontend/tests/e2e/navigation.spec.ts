import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

test('create, gallery, and jobs use separate routes without losing the prompt draft', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  const prompt = page.getByRole('textbox', { name: 'Prompt', exact: true });
  await expect(prompt).toBeVisible();
  await prompt.fill('route-preserved draft');

  await page.getByRole('link', { name: 'Gallery', exact: true }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'First gallery image' })).toBeVisible();
  await expect(prompt).toHaveCount(0);

  await page.getByRole('link', { name: 'Jobs', exact: true }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page).toHaveURL(/\/jobs\?tab=history$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('button', { name: 'Running', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(prompt).toHaveValue('route-preserved draft');
});

test('gallery lightbox URL and reuse action stay route-aware', async ({ page }) => {
  await mockApi(page);
  await page.goto('/gallery');

  await expect(page.getByRole('img', { name: 'First gallery image' })).toBeVisible();
  await page.getByRole('img', { name: 'First gallery image' }).click();
  await expect(page).toHaveURL(/\/gallery\?.*image=img-1/);

  let lightbox = page.getByRole('dialog', { name: 'Image Details' });
  await page.goBack();
  await expect(lightbox).toBeHidden();
  await page.getByRole('img', { name: 'First gallery image' }).click();
  lightbox = page.getByRole('dialog', { name: 'Image Details' });
  await lightbox.getByRole('button', { name: 'Use prompt', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('textbox', { name: 'Prompt', exact: true })).toHaveValue('First gallery image');
});
