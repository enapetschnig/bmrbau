import { test, expect } from "@playwright/test";

const SUPABASE_URL = "https://fxsjhdsitwtjasxbmksr.supabase.co";
const SUPABASE_KEY = "sb_publishable_juUA08EWUyeASe0zH9nnfw_ww-tnHyr";

async function getAuthToken(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<string | null> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes("supabase") && key?.includes("auth")) {
        try {
          const val = JSON.parse(localStorage.getItem(key) || "{}");
          return val?.access_token || val?.session?.access_token || null;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
}

test.describe("CRUD-Tests", () => {
  test.setTimeout(30_000);

  test("Zeiterfassung: Eintrag erstellen und löschen", async ({ page }) => {
    const testDate = "2099-12-31";

    await page.goto("/time-tracking");

    // Set far-future date to avoid conflicts with real entries
    const dateInput = page.locator("input[type='date']").first();
    await expect(dateInput).toBeVisible({ timeout: 10_000 });
    await dateInput.fill(testDate);
    await page.waitForTimeout(600);

    // Fill Beginn and Ende
    const timeInputs = page.locator("input[type='time']");
    await expect(timeInputs.nth(0)).toBeVisible({ timeout: 5_000 });
    await timeInputs.nth(0).fill("09:00");
    await timeInputs.nth(1).fill("17:00");

    // Save ("Stunden erfassen" is the submit button text in normal mode)
    await page.locator("button[type='submit']").click();

    // Verify success toast
    await expect(page.getByText(/gespeichert/i).first()).toBeVisible({ timeout: 8_000 });

    // Verify entry appears in "Bereits gebuchte Zeiten"
    await expect(page.getByText(/09:00|17:00/).first()).toBeVisible({ timeout: 5_000 });

    // Cleanup: delete via Supabase REST API
    const token = await getAuthToken(page);
    if (token) {
      await page.request.fetch(
        `${SUPABASE_URL}/rest/v1/time_entries?date=eq.${testDate}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_KEY,
            "Content-Type": "application/json",
          },
        }
      );
    }
  });

  test("Gerät: Erstellen und löschen", async ({ page }) => {
    const testName = "PLAYWRIGHT-TEST-GERÄT";

    // Pre-cleanup: remove any leftover test entries from previous runs
    await page.goto("/equipment");
    const token = await getAuthToken(page);
    if (token) {
      await page.request.fetch(
        `${SUPABASE_URL}/rest/v1/equipment?name=eq.${encodeURIComponent(testName)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      await page.reload();
    }

    // Open "Neues Gerät" dialog
    await page.locator("button").filter({ hasText: /Neues Gerät/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Fill name (Kategorie defaults to "Werkzeug")
    const nameInput = page.locator('[role="dialog"] input').first();
    await expect(nameInput).toBeVisible({ timeout: 3_000 });
    await nameInput.fill(testName);

    // Save
    await page.locator('[role="dialog"] button').filter({ hasText: /^Speichern$/ }).click();

    // Verify toast "Gespeichert"
    await expect(page.getByText(/Gespeichert|gespeichert/i).first()).toBeVisible({ timeout: 8_000 });

    // Verify item appears in list (Card renders as div.cursor-pointer)
    const card = page.locator("div.cursor-pointer").filter({ hasText: testName }).first();
    await expect(card).toBeVisible({ timeout: 8_000 });

    // Navigate to detail page via click
    await card.click();
    await expect(page).toHaveURL(/\/equipment\//, { timeout: 5_000 });

    // Delete (no confirmation dialog — direct delete)
    await page.locator("button").filter({ hasText: /Löschen/i }).click();

    // Verify redirect back to /equipment and toast
    await expect(page).toHaveURL(/\/equipment$/, { timeout: 8_000 });
    await expect(page.getByText(/Gelöscht|gelöscht/i).first()).toBeVisible({ timeout: 5_000 });

    // Verify test item is gone from list
    await expect(page.locator("div.cursor-pointer").filter({ hasText: testName })).not.toBeVisible({ timeout: 5_000 });
  });
});
