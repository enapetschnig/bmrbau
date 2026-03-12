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
});
