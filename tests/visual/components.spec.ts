import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests - Critical Components', () => {
  
  test('Mobile Side-Drawer Open', async ({ page }) => {
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('networkidle');
    
    // Set mobile viewport first
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Disable animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
    
    // Find and click the mobile menu button
    const menuButton = page.locator('button.open-btn');
    await menuButton.waitFor({ state: 'visible' });
    await menuButton.click();
    await page.waitForTimeout(200);
    
    // Screenshot only the side drawer
    const sideDrawer = page.locator('#mobile-menu');
    await sideDrawer.waitFor({ state: 'visible' });
    await expect(sideDrawer).toHaveScreenshot('mobile-sidedrawer.png', {
      threshold: 0.2,
      animations: 'disabled'
    });
  });

  test('Desktop Header Only', async ({ page }) => {
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('networkidle');
    
    // Set desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Disable animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
    
    // Screenshot only the header element with specific role
    const header = page.locator('header[role="banner"]');
    await header.waitFor({ state: 'visible' });
    await expect(header).toHaveScreenshot('desktop-header.png', {
      threshold: 0.2,
      animations: 'disabled'
    });
  });

  test('BadgeMini Component on Events Page', async ({ page }) => {
    await page.goto('http://localhost:4321/veranstaltungen/');
    await page.waitForLoadState('networkidle');
    
    // Set desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Disable animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
    
    // Screenshot nur den ersten Event-Artikel mit den Badges
    const firstEvent = page.locator('article').first();
    await firstEvent.waitFor({ state: 'visible' });
    await expect(firstEvent).toHaveScreenshot('badge-mini-in-event.png', {
      threshold: 0.2,
      animations: 'disabled'
    });
  });
});
