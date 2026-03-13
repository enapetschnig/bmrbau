import { test, expect } from "@playwright/test";

test.describe("Notizblock", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/notepad");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Notiz-Editor sichtbar", async ({ page }) => {
    await page.goto("/notepad");
    await expect(page.locator("textarea, [contenteditable], .container").first()).toBeVisible({ timeout: 10_000 });
  });
});
