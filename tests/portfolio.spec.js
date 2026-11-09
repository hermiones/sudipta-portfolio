// Cross-browser responsive checks for sudipta.site
// 7 screen sizes x 3 engines (Chromium, Firefox, WebKit) = 21 tests
import { test, expect } from '@playwright/test';

const sizes = [
  ['iPhone SE', 375, 667, true], ['iPhone 14', 390, 844, true], ['Android', 412, 915, true],
  ['iPad portrait', 768, 1024, true], ['iPad landscape', 1024, 768, true],
  ['Laptop', 1366, 768, false], ['Desktop', 1920, 1080, false],
];

for (const [name, width, height, hasTouch] of sizes) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height }, hasTouch });

    test('renders without errors, overflow or clipped content', async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('/');
      await page.waitForTimeout(3500); // let the build intro finish

      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const skip = '[aria-hidden="true"],canvas,.hp,.bots,.dock,.fab,.term.mini';
        const overflow = [];
        document.querySelectorAll('body *').forEach(el => {
          if (el.closest(skip)) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
          const b = el.getBoundingClientRect();
          if (b.width && (b.right > vw + 2 || b.left < -2)) overflow.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.'));
        });
        const visible = s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).opacity !== '0'; };
        return {
          hScroll: document.documentElement.scrollWidth > vw + 1,
          overflow: [...new Set(overflow)].slice(0, 5),
          hero: visible('h1') && visible('.headline') && visible('.cta'),
          nameFits: document.querySelector('h1').getBoundingClientRect().right <= vw + 1,
          dock: visible('.dock'),
          sections: ['#about', '#experience', '#flagships', '#swarm', '#code', '#matrix', '#contact'].every(s => document.querySelector(s)),
          repos: document.querySelectorAll('.repo').length,
          cvLink: !!document.querySelector('a[download][href$=".pdf"]'),
        };
      });

      expect(errors, 'JavaScript errors').toEqual([]);
      expect(r.hScroll, 'horizontal scroll').toBe(false);
      expect(r.overflow, 'elements overflowing the viewport').toEqual([]);
      expect(r.hero, 'hero name, title and buttons visible').toBe(true);
      expect(r.nameFits, 'name not clipped').toBe(true);
      expect(r.dock, 'contact dock visible').toBe(true);
      expect(r.sections, 'all sections present').toBe(true);
      expect(r.repos, 'GitHub repo cards').toBeGreaterThan(0);
      expect(r.cvLink, 'CV download link').toBe(true);
    });
  });
}
