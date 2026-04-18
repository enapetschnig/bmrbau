import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_URL || "https://www.bmrbau.app",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
