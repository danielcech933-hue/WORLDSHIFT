import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.env.FORGE_PROJECT_ROOT || process.cwd());
const RUNTIME = path.join(ROOT, '.forge-runtime');

function runPowerShell(script, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      cwd: ROOT,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve({ ok: false, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms.`.trim() });
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += String(d); if (stdout.length > 20000) stdout = stdout.slice(-20000); });
    child.stderr.on('data', d => { stderr += String(d); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on('error', e => { clearTimeout(timer); resolve({ ok: false, stdout, stderr: e.message }); });
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, code, stdout, stderr }); });
  });
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function listWindows() {
  const script = `Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object Id,ProcessName,MainWindowTitle,MainWindowHandle | ConvertTo-Json -Compress`;
  const result = await runPowerShell(script);
  if (!result.ok) return result;
  try { return { ok: true, windows: JSON.parse(result.stdout || '[]') }; } catch { return { ok: false, error: 'Could not parse window list.', raw: result.stdout }; }
}

export async function focusWindow(titleOrProcess) {
  const target = psQuote(titleOrProcess);
  const script = `$target=${target}; Add-Type @'\nusing System; using System.Runtime.InteropServices;\npublic static class Win32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); }\n'@; $p=Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like $target -or $_.MainWindowTitle -like "*$target*") } | Select-Object -First 1; if(-not $p){ throw "Window not found: $target" }; [Win32]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null; [Win32]::SetForegroundWindow($p.MainWindowHandle)|Out-Null; [pscustomobject]@{ok=$true;pid=$p.Id;process=$p.ProcessName;title=$p.MainWindowTitle}|ConvertTo-Json -Compress`;
  const result = await runPowerShell(script);
  try { return result.ok ? JSON.parse(result.stdout) : result; } catch { return result; }
}

export async function sendKeys(keys) {
  const value = psQuote(keys);
  const script = `$keys=${value}; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait($keys); Start-Sleep -Milliseconds 150; [pscustomobject]@{ok=$true;keys=$keys}|ConvertTo-Json -Compress`;
  const result = await runPowerShell(script);
  try { return result.ok ? JSON.parse(result.stdout) : result; } catch { return result; }
}

export async function typeText(text) {
  const value = psQuote(text);
  const script = `$text=${value}; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(($text -replace '([+^%~(){}])','{$1}')); Start-Sleep -Milliseconds 150; [pscustomobject]@{ok=$true;chars=$text.Length}|ConvertTo-Json -Compress`;
  const result = await runPowerShell(script);
  try { return result.ok ? JSON.parse(result.stdout) : result; } catch { return result; }
}

export async function captureScreen(fileName = 'jarvis-screen.png') {
  await fs.mkdir(RUNTIME, { recursive: true });
  const output = path.resolve(RUNTIME, path.basename(fileName));
  const psPath = psQuote(output);
  const script = `$path=${psPath}; Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap $bounds.Width,$bounds.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size); $bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose(); [pscustomobject]@{ok=$true;path=$path;width=$bounds.Width;height=$bounds.Height}|ConvertTo-Json -Compress`;
  const result = await runPowerShell(script, 60000);
  try { return result.ok ? JSON.parse(result.stdout) : result; } catch { return result; }
}

export async function clipboardGet() {
  const script = `Add-Type -AssemblyName PresentationCore; $text=[Windows.Clipboard]::GetText(); [pscustomobject]@{ok=$true;text=$text}|ConvertTo-Json -Compress`;
  const result = await runPowerShell(script);
  try { return result.ok ? JSON.parse(result.stdout) : result; } catch { return result; }
}

export async function clipboardSet(text) {
  const value = psQuote(text);
  const script = `Add-Type -AssemblyName PresentationCore; [Windows.Clipboard]::SetText(${value}); [pscustomobject]@{ok=$true}|ConvertTo-Json -Compress`;
  const result = await runPowerShell(script);
  try { return result.ok ? JSON.parse(result.stdout) : result; } catch { return result; }
}

export async function desktopState() {
  return { ok: true, platform: process.platform, runtimeDir: RUNTIME, windows: await listWindows() };
}
