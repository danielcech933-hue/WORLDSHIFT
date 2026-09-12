import { TaskQueue } from './task-queue.mjs';

const VALID = new Set(['queued', 'running', 'paused', 'blocked', 'done', 'failed', 'cancelled', 'proposed']);

export class JarvisTaskManager {
  constructor(projectRoot) { this.queue = new TaskQueue(projectRoot); }
  async init() { await this.queue.load(); return this; }
  async create(input = {}) {
    const title = String(input.title || '').trim();
    if (!title) throw new Error('Task title is required.');
    return this.queue.add({ title, description: String(input.description || ''), type: String(input.type || 'general'), priority: Number(input.priority ?? 50), risk: input.risk === 'needs_approval' ? 'needs_approval' : 'safe', state: input.state && VALID.has(input.state) ? input.state : 'queued', parentId: input.parentId || null, currentStep: String(input.currentStep || ''), nextStep: String(input.nextStep || '') });
  }
  async list(limit = 100) { return this.queue.list(limit); }
  async next() { return this.queue.next(); }
  async update(id, patch) { return this.queue.update(id, patch); }
  async pauseAll(reason = 'Interrupted by user') { return this.queue.pauseAll(reason); }
  async summary() {
    const tasks = await this.list(500);
    const counts = tasks.reduce((acc, task) => { acc[task.state] = (acc[task.state] || 0) + 1; return acc; }, {});
    return { ok: true, counts, active: tasks.filter(t => t.state === 'running'), queued: tasks.filter(t => t.state === 'queued' || t.state === 'proposed'), recent: tasks.slice(-10) };
  }
}
