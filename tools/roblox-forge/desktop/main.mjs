import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const children = new Map();
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'forge-config.json');
let projectRoot = null;
let mainWindow;

async function loadConfig() {
  try { projectRoot = JSON.parse(await fs.readFile(CONFIG_FILE(), 'utf8')).projectRoot || null; } catch {}
}
async function saveConfig() { await fs.mkdir(app.getPath('userData'), { recursive: true }); await fs.writeFile(CONFIG_FILE(), JSON.stringify({ projectRoot }, null, 2)); }
function forgeServerPath() { return path.join(projectRoot, 'tools', 'roblox-forge', 'forge-server.mjs'); }
function rojoProjectPath() { return path.join(projectRoot, 'default.project.json'); }

function definitions() {
  if (!projectRoot) return {};
  return {
    forge: { label: 'Forge Bridge', command: process.execPath, args: [forgeServerPath()], env: { ELECTRON_RUN_AS_NODE: '1' } },
    rojo: { label: 'Rojo', command: 'rojo', args: ['serve', rojoProjectPath()] },
    codex: { label: 'Codex CLI', command: 'codex', args: [] }
  };
}

function start(id) {
  const defs = definitions();
  if (!projectRoot) throw new Error('Nejdřív vyber projektovou složku WORLDSHIFT.');
  if (children.has(id)) return { ok: true, running: true, alreadyRunning: true };
  const def = defs[id];
  if (!def) throw new Error(`Unknown process: ${id}`);
  const child = spawn(def.command, def.args, { cwd: projectRoot, env: { ...process.env, ...(def.env || {}) }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  const entry = { id, label: def.label, pid: child.pid ?? null, running: true, log: '' };
  children.set(id, { child, entry });
  const append = chunk => { entry.log = (entry.log + String(chunk)).slice(-30000); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('process-log', { id, text: String(chunk) }); };
  child.stdout?.on('data', append); child.stderr?.on('data', append);
  child.on('error', error => append(`[FORGE] ${error.message}\n`));
  child.on('exit', (code, signal) => { entry.running = false; entry.exitCode = code; entry.signal = signal; children.delete(id); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('process-exit', { id, code, signal }); });
  append(`[FORGE] Starting ${def.label}\n`);
  return { ok: true, running: true, pid: child.pid ?? null };
}
function stop(id) { const item = children.get(id); if (!item) return { ok: true, running: false, alreadyStopped: true }; try { item.child.kill(); } catch {} return { ok: true, running: false }; }
function stopAll() { for (const id of children.keys()) stop(id); }
function status() { return Object.entries(definitions()).map(([id, def]) => { const item = children.get(id); return { id, label: def.label, running: Boolean(item), pid: item?.entry.pid ?? null, log: item?.entry.log ?? '' }; }); }

async function chooseProject() {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Vyber kořen projektu WORLDSHIFT', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  projectRoot = result.filePaths[0];
  await saveConfig();
  return { ok: true, projectRoot };
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1200, height: 780, minWidth: 960, minHeight: 620, title: 'ROBLOX FORGE', backgroundColor: '#070a10', webPreferences: { preload: path.join(app.getAppPath(), 'desktop', 'preload.mjs'), contextIsolation: true, nodeIntegration: false } });
  mainWindow.loadFile(path.join(app.getAppPath(), 'desktop', 'index.html'));
}

ipcMain.handle('project-get', () => ({ projectRoot }));
ipcMain.handle('project-choose', chooseProject);
ipcMain.handle('process-status', () => status());
ipcMain.handle('process-start', (_event, id) => start(id));
ipcMain.handle('process-stop', (_event, id) => stop(id));
ipcMain.handle('stack-start', () => { start('forge'); start('rojo'); return { ok: true, processes: status() }; });
ipcMain.handle('stack-stop', () => { stopAll(); return { ok: true, processes: status() }; });
ipcMain.handle('process-input', (_event, id, input) => { const item = children.get(id); if (!item?.child.stdin?.writable) throw new Error(`${id} is not running`); item.child.stdin.write(String(input)); return { ok: true }; });
ipcMain.handle('open-folder', () => projectRoot ? shell.openPath(projectRoot) : chooseProject());

app.whenReady().then(async () => { await loadConfig(); createWindow(); });
app.on('before-quit', stopAll);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
