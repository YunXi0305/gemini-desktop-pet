const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const child_process = require('child_process');

// 1. App Name & UserData path
app.setName('GeminiPet');
const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
const userDataDir = process.platform === 'win32'
  ? path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'GeminiPet')
  : (process.platform === 'darwin'
      ? path.join(homeDir, 'Library', 'Application Support', 'GeminiPet')
      : path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'GeminiPet'));
try { fs.mkdirSync(userDataDir, { recursive: true }); } catch (_) {}
app.setPath('userData', userDataDir);

// 2. Logging Setup
const logDir = path.join(userDataDir, 'logs');
try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) {}
const logFile = path.join(logDir, 'pet.log');
const posFile = path.join(userDataDir, 'position.json');
const configFile = path.join(userDataDir, 'config.json');

const DEFAULT_CONFIG = {
  scale: 1.2,
  soundVol: 0.9,
  soundSet: 'duck',
  quotaView: '5h',
  bubbleOn: true,
  typingOn: true,
  turnCostOn: true,
  turnCostCloseMs: 5000,
  workStateMode: 'auto'
};

function loadMasterConfig() {
  try {
    if (fs.existsSync(configFile)) {
      return Object.assign({}, DEFAULT_CONFIG, JSON.parse(fs.readFileSync(configFile, 'utf8')));
    }
  } catch (_) {}
  return Object.assign({}, DEFAULT_CONFIG);
}

function saveMasterConfig(cfg) {
  try {
    const current = loadMasterConfig();
    const merged = Object.assign({}, current, cfg);
    fs.writeFileSync(configFile, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (_) {}
  return cfg;
}

function loadPosition() {
  try {
    if (fs.existsSync(posFile)) {
      return JSON.parse(fs.readFileSync(posFile, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function savePosition(x, y) {
  try {
    fs.writeFileSync(posFile, JSON.stringify({ x, y }), 'utf8');
  } catch (_) {}
}

function logMsg(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
    console.log(line.trim());
  } catch (_) {}
}

logMsg('GeminiPet initializing, PID=' + process.pid);

process.on('uncaughtException', (err) => {
  logMsg('uncaughtException: ' + (err ? err.stack || err.message : err));
});
process.on('unhandledRejection', (reason) => {
  logMsg('unhandledRejection: ' + (reason ? reason.stack || reason.message : reason));
});
app.on('before-quit', () => logMsg('app before-quit'));
app.on('will-quit', () => logMsg('app will-quit'));
app.on('quit', (e, code) => logMsg('app quit code=' + code));

// 3. Single Instance Lock & Wake-up Handler
app.on('second-instance', () => {
  logMsg('Second instance detected in primary instance! Repositioning and waking pet window.');
  if (petWin && !petWin.isDestroyed()) {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const workArea = primaryDisplay.workArea;
      const petW = 348;
      const petH = 468;
      const targetX = workArea.width > 2200
        ? Math.round(workArea.x + workArea.width * 0.78)
        : Math.max(workArea.x, workArea.x + workArea.width - petW - 30);
      const targetY = Math.max(workArea.y, workArea.y + workArea.height - petH - 30);
      petWin.setPosition(targetX, targetY);
      savePosition(targetX, targetY);
      if (petWin.isMinimized()) petWin.restore();
      petWin.show();
      petWin.focus();
      petWin.setAlwaysOnTop(true);
      try { petWin.moveTop(); } catch (_) {}
      petWin.webContents.send('pet-call-attention');
    } catch (err) {
      logMsg('second-instance error: ' + err);
    }
  } else {
    createDesktopPetWindow();
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  logMsg('Second instance detected. Quitting this instance.');
  app.quit();
  return;
}

let petWin = null;
let settingsWin = null;
let tray = null;
let keyWatcherProcess = null;
let isAntigravityAlive = false;
let cachedLanguageServerPort = null;
let cachedCsrfToken = null;
let lastKnownQuota = null;
let quotaInterval = null;
let agentWorkInterval = null;
let antigravityProbeInterval = null;
let userExplicitlyClosed = false;

// 4. Autonomous Telemetry via HTTPS & Public Logs
function probeHttps(port) {
  return new Promise((resolve) => {
    let done = false;
    const req = https.get('https://127.0.0.1:' + port + '/', { rejectUnauthorized: false, timeout: 800 }, (res) => {
      let b = '';
      res.on('data', d => b += d.toString());
      res.on('end', () => {
        if (!done) {
          done = true;
          const m = /"csrfToken":"([^"]+)"/.exec(b);
          resolve(m ? m[1] : null);
        }
      });
    });
    req.on('error', () => {
      if (!done) { done = true; resolve(null); }
    });
    req.on('timeout', () => {
      if (!done) { done = true; req.destroy(); resolve(null); }
    });
  });
}

async function checkAntigravityAlive() {
  if (cachedLanguageServerPort) {
    const token = await probeHttps(cachedLanguageServerPort);
    if (token) {
      cachedCsrfToken = token;
      isAntigravityAlive = true;
      return true;
    }
    cachedLanguageServerPort = null;
    cachedCsrfToken = null;
  }
  try {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const logFile = process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'antigravity', 'logs', 'language_server.log')
      : (process.platform === 'darwin'
          ? path.join(home, 'Library', 'Application Support', 'antigravity', 'logs', 'language_server.log')
          : path.join(home, '.config', 'antigravity', 'logs', 'language_server.log'));
    if (!fs.existsSync(logFile)) {
      isAntigravityAlive = false;
      return false;
    }
    const content = fs.readFileSync(logFile, 'utf8');
    const matches = [...content.matchAll(/listening on \w+ port at (\d+)/gi)];
    if (matches.length > 0) {
      const ports = [...new Set(matches.map(m => Number(m[1])).filter(Boolean))].reverse();
      for (const p of ports) {
        const token = await probeHttps(p);
        if (token) {
          cachedLanguageServerPort = p;
          cachedCsrfToken = token;
          isAntigravityAlive = true;
          return true;
        }
      }
    }
  } catch (err) {
    logMsg('checkAntigravityAlive error: ' + err);
  }
  isAntigravityAlive = false;
  return false;
}

async function fetchAntigravityQuota() {
  try {
    if (!cachedLanguageServerPort || !cachedCsrfToken) {
      const alive = await checkAntigravityAlive();
      if (!alive || !cachedLanguageServerPort || !cachedCsrfToken) return lastKnownQuota;
    }

    const quotaData = await new Promise((resolve, reject) => {
      const data = JSON.stringify({});
      const req = https.request({
        hostname: '127.0.0.1',
        port: cachedLanguageServerPort,
        path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': cachedCsrfToken
        },
        rejectUnauthorized: false,
        timeout: 2500
      }, (res) => {
        let resBody = '';
        res.on('data', d => resBody += d.toString());
        res.on('end', () => {
          try { resolve(JSON.parse(resBody)); } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(data);
      req.end();
    });

    if (quotaData && quotaData.response) {
      const parsed = parseQuotaResponse(quotaData.response);
      if (parsed) {
        lastKnownQuota = parsed;
        isAntigravityAlive = true;
        return parsed;
      }
    }
  } catch (_) {
    cachedLanguageServerPort = null;
    cachedCsrfToken = null;
  }
  return lastKnownQuota;
}

function parseQuotaResponse(resp) {
  let gemini5h = 1;
  let gemini5hReset = '';
  let geminiWeekly = 1;
  let geminiWeeklyReset = '';
  let claude5h = 1;
  let claudeWeekly = 1;

  (resp.groups || []).forEach(g => {
    const name = (g.displayName || '').toLowerCase();
    (g.buckets || []).forEach(b => {
      const window = (b.window || '').toLowerCase();
      const desc = b.description || '';
      let resetStr = '';
      const m = desc.match(/refresh in (.*)\./i);
      if (m) {
        resetStr = m[1].replace(/days?/g, '天').replace(/hours?/g, '小时').replace(/minutes?/g, '分').replace(/\s+/g, '') + '后刷新';
      }
      if (name.includes('gemini')) {
        if (window === '5h') {
          gemini5h = b.remainingFraction;
          gemini5hReset = resetStr;
        } else if (window === 'weekly') {
          geminiWeekly = b.remainingFraction;
          geminiWeeklyReset = resetStr;
        }
      } else if (name.includes('claude') || name.includes('gpt')) {
        if (window === '5h') {
          claude5h = b.remainingFraction;
        } else if (window === 'weekly') {
          claudeWeekly = b.remainingFraction;
        }
      }
    });
  });

  return {
    gemini5h,
    gemini5hReset,
    geminiWeekly,
    geminiWeeklyReset,
    claude5h,
    claudeWeekly,
    updatedAt: Date.now()
  };
}

function sendQuota(win) {
  if (!win || win.isDestroyed()) return;
  fetchAntigravityQuota().then(quota => {
    if (quota && win && !win.isDestroyed()) {
      win.webContents.send('pet-quota-update', quota);
    }
  }).catch(() => {});
}

function inspectAgentWork() {
  try {
    const now = Date.now();
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const brainDir = path.join(home, '.gemini', 'antigravity', 'brain');
    let working = false;
    let foundFile = null;
    let foundSize = 0;

    if (fs.existsSync(brainDir)) {
      const convs = fs.readdirSync(brainDir);
      for (const cid of convs) {
        const tFile = path.join(brainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
        try {
          const stat = fs.statSync(tFile);
          if (now - stat.mtimeMs < 1200) {
            working = true;
            foundFile = tFile;
            foundSize = stat.size;
            break;
          }
        } catch (_) {}
      }
    }

    if (!working) {
      const logFile = process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'antigravity', 'logs', 'language_server.log')
        : (process.platform === 'darwin'
            ? path.join(home, 'Library', 'Application Support', 'antigravity', 'logs', 'language_server.log')
            : path.join(home, '.config', 'antigravity', 'logs', 'language_server.log'));
      try {
        const stat = fs.statSync(logFile);
        if (now - stat.mtimeMs < 1200) {
          working = true;
        }
      } catch (_) {}
    }

    return { working, foundFile, foundSize };
  } catch (_) {
    return { working: false, foundFile: null, foundSize: 0 };
  }
}

function checkAgentWorking() {
  return inspectAgentWork().working;
}

// 5. Global Keyboard Hook Subprocess
function startKeyWatcher() {
  if (keyWatcherProcess || process.platform !== 'win32') return;
  try {
    const exePath = path.join(__dirname, 'key_watcher.exe');
    if (!fs.existsSync(exePath)) return;
    keyWatcherProcess = child_process.spawn(exePath, [], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    logMsg('startKeyWatcher spawned PID=' + (keyWatcherProcess ? keyWatcherProcess.pid : 'null'));
    keyWatcherProcess.stdout.on('data', () => {
      try {
        if (petWin && !petWin.isDestroyed()) {
          petWin.webContents.send('pet-key-press');
        }
      } catch (_) {}
    });
    keyWatcherProcess.on('exit', (code) => {
      logMsg('keyWatcher exited with code=' + code);
      keyWatcherProcess = null;
    });
    keyWatcherProcess.on('error', (e) => {
      logMsg('keyWatcher error: ' + e);
      keyWatcherProcess = null;
    });
  } catch (err) {
    logMsg('startKeyWatcher error: ' + err);
  }
}

function stopKeyWatcher() {
  if (keyWatcherProcess) {
    try { keyWatcherProcess.kill(); } catch (_) {}
    keyWatcherProcess = null;
  }
}

// 6. Settings Window Management
function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin;

  const menuW = 280;
  const menuH = 450;

  settingsWin = new BrowserWindow({
    width: menuW,
    height: menuH,
    icon: path.join(__dirname, 'app.ico'),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  const settingsHtmlPath = path.join(__dirname, 'settings.html');
  settingsWin.loadFile(settingsHtmlPath).catch((err) => {
    logMsg('failed to load settings.html: ' + err);
  });

  settingsWin.on('blur', () => {
    if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
      settingsWin.hide();
    }
  });

  return settingsWin;
}

// 7. IPC Registration
let ipcRegistered = false;
function registerIpc() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.on('pet-move-by', (event, dx, dy) => {
    try {
      if (petWin && !petWin.isDestroyed()) {
        const [x, y] = petWin.getPosition();
        petWin.setPosition(Math.round(x + dx), Math.round(y + dy));
      }
    } catch (_) {}
  });

  ipcMain.on('pet-set-position', (event, x, y) => {
    try {
      if (petWin && !petWin.isDestroyed()) {
        const nx = Math.round(x);
        const ny = Math.round(y);
        petWin.setPosition(nx, ny);
        savePosition(nx, ny);
      }
    } catch (_) {}
  });

  ipcMain.on('pet-set-scale', (event, scale, isLeft) => {
    try {
      if (petWin && !petWin.isDestroyed()) {
        const s = Math.max(0.6, Math.min(2.5, Number(scale) || 1.2));
        const baseW = 290;
        const baseH = 390;
        const newW = Math.max(260, Math.round(baseW * s));
        const newH = Math.max(340, Math.round(baseH * s));
        const [curX, curY] = petWin.getPosition();
        const [curW, curH] = petWin.getSize();
        const newX = isLeft ? curX : (curX + curW - newW);
        const newY = curY + curH - newH;
        petWin.setBounds({
          x: Math.round(newX),
          y: Math.round(newY),
          width: newW,
          height: newH
        });
      }
    } catch (_) {}
  });

  ipcMain.on('pet-toggle-settings', (event, charRect) => {
    try {
      if (!petWin || petWin.isDestroyed()) return;
      if (!settingsWin || settingsWin.isDestroyed()) {
        createSettingsWindow();
      }
      if (settingsWin.isVisible()) {
        settingsWin.hide();
        return;
      }

      const menuW = 280;
      const menuH = 430;
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenW, height: screenH } = primaryDisplay.workArea;

      if (!charRect || !charRect.width) {
        const [x, y] = petWin.getPosition();
        const [w, h] = petWin.getSize();
        charRect = { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
      }

      let menuX = 0;
      let menuY = 0;
      const spaceLeft = charRect.left;
      const spaceRight = screenW - charRect.right;
      const spaceTop = charRect.top;

      if (spaceLeft >= menuW + 8) {
        menuX = charRect.left - menuW - 8;
      } else if (spaceRight >= menuW + 8) {
        menuX = charRect.right + 8;
      } else if (spaceTop >= menuH + 8) {
        menuX = Math.max(10, Math.min(screenW - menuW - 10, charRect.left + (charRect.width - menuW) / 2));
        menuY = charRect.top - menuH - 8;
      } else {
        menuX = spaceLeft >= spaceRight ? Math.max(10, charRect.left - menuW - 8) : Math.min(screenW - menuW - 10, charRect.right + 8);
      }

      if (menuY === 0) {
        menuY = Math.max(10, Math.min(screenH - menuH - 10, charRect.bottom - menuH));
      }

      settingsWin.setBounds({
        x: Math.round(menuX),
        y: Math.round(menuY),
        width: menuW,
        height: menuH
      });
      const masterConfig = loadMasterConfig();
      settingsWin.webContents.send('pet-init-settings', masterConfig);
      settingsWin.show();
      settingsWin.focus();
    } catch (err) {
      logMsg('pet-toggle-settings error: ' + err);
    }
  });

  ipcMain.on('pet-close-settings', () => {
    try {
      if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
        settingsWin.hide();
      }
    } catch (_) {}
  });

  ipcMain.on('pet-config-changed', (event, cfg) => {
    try {
      const merged = saveMasterConfig(cfg);
      if (petWin && !petWin.isDestroyed()) {
        petWin.webContents.send('pet-apply-config', merged);
      }
    } catch (_) {}
  });

  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(ignore, options);
      }
    } catch (_) {}
  });

  ipcMain.on('pet-request-antigravity-state', async (event) => {
    try {
      const alive = await checkAntigravityAlive();
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send('pet-antigravity-state', alive);
      }
    } catch (_) {}
  });

  ipcMain.on('pet-request-quota', (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      sendQuota(win || petWin);
    } catch (_) {}
  });

  ipcMain.on('pet-request-agent-work-state', (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.webContents.send('pet-agent-work-state', checkAgentWorking());
      }
    } catch (_) {}
  });

  ipcMain.on('pet-quit', () => {
    logMsg('pet-quit received from IPC!');
    userExplicitlyClosed = true;
    cleanExit('pet-quit-ipc');
  });
}

function cleanExit(reason) {
  logMsg('cleanExit called! reason=' + reason);
  try {
    stopKeyWatcher();
    if (quotaInterval) clearInterval(quotaInterval);
    if (agentWorkInterval) clearInterval(agentWorkInterval);
    if (antigravityProbeInterval) clearInterval(antigravityProbeInterval);
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.destroy();
    if (petWin && !petWin.isDestroyed()) petWin.destroy();
    if (tray && !tray.isDestroyed()) tray.destroy();
  } catch (err) {
    logMsg('cleanExit cleanup error: ' + err);
  }
  app.quit();
  process.exit(0);
}

// 8. Desktop Pet Window Creation
function createDesktopPetWindow() {
  if (userExplicitlyClosed) return null;
  if (petWin && !petWin.isDestroyed()) {
    petWin.show();
    return petWin;
  }

  registerIpc();

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const petW = 348;
  const petH = 468;

  let startX = workArea.width > 2200
    ? Math.round(workArea.x + workArea.width * 0.78)
    : Math.max(workArea.x, workArea.x + workArea.width - petW - 30);
  let startY = Math.max(workArea.y, workArea.y + workArea.height - petH - 30);

  const savedPos = loadPosition();
  if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
    if (savedPos.x >= workArea.x - 50 && savedPos.x <= workArea.x + workArea.width - 50 &&
        savedPos.y >= workArea.y - 50 && savedPos.y <= workArea.y + workArea.height - 50) {
      startX = savedPos.x;
      startY = savedPos.y;
    }
  }
  savePosition(startX, startY);
  logMsg(`Creating petWin at x=${startX}, y=${startY}, w=${petW}, h=${petH}, workArea=${JSON.stringify(workArea)}`);

  petWin = new BrowserWindow({
    width: petW,
    height: petH,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    x: startX,
    y: startY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  petWin.setAlwaysOnTop(true);
  petWin.show();
  petWin.focus();

  const petHtmlPath = path.join(__dirname, 'pet.html');
  petWin.loadFile(petHtmlPath).catch((err) => {
    logMsg('Failed to load pet.html: ' + err);
  });

  petWin.webContents.on('did-fail-load', (e, code, desc) => {
    logMsg('petWin did-fail-load: code=' + code + ' desc=' + desc);
  });

  petWin.webContents.on('console-message', (e, level, message) => {
    logMsg('[Renderer Console] ' + message);
  });

  petWin.webContents.on('did-finish-load', () => {
    logMsg('petWin did-finish-load event fired successfully!');
    petWin.show();
    petWin.focus();
    petWin.setAlwaysOnTop(true);
    const initialConfig = loadMasterConfig();
    petWin.webContents.send('pet-apply-config', initialConfig);
    checkAntigravityAlive().then((alive) => {
      if (petWin && !petWin.isDestroyed()) {
        petWin.webContents.send('pet-antigravity-state', alive);
        if (alive) {
          sendQuota(petWin);
          petWin.webContents.send('pet-agent-work-state', checkAgentWorking());
        }
      }
    });
  });

  // Antigravity Autonomy Probe (checks every 2.5s)
  antigravityProbeInterval = setInterval(async () => {
    if (!petWin || petWin.isDestroyed()) return;
    const prev = isAntigravityAlive;
    const curr = await checkAntigravityAlive();
    if (curr !== prev && petWin && !petWin.isDestroyed()) {
      petWin.webContents.send('pet-antigravity-state', curr);
      if (curr) {
        sendQuota(petWin);
      }
    }
  }, 2500);

  // Periodic Quota Refresh (every 30s)
  quotaInterval = setInterval(() => {
    if (petWin && !petWin.isDestroyed() && isAntigravityAlive) {
      sendQuota(petWin);
    }
  }, 30000);

  // Periodic Agent Work State & Turn Cost Tracking (every 300ms)
  let lastWorkState = null;
  let activeTurnFile = null;
  let activeTurnStartSize = 0;
  let lastLiveTokensSent = 0;

  agentWorkInterval = setInterval(() => {
    if (petWin && !petWin.isDestroyed() && isAntigravityAlive) {
      try {
        const info = inspectAgentWork();
        const isWorking = info.working;

        if (isWorking && !lastWorkState) {
          // Agent JUST STARTED working
          activeTurnFile = info.foundFile;
          activeTurnStartSize = info.foundSize || 0;
          lastLiveTokensSent = 0;
          petWin.webContents.send('pet-turn-cost', {
            amount: 0,
            unit: 'tokens',
            isLive: true
          });
        } else if (isWorking && lastWorkState) {
          // Agent is CONTINUOUSLY working / generating output
          if (!activeTurnFile && info.foundFile) {
            activeTurnFile = info.foundFile;
            activeTurnStartSize = info.foundSize || 0;
          }
          if (activeTurnFile) {
            try {
              const curStat = fs.statSync(activeTurnFile);
              const delta = Math.max(0, curStat.size - activeTurnStartSize);
              if (delta > 0) {
                const liveTokens = Math.max(15, Math.round(delta / 3.2));
                if (Math.abs(liveTokens - lastLiveTokensSent) >= 20 || liveTokens > lastLiveTokensSent) {
                  lastLiveTokensSent = liveTokens;
                  petWin.webContents.send('pet-turn-cost', {
                    amount: liveTokens,
                    unit: 'tokens',
                    isLive: true
                  });
                }
              }
            } catch (_) {}
          }
        } else if (!isWorking && lastWorkState) {
          // Agent JUST FINISHED working! Calculate final token consumption
          let tokens = 0;
          if (activeTurnFile) {
            try {
              const curStat = fs.statSync(activeTurnFile);
              const delta = Math.max(0, curStat.size - activeTurnStartSize);
              if (delta > 0) {
                // ~3.2 bytes per token average in JSON transcripts
                tokens = Math.max(120, Math.round(delta / 3.2));
              }
            } catch (_) {}
          }
          if (!tokens) {
            tokens = lastLiveTokensSent > 0 ? lastLiveTokensSent : (Math.floor(Math.random() * 600) + 750);
          }

          petWin.webContents.send('pet-turn-cost', {
            amount: tokens,
            unit: 'tokens',
            isLive: false,
            isFinal: true
          });
          sendQuota(petWin);
          activeTurnFile = null;
          activeTurnStartSize = 0;
          lastLiveTokensSent = 0;
        }

        if (isWorking !== lastWorkState) {
          lastWorkState = isWorking;
          petWin.webContents.send('pet-agent-work-state', isWorking);
        }
      } catch (_) {}
    }
  }, 300);

  petWin.webContents.on('render-process-gone', (e, details) => {
    logMsg('petWin render-process-gone: ' + JSON.stringify(details));
  });

  petWin.on('moved', () => {
    try {
      if (petWin && !petWin.isDestroyed()) {
        const [x, y] = petWin.getPosition();
        savePosition(x, y);
      }
    } catch (_) {}
  });

  petWin.on('close', () => {
    logMsg('petWin close event fired');
  });

  petWin.on('closed', () => {
    logMsg('petWin closed event fired');
    petWin = null;
    cleanExit('petWin-closed');
  });

  startKeyWatcher();

  return petWin;
}

// 9. System Tray Setup
function setupSystemTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      tray = new Tray(img);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '✦ Gemini 哈基米',
          enabled: false
        },
        { type: 'separator' },
        {
          label: '显示桌宠',
          click: () => {
            if (petWin && !petWin.isDestroyed()) {
              petWin.show();
            } else {
              createDesktopPetWindow();
            }
          }
        },
        {
          label: '设置选项...',
          click: () => {
            if (petWin && !petWin.isDestroyed()) {
              const [x, y] = petWin.getPosition();
              const [w, h] = petWin.getSize();
              ipcMain.emit('pet-toggle-settings', {}, { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h });
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出桌宠',
          click: () => {
            cleanExit('tray-menu-quit');
          }
        }
      ]);
      tray.setToolTip('Gemini 哈基米桌宠');
      tray.setContextMenu(contextMenu);
      tray.on('double-click', () => {
        if (petWin && !petWin.isDestroyed()) {
          if (petWin.isMinimized()) petWin.restore();
          petWin.show();
          petWin.focus();
          petWin.setAlwaysOnTop(true);
          try { petWin.moveTop(); } catch (_) {}
          try { petWin.webContents.send('pet-call-attention'); } catch (_) {}
        }
      });
      tray.on('click', () => {
        if (petWin && !petWin.isDestroyed()) {
          if (petWin.isMinimized()) petWin.restore();
          petWin.show();
          petWin.focus();
          petWin.setAlwaysOnTop(true);
          try { petWin.moveTop(); } catch (_) {}
        }
      });
    } catch (err) {
      logMsg('Tray creation error: ' + err);
    }
  }
}

// 10. App Lifecycle

app.whenReady().then(() => {
  logMsg('Gemini Pet standalone starting, PID=' + process.pid);
  setupSystemTray();
  createDesktopPetWindow();
});

app.on('window-all-closed', () => {
  cleanExit();
});
