import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(app.getAppPath(), '..');
const FORGE_SERVER = path.join(ROOT, 'forge-server.mjs');
const children = new Map();

const definitions = {
  forge: { label: 'Forge Bridge', command: process.execPath, args: [FORGE_SERVER], env: { ELECTRON_RUN_AS_NODE: '1' } },
  rojo: { label: 'Rojo', command: 'rojo', args: ['serve', path.join(ROOT, '..', '..', 'default.project.json')] },
  codex: { label: 'Codex CLI', command: 'codex', args: [] }
};

function start(id) {
  if (children.has(id)) return { ok: true, running: true, alreadyRunning: true };
  const def = definitions[id];
  if (!def) throw new Error(`Unknown process: ${id}`);
  const env = { ...process.env, ...(def.env || {}) };
  const child = spawn(def.command, def.args, { cwd: ROOT, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  const entry = { id, label: def.label, pid: child.pid ?? null, running: true, log: '' };
  children.set(id, { child, entry });
  const append = chunk => {
    entry.log = (entry.log + String(chunk)).slice(-30000);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('process-log', { id, text: String(chunk) });
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  child.on('error', error => append(`[FORGE] ${error.message}\n`));
  child.on('exit', (code, signal) => {
    entry.running = false;
    entry.exitCode = code;
    entry.signal = signal;
    children.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('process-exit', { id, code, signal });
  });
  append(`[FORGE] Starting ${def.label}\n`);
  return { ok: true, running: true, pid: child.pid ?? null };
}

function stop(id) {
  const item = children.get(id);
  if (!item) return { ok: true, running: false, alreadyStopped: true };
  try { item.child.kill(); } catch {}
  return { ok: true, running: false };
}

function stopAll() { for (const id of children.keys()) stop(id); }

function status() {
  return Object.keys(definitions).map(id => {
    const item = children.get(id);
    return { id, label: definitions[id].label, running: Boolean(item), pid: item?.entry.pid ?? null, log: item?.entry.log ?? '' };
  });
}

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 620,
    title: 'ROBLOX FORGE',
    backgroundColor: '#070a10',
    webPreferences: { preload: path.join(app.getAppPath(), 'desktop', 'preload.mjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(app.getAppPath(), 'desktop', 'index.html'));
}

ipcMain.handle('process-status', () => status());
ipcMain.handle('process-start', (_event, id) => start(id));
ipcMain.handle('process-stop', (_event, id) => stop(id));
ipcMain.handle('stack-start', () => { start('forge'); start('rojo'); return { ok: true, processes: status() }; });
ipcMain.handle('stack-stop', () => { stopAll(); return { ok: true, processes: status() }; });
ipcMain.handle('process-input', (_event, id, input) => {
  const item = children.get(id);
  if (!item?.child.stdin?.writable) throw new Error(`${id} is not running`);
  item.child.stdin.write(String(input));
  return { ok: true };
});
ipcMain.handle('open-folder', () => shell.openPath(ROOT));

app.whenReady().then(createWindow);
app.on('before-quit', stopAll);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
