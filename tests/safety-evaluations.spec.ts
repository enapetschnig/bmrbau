import { test, expect } from "@playwright/test";

test.describe("Arbeitsschutz (Admin)", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/safety-evaluations");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Neue Evaluierung Button sichtbar", async ({ page }) => {
    await page.goto("/safety-evaluations");
    await expect(page.locator("button").filter({ hasText: /Evaluierung|Neu|Erstellen/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
