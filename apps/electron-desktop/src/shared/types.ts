/**
 * Shared types used across main process, preload, and renderer.
 * Single source of truth — eliminates duplication of ExecResult and similar types.
 */

/** Result of running an external binary (memo, remindctl, obsidian-cli, gh, etc.). */
export type ExecResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  resolvedPath: string | null;
};

/** Obsidian vault entry parsed from obsidian.json. */
export type ObsidianVaultEntry = {
  name: string;
  path: string;
  open: boolean;
};

/** Metadata for a custom skill installed in the workspace. */
export type CustomSkillMeta = {
  name: string;
  description: string;
  emoji: string;
  dirName: string;
};
