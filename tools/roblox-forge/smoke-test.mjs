import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/+/, '').replace(/\//g, path.sep));

async function walk(dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

function runNodeCheck(file) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--check', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('close', code => resolve({ code, stderr }));
    child.on('error', error => resolve({ code: -1, stderr: error.message }));
  });
}

const files = await walk(ROOT);
const jsonFiles = files.filter(file => file.endsWith('.json'));
for (const file of jsonFiles) {
  try { JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw new Error(`Invalid JSON: ${path.relative(ROOT, file)} — ${error.message}`); }
}

const jsFiles = files.filter(file => /\.(mjs|cjs)$/.test(file));
for (const file of jsFiles) {
  const result = await runNodeCheck(file);
  if (result.code !== 0) throw new Error(`Node syntax check failed: ${path.relative(ROOT, file)}\n${result.stderr}`);
}

console.log(`[FORGE VERIFY] OK — ${jsonFiles.length} JSON files and ${jsFiles.length} Node files checked.`);
