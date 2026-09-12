import { execFile } from 'node:child_process';
import crypto from 'node:crypto';

const assessments = new Map();
const TTL_MS = 60_000;

function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = String(stdout || '');
        error.stderr = String(stderr || '');
        reject(error);
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

const KNOWLEDGE = {
  RobloxStudioBeta: { role: 'Roblox Studio', categories: ['roblox', 'development'], safeToStop: false },
  Rojo: { role: 'Rojo development sync', categories: ['roblox', 'development'], safeToStop: false },
  git: { role: 'Git source control', categories: ['development'], safeToStop: false },
  node: { role: 'Node.js runtime', categories: ['development', 'tools'], safeToStop: 'unknown' },
  Code: { role: 'Visual Studio Code', categories: ['development'], safeToStop: 'unknown' },
  Discord: { role: 'Discord', categories: ['communication', 'gaming'], safeToStop: 'unknown' },
  steam: { role: 'Steam', categories: ['gaming'], safeToStop: 'unknown' },
  RiotClientServices: { role: 'Riot Client services', categories: ['gaming', 'league-of-legends'], safeToStop: false },
  LeagueClient: { role: 'League of Legends client', categories: ['gaming', 'league-of-legends'], safeToStop: false },
  LeagueClientUx: { role: 'League of Legends UI client', categories: ['gaming', 'league-of-legends'], safeToStop: false },
  LeagueClientUxRender: { role: 'League of Legends UI renderer', categories: ['gaming', 'league-of-legends'], safeToStop: false },
  chrome: { role: 'Google Chrome', categories: ['browser'], safeToStop: 'unknown' },
  msedge: { role: 'Microsoft Edge', categories: ['browser'], safeToStop: 'unknown' },
  firefox: { role: 'Mozilla Firefox', categories: ['browser'], safeToStop: 'unknown' },
  ollama: { role: 'Ollama local AI runtime', categories: ['ai'], safeToStop: false },
  RobloxPlayerBeta: { role: 'Roblox Player', categories: ['gaming', 'roblox'], safeToStop: false },
};

function keyFor(name) {
  return String(name || '').replace(/\.exe$/i, '');
}

function classify(process, context) {
  const key = keyFor(process.name);
  const known = KNOWLEDGE[key];
  const contextName = String(context || 'balanced').toLowerCase();
  if (!known) {
    return {
      classification: 'unknown',
      confidence: 0,
      role: 'Unknown process',
      reason: 'Purpose is not in the local knowledge base. JARVIS must inspect ownership, path, signature and dependencies before considering any action.',
      safeToStop: false,
      requiresFurtherInspection: true,
    };
  }

  const relevant = known.categories.some(category => {
    if (contextName === 'roblox') return category === 'roblox' || category === 'development';
    if (contextName === 'league-of-legends' || contextName === 'lol') return category === 'gaming' || category === 'league-of-legends' || category === 'communication';
    if (contextName === 'gaming') return category === 'gaming' || category === 'communication';
    if (contextName === 'development' || contextName === 'robloxdev') return category === 'development' || category === 'roblox' || category === 'ai';
    if (contextName === 'ai') return category === 'ai' || category === 'development';
    return true;
  });

  let status = 'known';
  let safeToStop = known.safeToStop;
  let reason = `Recognized as ${known.role}.`;
  if (relevant) {
    status = 'required-or-relevant';
    safeToStop = false;
    reason += ` It is relevant to the current ${contextName} context, so JARVIS must not stop it automatically.`;
  } else if (safeToStop === true) {
    status = 'candidate';
    reason += ` It is not relevant to the current ${contextName} context, but JARVIS still needs runtime/dependency checks before stopping it.`;
    safeToStop = 'unknown';
  } else {
    status = 'known-but-uncertain';
    reason += ' Its necessity depends on what the user is currently doing.';
  }

  return {
    classification: status,
    confidence: 0.92,
    role: known.role,
    categories: known.categories,
    reason,
    safeToStop,
    requiresFurtherInspection: safeToStop !== false,
  };
}

export async function inspectProcesses(context = 'balanced') {
  if (process.platform !== 'win32') return { ok: false, error: 'Process intelligence currently targets Windows.' };
  const script = `
$items = Get-CimInstance Win32_Process | Select-Object Name,ProcessId,ParentProcessId,ExecutablePath,CommandLine
$items | ConvertTo-Json -Depth 5 -Compress
`;
  const raw = await powershell(script);
  const parsed = parseJson(raw.trim());
  const list = parsed == null ? [] : (Array.isArray(parsed) ? parsed : [parsed]);
  const processes = list.map(p => ({
    name: String(p.Name || ''),
    pid: Number(p.ProcessId || 0),
    parentPid: Number(p.ParentProcessId || 0),
    executablePath: p.ExecutablePath || null,
    commandLineAvailable: Boolean(p.CommandLine),
    ...classify({ name: p.Name }, context),
  })).filter(p => p.name);

  const counts = processes.reduce((acc, p) => {
    acc[p.classification] = (acc[p.classification] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    context,
    policy: 'inspect-before-action',
    counts,
    processes,
    note: 'This tool only observes. Unknown processes are never treated as safe to stop.',
  };
}

export async function assessProcess(processName, context = 'balanced') {
  const snapshot = await inspectProcesses(context);
  if (!snapshot.ok) return snapshot;
  const wanted = keyFor(processName);
  const matches = snapshot.processes.filter(p => keyFor(p.name).toLowerCase() === wanted.toLowerCase());
  if (!matches.length) return { ok: false, error: `Process ${processName} is not currently running.`, context };

  const assessmentId = crypto.randomUUID();
  assessments.set(assessmentId, {
    expiresAt: Date.now() + TTL_MS,
    processName: matches[0].name,
    context,
    safeToStop: matches[0].safeToStop === true,
    pidList: matches.map(p => p.pid),
  });

  return {
    ok: true,
    assessmentId,
    expiresInMs: TTL_MS,
    processName: matches[0].name,
    context,
    matches,
    decision: matches[0].safeToStop === false ? 'DO_NOT_STOP' : 'REQUIRES_EXPLICIT_REVIEW',
    reason: matches[0].reason,
  };
}

export function consumeStopAssessment(assessmentId, processName) {
  const record = assessments.get(String(assessmentId || ''));
  if (!record) return { ok: false, error: 'Missing or unknown process assessment. Inspect the process first.' };
  assessments.delete(String(assessmentId));
  if (record.expiresAt < Date.now()) return { ok: false, error: 'Process assessment expired. Inspect again before stopping.' };
  if (keyFor(record.processName).toLowerCase() !== keyFor(processName).toLowerCase()) return { ok: false, error: 'Assessment does not match the requested process.' };
  if (!record.safeToStop) return { ok: false, error: 'The current assessment does not mark this process as safely stoppable.' };
  return { ok: true, pids: record.pidList };
}
