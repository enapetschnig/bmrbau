import { test, expect } from "@playwright/test";

test.describe("Eingangsrechnungen", () => {
  test("Seite lädt", async ({ page }) => {
    await page.goto("/incoming-invoices");
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Tabs sichtbar (Liste / Hochladen / Abgleich)", async ({ page }) => {
    await page.goto("/incoming-invoices");
    await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 10_000 });
    const tabCount = await page.locator('[role="tab"]').count();
    expect(tabCount).toBeGreaterThanOrEqual(3);
  });

  test("Hochladen-Tab öffnet Upload-Bereich", async ({ page }) => {
    await page.goto("/incoming-invoices");
    await page.locator('[role="tab"]').filter({ hasText: /Hochladen|Upload/i }).click();
    await expect(page.locator("text=/Hochladen|Datei/i").first()).toBeVisible({ timeout: 5_000 });
  });

  test("Tab Abgleich wechselt Inhalt", async ({ page }) => {
    await page.goto("/incoming-invoices");
    await page.locator('[role="tab"]').filter({ hasText: /Abgleich/i }).click();
    await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible({ timeout: 5_000 });
  });
});
