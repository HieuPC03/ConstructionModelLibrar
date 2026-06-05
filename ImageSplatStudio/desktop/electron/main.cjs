const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
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
  } catch (_) {}
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

function bundledPythonPath() {
  if (process.platform === "win32") {
    return resolveResource("python", "python.exe");
  }
  const linuxPy = resolveResource("python", "bin", "python3");
  if (fs.existsSync(linuxPy)) return linuxPy;
  return resolveResource("python", "python.exe");
}

function findPythonExecutable() {
  const bundled = bundledPythonPath();
  if (fs.existsSync(bundled)) {
    log(`Using bundled Python: ${bundled}`);
    return { cmd: bundled, args: [], shell: false };
  }

  if (app.isPackaged) {
    throw new Error(
      `Khong tim thay Python trong app.\nDuong dan: ${bundled}\nTai lai ban cai dat day du tu GitHub Releases.`,
    );
  }

  const devPy = process.platform === "win32" ? "python" : "python3";
  return { cmd: devPy, args: [], shell: true };
}

function buildBackendEnv() {
  const backendDir = resolveResource("backend");
  const frontendDir = resolveResource("frontend", "dist");
  const appRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "..");
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const pythonRoot = resolveResource("python");
  const env = {
    ...process.env,
    SPLAT_DATA_DIR: dataDir,
    SPLAT_FRONTEND_DIR: frontendDir,
    SPLAT_APP_ROOT: appRoot,
    PYTHONPATH: backendDir,
    PYTHONUNBUFFERED: "1",
  };

  if (fs.existsSync(path.join(pythonRoot, "python.exe"))) {
    env.PATH = `${pythonRoot};${path.join(pythonRoot, "Scripts")};${env.PATH || ""}`;
  } else if (fs.existsSync(path.join(pythonRoot, "bin"))) {
    env.PATH = `${path.join(pythonRoot, "bin")}:${env.PATH || ""}`;
  }

  return { backendDir, env };
}

function startBackend() {
  return new Promise((resolve, reject) => {
    let py;
    try {
      py = findPythonExecutable();
    } catch (err) {
      reject(err);
      return;
    }

    const { backendDir, env } = buildBackendEnv();
    const args = [...py.args, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(PORT)];

    log(`Backend: ${py.cmd} ${args.join(" ")}`);

    backendProcess = spawn(py.cmd, args, {
      cwd: backendDir,
      env,
      shell: py.shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    backendProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      log(`stderr: ${chunk}`);
    });
    backendProcess.on("error", (err) => reject(err));

    waitForServer(120_000)
      .then(resolve)
      .catch(() => reject(new Error(`${stderr.trim() || "Backend timeout"}\nLog: ${logPath()}`)));
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
    await startBackend();
    createWindow();
  } catch (err) {
    dialog.showErrorBox("ImageSplat Studio", String(err.message || err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => stopBackend());
