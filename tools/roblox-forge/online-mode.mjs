import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';

const ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const STATE_DIR = path.join(ROOT, '.forge-runtime');
const STATE_FILE = path.join(STATE_DIR, 'online-mode.json');
const INTERVAL_MS = Number(process.env.FORGE_ONLINE_INTERVAL_MS || 5000);
const services = new Map();

function stamp() { return new Date().toISOString(); }
async function state(patch) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  let current = {};
  try { current = JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); } catch {}
  await fs.writeFile(STATE_FILE, JSON.stringify({ ...current, ...patch, updatedAt: stamp() }, null, 2), 'utf8');
}
function command(name, args) {
  return spawn(name, args, { cwd: ROOT, env: { ...process.env, FORGE_PROJECT_ROOT: ROOT, FORCE_COLOR: '0' }, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
}
function alive(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    const done = ok => { socket.destroy(); resolve(ok); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(700, () => done(false));
  });
}
async function startService(id, name, spawnFn, port) {
  if (await alive(port)) {
    services.set(id, { id, name, external: true, running: true, pid: null });
    return;
  }
  const child = spawnFn();
  const entry = { id, name, external: false, running: true, pid: child.pid || null, startedAt: stamp(), restarts: services.get(id)?.restarts || 0 };
  services.set(id, entry);
  child.stdout?.on('data', data => process.stdout.write(`[${name}] ${data}`));
  child.stderr?.on('data', data => process.stderr.write(`[${name}] ${data}`));
  child.on('error', error => { entry.running = false; entry.error = error.message; });
  child.on('exit', (code, signal) => { entry.running = false; entry.exitCode = code; entry.signal = signal; if (!entry.external) entry.restarts += 1; });
}
async function reconcile() {
  await startService('forge', 'Forge', () => command('node', [path.join(ROOT, 'tools', 'roblox-forge', 'forge-server.mjs')]), 43117);
  await startService('agents', 'AI Orchestrator', () => command('node', [path.join(ROOT, 'tools', 'roblox-forge', 'agents', 'orchestrator-v2.mjs')]), 43118);
  await startService('jarvis', 'JARVIS', () => command('node', [path.join(ROOT, 'tools', 'roblox-forge', 'jarvis-backend.mjs')]), 43119);
  await startService('rojo', 'Rojo', () => command(process.platform === 'win32' ? 'rojo.exe' : 'rojo', ['serve', 'default.project.json']), 34872);
  const processes = [...services.values()].map(({ child, ...item }) => item);
  await state({ mode: 'online', projectRoot: ROOT, intervalMs: INTERVAL_MS, processes, idle: true, status: 'READY_FOR_INSTRUCTION', lastCheck: stamp() });
}
console.log(`[ROBLOX FORGE] ONLINE MODE active for ${ROOT}`);
console.log('[ROBLOX FORGE] Services will be kept alive and restarted if they stop.');
await reconcile();
setInterval(() => reconcile().catch(error => { console.error(`[ROBLOX FORGE] Online mode error: ${error.message}`); state({ mode: 'online', status: 'ERROR', error: error.message }).catch(() => {}); }), INTERVAL_MS);
