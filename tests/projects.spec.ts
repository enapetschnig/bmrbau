import { test, expect } from "@playwright/test";

test.describe("Projekte", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Neues Projekt Button sichtbar", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("button").filter({ hasText: /Projekt|Neu|Erstellen/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Suchfeld funktioniert", async ({ page }) => {
    await page.goto("/projects");
    const searchInput = page.locator("input").first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill("Test");
    await expect(searchInput).toHaveValue("Test");
  });

  test("Mindestens ein Projekt vorhanden", async ({ page }) => {
    await page.goto("/projects");
    // Wait for data to load
    await page.waitForTimeout(2000);
    const cards = page.locator("[class*='card'], [class*='Card']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });
});
