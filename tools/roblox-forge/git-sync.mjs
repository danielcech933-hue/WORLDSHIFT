import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const BRANCH = process.env.FORGE_GITHUB_BRANCH || 'main';
const INTERVAL_MS = Number(process.env.FORGE_GIT_SYNC_INTERVAL_MS || 5000);
const REMOTE = process.env.FORGE_GIT_REMOTE || 'origin';
const STATE_DIR = path.join(ROOT, '.forge-runtime');
const STATE_FILE = path.join(STATE_DIR, 'git-sync.json');

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: ROOT, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = String(stdout || '');
        error.stderr = String(stderr || '');
        reject(error);
        return;
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function writeState(state) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

async function inspect() {
  const status = await runGit(['status', '--porcelain', '--untracked-files=no']);
  const head = (await runGit(['rev-parse', 'HEAD'])).stdout.trim();
  const remoteHead = (await runGit(['rev-parse', `${REMOTE}/${BRANCH}`])).stdout.trim();
  const relation = (await runGit(['merge-base', '--is-ancestor', 'HEAD', `${REMOTE}/${BRANCH}`]).then(() => 'behind-or-equal').catch(() => 'ahead-or-diverged'));
  return { dirty: Boolean(status.stdout.trim()), status: status.stdout.trim(), head, remoteHead, relation };
}

async function syncOnce() {
  const startedAt = new Date().toISOString();
  try {
    await runGit(['fetch', '--prune', REMOTE, BRANCH]);
    const info = await inspect();
    if (info.dirty) {
      const result = { ok: false, state: 'local_changes', reason: 'Tracked local changes detected. Automatic sync is paused to protect local work.', ...info, startedAt };
      await writeState(result);
      console.log(`[ROBLOX FORGE] Git sync paused: local changes detected.`);
      return result;
    }
    if (info.head === info.remoteHead) {
      const result = { ok: true, state: 'synced', ...info, startedAt };
      await writeState(result);
      return result;
    }
    if (info.relation !== 'behind-or-equal') {
      const result = { ok: false, state: 'diverged', reason: 'Local branch is ahead of or diverged from origin/main. No reset or force operation was performed.', ...info, startedAt };
      await writeState(result);
      console.log(`[ROBLOX FORGE] Git sync blocked: branch diverged.`);
      return result;
    }
    await runGit(['pull', '--ff-only', REMOTE, BRANCH]);
    const after = await inspect();
    const result = { ok: after.head === after.remoteHead, state: after.head === after.remoteHead ? 'updated' : 'error', ...after, previousHead: info.head, startedAt };
    await writeState(result);
    if (result.ok) console.log(`[ROBLOX FORGE] Git sync applied: ${info.head.slice(0, 8)} -> ${after.head.slice(0, 8)}`);
    return result;
  } catch (error) {
    const result = { ok: false, state: 'error', error: error.message, stdout: error.stdout || '', stderr: error.stderr || '', startedAt };
    await writeState(result);
    console.error(`[ROBLOX FORGE] Git sync error: ${error.message}`);
    return result;
  }
}

let running = false;
async function loop() {
  if (running) return;
  running = true;
  try { await syncOnce(); } finally { running = false; }
}

console.log(`[ROBLOX FORGE] Git sync watching ${ROOT} every ${INTERVAL_MS}ms.`);
await loop();
setInterval(loop, INTERVAL_MS);
