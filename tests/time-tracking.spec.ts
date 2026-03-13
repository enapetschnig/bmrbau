import { test, expect } from "@playwright/test";

test.describe("Zeiterfassung", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/time-tracking");
    await expect(page).not.toHaveURL(/\/auth/);
    // Page header or main content visible
    await expect(page.locator("h1, h2, [data-testid='page-header']").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Datum-Auswahl sichtbar", async ({ page }) => {
    await page.goto("/time-tracking");
    await expect(page.locator("input[type='date'], button").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Datum-Input hat einen Wert", async ({ page }) => {
    await page.goto("/time-tracking");
    const dateInput = page.locator("input[type='date']").first();
    await expect(dateInput).toBeVisible({ timeout: 10_000 });
    const value = await dateInput.inputValue();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("Projekt-Dropdown öffnet Optionen", async ({ page }) => {
    await page.goto("/time-tracking");
    const combobox = page.locator('[role="combobox"]').first();
    await expect(combobox).toBeVisible({ timeout: 10_000 });
    await combobox.click();
    await expect(page.locator('[role="option"], [role="listbox"]').first()).toBeVisible({ timeout: 5_000 });
  });
});
