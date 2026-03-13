import { test, expect } from "@playwright/test";

test.describe("Schlechtwetter", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/bad-weather");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Inhalt sichtbar", async ({ page }) => {
    await page.goto("/bad-weather");
    await expect(page.locator(".container, main").first()).toBeVisible({ timeout: 10_000 });
  });
});
