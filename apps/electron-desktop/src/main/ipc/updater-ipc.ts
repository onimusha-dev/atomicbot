/**
 * IPC handlers for auto-updater and release notes.
 */
import { ipcMain } from "electron";

import { checkForUpdates, downloadUpdate, installUpdate } from "../updater";

export function registerUpdaterIpcHandlers() {
  ipcMain.handle(
    "fetch-release-notes",
    async (_evt, p: { version?: string; owner?: string; repo?: string }) => {
      const version = typeof p?.version === "string" ? p.version : "";
      const owner = typeof p?.owner === "string" ? p.owner : "";
      const repo = typeof p?.repo === "string" ? p.repo : "";
      if (!version || !owner || !repo) {
        return { ok: false, body: "", htmlUrl: "" };
      }
      const tag = version.startsWith("v") ? version : `v${version}`;
      const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) {
          return { ok: false, body: "", htmlUrl: "" };
        }
        const data = (await res.json()) as { body?: string; html_url?: string };
        return { ok: true, body: data.body ?? "", htmlUrl: data.html_url ?? "" };
      } catch (err) {
        console.warn("[ipc/updater] fetch-release-notes failed:", err);
        return { ok: false, body: "", htmlUrl: "" };
      }
    }
  );

  ipcMain.handle("updater-check", async () => {
    await checkForUpdates();
    return { ok: true } as const;
  });

  ipcMain.handle("updater-download", async () => {
    await downloadUpdate();
    return { ok: true } as const;
  });

  ipcMain.handle("updater-install", async () => {
    installUpdate();
    return { ok: true } as const;
  });
}
