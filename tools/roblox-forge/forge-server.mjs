import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';

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
  version: '1.1.0',
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
  child.on('error', error => {
    appendProcessLog(id, `[FORGE] process error: ${error.message}\n`);
    entry.running = false;
    entry.pid = null;
  });
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

function safeProjectPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw new Error('Missing file path');
  const normalized = path.normalize(relativePath);
  const absolute = path.resolve(ROOT, normalized);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (absolute !== ROOT && !absolute.startsWith(rootPrefix)) throw new Error('Path escapes the connected project root');
  return absolute;
}

async function readProjectFile(relativePath) {
  const absolute = safeProjectPath(relativePath);
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new Error('Target is not a file');
  if (stat.size > 2 * 1024 * 1024) throw new Error('File is larger than the 2 MB AI edit limit');
  const content = await fs.readFile(absolute, 'utf8');
  return { path: path.relative(ROOT, absolute).replaceAll(path.sep, '/'), content, sha256: crypto.createHash('sha256').update(content, 'utf8').digest('hex'), bytes: stat.size };
}

async function writeProjectFile(relativePath, content, expectedSha256) {
  const absolute = safeProjectPath(relativePath);
  if (typeof content !== 'string') throw new Error('Content must be a string');
  if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) throw new Error('File is larger than the 2 MB AI edit limit');
  let current = '';
  try { current = await fs.readFile(absolute, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const currentSha256 = crypto.createHash('sha256').update(current, 'utf8').digest('hex');
  if (expectedSha256 && expectedSha256 !== currentSha256) throw new Error(`File changed since it was read. Expected ${expectedSha256}, current ${currentSha256}.`);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temp = `${absolute}.forge-tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, content, 'utf8');
  await fs.rename(temp, absolute);
  return { path: path.relative(ROOT, absolute).replaceAll(path.sep, '/'), sha256: crypto.createHash('sha256').update(content, 'utf8').digest('hex'), bytes: Buffer.byteLength(content, 'utf8') };
}

function commandExists(command) {
  return new Promise(resolve => {
    execFile(process.platform === 'win32' ? 'where.exe' : 'which', [command], { windowsHide: true }, (error, stdout) => {
      resolve(error ? null : String(stdout).split(/\r?\n/).map(v => v.trim()).find(Boolean) || null);
    });
  });
}

async function diagnostics() {
  const [node, rojo, git, codex] = await Promise.all([
    commandExists('node'),
    commandExists('rojo'),
    commandExists('git'),
    commandExists('codex'),
  ]);
  return {
    forge: { version: state.version, host: HOST, port: PORT, pid: process.pid },
    project: { root: ROOT, defaultProject: await exists(path.join(ROOT, 'default.project.json')) },
    tools: { node, rojo, git, codex },
    studio: { connected: isStudioConnected(), heartbeat: state.lastStudioHeartbeat },
    processes: Object.values(state.processes),
  };
}

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
function isStudioConnected() {
  const heartbeat = state.lastStudioHeartbeat ? Date.parse(state.lastStudioHeartbeat) : 0;
  return heartbeat > 0 && Date.now() - heartbeat < 8000;
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

async function getGithubFile(filePath) { return github(filePath + `?ref=${encodeURIComponent(GITHUB_BRANCH)}`); }
async function deleteGithubFile(filePath, sha, message) { return github(filePath, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sha, branch: GITHUB_BRANCH }) }); }
async function putGithubFile(filePath, content, message, sha = undefined) {
  const body = { message, content: Buffer.from(content, 'utf8').toString('base64'), branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  return github(filePath, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function writeResult(result) {
  state.lastResult = result;
  const payload = JSON.stringify(result, null, 2) + '\n';
  if (!GITHUB_TOKEN) return;
  try { await putGithubFile('.forge/outbox/last-result.json', payload, `forge: result ${result.id}`); }
  catch {
    try { const existing = await getGithubFile('.forge/outbox/last-result.json'); await putGithubFile('.forge/outbox/last-result.json', payload, `forge: result ${result.id}`, existing.sha); }
    catch (secondError) { state.github.lastError = secondError.message; }
  }
}

function safeName(value) { return String(value || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80); }

async function executeCommand(command) {
  const type = command.type;
  const args = command.args || {};
  switch (type) {
    case 'ping': return { ok: true, type, message: 'Forge bridge is alive.' };
    case 'studio_state': return { ok: true, type, studio: state.lastStudioState };
    case 'create_project_folder': {
      const name = safeName(args.name); if (!name) throw new Error('Missing args.name');
      const folder = path.join(ROOT, 'tools', 'roblox-forge', 'projects', name);
      await fs.mkdir(folder, { recursive: true }); return { ok: true, type, path: folder };
    }
    case 'process_start': return { ok: true, type, process: startManagedProcess(safeName(args.id)) };
    case 'process_stop': return { ok: true, type, process: stopManagedProcess(safeName(args.id)) };
    case 'process_input': return { ok: true, type, process: sendProcessInput(safeName(args.id), args.input || '') };
    default: throw new Error(`Unsupported Forge command: ${type}`);
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
    try { result = { id: command.id || crypto.randomUUID(), commandId: command.id || null, completedAt: new Date().toISOString(), ...(await executeCommand(command)) }; }
    catch (error) { result = { id: command.id || crypto.randomUUID(), commandId: command.id || null, completedAt: new Date().toISOString(), ok: false, error: error.message }; }
    await writeResult(result);
    await deleteGithubFile('.forge/inbox/next-command.json', file.sha, `forge: consume ${result.id}`);
  } catch (error) {
    if (!String(error.message).includes('GitHub 404')) state.github.lastError = error.message;
  }
}

async function serveStatic(urlPath, res) {
  const routes = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
  const entry = routes[urlPath]; if (!entry) return false;
  const body = await fs.readFile(path.join(PUBLIC_DIR, entry[0]));
  res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' }); res.end(body); return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-forge-secret' }); return res.end(); }
  if (!authorized(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && await serveStatic(url.pathname, res)) return;
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, ...state, processes: Object.values(state.processes) });
    if (req.method === 'GET' && url.pathname === '/api/project') return send(res, 200, { ok: true, root: ROOT, name: path.basename(ROOT), defaultProject: await exists(path.join(ROOT, 'default.project.json')) });
    if (req.method === 'GET' && url.pathname === '/api/studio/state') return send(res, 200, { ok: true, connected: isStudioConnected(), heartbeat: state.lastStudioHeartbeat, studio: state.lastStudioState });
    if (req.method === 'GET' && url.pathname === '/api/diagnostics') return send(res, 200, { ok: true, diagnostics: await diagnostics() });
    if (req.method === 'POST' && url.pathname === '/api/project/file/read') return send(res, 200, { ok: true, file: await readProjectFile((await readBody(req)).path) });
    if (req.method === 'POST' && url.pathname === '/api/project/file/write') {
      const body = await readBody(req);
      return send(res, 200, { ok: true, file: await writeProjectFile(body.path, body.content, body.expectedSha256) });
    }
    if (req.method === 'POST' && url.pathname === '/api/studio/state') {
      const payload = await readBody(req);
      state.lastStudioHeartbeat = new Date().toISOString(); state.lastStudioState = payload;
      await fs.writeFile(STATE_FILE, JSON.stringify(payload, null, 2));
      return send(res, 200, { ok: true, receivedAt: state.lastStudioHeartbeat });
    }
    if (req.method === 'POST' && url.pathname === '/api/command') return send(res, 200, { ok: true, result: await executeCommand(await readBody(req)) });
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (error) { return send(res, 500, { ok: false, error: error.message }); }
});

await ensureRuntime();
server.listen(PORT, HOST, () => {
  console.log(`ROBLOX FORGE listening on http://${HOST}:${PORT}`);
  console.log(`GitHub bridge: ${GITHUB_TOKEN ? GITHUB_REPO : 'not configured'}`);
});
setInterval(pollGithub, 3000);
process.on('SIGINT', () => { for (const id of managedProcesses.keys()) stopManagedProcess(id); process.exit(0); });
process.on('SIGTERM', () => { for (const id of managedProcesses.keys()) stopManagedProcess(id); process.exit(0); });
