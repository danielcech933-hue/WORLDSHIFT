import fs from 'node:fs/promises';
import path from 'node:path';

export class InterruptController {
  constructor(projectRoot) {
    this.file = path.join(path.resolve(projectRoot), '.forge-runtime', 'jarvis-interrupt.json');
  }

  async request(reason = 'User requested stop') {
    const payload = { interrupted: true, reason, requestedAt: new Date().toISOString() };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  async consume() {
    try {
      const payload = JSON.parse(await fs.readFile(this.file, 'utf8'));
      await fs.rm(this.file, { force: true });
      return payload?.interrupted ? payload : null;
    } catch {
      return null;
    }
  }

  async status() {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      return { interrupted: false };
    }
  }
}
