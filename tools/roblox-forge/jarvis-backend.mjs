import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { inspectPc } from './pc-inventory.mjs';
import { systemTool } from './jarvis-system-tools.mjs';

const PROJECT_ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const PORT = Number(process.env.JARVIS_PORT || 43119);
const HOST = process.env.JARVIS_HOST || '127.0.0.1';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.JARVIS_MODEL || 'qwen2.5-coder:7b';
const POLICY = process.env.JARVIS_POLICY || 'supervised';
const NAME = process.env.JARVIS_NAME || 'JARVIS';
const STATE_FILE = path.join(PROJECT_ROOT, '.forge-runtime', 'jarvis-state.json');
const MAX_BODY = 2 * 1024 * 1024;

let state = { online: true, autonomy: false, busy: false, activeTask: '', lastUser: '', lastReply: '', history: [], updatedAt: null };
let autonomyTimer = null;

async function loadState() { try { state = { ...state, ...JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) }; } catch {} }
async function saveState() { state.updatedAt = new Date().toISOString(); await fs.mkdir(path.dirname(STATE_FILE), { recursive: true }); await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); }
function json(res, code, data) { const body = JSON.stringify(data); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); }
function text(res, code, body, type='text/plain; charset=utf-8') { res.writeHead(code, { 'Content-Type': type }); res.end(body); }
async function body(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', c => { raw += c; if (raw.length > MAX_BODY) req.destroy(new Error('Body too large')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }
async function getJson(url, options={}) { const r = await fetch(url, options); const t = await r.text(); let d={}; try { d=t?JSON.parse(t):{}; } catch { d={raw:t}; } if(!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d; }
function safePath(p) { const root = path.resolve(PROJECT_ROOT); const full = path.resolve(root, p); if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Path is outside project.'); return full; }
async function forge(pathname, options) { return getJson(`http://127.0.0.1:43117${pathname}`, options); }
async function ollama(messages, options={}) {
  return getJson(`${OLLAMA_URL}/api/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model: MODEL, messages, tools: TOOL_SCHEMA, stream:false, options:{ temperature: options.temperature ?? 0.2 }, keep_alive:'10m' }) });
}
async function webSearch(query) {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers:{ 'User-Agent':'ROBLOX-FORGE-JARVIS/1.1' } });
  if (!r.ok) throw new Error(`Web search HTTP ${r.status}`);
  const html = await r.text(); const results=[]; const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html)) && results.length<8) results.push({ url:m[1], title:m[2].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&') });
  return results;
}
function gitStatus() { return new Promise((resolve,reject)=>{ const child=spawn('git',['status','--short'],{cwd:PROJECT_ROOT,windowsHide:true,shell:false}); let output=''; child.stdout.on('data',d=>output+=String(d)); child.stderr.on('data',d=>output+=String(d)); child.on('error',reject); child.on('close',code=>resolve({ok:code===0,output})); }); }

async function tool(name,args={}) {
  if(name==='forge_health') return forge('/api/health');
  if(name==='studio_state') return forge('/api/studio/state');
  if(name==='diagnostics') return forge('/api/diagnostics');
  if(name==='pc_profile') return inspectPc();
  if(name==='project_file') { const file=safePath(args.path); return {path:args.path,content:await fs.readFile(file,'utf8')}; }
  if(name==='write_file') { if(POLICY!=='autonomous' && args.approved!==true) return {needsApproval:true,path:args.path,message:'Writing files requires approval in supervised mode.'}; const file=safePath(args.path); await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,String(args.content||''),'utf8'); return {ok:true,path:args.path}; }
  if(name==='search_web') return webSearch(String(args.query||''));
  if(name==='git_status') return gitStatus();
  if(name==='agent_run') return getJson('http://127.0.0.1:43118/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:args.role||'coder',agentId:args.agentId||'codex',prompt:String(args.prompt||''),policy:'supervised'})});
  if(['run_powershell','git_action','process_action','roblox_studio','launch_app'].includes(name)) return systemTool(name,args);
  throw new Error(`Unknown tool: ${name}`);
}

const SYSTEM = `You are ${NAME}, the local AI development assistant for the WORLDSHIFT Roblox project. Speak Czech unless the user speaks another language. You are a practical computer-and-Roblox assistant, not just a chatbot. You can inspect the project, Roblox Studio, the Windows PC and the public web. You have supervised system tools for PowerShell, Git, processes, Roblox Studio and application launching. Never claim an action succeeded unless a tool result confirms it. In supervised mode, actions that change the machine require explicit approval; read-only inspection is fine. Prefer safe, reversible actions. Never read personal files unless explicitly requested. When the user gives a development task, keep working on it while remaining available for conversation. If a task is long-running, report short progress updates rather than pretending it is finished.`;

const TOOL_SCHEMA = [
 {type:'function',function:{name:'forge_health',description:'Get Forge bridge health.',parameters:{type:'object',properties:{},additionalProperties:false}}},
 {type:'function',function:{name:'studio_state',description:'Inspect current Roblox Studio state, heartbeat, selection and workspace snapshot.',parameters:{type:'object',properties:{},additionalProperties:false}}},
 {type:'function',function:{name:'diagnostics',description:'Get Forge diagnostics for Node, Rojo, Git, Studio and agents.',parameters:{type:'object',properties:{},additionalProperties:false}}},
 {type:'function',function:{name:'pc_profile',description:'Inspect safe Windows hardware, OS, BIOS, GPU, disks and top resource-consuming processes. Do not read personal files.',parameters:{type:'object',properties:{},additionalProperties:false}}},
 {type:'function',function:{name:'project_file',description:'Read a UTF-8 project file using a relative path.',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}},
 {type:'function',function:{name:'write_file',description:'Write a project file. Supervised mode requires approved=true.',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'},approved:{type:'boolean'}},required:['path','content'],additionalProperties:false}}},
 {type:'function',function:{name:'search_web',description:'Search the public web for current information.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}},
 {type:'function',function:{name:'git_status',description:'Read Git status.',parameters:{type:'object',properties:{},additionalProperties:false}}},
 {type:'function',function:{name:'git_action',description:'Run a safe Git action: status, pull, fetch, log, diff or branch. Pull/fetch require approval in supervised mode.',parameters:{type:'object',properties:{action:{type:'string'},args:{type:'array',items:{type:'string'}},approved:{type:'boolean'}},required:['action'],additionalProperties:false}}},
 {type:'function',function:{name:'run_powershell',description:'Run a PowerShell command on the local PC. Requires approval in supervised mode.',parameters:{type:'object',properties:{command:{type:'string'},approved:{type:'boolean'}},required:['command'],additionalProperties:false}}},
 {type:'function',function:{name:'process_action',description:'List or stop Windows processes. Stopping requires approval.',parameters:{type:'object',properties:{action:{type:'string'},process:{type:'string'},approved:{type:'boolean'}},required:['action'],additionalProperties:false}}},
 {type:'function',function:{name:'roblox_studio',description:'Start, stop or inspect Roblox Studio. Start/stop require approval.',parameters:{type:'object',properties:{action:{type:'string'},approved:{type:'boolean'}},required:['action'],additionalProperties:false}}},
 {type:'function',function:{name:'launch_app',description:'Launch a local application by executable path. Requires approval.',parameters:{type:'object',properties:{executable:{type:'string'},args:{type:'array',items:{type:'string'}},approved:{type:'boolean'}},required:['executable'],additionalProperties:false}}},
 {type:'function',function:{name:'agent_run',description:'Ask the existing Forge agent orchestrator to perform a coding task.',parameters:{type:'object',properties:{prompt:{type:'string'},role:{type:'string'},agentId:{type:'string'}},required:['prompt'],additionalProperties:false}}}
];

async function chat(message, approve=false) {
  const messages=[{role:'system',content:SYSTEM},...state.history.slice(-12),{role:'user',content:message}];
  let response=await ollama(messages,{temperature:0.15}); let msg=response.message||{role:'assistant',content:''};
  for(let round=0;round<10;round++){
    const calls=msg.tool_calls||[]; if(!calls.length) break; messages.push(msg);
    for(const call of calls){ const name=call.function?.name; let args={}; try{args=typeof call.function?.arguments==='string'?JSON.parse(call.function.arguments||'{}'):(call.function?.arguments||{});}catch{}
      if(approve && ['write_file','run_powershell','git_action','process_action','roblox_studio','launch_app'].includes(name)) args.approved=true;
      let result; try{result=await tool(name,args);}catch(e){result={error:e.message};}
      messages.push({role:'tool',content:JSON.stringify(result),tool_name:name});
    }
    response=await ollama(messages,{temperature:0.1}); msg=response.message||{role:'assistant',content:''};
  }
  const reply=String(msg.content||'Nemám odpověď.'); state.lastUser=message; state.lastReply=reply; state.history.push({role:'user',content:message},{role:'assistant',content:reply}); state.history=state.history.slice(-20); await saveState(); return {reply,model:MODEL,autonomy:state.autonomy,activeTask:state.activeTask};
}

async function autonomyTick(){ if(!state.autonomy||state.busy)return; state.busy=true; await saveState(); try{const snapshot=await Promise.allSettled([forge('/api/health'),forge('/api/studio/state'),forge('/api/diagnostics')]); state.activeTask='autonomous development cycle'; await saveState(); await chat(`Autonomous development cycle. Inspect current WORLDSHIFT state and choose ONE safe concrete next engineering task. Do not invent state. In supervised mode prepare changes but do not perform protected writes. Runtime snapshot: ${JSON.stringify(snapshot.map(x=>x.status==='fulfilled'?x.value:{error:String(x.reason)}))}`,false);}catch(e){console.error(`[JARVIS] ${e.message}`);}finally{state.activeTask='';state.busy=false;await saveState();}}

const html=`<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${NAME} — ROBLOX FORGE</title><style>body{margin:0;background:#070a10;color:#e8edf7;font:15px system-ui,Segoe UI,sans-serif}main{max-width:1100px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;align-items:center}.orb{width:14px;height:14px;border-radius:50%;background:#35d07f;box-shadow:0 0 18px #35d07f}.chat{height:62vh;overflow:auto;border:1px solid #1c2635;border-radius:18px;padding:18px;background:#0b1018}.msg{margin:10px 0;padding:12px 15px;border-radius:14px;max-width:80%;white-space:pre-wrap}.u{margin-left:auto;background:#162338}.a{background:#101923}.bar{display:flex;gap:10px;margin-top:14px}.bar textarea{flex:1;resize:none;height:58px;background:#0b1018;color:white;border:1px solid #273346;border-radius:14px;padding:12px}.btn{border:0;border-radius:14px;padding:0 18px;background:#e8edf7;color:#071018;font-weight:700;cursor:pointer}.mic{background:#1a2738;color:white}.status{opacity:.7;font-size:13px}.wake{font-size:12px;margin-top:8px}</style></head><body><main><div class="top"><div><h1>${NAME}</h1><div class="status"><span class="orb" style="display:inline-block"></span> LOCAL AI • WORLDSHIFT • <span id="model"></span></div><div class="wake">Wake word: <b>${NAME}</b> • mikrofon čeká na oslovení</div></div><button class="btn" id="auto">AUTONOMY: OFF</button></div><div id="chat" class="chat"></div><div class="bar"><textarea id="input" placeholder="Řekni ${NAME}ovi, co má udělat..."></textarea><button class="btn mic" id="mic">🎙️</button><button class="btn" id="send">ODESLAT</button></div></main><script>
const chatBox=document.getElementById('chat'),input=document.getElementById('input'),model=document.getElementById('model'),auto=document.getElementById('auto'),WAKE=${JSON.stringify(NAME.toLowerCase())};
function add(text,who){const d=document.createElement('div');d.className='msg '+who;d.textContent=text;chatBox.appendChild(d);chatBox.scrollTop=chatBox.scrollHeight;return d}
async function send(text=input.value.trim(),approved=false){if(!text)return;input.value='';add(text,'u');const d=add('Přemýšlím…','a');try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,approve:approved})});const j=await r.json();d.textContent=j.reply||j.error||'Chyba';speak(j.reply||'')}catch(e){d.textContent='JARVIS backend není dostupný: '+e.message}}
function speak(t){if(!t||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='cs-CZ';u.rate=.98;u.pitch=.9;speechSynthesis.speak(u)}
document.getElementById('send').onclick=()=>send();input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null,active=false;if(SR){rec=new SR();rec.lang='cs-CZ';rec.interimResults=false;rec.continuous=true;rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const text=e.results[i][0].transcript.trim();const lower=text.toLowerCase();const pos=lower.indexOf(WAKE);if(pos>=0){const command=text.slice(pos+WAKE.length).trim();if(!command){speak('Ano, co se děje?');continue}send(command)}}};rec.onend=()=>{if(active){try{rec.start()}catch{}}};document.getElementById('mic').onclick=()=>{active=!active;if(active){rec.start();speak('Poslouchám.')}else rec.stop()}}else document.getElementById('mic').disabled=true;
auto.onclick=async()=>{const on=auto.textContent.includes('OFF');const r=await fetch('/autonomy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:on})});const j=await r.json();auto.textContent='AUTONOMY: '+(j.autonomy?'ON':'OFF')};
fetch('/state').then(r=>r.json()).then(s=>{model.textContent=s.model||'';auto.textContent='AUTONOMY: '+(s.autonomy?'ON':'OFF');add('${NAME} online. Řekni mi, co chceš udělat.','a')});
</script></body></html>`;

async function handle(req,res){const u=new URL(req.url,`http://${HOST}:${PORT}`);try{
 if(req.method==='GET'&&u.pathname==='/')return text(res,200,html,'text/html; charset=utf-8');
 if(req.method==='GET'&&u.pathname==='/health')return json(res,200,{ok:true,service:NAME,model:MODEL,ollama:OLLAMA_URL,policy:POLICY,projectRoot:PROJECT_ROOT,autonomy:state.autonomy,busy:state.busy,activeTask:state.activeTask});
 if(req.method==='GET'&&u.pathname==='/state')return json(res,200,{...state,name:NAME,model:MODEL,policy:POLICY});
 if(req.method==='GET'&&u.pathname==='/pc')return json(res,200,await inspectPc());
 if(req.method==='POST'&&u.pathname==='/chat'){const b=await body(req);if(!b.message)return json(res,400,{error:'message required'});return json(res,200,await chat(String(b.message),Boolean(b.approve)));}
 if(req.method==='POST'&&u.pathname==='/autonomy'){const b=await body(req);state.autonomy=Boolean(b.enabled);if(state.autonomy&&!autonomyTimer){autonomyTimer=setInterval(()=>void autonomyTick(),Number(process.env.JARVIS_AUTONOMY_INTERVAL_MS||30000));void autonomyTick()}if(!state.autonomy&&autonomyTimer){clearInterval(autonomyTimer);autonomyTimer=null}await saveState();return json(res,200,{ok:true,autonomy:state.autonomy});}
 return json(res,404,{error:'not found'});
}catch(e){return json(res,500,{error:e.message})}}

await loadState();
http.createServer(handle).listen(PORT,HOST,()=>console.log(`[${NAME}] Online at http://${HOST}:${PORT} | model=${MODEL} | policy=${POLICY}`));
