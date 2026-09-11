import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PORT = Number(process.env.FORGE_PORT || 43117);
const HOST = process.env.FORGE_HOST || '127.0.0.1';
const GITHUB_TOKEN = process.env.FORGE_GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.FORGE_GITHUB_REPO || 'danielcech933-hue/WORLDSHIFT';
const GITHUB_BRANCH = process.env.FORGE_GITHUB_BRANCH || 'main';
const FORGE_SECRET = process.env.FORGE_SECRET || '';
const STATE_DIR = path.join(ROOT, '.forge-runtime');
const STATE_FILE = path.join(STATE_DIR, 'studio-state.json');
const PUBLIC_DIR = path.join(ROOT, 'tools', 'roblox-forge', 'public');

const state = {
  bridge: 'online',
  version: '0.2.0',
  startedAt: new Date().toISOString(),
  lastStudioHeartbeat: null,
  lastStudioState: null,
  lastCommand: null,
  lastResult: null,
  github: { connected: Boolean(GITHUB_TOKEN), lastPoll: null, lastError: null },
  processes: {}
};

const PROCESS_DEFINITIONS = {
  rojo: { label: 'Rojo', command: 'rojo', args: ['serve', 'default.project.json'], cwd: ROOT, persistent: true },
  codex: { label: 'Codex CLI', command: 'codex', args: [], cwd: ROOT, persistent: true }
};

const managedProcesses = new Map();
const processLogs = new Map();

function ensureProcessState(id) {
  if (!state.processes[id]) {
    state.processes[id] = { id, label: PROCESS_DEFINITIONS[id]?.label || id, running: false, pid: null, exitCode: null, log: '' };
  }
  return state.processes[id];
}

function appendProcessLog(id, chunk) {
  const current = processLogs.get(id) || '';
  const next = (current + String(chunk)).slice(-30000);
  processLogs.set(id, next);
  ensureProcessState(id).log = next;
}

function startManagedProcess(id) {
  const definition = PROCESS_DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown managed process: ${id}`);
  if (managedProcesses.has(id)) return ensureProcessState(id);

  const child = spawn(definition.command, definition.args, {
    cwd: definition.cwd,
    env: process.env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });

  managedProcesses.set(id, child);
  processLogs.set(id, '');
  const entry = ensureProcessState(id);
  entry.running = true;
  entry.pid = child.pid || null;
  entry.exitCode = null;
  entry.log = '';

  child.stdout?.on('data', chunk => appendProcessLog(id, chunk));
  child.stderr?.on('data', chunk => appendProcessLog(id, chunk));
  child.on('error', error => appendProcessLog(id, `[FORGE] process error: ${error.message}\n`));
  child.on('exit', (code, signal) => {
    managedProcesses.delete(id);
    const current = ensureProcessState(id);
    current.running = false;
    current.pid = null;
    current.exitCode = code;
    appendProcessLog(id, `\n[FORGE] ${definition.label} exited (${signal ?? code ?? 'unknown'}).\n`);
  });

  appendProcessLog(id, `[FORGE] Starting ${definition.label}: ${definition.command} ${definition.args.join(' ')}\n`);
  return entry;
}

function stopManagedProcess(id) {
  const child = managedProcesses.get(id);
  if (!child) return ensureProcessState(id);
  try { child.kill(); } catch {}
  return ensureProcessState(id);
}

function sendProcessInput(id, input) {
  const child = managedProcesses.get(id);
  if (!child || !child.stdin?.writable) throw new Error(`${id} is not running`);
  child.stdin.write(String(input));
  return ensureProcessState(id);
}

async function ensureRuntime() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    state.lastStudioState = JSON.parse(raw);
  } catch {}
  for (const id of Object.keys(PROCESS_DEFINITIONS)) ensureProcessState(id);
}

function authorized(req) {
  if (!FORGE_SECRET) return true;
  return req.headers['x-forge-secret'] === FORGE_SECRET;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type,x-forge-secret'
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function github(pathname, options = {}) {
  if (!GITHUB_TOKEN) throw new Error('FORGE_GITHUB_TOKEN is not configured');
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { text }; }
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${data.message || text}`);
  return data;
}

async function getGithubFile(filePath) {
  return github(filePath + `?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
}

async function deleteGithubFile(filePath, sha, message) {
  return github(filePath, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: GITHUB_BRANCH })
  });
}

async function putGithubFile(filePath, content, message, sha = undefined) {
  const body = { message, content: Buffer.from(content, 'utf8').toString('base64'), branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  return github(filePath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function writeResult(result) {
  state.lastResult = result;
  const payload = JSON.stringify(result, null, 2) + '\n';
  if (!GITHUB_TOKEN) return;
  try {
    await putGithubFile('.forge/outbox/last-result.json', payload, `forge: result ${result.id}`);
  } catch {
    try {
      const existing = await getGithubFile('.forge/outbox/last-result.json');
      await putGithubFile('.forge/outbox/last-result.json', payload, `forge: result ${result.id}`, existing.sha);
    } catch (secondError) {
      state.github.lastError = secondError.message;
    }
  }
}

function safeName(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80);
}

async function executeCommand(command) {
  const type = command.type;
  const args = command.args || {};

  switch (type) {
    case 'ping':
      return { ok: true, type, message: 'Forge bridge is alive.' };
    case 'studio_state':
      return { ok: true, type, studio: state.lastStudioState };
    case 'create_project_folder': {
      const name = safeName(args.name);
      if (!name) throw new Error('Missing args.name');
      const folder = path.join(ROOT, 'tools', 'roblox-forge', 'projects', name);
      await fs.mkdir(folder, { recursive: true });
      return { ok: true, type, path: folder };
    }
    case 'process_start':
      return { ok: true, type, process: startManagedProcess(safeName(args.id)) };
    case 'process_stop':
      return { ok: true, type, process: stopManagedProcess(safeName(args.id)) };
    case 'process_input':
      return { ok: true, type, process: sendProcessInput(safeName(args.id), args.input || '') };
    default:
      throw new Error(`Unsupported Forge command: ${type}`);
  }
}

async function pollGithub() {
  if (!GITHUB_TOKEN) return;
  state.github.lastPoll = new Date().toISOString();
  try {
    const file = await getGithubFile('.forge/inbox/next-command.json');
    const command = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    if (command.id && state.lastCommand?.id === command.id) return;
    state.lastCommand = command;
    let result;
    try {
      result = { id: command.id || crypto.randomUUID(), commandId: command.id || null, completedAt: new Date().toISOString(), ...(await executeCommand(command)) };
    } catch (error) {
      result = { id: command.id || crypto.randomUUID(), commandId: command.id || null, completedAt: new Date().toISOString(), ok: false, error: error.message };
    }
    await writeResult(result);
    await deleteGithubFile('.forge/inbox/next-command.json', file.sha, `forge: consume ${result.id}`);
  } catch (error) {
    if (!String(error.message).includes('GitHub 404')) state.github.lastError = error.message;
  }
}

async function serveStatic(urlPath, res) {
  const routes = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8']
  };
  const entry = routes[urlPath];
  if (!entry) return false;
  const body = await fs.readFile(path.join(PUBLIC_DIR, entry[0]));
  res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
  res.end(body);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-forge-secret' });
    return res.end();
  }
  if (!authorized(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && await serveStatic(url.pathname, res)) return;
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, ...state, processes: Object.values(state.processes) });
    if (req.method === 'POST' && url.pathname === '/api/studio/state') {
      const payload = await readBody(req);
      state.lastStudioHeartbeat = new Date().toISOString();
      state.lastStudioState = payload;
      await fs.writeFile(STATE_FILE, JSON.stringify(payload, null, 2));
      return send(res, 200, { ok: true, receivedAt: state.lastStudioHeartbeat });
    }
    if (req.method === 'POST' && url.pathname === '/api/command') {
      const command = await readBody(req);
      const result = await executeCommand(command);
      return send(res, 200, { ok: true, result });
    }
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    return send(res, 500, { ok: false, error: error.message });
  }
});

await ensureRuntime();
server.listen(PORT, HOST, () => {
  console.log(`ROBLOX FORGE listening on http://${HOST}:${PORT}`);
  console.log(`GitHub bridge: ${GITHUB_TOKEN ? GITHUB_REPO : 'not configured'}`);
});

setInterval(pollGithub, 3000);

process.on('SIGINT', () => {
  for (const id of managedProcesses.keys()) stopManagedProcess(id);
  process.exit(0);
});
process.on('SIGTERM', () => {
  for (const id of managedProcesses.keys()) stopManagedProcess(id);
  process.exit(0);
});
