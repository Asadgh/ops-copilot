import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "src/tests",
  testMatch: "**/*.smoke.spec.ts",
  timeout: 60_000,
  use: {
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
