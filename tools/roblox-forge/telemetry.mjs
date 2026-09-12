import path from 'node:path';

try {
  process.loadEnvFile?.(path.join(process.env.FORGE_PROJECT_ROOT || process.cwd(), 'tools', 'roblox-forge', '.env'));
} catch {}

const FORGE_URL = process.env.FORGE_TELEMETRY_FORGE_URL || 'http://127.0.0.1:43117';
const AGENT_URL = process.env.FORGE_TELEMETRY_AGENT_URL || 'http://127.0.0.1:43118';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const PROJECT_NAME = process.env.FORGE_PROJECT_NAME || path.basename(process.env.FORGE_PROJECT_ROOT || process.cwd());
const PROJECT_ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const INTERVAL_MS = Number(process.env.FORGE_TELEMETRY_INTERVAL_MS || 5000);
const EVENT_BATCH_LIMIT = 25;
const queue = [];
let flushing = false;
let started = false;

function configured() { return Boolean(SUPABASE_URL && SUPABASE_KEY); }
function sanitize(value) {
  if (value === undefined || value === null) return value === null ? null : null;
  if (typeof value === 'string') return value.slice(0, 10000);
  return value;
}
async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export function telemetryStatus() {
  return { configured: configured(), project: PROJECT_NAME, endpoint: SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/forge_events` : null, queued: queue.length };
}
export function track(eventType, payload = {}, severity = 'info', source = 'forge') {
  queue.push({ project_name: PROJECT_NAME, project_root: PROJECT_ROOT, source: String(source).slice(0, 80), event_type: String(eventType).slice(0, 120), severity, payload: sanitize(payload) || {} });
  while (queue.length > 500) queue.shift();
  void flush();
}
async function flush() {
  if (flushing || !configured() || !queue.length) return;
  flushing = true;
  const batch = queue.splice(0, EVENT_BATCH_LIMIT);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/forge_events`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${await response.text()}`);
  } catch (error) {
    queue.unshift(...batch);
    while (queue.length > 500) queue.pop();
    if (process.env.FORGE_TELEMETRY_DEBUG === '1') console.error(`[FORGE TELEMETRY] ${error.message}`);
  } finally { flushing = false; }
}
async function snapshot() {
  const [forge, studio, agents] = await Promise.allSettled([getJson(`${FORGE_URL}/api/health`), getJson(`${FORGE_URL}/api/studio/state`), getJson(`${AGENT_URL}/health`)]);
  track('runtime_snapshot', {
    forge: forge.status === 'fulfilled' ? forge.value : { error: String(forge.reason?.message || forge.reason) },
    studio: studio.status === 'fulfilled' ? studio.value : { error: String(studio.reason?.message || studio.reason) },
    agents: agents.status === 'fulfilled' ? agents.value : { error: String(agents.reason?.message || agents.reason) },
  }, 'info', 'telemetry');
}
export async function startTelemetry() {
  if (started) return telemetryStatus();
  started = true;
  track('telemetry_started', { intervalMs: INTERVAL_MS }, 'info', 'telemetry');
  console.log(configured() ? `[ROBLOX FORGE] Supabase telemetry enabled for ${PROJECT_NAME}.` : '[ROBLOX FORGE] Telemetry disabled until SUPABASE_URL and SUPABASE_ANON_KEY are configured.');
  await snapshot().catch(() => {});
  setInterval(() => { void snapshot().catch(() => {}); }, INTERVAL_MS);
  setInterval(() => { void flush(); }, 1000);
  return telemetryStatus();
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) startTelemetry();
