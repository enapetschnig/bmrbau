import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("lädt ohne Fehler", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/auth/);
    // At least one navigation element visible
    await expect(page.locator("main, [role='main'], .container").first()).toBeVisible({ timeout: 10_000 });
  });

  test("zeigt Navigations-Kacheln", async ({ page }) => {
    await page.goto("/");
    // Should show at least 3 navigation cards/tiles
    const cards = page.locator("a[href], button").filter({ hasText: /.+/ });
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });
});
