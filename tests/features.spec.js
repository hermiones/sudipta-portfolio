// Interactive features: locator inspector, coverage gutter, 3D test pyramid, theme reveal, mascot chat
// 5 tests x 3 engines (Chromium, Firefox, WebKit) = 15 tests
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 820 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(5000); // let the build intro finish
});

test('locator inspector shows a Playwright locator and copies it on click', async ({ page }) => {
  await page.keyboard.press('i');
  await expect(page.locator('body')).toHaveClass(/inspecting/);
  const link = page.locator('.hero .cta a[href="#flagships"]');
  await link.hover();
  await expect(page.locator('.insp-tag')).toContainText("getByRole('link', { name: 'View my work' })");
  await expect(page.locator('.insp-tag')).toContainText('unique');
  await link.click();
  await expect(page.locator('#toast')).toContainText("getByRole('link', { name: 'View my work' })");
  expect(new URL(page.url()).hash).toBe(''); // the click was swallowed, no navigation
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/inspecting/);
});

test('coverage gutter fills in as sections are read', async ({ page }) => {
  const badge = page.locator('.cov-badge');
  await expect(badge).toBeVisible();
  await page.evaluate(() => document.getElementById('matrix').scrollIntoView());
  await page.waitForTimeout(1800);
  await expect(page.locator('.cov i.hit').first()).toBeAttached();
  const pct = parseInt(await badge.locator('b').textContent(), 10);
  expect(pct).toBeGreaterThan(0);
});

test('3D test pyramid builds on view and rotates on drag', async ({ page }) => {
  const wrap = page.locator('#pyramid');
  await wrap.scrollIntoViewIfNeeded();
  await expect(wrap).toHaveClass(/built/);
  await expect(page.locator('#pyramid .slab')).toHaveCount(4);
  const pyr = page.locator('#pyramid .pyr');
  const scene = await page.locator('#pyramid .pyr-scene').boundingBox();
  const before = await pyr.evaluate(e => e.style.transform);
  await page.mouse.move(scene.x + scene.width / 2, scene.y + scene.height / 2);
  await page.mouse.down();
  await page.mouse.move(scene.x + scene.width / 2 + 160, scene.y + scene.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await pyr.evaluate(e => e.style.transform)).not.toBe(before);
  await page.hover('.pyr-leg li[data-l="2"]');
  await expect(page.locator('#pyramid .slab[data-l="2"]')).toHaveClass(/on/);
});

test('theme toggle switches light and dark', async ({ page }) => {
  const html = page.locator('html');
  await page.click('#themeBtn');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.waitForTimeout(900);
  await page.click('#themeBtn');
  await expect(html).not.toHaveAttribute('data-theme', 'light');
});

test('Testy follows the cursor and answers questions about Sudipta', async ({ page }) => {
  await page.mouse.wheel(0, 400);                       // Testy spawns on the first scroll
  await page.waitForTimeout(900);
  const buddy = page.getByRole('button', { name: /Ask Testy/ });
  await expect(buddy).not.toHaveClass(/unspawned/);
  const b = await buddy.boundingBox();
  const yawNow = () => page.locator('#buddy .b-turn').evaluate(e => parseFloat(/rotateY\((-?[\d.]+)deg/.exec(e.style.transform)[1]));
  await page.mouse.move(b.x - 600, b.y + 40);
  await page.waitForTimeout(700);
  expect(await yawNow()).toBeLessThan(-5);
  await page.mouse.move(b.x + b.width / 2, b.y - 400);
  await page.waitForTimeout(700);
  await buddy.click();
  const chat = page.getByRole('dialog', { name: /Ask Testy/ });
  await expect(chat).toBeVisible();
  await chat.getByRole('button', { name: 'Notice period?' }).click();
  await expect(chat.locator('.tc-m.tbot').last()).toContainText('30 days');
  await page.fill('#tcIn', 'where is she based');
  await page.press('#tcIn', 'Enter');
  await expect(chat.locator('.tc-m.tbot').last()).toContainText('Kolkata');
  await page.keyboard.press('Escape');
  await expect(chat).toBeHidden();
});
