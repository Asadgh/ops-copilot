import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_SETTINGS_ID, DEFAULT_SETTINGS } from "../shared/constants";
import { buildTask } from "../shared/storage/repositories";
import { backupToSyncStorage, exportFullBackup, importFullBackup, restoreFromSyncBackupIfEmpty } from "../shared/storage/syncBackup";
import { db } from "../shared/storage/db";

type SyncStore = Record<string, unknown>;

function stubChromeSync(initial: SyncStore = {}): SyncStore {
  const store: SyncStore = { ...initial };
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        async get(keys?: string | string[]) {
          if (!keys) return { ...store };
          if (typeof keys === "string") return { [keys]: store[keys] };
          return keys.reduce<SyncStore>((result, key) => {
            result[key] = store[key];
            return result;
          }, {});
        },
        async set(entries: SyncStore) {
          Object.assign(store, entries);
        },
        async remove(keys: string | string[]) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((key) => {
            delete store[key];
          });
        }
      }
    }
  });
  return store;
}

async function resetDb() {
  await db.delete();
  await db.open();
}

describe("sync backup persistence", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetDb();
  });

  it("backs up tasks and restores them into an empty local database", async () => {
    stubChromeSync();
    await db.settings.put({ ...DEFAULT_SETTINGS, userName: "Persistent Operator" });
    await db.tasks.put(buildTask({ id: "task-persistent", task: "Persistent routing task" }));

    const manifest = await backupToSyncStorage();
    expect(manifest?.counts.tasks).toBe(1);

    await resetDb();
    const result = await restoreFromSyncBackupIfEmpty();

    expect(result.restored).toBe(true);
    expect((await db.tasks.get("task-persistent"))?.task).toBe("Persistent routing task");
    expect((await db.settings.get(APP_SETTINGS_ID))?.userName).toBe("Persistent Operator");
  });

  it("does not overwrite existing local data", async () => {
    stubChromeSync();
    await db.tasks.put(buildTask({ id: "task-remote", task: "Remote backup task" }));
    await backupToSyncStorage();

    await resetDb();
    await db.tasks.put(buildTask({ id: "task-local", task: "Local task" }));
    const result = await restoreFromSyncBackupIfEmpty();

    expect(result.restored).toBe(false);
    expect(await db.tasks.get("task-remote")).toBeUndefined();
    expect((await db.tasks.get("task-local"))?.task).toBe("Local task");
  });

  it("exports and imports a full manual backup", async () => {
    stubChromeSync();
    await db.tasks.put(buildTask({ id: "task-exported", task: "Exported backup task" }));
    const backup = await exportFullBackup();

    await resetDb();
    await db.tasks.put(buildTask({ id: "task-stale", task: "Stale local task" }));
    const result = await importFullBackup(backup.json, "replace");

    expect(result.restored).toBe(true);
    expect(await db.tasks.get("task-stale")).toBeUndefined();
    expect((await db.tasks.get("task-exported"))?.task).toBe("Exported backup task");
  });
});
