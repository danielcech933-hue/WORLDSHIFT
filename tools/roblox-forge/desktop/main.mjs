import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';

const APP_ID = 'com.robloxforge.desktop';
const DESKTOP_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'forge-config.json');
const children = new Map();
let projectRoot = null;
let mainWindow = null;

app.setAppUserModelId(APP_ID);

async function requirePath(root, ...parts) {
  try { await fs.access(path.join(root, ...parts)); return true; } catch { return false; }
}

async function isValidProject(root) {
  return Boolean(root)
    && await requirePath(root, 'default.project.json')
    && await requirePath(root, 'src')
    && await requirePath(root, 'tools', 'roblox-forge', 'forge-server.mjs');
}

async function findProjectInside(root, maxDepth = 3) {
  if (!root || maxDepth < 0) return null;
  if (await isValidProject(root)) return path.normalize(root);
  if (maxDepth === 0) return null;
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return null; }
  const directories = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist')
    .sort((a, b) => {
      const as = a.name.toLowerCase() === 'worldshift' ? 0 : 1;
      const bs = b.name.toLowerCase() === 'worldshift' ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name);
    });
  for (const entry of directories) {
    const found = await findProjectInside(path.join(root, entry.name), maxDepth - 1);
    if (found) return found;
  }
  return null;
}

async function loadConfig() {
  try {
    const config = JSON.parse(await fs.readFile(CONFIG_FILE(), 'utf8'));
    projectRoot = await findProjectInside(config.projectRoot, 1);
  } catch {}
  if (!projectRoot) projectRoot = await findProject();
  if (projectRoot) await saveConfig();
}

async function saveConfig() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(CONFIG_FILE(), JSON.stringify({ projectRoot }, null, 2), 'utf8');
}

async function findProject() {
  const home = os.homedir();
  const oneDrive = process.env.OneDrive || process.env.OneDriveConsumer;
  const candidates = [
    path.join(home, 'Desktop'),
    path.join(home, 'OneDrive', 'Desktop'),
    oneDrive && path.join(oneDrive, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'OneDrive', 'Documents'),
    oneDrive && path.join(oneDrive, 'Documents'),
    path.resolve(process.cwd()),
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates.map(path.normalize))]) {
    const found = await findProjectInside(candidate, 4);
    if (found) return found;
  }
  return null;
}

function forgeServerPath() { return path.join(projectRoot, 'tools', 'roblox-forge', 'forge-server.mjs'); }
function rojoProjectPath() { return path.join(projectRoot, 'default.project.json'); }
function studioPluginSource() { return path.join(projectRoot, 'tools', 'roblox-forge', 'studio', 'ForgePlugin.server.lua'); }
function studioPluginTarget() { return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Roblox', 'Plugins', 'RobloxForge.lua'); }

function definitions() {
  if (!projectRoot) return {};
  return {
    forge: { label: 'Forge Bridge', command: process.env.FORGE_NODE || 'node', args: [forgeServerPath()] },
    rojo: { label: 'Rojo', command: 'rojo', args: ['serve', rojoProjectPath()] },
    codex: { label: 'Codex CLI', command: 'codex', args: [] },
  };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function start(id) {
  if (!projectRoot) throw new Error('Nejdřív vyber nebo automaticky najdi projekt WORLDSHIFT.');
  if (children.has(id)) return { ok: true, running: true, alreadyRunning: true, pid: children.get(id).entry.pid };
  const def = definitions()[id];
  if (!def) throw new Error(`Neznámý proces: ${id}`);
  const child = spawn(def.command, def.args, {
    cwd: projectRoot,
    env: { ...process.env, FORCE_COLOR: '0' },
    windowsHide: true,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const entry = { id, label: def.label, pid: child.pid ?? null, running: true, log: '' };
  children.set(id, { child, entry });
  const append = chunk => {
    const text = String(chunk);
    entry.log = (entry.log + text).slice(-50000);
    send('process-log', { id, text });
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  child.on('error', error => {
    append(`[FORGE ERROR] ${error.message}\n`);
    entry.running = false;
    children.delete(id);
    send('process-exit', { id, code: null, signal: null, error: error.message });
  });
  child.on('exit', (code, signal) => {
    entry.running = false;
    entry.exitCode = code;
    entry.signal = signal;
    children.delete(id);
    send('process-exit', { id, code, signal });
  });
  append(`[FORGE] Starting ${def.label} (PID ${child.pid ?? 'unknown'})\n`);
  return { ok: true, running: true, pid: child.pid ?? null };
}

function stop(id) {
  const item = children.get(id);
  if (!item) return { ok: true, running: false, alreadyStopped: true };
  try { item.child.kill(); } catch {}
  children.delete(id);
  return { ok: true, running: false };
}
function stopAll() { for (const id of [...children.keys()]) stop(id); }
function status() {
  return Object.entries(definitions()).map(([id, def]) => {
    const item = children.get(id);
    return { id, label: def.label, running: Boolean(item), pid: item?.entry.pid ?? null, log: item?.entry.log ?? '' };
  });
}

async function chooseProject() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Vyber složku projektu WORLDSHIFT',
    defaultPath: projectRoot || path.join(os.homedir(), 'Desktop'),
    buttonLabel: 'PŘIPOJIT PROJEKT',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true, projectRoot };
  const selected = path.normalize(result.filePaths[0]);
  const detected = await findProjectInside(selected, 5);
  if (!detected) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'ROBLOX FORGE — projekt nenalezen',
      message: 'V této složce jsem nenašel platný WORLDSHIFT projekt.',
      detail: 'Vyber složku, ve které je default.project.json. Forge umí najít WORLDSHIFT i uvnitř vybrané složky.',
    });
    return { ok: false, invalid: true, projectRoot };
  }
  stopAll();
  projectRoot = detected;
  await saveConfig();
  return { ok: true, projectRoot };
}

async function resetProject() {
  stopAll();
  projectRoot = null;
  try { await fs.rm(CONFIG_FILE(), { force: true }); } catch {}
  return { ok: true, projectRoot: null };
}

async function installStudioPlugin() {
  if (!projectRoot) throw new Error('Nejdřív vyber projekt WORLDSHIFT.');
  const source = studioPluginSource();
  const target = studioPluginTarget();
  if (!(await requirePath(projectRoot, 'tools', 'roblox-forge', 'studio', 'ForgePlugin.server.lua'))) {
    throw new Error(`Studio plugin nebyl nalezen: ${source}`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return { ok: true, target };
}

async function studioHealth() {
  try {
    const response = await fetch('http://127.0.0.1:43117/api/health');
    if (!response.ok) return { online: false, connected: false, reason: `HTTP ${response.status}` };
    const health = await response.json();
    const heartbeat = health.lastStudioHeartbeat ? Date.parse(health.lastStudioHeartbeat) : 0;
    const connected = heartbeat > 0 && (Date.now() - heartbeat) < 8000;
    return { online: true, connected, heartbeat: health.lastStudioHeartbeat, health };
  } catch (error) {
    return { online: false, connected: false, reason: error.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 1000, minHeight: 680,
    title: 'ROBLOX FORGE', backgroundColor: '#070a10', show: false,
    webPreferences: {
      preload: path.join(DESKTOP_DIR, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(DESKTOP_DIR, 'index.html'));
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    send('app-error', { message: `Preload error: ${preloadPath}: ${error.message}` });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    send('app-error', { message: `Renderer ukončen: ${details.reason}` });
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

ipcMain.handle('app-info', () => ({ version: app.getVersion(), packaged: app.isPackaged, platform: process.platform }));
ipcMain.handle('project-get', () => ({ projectRoot }));
ipcMain.handle('project-choose', chooseProject);
ipcMain.handle('project-reset', resetProject);
ipcMain.handle('studio-install', installStudioPlugin);
ipcMain.handle('studio-health', studioHealth);
ipcMain.handle('process-status', () => status());
ipcMain.handle('process-start', (_event, id) => start(id));
ipcMain.handle('process-stop', (_event, id) => stop(id));
ipcMain.handle('stack-start', () => {
  if (!projectRoot) throw new Error('Nejdřív vyber projekt WORLDSHIFT.');
  const results = {};
  for (const id of ['forge', 'rojo']) {
    try { results[id] = start(id); } catch (error) { results[id] = { ok: false, error: error.message }; }
  }
  return { ok: true, results, processes: status() };
});
ipcMain.handle('stack-stop', () => { stopAll(); return { ok: true, processes: status() }; });
ipcMain.handle('process-input', (_event, id, input) => {
  const item = children.get(id);
  if (!item?.child.stdin?.writable) throw new Error(`${id} neběží.`);
  item.child.stdin.write(String(input));
  return { ok: true };
});
ipcMain.handle('open-folder', () => projectRoot ? shell.openPath(projectRoot) : chooseProject());

process.on('uncaughtException', error => send('app-error', { message: error.message, stack: error.stack }));
process.on('unhandledRejection', reason => send('app-error', { message: String(reason) }));

app.whenReady().then(async () => { await loadConfig(); createWindow(); });
app.on('before-quit', stopAll);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
