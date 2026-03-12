import { test, expect } from "@playwright/test";

test.describe("Zeiterfassung", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/time-tracking");
    await expect(page).not.toHaveURL(/\/auth/);
    // Page header or main content visible
    await expect(page.locator("h1, h2, [data-testid='page-header']").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Datum-Auswahl sichtbar", async ({ page }) => {
    await page.goto("/time-tracking");
    await expect(page.locator("input[type='date'], button").first()).toBeVisible({ timeout: 10_000 });
  });
});
