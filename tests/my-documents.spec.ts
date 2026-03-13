import { test, expect } from "@playwright/test";

test.describe("Meine Dokumente", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/my-documents");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Dokumente-Liste oder Upload sichtbar", async ({ page }) => {
    await page.goto("/my-documents");
    await expect(page.locator(".container").first()).toBeVisible({ timeout: 10_000 });
  });
});
