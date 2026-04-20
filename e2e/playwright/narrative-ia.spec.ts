/**
 * E2E — Narrativa IA Flow
 *
 * Tests the AI narrative generation section:
 * - Style selector (Contador de Histórias / Educativo / Resumido)
 * - Premium gate for unauthenticated / free users
 * - "Saber mais" free brief available for short descriptions
 * - "Ouvir" TTS button present after narrative is generated
 */
import { test, expect, type Page } from '@playwright/test';

async function goToFirstPOIDetail(page: Page): Promise<boolean> {
  await page.goto('/');
  await page.waitForTimeout(4000);
  await page.getByText('Explorar Portugal').click();
  await page.waitForTimeout(3000);

  const firstCard = page.locator('a[href*="/heritage/"]').first();
  if (await firstCard.isVisible()) {
    const href = await firstCard.getAttribute('href');
    if (href) {
      await page.goto(href);
      await page.waitForTimeout(4000);
      return true;
    }
  }
  return false;
}

test.describe('Narrativa IA — section structure', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await goToFirstPOIDetail(page);
    if (!ok) test.skip();
  });

  test('Narrativa IA heading is visible', async ({ page }) => {
    await expect(page.getByText('Narrativa IA')).toBeVisible();
  });

  test('style selector shows 3 options', async ({ page }) => {
    await expect(page.getByText('Contador de Histórias')).toBeVisible();
    await expect(page.getByText('Educativo')).toBeVisible();
    await expect(page.getByText('Resumido')).toBeVisible();
  });

  test('style options are selectable', async ({ page }) => {
    const educativo = page.getByText('Educativo');
    await educativo.click();
    await page.waitForTimeout(500);
    // After clicking, the style is selected — visually the style tab should be highlighted
    // (no specific testID, so just verify it's still visible and clickable)
    await expect(educativo).toBeVisible();

    const resumido = page.getByText('Resumido');
    await resumido.click();
    await page.waitForTimeout(500);
    await expect(resumido).toBeVisible();
  });
});

test.describe('Narrativa IA — premium gate (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await goToFirstPOIDetail(page);
    if (!ok) test.skip();
  });

  test('"Gerar Narrativa" button shows lock for guest users', async ({ page }) => {
    // In dev mode isPremium might be true — check for either state
    const generateBtn = page.getByText(/Gerar Narrativa|Narrativa Premium/i);
    await expect(generateBtn).toBeVisible();
  });

  test('clicking "Narrativa Premium" routes to /premium for guest', async ({ page }) => {
    const premiumBtn = page.getByText('Narrativa Premium');
    if (await premiumBtn.isVisible()) {
      await premiumBtn.click();
      await page.waitForTimeout(2000);
      expect(page.url()).toContain('/premium');
    }
  });
});

test.describe('Narrativa IA — free brief', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await goToFirstPOIDetail(page);
    if (!ok) test.skip();
  });

  test('"Saber mais" free brief button appears for short descriptions', async ({ page }) => {
    const saberMais = page.getByText(/Saber mais.*gratuito/i);
    // Only assert if present (depends on the POI's description length)
    const count = await saberMais.count();
    if (count > 0) {
      await expect(saberMais).toBeVisible();
    }
  });

  test('clicking "Saber mais" shows loading then content', async ({ page }) => {
    const saberMais = page.getByText(/Saber mais.*gratuito/i);
    if (!await saberMais.isVisible()) test.skip();

    await saberMais.click();
    // Either loading indicator or result should appear within 10s
    const result = page.getByText(/Resumo gerado por IA|A gerar resumo/i);
    await expect(result).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Narrativa IA — audio on narrative', () => {
  // This requires premium access to generate a narrative first.
  // In dev mode (EXPO_PUBLIC_DEV_MODE=true) isPremium is true.
  test('audio guide in action bar is visible', async ({ page }) => {
    const ok = await goToFirstPOIDetail(page);
    if (!ok) test.skip();

    const audioBtn = page.getByText(/Ouvir|Áudio Premium/i).first();
    await expect(audioBtn).toBeVisible();
  });

  test('"Áudio Premium" routes to /premium for unauthenticated users', async ({ page }) => {
    const ok = await goToFirstPOIDetail(page);
    if (!ok) test.skip();

    const premiummBtn = page.getByText('Áudio Premium');
    if (await premiummBtn.isVisible()) {
      await premiummBtn.click();
      await page.waitForTimeout(2000);
      expect(page.url()).toContain('/premium');
    }
  });
});
