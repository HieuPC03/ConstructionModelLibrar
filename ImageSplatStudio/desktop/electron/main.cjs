const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const PORT = 17890;
let backendProcess = null;
let mainWindow = null;

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
  const bundledLinux = resolveResource("python", "bin", "python3");
  if (process.platform === "win32" && fs.existsSync(bundledWin)) return bundledWin;
  if (fs.existsSync(bundledLinux)) return bundledLinux;

  return process.platform === "win32" ? "python" : "python3";
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
    const python = findPythonExecutable();
    const { backendDir, env } = buildBackendEnv();

    const args = ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(PORT)];

    backendProcess = spawn(python, args, {
      cwd: backendDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    backendProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    backendProcess.on("error", (err) => reject(err));

    waitForServer(90_000)
      .then(resolve)
      .catch(() =>
        reject(
          new Error(
            `${stderr.trim() || "Backend timeout"}\n\nCài Python 3.10+ và chạy: pip install -r backend/requirements.txt`,
          ),
        ),
      );
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
    icon: path.join(__dirname, "..", "assets", "icon.png"),
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
      spawn("taskkill", ["/pid", String(backendProcess.pid), "/f", "/t"], { windowsHide: true });
    } else {
      backendProcess.kill("SIGTERM");
    }
  }
  backendProcess = null;
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    dialog.showErrorBox("ImageSplat Studio", `Không khởi động được:\n\n${err.message}`);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBackend());
