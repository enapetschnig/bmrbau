import { test, expect } from "@playwright/test";

test.describe("Meine Stunden", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/my-hours");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator(".card, main, [class*='Card']").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Inhalt sichtbar", async ({ page }) => {
    await page.goto("/my-hours");
    await expect(page.locator(".container").first()).toBeVisible({ timeout: 10_000 });
  });
});
