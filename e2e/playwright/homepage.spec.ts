import { test, expect } from '@playwright/test';

test.describe('Portugal Vivo - Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
  });

  test('should load welcome screen with main elements', async ({ page }) => {
    await expect(page.getByText('Património Vivo')).toBeVisible();
    await expect(page.getByText('Explorar Portugal')).toBeVisible();
  });

  test('should navigate to explore tab', async ({ page }) => {
    await page.getByText('Explorar Portugal').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Explorar')).toBeVisible();
  });

  test('should navigate to map tab', async ({ page }) => {
    await page.getByText('Explorar Portugal').click();
    await page.waitForTimeout(2000);
    await page.getByText('Mapa').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Mapa Cultural')).toBeVisible();
  });

  test('should navigate to routes tab', async ({ page }) => {
    await page.getByText('Explorar Portugal').click();
    await page.waitForTimeout(2000);
    await page.getByText('Rotas').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Rotas')).toBeVisible();
  });

  test('should navigate to community tab', async ({ page }) => {
    await page.getByText('Explorar Portugal').click();
    await page.waitForTimeout(2000);
    await page.getByText('Comunidade').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Comunidade')).toBeVisible();
  });

  test('should navigate to profile tab', async ({ page }) => {
    await page.getByText('Explorar Portugal').click();
    await page.waitForTimeout(2000);
    await page.getByText('Perfil').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Perfil')).toBeVisible();
  });
});
