import { test, expect } from "@playwright/test";

test.describe("Geräte", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/equipment");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Geräteliste oder Hinzufügen-Button sichtbar", async ({ page }) => {
    await page.goto("/equipment");
    await expect(page.locator("button, .container").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Suchfeld vorhanden und beschreibbar", async ({ page }) => {
    await page.goto("/equipment");
    const searchInput = page.locator("input").first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill("Bagger");
    await expect(searchInput).toHaveValue("Bagger");
  });

  test("Kategorie-Filter öffnet Optionen", async ({ page }) => {
    await page.goto("/equipment");
    const combobox = page.locator('[role="combobox"]').first();
    await expect(combobox).toBeVisible({ timeout: 10_000 });
    await combobox.click();
    await expect(page.locator('[role="option"], [role="listbox"]').first()).toBeVisible({ timeout: 5_000 });
  });
});
