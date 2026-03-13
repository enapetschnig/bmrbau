import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Admin-Bereiche sichtbar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator(".container, main, [role='main']").first()).toBeVisible({ timeout: 10_000 });
  });
});
