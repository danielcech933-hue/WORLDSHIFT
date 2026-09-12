import { inspectPc } from './pc-inventory.mjs';

function push(list, area, title, reason, risk = 'low') {
  list.push({ area, title, reason, risk, requiresApproval: risk !== 'low' });
}

export async function buildOptimizationPlan() {
  const profile = await inspectPc();
  if (!profile.ok) return profile;

  const recommendations = [];
  const ram = Number(profile.ram?.TotalGB || 0);
  const cpu = String(profile.cpu?.Name || '');
  const gpu = Array.isArray(profile.gpu) ? profile.gpu : profile.gpu ? [profile.gpu] : [];
  const disks = Array.isArray(profile.disks) ? profile.disks : profile.disks ? [profile.disks] : [];

  if (ram <= 8) push(recommendations, 'memory', 'Reduce background load', 'Low system RAM benefits from fewer startup/background applications.', 'low');
  if (ram >= 16) push(recommendations, 'memory', 'Keep RAM available for Ollama', '16 GB is enough to run a modest local coding model, but Roblox Studio and Ollama should not compete with unnecessary background processes.', 'low');

  if (/i5-3470/i.test(cpu)) {
    push(recommendations, 'cpu', 'Prefer lightweight local AI settings', 'The i5-3470 has 4 cores/4 threads, so smaller quantized models and modest context are preferable for responsive development.', 'low');
    push(recommendations, 'cpu', 'Check CPU cooling before performance tuning', 'This is older hardware; thermal headroom should be verified before any boost/voltage changes.', 'medium');
  }

  if (gpu.some(x => /quadro k620/i.test(String(x.Name)))) {
    push(recommendations, 'gpu', 'Use CPU-first Ollama configuration', 'The Quadro K620 is an older GPU with limited VRAM and should not be assumed to accelerate a modern 7B coding model effectively.', 'low');
    push(recommendations, 'gpu', 'Keep Roblox graphics conservative during development', 'A lightweight editor/test profile leaves more headroom for Studio and the local AI model.', 'low');
  }

  for (const disk of disks) {
    if (Number(disk.FreeGB || 0) < 20) push(recommendations, 'storage', `Free space on ${disk.DeviceID}`, 'Low free space can hurt Windows, shader/cache and development workloads.', 'low');
  }

  push(recommendations, 'bios', 'Inspect XMP/EXPO and Resizable BAR', 'These can improve platform configuration when supported, but exact motherboard/CPU/GPU compatibility must be checked first.', 'medium');
  push(recommendations, 'bios', 'Do not auto-change voltage, clocks or firmware', 'BIOS overclocking, undervolting and firmware flashing can cause instability or boot problems and therefore require explicit review.', 'high');

  return {
    ok: true,
    profile,
    profiles: {
      gaming: { goal: 'maximum stable game performance without unsafe changes' },
      robloxDev: { goal: 'Roblox Studio + Rojo + JARVIS + Ollama responsiveness' },
      ai: { goal: 'maximize local model responsiveness while keeping Windows usable' },
      balanced: { goal: 'normal daily use with low background overhead' },
    },
    recommendations,
    policy: 'recommend-only',
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  buildOptimizationPlan().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
