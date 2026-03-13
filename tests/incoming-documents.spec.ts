import { test, expect } from "@playwright/test";

test.describe("Eingehende Dokumente", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/incoming-documents");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Dokumentenliste sichtbar", async ({ page }) => {
    await page.goto("/incoming-documents");
    await expect(page.locator(".container, main").first()).toBeVisible({ timeout: 10_000 });
  });
});
