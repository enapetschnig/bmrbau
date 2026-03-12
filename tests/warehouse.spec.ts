import { test, expect } from "@playwright/test";

test.describe("Lagerverwaltung", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Tabs vorhanden", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test("Produkt hinzufügen Button sichtbar", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.locator("button").filter({ hasText: /Produkt|Artikel|Hinzufügen|Neu/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
