import { test, expect } from "@playwright/test";

test.describe("Arbeitszeitgesetz-Bericht", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/legal-work-time");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Bericht-Inhalt sichtbar", async ({ page }) => {
    await page.goto("/legal-work-time");
    await expect(page.locator(".container").first()).toBeVisible({ timeout: 10_000 });
  });
});
