import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PORT = Number(process.env.FORGE_AGENT_PORT || 43118);
const HOST = process.env.FORGE_AGENT_HOST || '127.0.0.1';
const REGISTRY_PATH = path.join(ROOT, 'tools', 'roblox-forge', 'agents', 'registry.json');
const DEFAULT_POLICY = process.env.FORGE_AGENT_POLICY || 'supervised';
const running = new Map();

async function readRegistry() {
  return JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
}

function commandExists(command) {
  return new Promise(resolve => {
    const checker = process.platform === 'win32' ? 'where.exe' : 'which';
    const child = spawn(checker, [command], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    child.stdout?.on('data', chunk => { output += String(chunk); });
    child.on('close', code => resolve(code === 0 ? output.split(/\r?\n/).map(x => x.trim()).find(Boolean) || command : null));
    child.on('error', () => resolve(null));
  });
}

async function discoverAgents() {
  const registry = await readRegistry();
  return Promise.all(registry.agents.map(async agent => ({
    ...agent,
    executable: await commandExists(agent.command),
    available: Boolean(await commandExists(agent.command)),
    running: running.has(agent.id)
  })));
}

function json(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body, null, 2));
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function chooseAgent(agents, role, requested) {
  if (requested) {
    const match = agents.find(a => a.id === requested && a.available && a.roles.includes(role));
    if (match) return match;
    throw new Error(`Requested agent '${requested}' is not available for role '${role}'.`);
  }
  return agents.filter(a => a.available && a.roles.includes(role)).sort((a, b) => b.priority - a.priority)[0] || null;
}

function buildArgs(agent, prompt, role, policy) {
  const roleHint = `You are the ${role} agent inside ROBLOX FORGE. ${prompt}`;
  const args = [...(agent.run?.argsPrefix || [])];
  if (agent.id === 'opencode') {
    args.push('--agent', role === 'reviewer' ? 'plan' : 'build');
    if (policy === 'auto') args.push('--auto');
  }
  args.push(roleHint);
  return args;
}

async function runAgent({ role = 'coder', prompt, agentId, policy = DEFAULT_POLICY }) {
  if (!prompt || typeof prompt !== 'string') throw new Error('prompt is required');
  const registry = await readRegistry();
  const agents = await Promise.all(registry.agents.map(async agent => ({...agent, executable: await commandExists(agent.command), available: Boolean(await commandExists(agent.command))})));
  const agent = chooseAgent(agents, role, agentId);
  if (!agent) throw new Error(`No available agent for role '${role}'. Install/configure an agent or use a local model through OpenCode.`);

  const id = `${agent.id}-${Date.now()}`;
  const args = buildArgs(agent, prompt, role, policy);
  const child = spawn(agent.command, args, {cwd: ROOT, env: {...process.env}, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe']});
  running.set(id, {id, agent: agent.id, role, pid: child.pid || null, startedAt: new Date().toISOString()});

  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', chunk => { stdout = (stdout + String(chunk)).slice(-200000); });
  child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-100000); });

  return await new Promise((resolve, reject) => {
    child.on('error', error => { running.delete(id); reject(error); });
    child.on('close', (code, signal) => {
      running.delete(id);
      resolve({ok: code === 0, id, agent: agent.id, role, code, signal, stdout, stderr});
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {ok: true, port: PORT, policy: DEFAULT_POLICY, agents: await discoverAgents(), running: [...running.values()]});
    if (req.method === 'GET' && url.pathname === '/agents') return json(res, 200, {ok: true, agents: await discoverAgents()});
    if (req.method === 'POST' && url.pathname === '/run') return json(res, 200, await runAgent(await body(req)));
    if (req.method === 'POST' && url.pathname === '/stop') {
      const data = await body(req);
      const item = running.get(data.id);
      if (!item) return json(res, 404, {ok: false, error: 'run not found'});
      return json(res, 200, {ok: true, message: 'Stopping is not implemented for one-shot agents yet.', run: item});
    }
    return json(res, 404, {ok: false, error: 'not found'});
  } catch (error) {
    return json(res, 400, {ok: false, error: error.message});
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[ROBLOX FORGE] Agent Orchestrator listening on http://${HOST}:${PORT}`);
});
