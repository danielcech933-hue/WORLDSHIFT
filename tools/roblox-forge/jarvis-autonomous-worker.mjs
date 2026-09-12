import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { JarvisTaskManager } from './jarvis-task-manager.mjs';
import { InterruptController } from './interrupt-controller.mjs';
import { ContextEngine } from './jarvis-context.mjs';
import { resolveModel } from './model-router.mjs';

const ROOT = path.resolve(process.env.FORGE_PROJECT_ROOT || process.cwd());
const PORT = Number(process.env.JARVIS_WORKER_PORT || 43120);
const HOST = process.env.JARVIS_WORKER_HOST || '127.0.0.1';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MAX_STEPS = Number(process.env.JARVIS_WORKER_MAX_STEPS || 12);
const IDLE_MS = Number(process.env.JARVIS_WORKER_IDLE_MS || 5000);
const AUTO_CREATE = process.env.JARVIS_WORKER_AUTO_CREATE !== '0';

const tasks = await new JarvisTaskManager(ROOT).init();
const interrupts = new InterruptController(ROOT);
const context = new ContextEngine(ROOT);
await context.load();

const state = { running: true, phase: 'idle', taskId: null, taskTitle: null, step: 0, lastAction: null, lastResult: null, error: null, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const runtimeFile = path.join(ROOT, '.forge-runtime', 'jarvis-autonomy.json');
const runtimeDir = path.dirname(runtimeFile);

async function persist(patch = {}) {
  Object.assign(state, patch, { updatedAt: new Date().toISOString() });
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(runtimeFile, JSON.stringify(state, null, 2), 'utf8');
}

function safePath(input) {
  const candidate = path.resolve(ROOT, String(input || ''));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) throw new Error('Path is outside the project root.');
  return candidate;
}

async function readFile(file) {
  const full = safePath(file);
  const stat = await fs.stat(full);
  if (!stat.isFile()) throw new Error('Not a file.');
  if (stat.size > 2 * 1024 * 1024) throw new Error('File exceeds 2 MB limit.');
  return fs.readFile(full, 'utf8');
}

async function searchProject(query) {
  const needle = String(query || '').toLowerCase();
  if (!needle) throw new Error('query required');
  const results = [];
  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.forge-runtime') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(m?js|cjs|lua|luau|json|md|txt|bat|ps1)$/i.test(entry.name)) {
        try {
          const lines = (await fs.readFile(full, 'utf8')).split(/\r?\n/);
          for (let i = 0; i < lines.length; i += 1) {
            if (lines[i].toLowerCase().includes(needle)) results.push({ file: path.relative(ROOT, full), line: i + 1, text: lines[i].slice(0, 300) });
            if (results.length >= 80) return;
          }
        } catch {}
      }
      if (results.length >= 80) return;
    }
  }
  for (const root of ['src', 'tools']) { await walk(path.join(ROOT, root)); if (results.length >= 80) break; }
  return results;
}

async function writeFile(file, content) {
  const relative = String(file || '');
  const full = safePath(relative);
  if (relative === '.forge-runtime' || relative.startsWith('.forge-runtime' + path.sep)) throw new Error('Runtime state cannot be edited by the autonomous worker.');
  const text = String(content ?? '');
  if (text.length > 2 * 1024 * 1024) throw new Error('File exceeds 2 MB limit.');
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, text, 'utf8');
  return { ok: true, file: path.relative(ROOT, full), bytes: Buffer.byteLength(text) };
}

async function run(executable, args, timeoutMs = 60000) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { cwd: ROOT, env: { ...process.env, FORGE_PROJECT_ROOT: ROOT, FORCE_COLOR: '0' }, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += String(d); if (stdout.length > 20000) stdout = stdout.slice(-20000); });
    child.stderr.on('data', d => { stderr += String(d); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    const timer = setTimeout(() => { child.kill(); resolve({ ok: false, code: null, stdout, stderr: stderr + '\nProcess timed out.' }); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); resolve({ ok: false, code: null, stdout, stderr: error.message }); });
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, code, stdout, stderr }); });
  });
}

async function verify() {
  const result = await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'verify'], 120000);
  return { ok: result.ok, code: result.code, stdout: result.stdout.slice(-12000), stderr: result.stderr.slice(-12000) };
}
async function gitStatus() {
  const result = await run(process.platform === 'win32' ? 'git.exe' : 'git', ['status', '--short'], 30000);
  return { ok: result.ok, stdout: result.stdout.slice(-12000), stderr: result.stderr.slice(-4000) };
}

const TOOL_SCHEMA = [
  { type: 'function', function: { name: 'read_file', description: 'Read a project file.', parameters: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } } },
  { type: 'function', function: { name: 'search_project', description: 'Search source files for a string.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Write a project source/config file. Never write runtime state.', parameters: { type: 'object', properties: { file: { type: 'string' }, content: { type: 'string' } }, required: ['file', 'content'] } } },
  { type: 'function', function: { name: 'verify', description: 'Run the project verification suite.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'git_status', description: 'Inspect git working tree. Does not commit or push.', parameters: { type: 'object', properties: {} } } },
];

async function toolCall(name, args) {
  if (name === 'read_file') return readFile(args.file);
  if (name === 'search_project') return searchProject(args.query);
  if (name === 'write_file') return writeFile(args.file, args.content);
  if (name === 'verify') return verify();
  if (name === 'git_status') return gitStatus();
  throw new Error(`Unknown worker tool: ${name}`);
}

async function ollama(messages, model) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, tools: TOOL_SCHEMA, stream: false, options: { temperature: 0.15, num_ctx: 4096 }, keep_alive: '10m' }) });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

async function ensureMission() {
  const next = await tasks.next();
  if (next || !AUTO_CREATE) return next;
  return tasks.create({ title: 'Autonomously improve JARVIS / ROBLOX FORGE', description: 'Inspect the current JARVIS and ROBLOX FORGE codebase, identify one safe high-value improvement, implement it, verify it, and leave a clear checkpoint. Do not modify WORLDSHIFT gameplay unless a task explicitly asks for it. Never commit, push, delete, reset, or run arbitrary system commands.', type: 'maintenance', priority: 10, risk: 'safe' });
}

async function workTask(task) {
  await tasks.update(task.id, { state: 'running', currentStep: 'Inspecting project and planning first safe change', nextStep: 'Use project tools, implement one focused improvement, then verify.' });
  await persist({ phase: 'working', taskId: task.id, taskTitle: task.title, step: 0, error: null });
  const modelInfo = await resolveModel(ROOT, 'heavy');
  const model = modelInfo.model;
  const messages = [
    { role: 'system', content: `You are JARVIS Autonomous Worker for ROBLOX FORGE. Work only inside ${ROOT}. You have safe project tools: read/search/write/verify/git-status. You may edit source/config files, but NEVER commit, push, reset, delete files, run PowerShell, kill processes, start apps, or modify .forge-runtime. Work one focused improvement at a time. Inspect before editing. Prefer small reversible changes. After editing, run verify. If verification fails, fix it before finishing. If you cannot safely improve anything, report why. Current context: ${JSON.stringify(context.get())}.` },
    { role: 'user', content: `Task: ${task.title}\nDescription: ${task.description}\nCurrent step: ${task.currentStep || 'none'}\nNext step: ${task.nextStep || 'none'}` },
  ];
  for (let step = 1; step <= MAX_STEPS; step += 1) {
    const interrupt = await interrupts.consume();
    if (interrupt) { await tasks.update(task.id, { state: 'paused', error: interrupt.reason, currentStep: 'Paused by interrupt' }); await persist({ phase: 'paused', step, lastAction: 'interrupt', lastResult: interrupt.reason }); return; }
    await persist({ phase: 'working', step });
    const response = await ollama(messages, model);
    const assistant = response.message || { role: 'assistant', content: '' };
    messages.push(assistant);
    const calls = assistant.tool_calls || [];
    if (!calls.length) {
      const result = assistant.content || 'Worker completed without further tool calls.';
      await tasks.update(task.id, { state: 'done', result: { summary: result, model, steps: step }, currentStep: 'Completed', nextStep: '' });
      await persist({ phase: 'done', step, lastAction: 'finish', lastResult: result });
      return;
    }
    for (const call of calls) {
      const name = call.function?.name;
      const args = call.function?.arguments || {};
      await persist({ lastAction: name, lastResult: null });
      let result;
      try { result = await toolCall(name, args); } catch (error) { result = { ok: false, error: error.message }; }
      messages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: call.id, name });
      await persist({ lastAction: name, lastResult: result });
    }
  }
  const message = `Stopped after ${MAX_STEPS} worker steps; checkpoint is preserved in task state.`;
  await tasks.update(task.id, { state: 'paused', error: message, currentStep: `Step limit reached (${MAX_STEPS})`, nextStep: 'Resume from the saved checkpoint.' });
  await persist({ phase: 'paused', error: message });
}

async function loop() {
  while (state.running) {
    try {
      const interrupt = await interrupts.consume();
      if (interrupt) { await tasks.pauseAll(interrupt.reason); await persist({ phase: 'paused', lastAction: 'interrupt', lastResult: interrupt.reason }); await new Promise(r => setTimeout(r, IDLE_MS)); continue; }
      const task = await ensureMission();
      if (!task) { await persist({ phase: 'idle', taskId: null, taskTitle: null }); await new Promise(r => setTimeout(r, IDLE_MS)); continue; }
      await workTask(task);
      await new Promise(r => setTimeout(r, IDLE_MS));
    } catch (error) {
      await persist({ phase: 'error', error: error.message });
      await new Promise(r => setTimeout(r, IDLE_MS));
    }
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/health') return res.end(JSON.stringify({ ok: true, service: 'jarvis-autonomous-worker', state, projectRoot: ROOT }));
  if (req.method === 'POST' && req.url === '/stop') { await interrupts.request('Worker stop requested via local API'); return res.end(JSON.stringify({ ok: true })); }
  res.statusCode = 404;
  return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

await persist({ phase: 'idle' });
server.listen(PORT, HOST, () => console.log(`[JARVIS WORKER] listening on http://${HOST}:${PORT} for ${ROOT}`));
loop().catch(async error => { await persist({ phase: 'error', error: error.message }); process.exitCode = 1; });
