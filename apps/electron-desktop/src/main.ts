import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import JSON5 from "json5";

const DEFAULT_PORT = 18789;
const DEFAULT_AGENT_ID = "main";

const THIS_DIR = __dirname;

let mainWindow: BrowserWindow | null = null;

type GatewayState =
  | { kind: "starting"; port: number; logsDir: string; token: string }
  | { kind: "ready"; port: number; logsDir: string; url: string; token: string }
  | { kind: "failed"; port: number; logsDir: string; details: string; token: string };

function resolveRepoRoot(): string {
  // In dev (running from source), this file compiles to apps/electron-desktop/dist/main.js.
  // We want the repo root to locate openclaw.mjs and dist/.
  return path.resolve(THIS_DIR, "..", "..", "..");
}

function resolveBundledOpenClawDir(): string {
  return path.join(process.resourcesPath, "openclaw");
}

function resolveBundledNodeBin(): string {
  const platform = process.platform;
  const arch = process.arch;
  const base = path.join(process.resourcesPath, "node", `${platform}-${arch}`);
  if (platform === "win32") {
    return path.join(base, "node.exe");
  }
  return path.join(base, "bin", "node");
}

function resolveBundledGogBin(): string {
  const platform = process.platform;
  const arch = process.arch;
  return path.join(process.resourcesPath, "gog", `${platform}-${arch}`, "gog");
}

function resolveDownloadedGogBin(): string {
  const platform = process.platform;
  const arch = process.arch;
  // In dev, this file compiles to apps/electron-desktop/dist/main.js.
  // We keep the downloaded gog runtime next to the Electron app sources.
  const appDir = path.resolve(THIS_DIR, "..");
  return path.join(appDir, ".gog-runtime", `${platform}-${arch}`, "gog");
}

function resolveBundledGogCredentialsPath(): string {
  return path.join(process.resourcesPath, "gog-credentials", "gog-client-secret.json");
}

function resolveDownloadedGogCredentialsPath(): string {
  // In dev, this file compiles to apps/electron-desktop/dist/main.js.
  const appDir = path.resolve(THIS_DIR, "..");
  return path.join(appDir, ".gog-runtime", "credentials", "gog-client-secret.json");
}

function resolveGogCredentialsPaths(): string[] {
  const paths: string[] = [];
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    paths.push(path.join(xdg, "gogcli", "credentials.json"));
  }
  paths.push(path.join(os.homedir(), ".config", "gogcli", "credentials.json"));
  if (process.platform === "darwin") {
    paths.push(path.join(os.homedir(), "Library", "Application Support", "gogcli", "credentials.json"));
  }
  return paths;
}

async function ensureGogCredentialsConfigured(params: {
  gogBin: string;
  openclawDir: string;
  credentialsJsonPath: string;
}): Promise<void> {
  if (!fs.existsSync(params.gogBin)) {
    return;
  }
  if (!fs.existsSync(params.credentialsJsonPath)) {
    return;
  }

  // If credentials already exist (file-based or gog-managed), do not override user config.
  if (resolveGogCredentialsPaths().some((p) => fs.existsSync(p))) {
    return;
  }
  try {
    const list = await runGog({
      bin: params.gogBin,
      args: ["auth", "credentials", "list", "--json", "--no-input"],
      cwd: params.openclawDir,
      timeoutMs: 15_000,
    });
    if (list.ok) {
      try {
        const parsed = JSON.parse(list.stdout || "{}") as { clients?: unknown };
        if (Array.isArray(parsed.clients) && parsed.clients.length > 0) {
          return;
        }
      } catch {
        // ignore and proceed to set
      }
    }
  } catch {
    // ignore and proceed to set
  }

  const res = await runGog({
    bin: params.gogBin,
    args: ["auth", "credentials", "set", params.credentialsJsonPath, "--no-input"],
    cwd: params.openclawDir,
    timeoutMs: 30_000,
  });
  if (!res.ok) {
    const stderr = res.stderr.trim();
    const stdout = res.stdout.trim();
    console.warn(
      `[electron-desktop] gog auth credentials set failed: ${stderr || stdout || "unknown error"} (bin: ${params.gogBin})`,
    );
  }
}

function resolveRendererIndex(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), "renderer", "dist", "index.html");
  }
  // dev: this file is apps/electron-desktop/dist/main.js
  return path.join(path.resolve(THIS_DIR, ".."), "renderer", "dist", "index.html");
}

async function waitForPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port });
      const done = (result: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(result);
      };
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
      socket.setTimeout(500, () => done(false));
    });
    if (ok) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function createTailBuffer(maxChars: number) {
  let buf = "";
  return {
    push(chunk: string) {
      buf += chunk;
      if (buf.length > maxChars) {
        buf = buf.slice(buf.length - maxChars);
      }
    },
    read() {
      return buf;
    },
  };
}

async function pickPort(preferred: number): Promise<number> {
  const isFree = await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(preferred, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
  if (isFree) {
    return preferred;
  }
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (e: unknown) => reject(e));
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      server.close(() => {
        if (!addr || typeof addr === "string") {
          reject(new Error("Failed to resolve random port"));
          return;
        }
        resolve(addr.port);
      });
    });
  });
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeAuthProfilesAnthropicApiKey(params: { stateDir: string; apiKey: string }) {
  const key = params.apiKey.trim();
  if (!key) {
    throw new Error("apiKey is required");
  }
  const agentDir = path.join(params.stateDir, "agents", DEFAULT_AGENT_ID, "agent");
  const authPath = path.join(agentDir, "auth-profiles.json");
  ensureDir(agentDir);

  let store: {
    version?: number;
    profiles?: Record<string, unknown>;
    order?: Record<string, unknown>;
  } = {};
  try {
    if (fs.existsSync(authPath)) {
      const raw = fs.readFileSync(authPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        store = parsed as typeof store;
      }
    }
  } catch {
    // ignore; we will overwrite with a sane payload
    store = {};
  }

  const profiles = (store.profiles && typeof store.profiles === "object" ? store.profiles : {}) as Record<
    string,
    unknown
  >;
  profiles["anthropic:default"] = { type: "api_key", provider: "anthropic", key };
  const order = (store.order && typeof store.order === "object" ? store.order : {}) as Record<
    string,
    unknown
  >;
  order.anthropic = ["anthropic:default"];

  const payload = {
    version: typeof store.version === "number" ? store.version : 1,
    profiles,
    order,
  };

  const tmp = `${authPath}.${randomBytes(8).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf-8" });
  try {
    fs.chmodSync(tmp, 0o600);
  } catch {
    // ignore
  }
  fs.renameSync(tmp, authPath);
  try {
    fs.chmodSync(authPath, 0o600);
  } catch {
    // ignore
  }
}

function readGatewayTokenFromConfig(configPath: string): string | null {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const text = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON5.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const cfg = parsed as {
      gateway?: { auth?: { token?: unknown } };
    };
    const token = cfg.gateway?.auth?.token;
    return typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
  } catch {
    return null;
  }
}

function ensureGatewayConfigFile(params: { configPath: string; token: string }) {
  if (fs.existsSync(params.configPath)) {
    return;
  }
  ensureDir(path.dirname(params.configPath));
  const minimal = {
    gateway: {
      mode: "local",
      bind: "loopback",
      auth: {
        mode: "token",
        token: params.token,
      },
    },
  };
  // Write JSON (JSON5-compatible) to keep it simple and deterministic.
  fs.writeFileSync(params.configPath, `${JSON.stringify(minimal, null, 2)}\n`, "utf-8");
}

function spawnGateway(params: {
  port: number;
  logsDir: string;
  stateDir: string;
  configPath: string;
  token: string;
  openclawDir: string;
  nodeBin: string;
  gogBin?: string;
  stderrTail: ReturnType<typeof createTailBuffer>;
}): ChildProcess {
  const { port, logsDir, stateDir, configPath, token, openclawDir, nodeBin, gogBin, stderrTail } =
    params;

  ensureDir(logsDir);
  ensureDir(stateDir);

  const stdoutPath = path.join(logsDir, "gateway.stdout.log");
  const stderrPath = path.join(logsDir, "gateway.stderr.log");
  const stdout = fs.createWriteStream(stdoutPath, { flags: "a" });
  const stderr = fs.createWriteStream(stderrPath, { flags: "a" });

  const script = path.join(openclawDir, "openclaw.mjs");
  // Important: first-run embedded app starts without a config file. Allow the Gateway to start
  // so the Control UI/WebChat + wizard flows can create config.
  const args = [script, "gateway", "--bind", "loopback", "--port", String(port), "--allow-unconfigured"];

  const envPath = typeof process.env.PATH === "string" ? process.env.PATH : "";
  const extraBinDir = gogBin ? path.dirname(gogBin) : "";
  const mergedPath = extraBinDir ? `${extraBinDir}:${envPath}` : envPath;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // In dev mode we spawn the Gateway using the Electron binary (process.execPath). That binary
    // must run in "Node mode" for the child process, otherwise it tries to launch Electron again.
    ELECTRON_RUN_AS_NODE: "1",
    // Keep all OpenClaw state inside the Electron app's userData directory.
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_PORT: String(port),
    OPENCLAW_GATEWAY_TOKEN: token,
    // Ensure the embedded Gateway resolves the bundled gog binary via PATH.
    PATH: mergedPath,
    // Reduce noise in embedded contexts.
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };

  const child = spawn(nodeBin, args, {
    cwd: openclawDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    try {
      stderrTail.push(String(chunk));
    } catch {
      // ignore
    }
  });

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);

  return child;
}

type GogExecResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

type ResetAndCloseResult = {
  ok: true;
  warnings?: string[];
};

function runGog(params: {
  bin: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<GogExecResult> {
  const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 120_000;
  return new Promise<GogExecResult>((resolve) => {
    const child = spawn(params.bin, params.args, {
      cwd: params.cwd,
      env: params.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const onData = (buf: Buffer, which: "stdout" | "stderr") => {
      const text = buf.toString("utf-8");
      if (which === "stdout") {
        stdout += text;
      } else {
        stderr += text;
      }
    };
    child.stdout?.on("data", (b: Buffer) => onData(b, "stdout"));
    child.stderr?.on("data", (b: Buffer) => onData(b, "stderr"));

    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !killed && code === 0,
        code: typeof code === "number" ? code : null,
        stdout,
        stderr,
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}${stderr ? "\n" : ""}${String(err)}`,
      });
    });
  });
}

function parseGogAuthListEmails(jsonText: string): string[] {
  try {
    const parsed = JSON.parse(jsonText || "{}") as { accounts?: unknown };
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    const emails = accounts
      .map((a) => (a && typeof a === "object" ? (a as { email?: unknown }).email : undefined))
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    return Array.from(new Set(emails));
  } catch {
    return [];
  }
}

async function clearGogAuthTokens(params: { gogBin: string; openclawDir: string; warnings: string[] }) {
  if (!fs.existsSync(params.gogBin)) {
    params.warnings.push(`gog binary not found at: ${params.gogBin}`);
    return;
  }
  const list = await runGog({
    bin: params.gogBin,
    args: ["auth", "list", "--json", "--no-input"],
    cwd: params.openclawDir,
    timeoutMs: 15_000,
  });
  if (!list.ok) {
    const msg = (list.stderr || list.stdout || "").trim();
    params.warnings.push(`gog auth list failed: ${msg || "unknown error"}`);
    return;
  }
  const emails = parseGogAuthListEmails(list.stdout);
  for (const email of emails) {
    const res = await runGog({
      bin: params.gogBin,
      args: ["auth", "remove", email, "--force", "--no-input"],
      cwd: params.openclawDir,
      timeoutMs: 15_000,
    });
    if (!res.ok) {
      const msg = (res.stderr || res.stdout || "").trim();
      params.warnings.push(`gog auth remove failed for ${email}: ${msg || "unknown error"}`);
    }
  }
}

async function createMainWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0b0f14",
    webPreferences: {
      preload: path.join(THIS_DIR, "preload.js"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  await win.loadFile(resolveRendererIndex());

  return win;
}

let gateway: ChildProcess | null = null;
let logsDirForUi: string | null = null;
let gatewayState: GatewayState | null = null;

async function stopGatewayChild(): Promise<void> {
  const child = gateway;
  gateway = null;
  if (!child) {
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  await new Promise((r) => setTimeout(r, 1500));
  if (!child.killed) {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

function broadcastGatewayState(win: BrowserWindow | null, state: GatewayState) {
  gatewayState = state;
  try {
    win?.webContents.send("gateway-state", state);
  } catch {
    // ignore
  }
}

app.on("window-all-closed", () => {
  // macOS convention: keep the app alive until the user quits explicitly.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await stopGatewayChild();
});

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  const stateDir = path.join(userData, "openclaw");
  const logsDir = path.join(userData, "logs");
  logsDirForUi = logsDir;

  ipcMain.handle("open-logs", async () => {
    if (!logsDirForUi) {
      return;
    }
    // Open the logs directory in Finder/Explorer.
    await shell.openPath(logsDirForUi);
  });
  ipcMain.handle("devtools-toggle", async () => {
    const win = mainWindow;
    if (!win || win.isDestroyed()) {
      return;
    }
    const wc = win.webContents;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
    } else {
      wc.openDevTools({ mode: "detach" });
    }
  });
  ipcMain.handle("open-external", async (_evt, params: { url?: unknown }) => {
    const url = typeof params?.url === "string" ? params.url : "";
    if (!url) {
      return;
    }
    await shell.openExternal(url);
  });
  ipcMain.handle("gateway-get-info", async () => ({ state: gatewayState }));
  ipcMain.handle("gateway-retry", async () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle("auth-set-anthropic-api-key", async (_evt, params: { apiKey?: unknown }) => {
    const apiKey = typeof params?.apiKey === "string" ? params.apiKey : "";
    writeAuthProfilesAnthropicApiKey({ stateDir, apiKey });
    return { ok: true } as const;
  });

  const openclawDir = app.isPackaged ? resolveBundledOpenClawDir() : resolveRepoRoot();
  const nodeBin = app.isPackaged ? resolveBundledNodeBin() : process.execPath;
  const bundledGogBin = app.isPackaged ? resolveBundledGogBin() : resolveDownloadedGogBin();
  const bundledGogCredentialsPath = app.isPackaged
    ? resolveBundledGogCredentialsPath()
    : resolveDownloadedGogCredentialsPath();

  await ensureGogCredentialsConfigured({
    gogBin: bundledGogBin,
    openclawDir,
    credentialsJsonPath: bundledGogCredentialsPath,
  });

  ipcMain.handle("gog-auth-list", async () => {
    if (!fs.existsSync(bundledGogBin)) {
      return {
        ok: false,
        code: null,
        stdout: "",
        stderr: `gog binary not found at: ${bundledGogBin}\nRun: npm run fetch:gog (in apps/electron-desktop)`,
      } satisfies GogExecResult;
    }
    const res = await runGog({ bin: bundledGogBin, args: ["auth", "list"], cwd: openclawDir });
    return res;
  });

  ipcMain.handle(
    "gog-auth-add",
    async (_evt, params: { account?: unknown; services?: unknown; noInput?: unknown }) => {
      if (!fs.existsSync(bundledGogBin)) {
        return {
          ok: false,
          code: null,
          stdout: "",
          stderr: `gog binary not found at: ${bundledGogBin}\nRun: npm run fetch:gog (in apps/electron-desktop)`,
        } satisfies GogExecResult;
      }
      const account = typeof params?.account === "string" ? params.account.trim() : "";
      const services = typeof params?.services === "string" ? params.services.trim() : "gmail";
      const noInput = Boolean(params?.noInput);
      if (!account) {
        return {
          ok: false,
          code: null,
          stdout: "",
          stderr: "account is required",
        } satisfies GogExecResult;
      }
      const args = ["auth", "add", account, "--services", services];
      if (noInput) {
        args.push("--no-input");
      }
      const res = await runGog({ bin: bundledGogBin, args, cwd: openclawDir });
      return res;
    },
  );

  ipcMain.handle(
    "gog-auth-credentials",
    async (_evt, params: { credentialsJson?: unknown; filename?: unknown }) => {
      if (!fs.existsSync(bundledGogBin)) {
        return {
          ok: false,
          code: null,
          stdout: "",
          stderr: `gog binary not found at: ${bundledGogBin}\nRun: npm run fetch:gog (in apps/electron-desktop)`,
        } satisfies GogExecResult;
      }
      const text = typeof params?.credentialsJson === "string" ? params.credentialsJson : "";
      if (!text.trim()) {
        return {
          ok: false,
          code: null,
          stdout: "",
          stderr: "credentialsJson is required",
        } satisfies GogExecResult;
      }
      const tmpDir = path.join(userData, "tmp");
      ensureDir(tmpDir);
      const nameRaw = typeof params?.filename === "string" ? params.filename.trim() : "";
      const base = nameRaw && nameRaw.endsWith(".json") ? nameRaw : "gog-client-secret.json";
      const tmpPath = path.join(tmpDir, `${randomBytes(8).toString("hex")}-${base}`);
      fs.writeFileSync(tmpPath, text, { encoding: "utf-8" });
      try {
        fs.chmodSync(tmpPath, 0o600);
      } catch {
        // ignore
      }
      try {
        const res = await runGog({
          bin: bundledGogBin,
          args: ["auth", "credentials", "set", tmpPath, "--no-input"],
          cwd: openclawDir,
        });
        return res;
      } finally {
        try {
          fs.rmSync(tmpPath, { force: true });
        } catch {
          // ignore
        }
      }
    },
  );

  ipcMain.handle("reset-and-close", async () => {
    const warnings: string[] = [];

    try {
      await stopGatewayChild();
    } catch (err) {
      warnings.push(`failed to stop gateway: ${String(err)}`);
    }

    try {
      await clearGogAuthTokens({ gogBin: bundledGogBin, openclawDir, warnings });
    } catch (err) {
      warnings.push(`failed to clear gog auth tokens: ${String(err)}`);
    }

    // Clear the embedded OpenClaw state/logs plus any temp files we created under userData.
    const tmpDir = path.join(userData, "tmp");
    for (const dir of [stateDir, logsDir, tmpDir]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        warnings.push(`failed to delete ${dir}: ${String(err)}`);
      }
    }

    // Clear renderer storage (localStorage/IndexedDB/etc.) so onboarding state is reset too.
    try {
      await session.defaultSession.clearStorageData();
    } catch (err) {
      warnings.push(`failed to clear renderer storage: ${String(err)}`);
    }

    // Let the IPC reply resolve before quitting.
    setTimeout(() => {
      try {
        app.quit();
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          app.exit(0);
        } catch {
          // ignore
        }
      }, 2000);
    }, 25);

    const res: ResetAndCloseResult = warnings.length > 0 ? { ok: true, warnings } : { ok: true };
    return res;
  });

  const port = await pickPort(DEFAULT_PORT);
  const url = `http://127.0.0.1:${port}/`;
  const configPath = path.join(stateDir, "openclaw.json");
  const tokenFromConfig = readGatewayTokenFromConfig(configPath);
  const token = tokenFromConfig ?? randomBytes(24).toString("base64url");
  ensureGatewayConfigFile({ configPath, token });

  const stderrTail = createTailBuffer(24_000);
  gateway = spawnGateway({
    port,
    logsDir,
    stateDir,
    configPath,
    token,
    openclawDir,
    nodeBin,
    gogBin: bundledGogBin,
    stderrTail,
  });

  const win = await createMainWindow();
  mainWindow = win;
  broadcastGatewayState(win, { kind: "starting", port, logsDir, token });

  const ok = await waitForPortOpen("127.0.0.1", port, 30_000);
  if (!ok) {
    const details = [
      `Gateway did not open the port within 30s.`,
      "",
      `openclawDir: ${openclawDir}`,
      `nodeBin: ${nodeBin}`,
      `stderr (tail):`,
      stderrTail.read().trim() || "<empty>",
      "",
      `See logs in: ${logsDir}`,
    ].join("\n");
    broadcastGatewayState(win, { kind: "failed", port, logsDir, details, token });
    return;
  }

  // Keep the Electron window on the React renderer. The legacy Control UI is embedded in an iframe
  // and can be switched to/from the native pages without losing the top-level navigation.
  broadcastGatewayState(win, { kind: "ready", port, logsDir, url, token });
});

