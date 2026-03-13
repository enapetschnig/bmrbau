import { test, expect } from "@playwright/test";

test.describe("Firmen-Chat", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/company-chat");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Chat-Bereich sichtbar", async ({ page }) => {
    await page.goto("/company-chat");
    await expect(page.locator("button, .container, main").first()).toBeVisible({ timeout: 10_000 });
  });
});
