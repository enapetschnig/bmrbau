import { test, expect } from "@playwright/test";

test.describe("Tagesberichte", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/daily-reports");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Neuer Bericht Button oder Liste sichtbar", async ({ page }) => {
    await page.goto("/daily-reports");
    await expect(page.locator("button, .container").first()).toBeVisible({ timeout: 10_000 });
  });
});
