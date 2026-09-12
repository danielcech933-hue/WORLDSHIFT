import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_FILE = '.forge-runtime/jarvis-tasks.json';
const VALID_STATES = new Set(['queued', 'running', 'paused', 'blocked', 'done', 'failed', 'cancelled', 'proposed']);
const VALID_RISKS = new Set(['safe', 'needs_approval']);

export class TaskQueue {
  constructor(projectRoot, file = DEFAULT_FILE) {
    this.projectRoot = path.resolve(projectRoot);
    this.file = path.join(this.projectRoot, file);
    this.tasks = [];
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    } catch {
      this.tasks = [];
    }
    return this.tasks;
  }

  async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), tasks: this.tasks }, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }

  async add(input) {
    const risk = VALID_RISKS.has(input.risk) ? input.risk : 'safe';
    const state = VALID_STATES.has(input.state) ? input.state : 'queued';
    const task = {
      id: input.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: String(input.title || 'Untitled task'),
      description: String(input.description || ''),
      type: String(input.type || 'general'),
      priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 50,
      risk,
      state,
      parentId: input.parentId || null,
      currentStep: String(input.currentStep || ''),
      nextStep: String(input.nextStep || ''),
      result: input.result || null,
      error: input.error || null,
    };
    this.tasks.push(task);
    await this.save();
    return task;
  }

  async update(id, patch) {
    const task = this.tasks.find(item => item.id === id);
    if (!task) throw new Error(`Task not found: ${id}`);
    if (patch.state && !VALID_STATES.has(patch.state)) throw new Error(`Invalid task state: ${patch.state}`);
    if (patch.risk && !VALID_RISKS.has(patch.risk)) throw new Error(`Invalid task risk: ${patch.risk}`);
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    await this.save();
    return task;
  }

  async next() {
    await this.load();
    return [...this.tasks]
      .filter(task => task.state === 'queued' || task.state === 'proposed')
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0] || null;
  }

  async list(limit = 100) {
    await this.load();
    return this.tasks.slice(-Math.max(1, Math.min(500, Number(limit) || 100)));
  }

  async pauseAll(reason = 'Interrupted by user') {
    await this.load();
    let count = 0;
    for (const task of this.tasks) {
      if (task.state === 'running') {
        task.state = 'paused';
        task.error = reason;
        task.updatedAt = new Date().toISOString();
        count += 1;
      }
    }
    if (count) await this.save();
    return count;
  }
}
