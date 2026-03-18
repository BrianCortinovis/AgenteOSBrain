const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');

// ─── Config ─────────────────────────────────────────────────
const PORT = 43101;
const isDev = process.argv.includes('--dev');

let mainWindow = null;
let backendReady = false;

// ─── Data directory (persistent across updates) ─────────────
function getDataDir() {
  const fs = require('fs');
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // First run or empty DB: copy default database with demo projects, agents, skills
  const dbPath = path.join(dataDir, 'agenteos.db');
  const dbExists = fs.existsSync(dbPath);
  const dbSize = dbExists ? fs.statSync(dbPath).size : 0;
  // If DB doesn't exist or is basically empty (< 50KB = no seed data), install defaults
  if (!dbExists || dbSize < 50000) {
    let defaultDb = '';
    if (isDev) {
      defaultDb = path.join(__dirname, 'default-data', 'agenteos.db');
    } else {
      defaultDb = path.join(process.resourcesPath, 'default-data', 'agenteos.db');
    }
    console.log('[AgentOS] Looking for default DB at:', defaultDb);
    if (fs.existsSync(defaultDb)) {
      fs.copyFileSync(defaultDb, dbPath);
      console.log('[AgentOS] Default database installed (3.1MB with demo projects, agents, skills)');
    } else {
      console.warn('[AgentOS] Default DB not found at:', defaultDb);
    }
  } else {
    console.log('[AgentOS] Using existing database:', dbSize, 'bytes');
  }

  // Ensure outputs dir
  fs.mkdirSync(path.join(dataDir, 'outputs'), { recursive: true });

  return dataDir;
}

// ─── Start embedded backend ─────────────────────────────────
async function startBackend() {
  const dataDir = getDataDir();

  // Set env vars BEFORE requiring backend
  process.env.PORT = String(PORT);
  process.env.NODE_ENV = 'production';
  process.env.AGENT_OS_DATA_DIR = dataDir;
  process.env.AGENT_OS_DB_PATH = path.join(dataDir, 'agenteos.db');
  process.env.AGENT_OS_OUTPUTS_DIR = path.join(dataDir, 'outputs');

  // Set static dir for frontend serving
  if (isDev) {
    process.env.STATIC_DIR = path.resolve(__dirname, '../frontend/dist');
  } else {
    process.env.STATIC_DIR = path.join(__dirname, 'frontend-dist');
  }

  // Set migrations path
  if (!isDev) {
    process.env.AGENT_OS_MIGRATIONS_DIR = path.join(process.resourcesPath, 'migrations');
  }

  console.log('[AgentOS] Data dir:', dataDir);
  console.log('[AgentOS] Static dir:', process.env.STATIC_DIR);
  console.log('[AgentOS] DB:', process.env.AGENT_OS_DB_PATH);

  try {
    // Import the bundled backend (or source in dev)
    if (isDev) {
      require('../backend/src/index.ts');
    } else {
      require('./backend-bundle.js');
    }
    console.log('[AgentOS] Backend loaded');
  } catch (err) {
    console.error('[AgentOS] Backend failed:', err);
    dialog.showErrorBox(
      'Agent OS Brain — Errore',
      `Il backend non è partito:\n\n${err.message}\n\nL'app si chiuderà.`
    );
    app.quit();
    return;
  }
}

// ─── Wait for backend to be ready ───────────────────────────
function waitForBackend(maxRetries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://localhost:${PORT}/api/v1/health`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          // 404 is ok — means express is running, just no health endpoint
          backendReady = true;
          resolve();
        } else if (attempts < maxRetries) {
          setTimeout(check, 500);
        } else {
          resolve(); // Proceed anyway
        }
      });
      req.on('error', () => {
        if (attempts < maxRetries) {
          setTimeout(check, 500);
        } else {
          resolve(); // Proceed anyway after timeout
        }
      });
      req.setTimeout(2000);
    };
    check();
  });
}

// ─── Create window ──────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Agent OS Brain',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0d0f12',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[AgentOS] Starting...');

  await startBackend();
  await waitForBackend();

  console.log('[AgentOS] Backend ready, opening window');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  console.log('[AgentOS] Shutting down...');
});
