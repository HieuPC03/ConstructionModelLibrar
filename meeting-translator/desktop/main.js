const { app, BrowserWindow, dialog, session, shell, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const PORT = 17888;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;

let mainWindow = null;
let pythonProcess = null;

function isPackaged() {
  return app.isPackaged;
}

function resourcesPath() {
  return isPackaged()
    ? path.join(process.resourcesPath)
    : path.join(__dirname, "..");
}

function backendDir() {
  return path.join(resourcesPath(), "backend");
}

function userDataPaths() {
  const root = app.getPath("userData");
  return {
    root,
    env: path.join(root, ".env"),
    envExample: path.join(root, ".env.example"),
    recordings: path.join(root, "recordings"),
  };
}

function ensureUserConfig() {
  const ud = userDataPaths();
  if (!fs.existsSync(ud.root)) {
    fs.mkdirSync(ud.root, { recursive: true });
  }
  if (!fs.existsSync(ud.recordings)) {
    fs.mkdirSync(ud.recordings, { recursive: true });
  }

  const exampleInBundle = path.join(backendDir(), ".env.example");
  if (!fs.existsSync(ud.env)) {
    if (fs.existsSync(exampleInBundle)) {
      fs.copyFileSync(exampleInBundle, ud.env);
    } else if (fs.existsSync(ud.envExample)) {
      fs.copyFileSync(ud.envExample, ud.env);
    } else {
      fs.writeFileSync(
        ud.env,
        "TRANSLATOR_PROVIDER=grok\nXAI_API_KEY=\nGROK_MODEL=grok-2-latest\nOPENAI_API_KEY=\n",
        "utf8"
      );
    }
  }
  return ud;
}

function resolvePython() {
  const bundledWin = path.join(
    resourcesPath(),
    "runtime",
    "python",
    "python.exe"
  );
  if (fs.existsSync(bundledWin)) return bundledWin;

  const venvWin = path.join(backendDir(), ".venv", "Scripts", "python.exe");
  const venvUnix = path.join(backendDir(), ".venv", "bin", "python3");
  if (fs.existsSync(venvWin)) return venvWin;
  if (fs.existsSync(venvUnix)) return venvUnix;
  return process.platform === "win32" ? "python" : "python3";
}

function waitForBackend(maxMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(HEALTH_URL, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > maxMs) {
        reject(new Error("Backend không khởi động được"));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function startPythonBackend() {
  const ud = ensureUserConfig();
  const python = resolvePython();
  const cwd = backendDir();

  const env = {
    ...process.env,
    MEETING_TRANSLATOR_DATA: ud.root,
    MEETING_TRANSLATOR_ENV: ud.env,
    RECORDINGS_DIR: ud.recordings,
    RESOURCES_PATH: resourcesPath(),
  };

  pythonProcess = spawn(
    python,
    [
      "-m",
      "uvicorn",
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
    ],
    {
      cwd,
      env,
      stdio: isPackaged() ? "ignore" : "inherit",
    }
  );

  pythonProcess.on("error", (err) => {
    dialog.showErrorBox(
      "Lỗi khởi động",
      `Không chạy được backend.\n\n${err.message}\n\nNếu cài từ source: chạy install-desktop.bat`
    );
    app.quit();
  });

  pythonProcess.on("exit", (code) => {
    if (code !== null && code !== 0 && mainWindow) {
      dialog.showErrorBox(
        "Backend dừng",
        `Server thoát với mã ${code}. Kiểm tra OPENAI_API_KEY trong:\n${ud.env}`
      );
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Meeting Translator",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

ipcMain.handle("open-config-folder", async () => {
  const ud = ensureUserConfig();
  shell.showItemInFolder(ud.env);
  return ud.env;
});

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => {
    cb(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  startPythonBackend();
  try {
    await waitForBackend();
  } catch (e) {
    dialog.showErrorBox("Khởi động thất bại", e.message);
    app.quit();
    return;
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});
