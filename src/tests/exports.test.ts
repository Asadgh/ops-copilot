import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../shared/storage/db";
import { createTask } from "../shared/storage/repositories";
import { exportTasks } from "../shared/services/reports";

describe("exports", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("exports CSV and markdown from local tasks", async () => {
    await createTask({ task: "Investigate routing delay", priority: "high", status: "active", blockers: "Waiting on logs" }, "system");
    const csv = await exportTasks("csv", {});
    const markdown = await exportTasks("markdown", {});
    expect(csv.content).toContain("Investigate routing delay");
    expect(csv.filename.endsWith(".csv")).toBe(true);
    expect(markdown.content).toContain("Waiting on logs");
  });
});
