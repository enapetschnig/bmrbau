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

  test("Mitarbeiterkarte klickbar öffnet Dialog", async ({ page }) => {
    await page.goto("/employees");
    const card = page.locator("[class*='card'], [class*='Card']").filter({ hasText: /.{3,}/ }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
  });

  test("Mitarbeiter-Dialog schließen funktioniert", async ({ page }) => {
    await page.goto("/employees");
    const card = page.locator("[class*='card'], [class*='Card']").filter({ hasText: /.{3,}/ }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 });
  });
});
