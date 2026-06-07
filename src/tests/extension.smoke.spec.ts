import { expect, test, type Page } from "@playwright/test";

type SmokeTheme = "dark" | "light";
type SmokeSurface = "dashboard" | "sidepanel";

const storeNames = ["tasks", "activityEvents", "focusSessions", "shifts", "dailyPlans", "reminders", "captures", "reports", "settings"];

const cases: Array<{ name: string; surface: SmokeSurface; theme: SmokeTheme; viewport: { width: number; height: number } }> = [
  { name: "dashboard dark desktop", surface: "dashboard", theme: "dark", viewport: { width: 1440, height: 900 } },
  { name: "dashboard light desktop", surface: "dashboard", theme: "light", viewport: { width: 1440, height: 900 } },
  { name: "sidepanel dark narrow", surface: "sidepanel", theme: "dark", viewport: { width: 390, height: 900 } },
  { name: "sidepanel light narrow", surface: "sidepanel", theme: "light", viewport: { width: 390, height: 900 } }
];

async function seedDenseState(page: Page, theme: SmokeTheme) {
  await page.goto("/dashboard.html");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.evaluate(
    async ({ theme, storeNames }) => {
      const openRequest = indexedDB.open("ops-copilot");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => resolve(openRequest.result);
      });
      const tx = db.transaction(storeNames, "readwrite");
      storeNames.forEach((storeName) => tx.objectStore(storeName).clear());

      const now = Date.now();
      const dateKey = new Date(now).toISOString().slice(0, 10);
      tx.objectStore("settings").put({
        id: "app",
        theme,
        aiMode: "assist",
        textModel: "gpt-5.4-mini",
        reportModel: "gpt-5.5",
        transcriptionModel: "gpt-4o-mini-transcribe",
        voiceEnabled: true,
        planMode: "assisted",
        notificationsEnabled: true,
        userName: "Sadick",
        launcher: {
          visible: true,
          positionY: 0.42,
          opacity: 0.92,
          compact: false,
          showOnlyDuringShift: false,
          disabledSites: []
        }
      });
      tx.objectStore("shifts").put({
        id: "default-shift",
        name: "Primary Shift",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        startHour: "07:00",
        endHour: "19:00",
        timezone: "Africa/Accra",
        quietHoursEnabled: true,
        autoShutdownPrompt: true
      });

      const priorities = ["critical", "high", "medium", "low"] as const;
      const statuses = ["active", "blocked", "pending", "completed"] as const;
      const tasks = Array.from({ length: 14 }, (_, index) => {
        const id = `task-smoke-${index + 1}`;
        const status = statuses[index % statuses.length];
        return {
          id,
          month: "June",
          week: "W23",
          priority: priorities[index % priorities.length],
          task: `Coordinate operational handoff item ${index + 1} with a deliberately descriptive title`,
          location: index % 2 ? "Dispatch dashboard" : "Flight operations queue",
          timeline: now - index * 30 * 60_000,
          status,
          completion: status === "completed" ? 100 : status === "active" ? 45 : status === "blocked" ? 20 : 5,
          blockers: status === "blocked" ? "Waiting on routing confirmation and maintenance availability." : "",
          improvements: "Reduce manual checks by grouping related updates.",
          notes: "Seeded smoke-test task with enough text to exercise wrapping and dense card layout.",
          dueAt: now + (index + 1) * 45 * 60_000,
          estimatedMinutes: 25 + index * 5,
          tags: ["smoke", index % 2 ? "dispatch" : "handoff"],
          metadata: {
            createdAt: now - index * 60 * 60_000,
            updatedAt: now - index * 20 * 60_000,
            sourceUrl: "https://example.test/ops",
            sourceTitle: "Smoke source",
            linkedTasks: [],
            activityLog: []
          }
        };
      });
      tasks.forEach((task) => tx.objectStore("tasks").put(task));

      tx.objectStore("focusSessions").put({
        id: "focus-smoke-active",
        taskId: "task-smoke-1",
        startTime: now - 12 * 60_000,
        durationMinutes: 45,
        status: "active",
        interruptions: 1
      });
      tx.objectStore("focusSessions").put({
        id: "focus-smoke-complete",
        taskId: "task-smoke-4",
        startTime: now - 4 * 60 * 60_000,
        endTime: now - 3 * 60 * 60_000,
        durationMinutes: 60,
        status: "completed",
        interruptions: 0
      });

      tx.objectStore("dailyPlans").put({
        id: "plan-smoke",
        date: dateKey,
        mode: "assisted",
        createdAt: now,
        updatedAt: now,
        rationale: "Prioritize blocked work first, then active handoff tasks.",
        items: tasks.slice(0, 6).map((task, index) => ({
          id: `plan-item-${index + 1}`,
          startTime: `${String(7 + index).padStart(2, "0")}:00`,
          endTime: `${String(8 + index).padStart(2, "0")}:00`,
          title: task.task,
          taskId: task.id,
          reason: index % 2 ? "Keeps field follow-up close to dispatch review." : "Reduces blocker risk early in the shift.",
          status: index === 0 ? "active" : "planned"
        }))
      });

      tasks.slice(0, 5).forEach((task, index) => {
        tx.objectStore("reminders").put({
          id: `reminder-smoke-${index + 1}`,
          taskId: task.id,
          title: `Follow up on ${task.task}`,
          dueAt: now + index * 10 * 60_000,
          status: index === 0 ? "fired" : "scheduled",
          createdAt: now - 60 * 60_000
        });
      });

      Array.from({ length: 10 }, (_, index) => {
        tx.objectStore("activityEvents").put({
          id: `event-smoke-${index + 1}`,
          timestamp: now - index * 15 * 60_000,
          type: index % 3 === 0 ? "task.blocked" : index % 3 === 1 ? "task.updated" : "focus.started",
          title: `Smoke activity event ${index + 1}`,
          details: "Representative operational activity used for visual smoke coverage.",
          taskId: tasks[index % tasks.length].id,
          source: "ui"
        });
      });

      tx.objectStore("reports").put({
        id: "report-smoke",
        type: "performance",
        title: "Smoke Performance Report",
        createdAt: now,
        periodStart: now - 8 * 60 * 60_000,
        periodEnd: now,
        content: "Seeded report content for visual smoke coverage.",
        aiGenerated: false
      });

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    { theme, storeNames }
  );
}

async function applyThemeClass(page: Page, theme: SmokeTheme) {
  await page.evaluate((theme) => document.documentElement.classList.toggle("light", theme === "light"), theme);
  await page.waitForTimeout(150);
}

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyScrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function verifyNavigation(page: Page) {
  const targets = [
    { title: "Daily Plan", text: "Today's Plan" },
    { title: "Reports", text: "Reports & Analytics" },
    { title: "Settings", text: "Appearance & Workflow" }
  ];
  for (const target of targets) {
    await page.locator(`button[title="${target.title}"]`).first().click();
    await expect(page.getByText(target.text)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
}

for (const smokeCase of cases) {
  test(`visual smoke: ${smokeCase.name}`, async ({ page }) => {
    await page.setViewportSize(smokeCase.viewport);
    await seedDenseState(page, smokeCase.theme);
    await page.goto(`/${smokeCase.surface}.html`);
    await expect(page.getByText("Ops Copilot").or(page.getByTitle("Overview")).first()).toBeVisible();
    await applyThemeClass(page, smokeCase.theme);
    await expect(page.getByText(/Good (morning|afternoon|evening)/).first()).toBeVisible();
    await expect(page.getByText("Current Priorities").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await verifyNavigation(page);
  });
}
