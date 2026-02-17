import { vi } from "vitest";

// Mock the "electron" module for unit testing.
// Each export mirrors the real Electron API surface used by the app.

export const app = {
  getPath: vi.fn((name: string) => `/mock/${name}`),
  getVersion: vi.fn(() => "0.0.0-test"),
  isPackaged: false,
  quit: vi.fn(),
  exit: vi.fn(),
  relaunch: vi.fn(),
  getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
  setLoginItemSettings: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
};

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  removeHandler: vi.fn(),
};

export const ipcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

export const shell = {
  openPath: vi.fn(() => Promise.resolve("")),
  openExternal: vi.fn(() => Promise.resolve()),
};

export class BrowserWindow {
  webContents = {
    send: vi.fn(),
    isDevToolsOpened: vi.fn(() => false),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
  };
  isDestroyed = vi.fn(() => false);
  loadFile = vi.fn(() => Promise.resolve());
  show = vi.fn();
  on = vi.fn();
}

export const dialog = {
  showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
  showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: undefined })),
};

export const contextBridge = {
  exposeInMainWorld: vi.fn(),
};
