import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONTEXT = 'balanced';
const FILE = '.forge-runtime/jarvis-context.json';

const CONTEXTS = {
  balanced: { id: 'balanced', label: 'Balanced Desktop', required: [], optional: ['browser', 'communication'] },
  'league-of-legends': { id: 'league-of-legends', label: 'League of Legends', required: ['gaming', 'league-of-legends'], optional: ['communication', 'browser'] },
  gaming: { id: 'gaming', label: 'Gaming', required: ['gaming'], optional: ['communication'] },
  roblox: { id: 'roblox', label: 'Roblox', required: ['roblox', 'gaming'], optional: ['communication'] },
  'roblox-development': { id: 'roblox-development', label: 'Roblox Development', required: ['roblox', 'development', 'ai'], optional: ['communication', 'browser'] },
  development: { id: 'development', label: 'Software Development', required: ['development'], optional: ['communication', 'browser'] },
  ai: { id: 'ai', label: 'AI Work', required: ['ai', 'development'], optional: ['communication', 'browser'] },
  creative: { id: 'creative', label: 'Creative Work', required: ['creative'], optional: ['browser', 'communication'] },
};

const RULES = [
  ['roblox-development', /\b(worldshift|roblox studio|rojo|roblox|luau|lua|minihru|roblox forge)\b/i],
  ['league-of-legends', /\b(lol|league of legends|league|riot)\b/i],
  ['development', /\b(programuj|programovat|kód|kod|coding|web|webu|frontend|backend|github|lovable|javascript|typescript|python|react|node)\b/i],
  ['ai', /\b(jarvis|ollama|ai|umělá inteligence|model|llm)\b/i],
  ['gaming', /\b(hra|hraju|hrajeme|gaming|steam)\b/i],
  ['creative', /\b(video|photoshop|grafik|střih|edit|design)\b/i],
];

export function contextInfo(id) { return CONTEXTS[id] || CONTEXTS[DEFAULT_CONTEXT]; }

export function detectContext(text = '') {
  const value = String(text || '');
  for (const [id, regex] of RULES) if (regex.test(value)) return contextInfo(id);
  return contextInfo(DEFAULT_CONTEXT);
}

export class ContextEngine {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
    this.file = path.join(this.projectRoot, FILE);
    this.state = { context: DEFAULT_CONTEXT, label: CONTEXTS[DEFAULT_CONTEXT].label, confidence: 0.2, source: 'default', updatedAt: null };
  }
  async load() {
    try { this.state = { ...this.state, ...JSON.parse(await fs.readFile(this.file, 'utf8')) }; } catch {}
    return this.state;
  }
  async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.state, null, 2), 'utf8');
    return this.state;
  }
  async set(id, source = 'user', confidence = 1) {
    const info = contextInfo(id);
    this.state = { context: info.id, label: info.label, confidence, source, updatedAt: new Date().toISOString() };
    return this.save();
  }
  async infer(text, source = 'user') {
    const detected = detectContext(text);
    const confidence = detected.id === DEFAULT_CONTEXT ? 0.2 : 0.9;
    if (detected.id !== DEFAULT_CONTEXT || this.state.context === DEFAULT_CONTEXT) return this.set(detected.id, source, confidence);
    return this.state;
  }
  get() { return { ...this.state, profile: contextInfo(this.state.context) }; }
}

export { CONTEXTS };
