import { test, expect } from "@playwright/test";

test.describe("Plantafel", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Plantafel-Inhalt sichtbar", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.locator(".container, main").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Wochennavigation vorhanden", async ({ page }) => {
    await page.goto("/schedule");
    // ChevronLeft/Right buttons for week navigation
    await expect(page.locator("button").nth(1)).toBeVisible({ timeout: 10_000 });
  });

  test("Heute-Button klickbar", async ({ page }) => {
    await page.goto("/schedule");
    const heuteBtn = page.locator("button").filter({ hasText: /Heute/i });
    await expect(heuteBtn).toBeVisible({ timeout: 10_000 });
    await heuteBtn.click();
    // Page stays on schedule after clicking Heute
    await expect(page).toHaveURL(/\/schedule/);
  });
});
