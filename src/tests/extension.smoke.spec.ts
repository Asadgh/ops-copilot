import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

test("loads built dashboard and side panel pages", async () => {
  const extensionPath = path.resolve("dist");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
  const page = await context.newPage();
  await page.goto(`file://${path.resolve("dist/dashboard.html")}`);
  await expect(page.getByText("Ops Copilot").first()).toBeVisible();
  await page.goto(`file://${path.resolve("dist/sidepanel.html")}`);
  await expect(page.getByText("Overview").or(page.getByTitle("Overview"))).toBeVisible();
  await context.close();
});
