import fs from 'node:fs/promises';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const FAST_MODEL = process.env.JARVIS_FAST_MODEL || 'qwen2.5-coder:3b';
const HEAVY_MODEL = process.env.JARVIS_HEAVY_MODEL || process.env.JARVIS_MODEL || 'qwen2.5-coder:7b';
const FALLBACK_MODEL = process.env.JARVIS_FALLBACK_MODEL || 'qwen2.5-coder:1.5b';
const PREFERRED_FILE = process.env.JARVIS_MODEL_FILE || '.forge-runtime/jarvis-model.json';

async function tags() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) throw new Error(`Ollama tags HTTP ${response.status}`);
  return response.json();
}

function installedNames(data) {
  return new Set((data?.models || []).map(model => String(model.name || '').toLowerCase()));
}

async function loadPreference(projectRoot) {
  try {
    const value = JSON.parse(await fs.readFile(`${projectRoot}/${PREFERRED_FILE}`, 'utf8'));
    return typeof value.model === 'string' ? value.model : null;
  } catch {
    return null;
  }
}

export async function resolveModel(projectRoot = process.cwd(), mode = 'interactive') {
  const data = await tags();
  const installed = installedNames(data);
  const preferred = await loadPreference(projectRoot);
  const candidates = mode === 'heavy'
    ? [preferred, HEAVY_MODEL, FAST_MODEL, FALLBACK_MODEL]
    : [preferred, FAST_MODEL, FALLBACK_MODEL, HEAVY_MODEL];

  const selected = candidates.find(model => model && installed.has(model.toLowerCase()));
  if (!selected) {
    throw new Error(`No configured JARVIS model is installed. Expected one of: ${candidates.filter(Boolean).join(', ')}`);
  }
  return {
    model: selected,
    mode,
    installed: [...installed],
    fastModel: FAST_MODEL,
    heavyModel: HEAVY_MODEL,
    fallbackModel: FALLBACK_MODEL,
  };
}

export async function modelStatus(projectRoot = process.cwd()) {
  try {
    return { ok: true, ...(await resolveModel(projectRoot, 'interactive')) };
  } catch (error) {
    return { ok: false, error: error.message, fastModel: FAST_MODEL, heavyModel: HEAVY_MODEL, fallbackModel: FALLBACK_MODEL };
  }
}
