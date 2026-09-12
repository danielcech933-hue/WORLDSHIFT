import path from 'node:path';

try {
  process.loadEnvFile?.(path.join(process.env.FORGE_PROJECT_ROOT || process.cwd(), 'tools', 'roblox-forge', '.env'));
} catch {}

const ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const PROJECT_NAME = process.env.FORGE_PROJECT_NAME || path.basename(ROOT);
const AGENT_URL = process.env.FORGE_APPROVAL_AGENT_URL || 'http://127.0.0.1:43118';
const INTERVAL_MS = Number(process.env.FORGE_APPROVAL_INTERVAL_MS || 2000);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ROBLOX FORGE] Approval bridge disabled: SUPABASE_URL / SUPABASE_ANON_KEY missing.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function supabase(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function claimNext() {
  const rows = await supabase(`/rest/v1/forge_commands?select=*&project_name=eq.${encodeURIComponent(PROJECT_NAME)}&status=eq.pending&order=created_at.asc&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function updateCommand(id, patch) {
  await supabase(`/rest/v1/forge_commands?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function runApproval(command) {
  await updateCommand(command.id, { status: 'running' });
  console.log(`[ROBLOX FORGE] Approval ${command.id}: starting AI work.`);
  try {
    const response = await fetch(`${AGENT_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'coder',
        agentId: process.env.FORGE_APPROVAL_AGENT_ID || 'codex',
        policy: 'supervised',
        prompt: command.instruction || 'Human approved the current AI plan. Continue implementation, testing and safe sync.',
      }),
    });
    const text = await response.text();
    let result;
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }
    const ok = response.ok && result.ok !== false;
    await updateCommand(command.id, { status: ok ? 'completed' : 'failed', result, completed_at: new Date().toISOString() });
    console.log(`[ROBLOX FORGE] Approval ${command.id}: ${ok ? 'completed' : 'failed'}.`);
  } catch (error) {
    await updateCommand(command.id, { status: 'failed', result: { ok: false, error: error.message }, completed_at: new Date().toISOString() }).catch(() => {});
    console.error(`[ROBLOX FORGE] Approval ${command.id}: ${error.message}`);
  }
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const command = await claimNext();
    if (command) await runApproval(command);
  } catch (error) {
    console.error(`[ROBLOX FORGE] Approval bridge error: ${error.message}`);
  } finally {
    busy = false;
  }
}

console.log(`[ROBLOX FORGE] Approval bridge watching ${PROJECT_NAME} every ${INTERVAL_MS}ms.`);
await tick();
setInterval(tick, INTERVAL_MS);
