import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "src/tests",
  testMatch: "**/*.smoke.spec.ts",
  timeout: 60_000,
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/dashboard.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
