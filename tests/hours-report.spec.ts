import { test, expect } from "@playwright/test";

test.describe("Stundenübersicht", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/hours-report");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Filter-Elemente sichtbar", async ({ page }) => {
    await page.goto("/hours-report");
    await expect(page.locator(".container").first()).toBeVisible({ timeout: 10_000 });
    const controls = await page.locator("button, [role='combobox'], input, select").count();
    expect(controls).toBeGreaterThan(0);
  });
});
