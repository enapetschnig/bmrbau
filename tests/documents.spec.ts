import { test, expect } from "@playwright/test";

test.describe("Dokumentenbibliothek", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/documents");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Upload oder Dokumentenliste sichtbar", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.locator("button, .container").first()).toBeVisible({ timeout: 10_000 });
  });
});
