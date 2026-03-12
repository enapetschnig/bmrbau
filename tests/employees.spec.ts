import { test, expect } from "@playwright/test";

test.describe("Mitarbeiter", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/employees");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Mitarbeiterliste vorhanden", async ({ page }) => {
    await page.goto("/employees");
    await expect(page.locator("table, [role='table'], .grid").first()).toBeVisible({ timeout: 10_000 });
  });
});
