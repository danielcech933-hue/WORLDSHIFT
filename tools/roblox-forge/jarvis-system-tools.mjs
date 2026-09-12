import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assessProcess, consumeStopAssessment } from './pc-intelligence.mjs';
import { listWindows, focusWindow, sendKeys, typeText, captureScreen, clipboardGet, clipboardSet, desktopState } from './jarvis-desktop-control.mjs';
import { consultChatGPT, chatGPTStatus } from './chatgpt-desktop-bridge.mjs';

const ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const APPROVAL = process.env.JARVIS_POLICY || 'supervised';

function run(executable, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || ROOT,
      env: { ...process.env, FORGE_PROJECT_ROOT: ROOT },
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += String(d); if (stdout.length > 30000) stdout = stdout.slice(-30000); });
    child.stderr.on('data', d => { stderr += String(d); if (stderr.length > 30000) stderr = stderr.slice(-30000); });
    child.on('error', reject);
    child.on('close', code => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

function needsApproval(args) {
  return APPROVAL !== 'autonomous' && args?.approved !== true;
}

async function findRobloxStudio() {
  if (process.platform !== 'win32') return null;
  const versions = path.join(process.env.LOCALAPPDATA || '', 'Roblox', 'Versions');
  try {
    const entries = await fs.readdir(versions, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const exe = path.join(versions, entry.name, 'RobloxStudioBeta.exe');
      try { await fs.access(exe); candidates.push(exe); } catch {}
    }
    return candidates.at(-1) || null;
  } catch { return null; }
}

export async function systemTool(name, args = {}) {
  if (name === 'run_powershell') {
    if (needsApproval(args)) return { needsApproval: true, message: 'PowerShell execution requires approval in supervised mode.', command: args.command };
    const command = String(args.command || '').trim();
    if (!command) return { ok: false, error: 'command required' };
    return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command]);
  }

  if (name === 'desktop_control') {
    const action = String(args.action || 'state');
    if (['type', 'keys'].includes(action) && needsApproval(args)) return { needsApproval: true, message: 'Desktop input requires approval in supervised mode.' };
    if (action === 'state') return desktopState();
    if (action === 'windows') return listWindows();
    if (action === 'focus') return focusWindow(String(args.target || ''));
    if (action === 'keys') return sendKeys(String(args.keys || ''));
    if (action === 'type') return typeText(String(args.text || ''));
    if (action === 'screenshot') return captureScreen(String(args.file || 'jarvis-screen.png'));
    if (action === 'clipboard_get') return clipboardGet();
    if (action === 'clipboard_set') return clipboardSet(String(args.text || ''));
    return { ok: false, error: `Unsupported desktop action: ${action}` };
  }

  if (name === 'chatgpt_desktop') {
    const action = String(args.action || 'status');
    if (['consult'].includes(action) && needsApproval(args)) return { needsApproval: true, message: 'Sending a message to the ChatGPT desktop app requires approval in supervised mode.' };
    if (action === 'status') return chatGPTStatus();
    if (action === 'consult') return consultChatGPT(String(args.prompt || ''), { waitMs: args.waitMs, window: args.window, screenshot: args.screenshot });
    return { ok: false, error: `Unsupported ChatGPT action: ${action}` };
  }

  if (name === 'git_action') {
    const action = String(args.action || 'status');
    const allowed = new Set(['status', 'pull', 'fetch', 'log', 'diff', 'branch']);
    if (!allowed.has(action)) return { ok: false, error: `Unsupported git action: ${action}` };
    if (['pull', 'fetch'].includes(action) && needsApproval(args)) return { needsApproval: true, action, message: `git ${action} requires approval in supervised mode.` };
    return run('git', action === 'pull' ? ['pull', '--ff-only'] : [action, ...(Array.isArray(args.args) ? args.args.map(String) : [])]);
  }

  if (name === 'process_action') {
    const action = String(args.action || 'list');
    if (action === 'list') return run('tasklist', ['/FO', 'CSV', '/NH']);
    if (action === 'assess') return assessProcess(String(args.process || ''), String(args.context || 'balanced'));
    if (action === 'stop') {
      if (needsApproval(args)) return { needsApproval: true, message: 'Stopping a process requires approval.', process: args.process };
      const processName = String(args.process || '').trim();
      if (!/^[A-Za-z0-9_.-]+\.exe$/i.test(processName)) return { ok: false, error: 'Use an exact .exe process name.' };
      const assessment = consumeStopAssessment(args.assessmentId, processName);
      if (!assessment.ok) return assessment;
      return run('taskkill', ['/IM', processName, '/T', '/F']);
    }
    return { ok: false, error: `Unsupported process action: ${action}` };
  }

  if (name === 'roblox_studio') {
    const action = String(args.action || 'status');
    const exe = await findRobloxStudio();
    if (action === 'status') return { ok: true, executable: exe, running: Boolean(exe) && (await run('tasklist', ['/FI', 'IMAGENAME eq RobloxStudioBeta.exe', '/NH'])).stdout.includes('RobloxStudioBeta.exe') };
    if (action === 'stop') {
      if (needsApproval(args)) return { needsApproval: true, message: 'Stopping Roblox Studio requires approval.' };
      return run('taskkill', ['/IM', 'RobloxStudioBeta.exe', '/T', '/F']);
    }
    if (action === 'start') {
      if (needsApproval(args)) return { needsApproval: true, message: 'Starting Roblox Studio requires approval.' };
      if (!exe) return { ok: false, error: 'RobloxStudioBeta.exe was not found under LocalAppData.' };
      const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      return { ok: true, executable: exe, pid: child.pid || null };
    }
    return { ok: false, error: `Unsupported Studio action: ${action}` };
  }

  if (name === 'launch_app') {
    if (needsApproval(args)) return { needsApproval: true, message: 'Launching an application requires approval.', executable: args.executable };
    const executable = String(args.executable || '').trim();
    if (!/^[A-Za-z0-9_.\\/: -]+$/i.test(executable)) return { ok: false, error: 'Executable path contains unsupported characters.' };
    const child = spawn(executable, Array.isArray(args.args) ? args.args.map(String) : [], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return { ok: true, executable, pid: child.pid || null };
  }

  throw new Error(`Unknown system tool: ${name}`);
}
