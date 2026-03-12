import { test, expect } from "@playwright/test";

test.describe("Arbeitsschutz (Mitarbeiter)", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/my-safety");
    // Admins get redirected to /safety-evaluations — either is fine
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });
});
