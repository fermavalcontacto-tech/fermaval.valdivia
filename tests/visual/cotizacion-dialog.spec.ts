import { test, expect, type Page } from '@playwright/test';

/**
 * Visual / overflow snapshot tests for NuevaCotizacionDialog + ItemsEditor.
 *
 * Goal: catch regressions where mobile and desktop diverge — hidden required
 * fields, clipped inputs, accidental horizontal overflow.
 *
 * The test requires an authenticated Supabase session. In Lovable's sandbox
 * the session is auto-injected via LOVABLE_BROWSER_SUPABASE_* env vars.
 * Outside the sandbox set those manually or the suite skips itself.
 */

const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const HAS_SESSION = Boolean(STORAGE_KEY && SESSION_JSON);

const REQUIRED_LABELS = [
  /Nombre/i,
  /Precio \/ m²/i,
  /Responsable/i,
  /Tipo/i,
  /Largo \(m\)/i,
  /Cantidad/i,
  /Color/i,
];

async function seedSession(page: Page) {
  // Land on a same-origin page first so localStorage writes the right origin.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if (HAS_SESSION) {
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [STORAGE_KEY!, SESSION_JSON!],
    );
  }
}

async function openDialog(page: Page) {
  await page.goto('/admin/cotizaciones', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Nueva cotización/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('NuevaCotizacionDialog · visual snapshots', () => {
  test.skip(!HAS_SESSION, 'No Supabase session injected — set LOVABLE_BROWSER_SUPABASE_* to run.');

  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('all required fields are visible and dialog has no horizontal overflow', async ({ page }) => {
    const dialog = await openDialog(page);

    for (const label of REQUIRED_LABELS) {
      await expect(dialog.getByText(label).first()).toBeVisible();
    }

    // Page-level horizontal overflow.
    const docOverflow = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(docOverflow, 'page horizontal overflow (px)').toBeLessThanOrEqual(1);

    // Dialog-level horizontal overflow.
    const dialogOverflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(dialogOverflow, 'dialog horizontal overflow (px)').toBeLessThanOrEqual(1);

    await expect(dialog).toHaveScreenshot('nueva-cotizacion-dialog.png', {
      animations: 'disabled',
    });
  });

  test('ItemsEditor with 2 items renders all controls without clipping', async ({ page }) => {
    const dialog = await openDialog(page);

    await dialog.getByRole('button', { name: /Agregar otra plancha/i }).click();

    // Locate the ItemsEditor block via its label.
    const editor = dialog
      .locator('div')
      .filter({ hasText: /^Planchas \(ancho 1 m/ })
      .first();
    await expect(editor).toBeVisible();

    // Every row must expose Tipo / Largo / Cantidad / Color.
    const tipoTriggers = editor.getByLabel(/Tipo/i);
    const largoInputs = editor.getByLabel(/Largo \(m\)/i);
    const cantidadInputs = editor.getByLabel(/Cantidad/i);
    const colorTriggers = editor.getByLabel(/Color/i);

    await expect(tipoTriggers).toHaveCount(2);
    await expect(largoInputs).toHaveCount(2);
    await expect(cantidadInputs).toHaveCount(2);
    await expect(colorTriggers).toHaveCount(2);

    for (const loc of [tipoTriggers, largoInputs, cantidadInputs, colorTriggers]) {
      await expect(loc.nth(0)).toBeVisible();
      await expect(loc.nth(1)).toBeVisible();
    }

    const overflow = await editor.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'ItemsEditor horizontal overflow (px)').toBeLessThanOrEqual(1);

    await expect(editor).toHaveScreenshot('items-editor-two-items.png', {
      animations: 'disabled',
    });
  });
});
