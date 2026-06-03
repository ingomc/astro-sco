// a11y-test.js - Accessibility Testing Script
// Führt grundlegende Accessibility-Tests mit axe-core durch

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('Startseite sollte keine a11y-Verstöße haben', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Veranstaltungen-Seite sollte keine a11y-Verstöße haben', async ({ page }) => {
    await page.goto('/veranstaltungen');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Sportheim-Seite sollte keine a11y-Verstöße haben', async ({ page }) => {
    await page.goto('/sportheim');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard Navigation sollte funktionieren', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile || browserName === 'webkit', 'Skip keyboard tests on mobile and webkit');
    await page.goto('/');
    
    // 1. Tab press focuses the first skip link
    await page.keyboard.press('Tab');
    const skipLink1 = page.locator('text=Zum Hauptinhalt springen');
    await expect(skipLink1).toBeFocused();
    
    // 2. Tab press focuses the second skip link
    await page.keyboard.press('Tab');
    const skipLink2 = page.locator('text=Zur Navigation springen');
    await expect(skipLink2).toBeFocused();

    // 3. Tab press focuses the third skip link
    await page.keyboard.press('Tab');
    const skipLink3 = page.locator('text=Zum Footer springen');
    await expect(skipLink3).toBeFocused();
    
    // 4. Tab press focuses the logo link
    await page.keyboard.press('Tab');
    const logoLink = page.locator('header a[aria-label*="Startseite"]');
    await expect(logoLink).toBeFocused();

    // 5. Tab press focuses the first main navigation item
    await page.keyboard.press('Tab');
    const navLink = page.locator('#navigation a').first();
    await expect(navLink).toBeFocused();
  });

  test('Mobile Menu sollte accessibility-konform sein', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
    await page.goto('/');
    
    // Öffne Mobile Menu
    const menuButton = page.locator('button.open-btn');
    await menuButton.click();
    
    // Check ARIA attributes
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    
    const dialog = page.locator('#mobile-menu');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'mobile-menu-title');
    
    // Test Focus Management
    const firstMenuItem = dialog.locator('a').first();
    await expect(firstMenuItem).toBeFocused();
    
    // Test Escape Key
    await page.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('Farbkontrast sollte WCAG-Standards erfüllen', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('.link') // Test navigation links
      .analyze();
    
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(colorContrastViolations).toEqual([]);
  });

  test('Alle Bilder sollten Alt-Texte haben', async ({ page }) => {
    await page.goto('/');
    
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const alt = await image.getAttribute('alt');
      expect(alt).toBeTruthy();
      expect(alt.trim().length).toBeGreaterThan(0);
    }
  });

  test('Heading-Struktur sollte logisch sein', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
