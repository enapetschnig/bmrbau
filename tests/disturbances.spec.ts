import { test, expect } from "@playwright/test";

test.describe("Störungen", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/disturbances");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Neue Störung Button oder Liste sichtbar", async ({ page }) => {
    await page.goto("/disturbances");
    await expect(page.locator("button, .container").first()).toBeVisible({ timeout: 10_000 });
  });
});
