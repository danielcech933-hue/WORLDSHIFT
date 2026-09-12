import { clipboardGet, clipboardSet, focusWindow, sendKeys, captureScreen } from './jarvis-desktop-control.mjs';

const WAIT_MS = Number(process.env.JARVIS_CHATGPT_WAIT_MS || 4000);

async function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function invokeLatestCopyButton() {
  if (process.platform !== 'win32') return { ok: false, error: 'ChatGPT desktop bridge currently targets Windows.' };
  const script = `Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; $root=[Windows.Automation.AutomationElement]::RootElement; $cond=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'ChatGPT'); $wins=$root.FindAll([Windows.Automation.TreeScope]::Children,$cond); if($wins.Count -eq 0){ $wins=$root.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,'ChatGPT'))) }; if($wins.Count -eq 0){ throw 'ChatGPT window not found.' }; $win=$wins.Item($wins.Count-1); $buttons=$win.FindAll([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Button))); $found=$null; for($i=$buttons.Count-1;$i -ge 0;$i--){ $b=$buttons.Item($i); if($b.Current.Name -match '^(Copy|Kopírovat)$'){ $found=$b; break } }; if(-not $found){ throw 'No Copy button found in ChatGPT UI.' }; $inv=$found.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern); $inv.Invoke(); Start-Sleep -Milliseconds 250; [pscustomobject]@{ok=$true;name=$found.Current.Name}|ConvertTo-Json -Compress`;
  const { spawn } = await import('node:child_process');
  return new Promise(resolve => {
    const child = spawn('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script], { windowsHide:true, shell:false, stdio:['ignore','pipe','pipe'] });
    let out='',err=''; child.stdout.on('data',d=>out+=String(d)); child.stderr.on('data',d=>err+=String(d)); child.on('error',e=>resolve({ok:false,error:e.message})); child.on('close',code=>{ if(code!==0)return resolve({ok:false,error:err||out||`exit ${code}`}); try{resolve(JSON.parse(out))}catch{resolve({ok:true,raw:out})} });
  });
}

export async function consultChatGPT(prompt, options = {}) {
  const focus = await focusWindow(options.window || 'ChatGPT');
  if (!focus.ok) return { ok:false, stage:'focus', focus };
  await clipboardSet(String(prompt));
  await sendKeys('^v');
  await sendKeys('{ENTER}');
  await wait(Number(options.waitMs || WAIT_MS));

  let copied = await invokeLatestCopyButton();
  let answer = '';
  if (copied.ok) {
    const clip = await clipboardGet();
    answer = String(clip.text || '');
  }
  const screenshot = await captureScreen(options.screenshot || 'chatgpt-latest.png');
  return {
    ok: Boolean(answer.trim() || screenshot.ok),
    focus,
    answer: answer.trim(),
    screenshot: screenshot.path || null,
    copied,
    note: answer.trim() ? 'ChatGPT response copied from the latest visible Copy button.' : 'ChatGPT response text was not extracted; inspect the screenshot and retry with a longer wait.',
  };
}

export async function chatGPTStatus() {
  const focus = await focusWindow('ChatGPT');
  return { ok: focus.ok, window: focus };
}
