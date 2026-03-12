import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/auth");

  // Wait for the login form
  await page.waitForSelector("input[type='email']", { timeout: 10_000 });

  await page.fill("input[type='email']", process.env.TEST_EMAIL!);
  await page.fill("input[type='password']", process.env.TEST_PASSWORD!);
  await page.click("button[type='submit']");

  // Wait for redirect to dashboard after login
  await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/auth/);

  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
