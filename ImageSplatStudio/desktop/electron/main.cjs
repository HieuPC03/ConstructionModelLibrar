const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const PORT = 17890;
let backendProcess = null;
let mainWindow = null;

function logPath() {
  return path.join(app.getPath("userData"), "startup.log");
}

function log(msg) {
  try {
    fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {
    /* ignore */
  }
}

function resolveResource(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  const root = path.join(__dirname, "..", "..");
  const [head, ...rest] = parts;
  if (head === "frontend") return path.join(root, "frontend", ...rest);
  if (head === "backend") return path.join(root, "backend", ...rest);
  if (head === "pipeline") return path.join(root, "pipeline", ...rest);
  if (head === "python") return path.join(__dirname, "..", "python", ...rest);
  return path.join(root, ...parts);
}

function appDataDir() {
  return path.join(app.getPath("userData"), "data");
}

function findPythonExecutable() {
  const bundledWin = resolveResource("python", "python.exe");
  if (process.platform === "win32" && fs.existsSync(bundledWin)) {
    return { cmd: bundledWin, args: [], shell: false };
  }

  const bundledLinux = resolveResource("python", "bin", "python3");
  if (fs.existsSync(bundledLinux)) {
    return { cmd: bundledLinux, args: [], shell: false };
  }

  if (process.platform === "win32") {
    for (const candidate of ["py -3", "python3", "python"]) {
      try {
        execSync(`${candidate} --version`, { stdio: "ignore", shell: true });
        const parts = candidate.split(" ");
        return { cmd: parts[0], args: parts.slice(1), shell: true };
      } catch (_) {
        /* try next */
      }
    }
    return { cmd: "python", args: [], shell: true };
  }

  return { cmd: "python3", args: [], shell: false };
}

function buildBackendEnv() {
  const backendDir = resolveResource("backend");
  const frontendDir = resolveResource("frontend", "dist");
  const appRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "..");
  const dataDir = appDataDir();

  fs.mkdirSync(dataDir, { recursive: true });

  const env = {
    ...process.env,
    SPLAT_DATA_DIR: dataDir,
    SPLAT_FRONTEND_DIR: frontendDir,
    SPLAT_APP_ROOT: appRoot,
    PYTHONPATH: backendDir,
    PYTHONUNBUFFERED: "1",
  };

  if (process.platform === "win32") {
    const pythonRoot = resolveResource("python");
    if (fs.existsSync(path.join(pythonRoot, "python.exe"))) {
      env.PATH = `${pythonRoot};${path.join(pythonRoot, "Scripts")};${env.PATH || ""}`;
    }
  }

  return { backendDir, env };
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const { cmd, args: pyArgs, shell } = findPythonExecutable();
    const { backendDir, env } = buildBackendEnv();
    const args = [...pyArgs, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(PORT)];

    log(`Starting backend: ${cmd} ${args.join(" ")}`);
    log(`Backend dir: ${backendDir}`);

    backendProcess = spawn(cmd, args, {
      cwd: backendDir,
      env,
      shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    backendProcess.stdout?.on("data", (c) => log(`stdout: ${c}`));
    backendProcess.stderr.on("data", (chunk) => {
      const t = chunk.toString();
      stderr += t;
      log(`stderr: ${t}`);
    });
    backendProcess.on("error", (err) => {
      log(`spawn error: ${err.message}`);
      reject(err);
    });

    waitForServer(120_000)
      .then(resolve)
      .catch(() => {
        const hint =
          process.platform === "win32"
            ? "Chay CaiDat.bat (Run as administrator) trong thu muc da giai nen.\nCan Python 3.10+ trong PATH."
            : "pip install -r backend/requirements.txt";
        reject(new Error(`${stderr.trim() || "Backend timeout"}\n\n${hint}\n\nLog: ${logPath()}`));
      });
  });
}

function waitForServer(timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error("timeout"));
      else setTimeout(tick, 500);
    };
    tick();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "ImageSplat Studio",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(backendProcess.pid), "/f", "/t"], { windowsHide: true, shell: true });
    } else {
      backendProcess.kill("SIGTERM");
    }
  }
  backendProcess = null;
}

app.whenReady().then(async () => {
  try {
    log("App starting...");
    await startBackend();
    createWindow();
  } catch (err) {
    log(`Fatal: ${err.message}`);
    dialog.showErrorBox(
      "ImageSplat Studio — Loi khoi dong",
      `${err.message}\n\nNeu lan dau cai dat:\n1. Giai nen file .zip\n2. Chay CaiDat.bat (Run as administrator)\n3. Mo lai ImageSplat Studio.exe`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBackend());
