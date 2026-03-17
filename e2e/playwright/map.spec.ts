import { test, expect } from '@playwright/test';

test.describe('Portugal Vivo - Map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.getByText('Explorar Portugal').click();
    await page.waitForTimeout(2000);
    await page.getByText('Mapa').click();
    await page.waitForTimeout(5000);
  });

  test('should show map with Leaflet tiles', async ({ page }) => {
    const mapContainer = page.locator('[data-testid="leaflet-map"]');
    await expect(mapContainer).toBeVisible();
  });

  test('should show map statistics', async ({ page }) => {
    await expect(page.getByText(/\d+ locais/)).toBeVisible();
  });

  test('should show region filter tabs', async ({ page }) => {
    await expect(page.getByText('Todas')).toBeVisible();
    await expect(page.getByText('Norte')).toBeVisible();
    await expect(page.getByText('Algarve')).toBeVisible();
  });

  test('should filter by region', async ({ page }) => {
    await page.getByText('Norte').click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Norte/)).toBeVisible();
  });
});
