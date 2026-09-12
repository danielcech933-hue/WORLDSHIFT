import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const PORT = Number(process.env.JARVIS_PORT || 43119);
const HOST = process.env.JARVIS_HOST || '127.0.0.1';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.JARVIS_MODEL || 'qwen2.5-coder:7b';
const POLICY = process.env.JARVIS_POLICY || 'supervised';
const STATE_FILE = path.join(PROJECT_ROOT, '.forge-runtime', 'jarvis-state.json');
const MAX_BODY = 2 * 1024 * 1024;

let state = { online: true, autonomy: false, busy: false, lastUser: '', lastReply: '', history: [], updatedAt: null };
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
  return getJson(`${OLLAMA_URL}/api/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model: MODEL, messages, stream:false, options:{ temperature: options.temperature ?? 0.2 }, keep_alive:'10m' }) });
}

async function webSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers:{ 'User-Agent':'ROBLOX-FORGE-JARVIS/1.0' } });
  const html = await r.text();
  const results=[];
  const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m; while((m=re.exec(html)) && results.length<8){ results.push({ url:m[1], title:m[2].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&') }); }
  return results;
}

async function tool(name, args={}) {
  if(name==='forge_health') return forge('/api/health');
  if(name==='studio_state') return forge('/api/studio/state');
  if(name==='diagnostics') return forge('/api/diagnostics');
  if(name==='project_file') { const file=safePath(args.path); return { path:args.path, content:await fs.readFile(file,'utf8') }; }
  if(name==='write_file') {
    if(POLICY!=='autonomous' && args.approved!==true) return { needsApproval:true, path:args.path, message:'Writing files requires approval in supervised mode.' };
    const file=safePath(args.path); await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,String(args.content||''),'utf8'); return { ok:true, path:args.path }; }
  if(name==='search_web') return webSearch(String(args.query||''));
  if(name==='git_status') return new Promise((resolve,reject)=>spawn('git',['status','--short'],{cwd:PROJECT_ROOT,windowsHide:true,shell:false},).stdout.on('data',d=>resolve({output:String(d)})));
  if(name==='agent_run') return getJson('http://127.0.0.1:43118/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:args.role||'coder',agentId:args.agentId||'codex',prompt:String(args.prompt||''),policy:'supervised'})});
  throw new Error(`Unknown tool: ${name}`);
}

const SYSTEM = `You are JARVIS, the local AI development assistant for the WORLDSHIFT Roblox project. Speak Czech unless the user speaks another language. Be concise but useful. You have tools exposed by the local Forge backend. Never claim an action succeeded unless the tool result confirms it. Prefer inspecting the project and Studio before making assumptions. In supervised mode, file writes require explicit approval. You are allowed to search the public web when current information is needed. Your goal is to autonomously develop, test and improve WORLDSHIFT while keeping the human as creative director.`;
const TOOL_SCHEMA = [
  {type:'function',function:{name:'forge_health',description:'Get Forge bridge health.',parameters:{type:'object',properties:{},additionalProperties:false}}},
  {type:'function',function:{name:'studio_state',description:'Inspect current Roblox Studio state, heartbeat, selection and workspace snapshot.',parameters:{type:'object',properties:{},additionalProperties:false}}},
  {type:'function',function:{name:'diagnostics',description:'Get Forge diagnostics for Node, Rojo, Git, Studio and agents.',parameters:{type:'object',properties:{},additionalProperties:false}}},
  {type:'function',function:{name:'project_file',description:'Read a UTF-8 project file. Use relative paths only.',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}},
  {type:'function',function:{name:'write_file',description:'Write a UTF-8 project file. In supervised mode this returns a pending approval unless approved=true.',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'},approved:{type:'boolean'}},required:['path','content'],additionalProperties:false}}},
  {type:'function',function:{name:'search_web',description:'Search the public web for current information.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}},
  {type:'function',function:{name:'git_status',description:'Read current Git status.',parameters:{type:'object',properties:{},additionalProperties:false}}},
  {type:'function',function:{name:'agent_run',description:'Ask the existing Forge agent orchestrator to perform a coding task. Use only when explicitly requested or when supervised approval has been granted.',parameters:{type:'object',properties:{prompt:{type:'string'},role:{type:'string'},agentId:{type:'string'}},required:['prompt'],additionalProperties:false}}}
];

async function chat(message, approve=false) {
  const messages=[{role:'system',content:SYSTEM},...state.history.slice(-12),{role:'user',content:message}];
  let response=await ollama(messages,{temperature:0.15});
  let msg=response.message||{role:'assistant',content:''};
  for(let round=0;round<8;round++){
    const calls=msg.tool_calls||[]; if(!calls.length) break;
    messages.push(msg);
    for(const call of calls){
      const name=call.function?.name; let args={}; try{args=JSON.parse(call.function?.arguments||'{}')}catch{}
      if(approve && name==='write_file') args.approved=true;
      let result; try{result=await tool(name,args)}catch(e){result={error:e.message};}
      messages.push({role:'tool',content:JSON.stringify(result),tool_name:name});
    }
    response=await ollama(messages,{temperature:0.1}); msg=response.message||{role:'assistant',content:''};
  }
  const reply=String(msg.content||'Nemám odpověď.');
  state.lastUser=message; state.lastReply=reply; state.history.push({role:'user',content:message},{role:'assistant',content:reply}); state.history=state.history.slice(-20); await saveState();
  return {reply,model:MODEL,autonomy:state.autonomy};
}

async function autonomyTick() {
  if(!state.autonomy || state.busy) return;
  state.busy=true; await saveState();
  try {
    const snapshot=await Promise.allSettled([forge('/api/health'),forge('/api/studio/state'),forge('/api/diagnostics')]);
    const prompt=`Autonomous development cycle. Inspect current WORLDSHIFT state and choose ONE safe, concrete next engineering task. If there is nothing useful to do, say so. Do not invent state. In supervised mode, prepare changes but do not write files without approval. Current runtime snapshot: ${JSON.stringify(snapshot.map(x=>x.status==='fulfilled'?x.value:{error:String(x.reason)}))}`;
    const result=await chat(prompt,false); console.log(`[JARVIS] ${result.reply}`);
  }catch(e){ console.error(`[JARVIS] autonomy error: ${e.message}`); } finally { state.busy=false; await saveState(); }
}

const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JARVIS — ROBLOX FORGE</title><style>body{margin:0;background:#070a10;color:#e8edf7;font:15px system-ui,Segoe UI,sans-serif}main{max-width:1100px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;align-items:center}.orb{width:14px;height:14px;border-radius:50%;background:#35d07f;box-shadow:0 0 18px #35d07f}.chat{height:62vh;overflow:auto;border:1px solid #1c2635;border-radius:18px;padding:18px;background:#0b1018}.msg{margin:10px 0;padding:12px 15px;border-radius:14px;max-width:80%;white-space:pre-wrap}.u{margin-left:auto;background:#162338}.a{background:#101923}.bar{display:flex;gap:10px;margin-top:14px}.bar textarea{flex:1;resize:none;height:58px;background:#0b1018;color:white;border:1px solid #273346;border-radius:14px;padding:12px}.btn{border:0;border-radius:14px;padding:0 18px;background:#e8edf7;color:#071018;font-weight:700;cursor:pointer}.mic{background:#1a2738;color:white}.status{opacity:.7;font-size:13px}</style></head><body><main><div class="top"><div><h1>JARVIS</h1><div class="status"><span class="orb" style="display:inline-block"></span> LOCAL AI • WORLDSHIFT • <span id="model"></span></div></div><button class="btn" id="auto">AUTONOMY: OFF</button></div><div id="chat" class="chat"></div><div class="bar"><textarea id="input" placeholder="Řekni JARVISovi, co má udělat..."></textarea><button class="btn mic" id="mic">🎙️</button><button class="btn" id="send">ODESLAT</button></div><p class="status">Hlas používá Web Speech API; dostupnost rozpoznávání závisí na prohlížeči. Odpovědi může JARVIS číst nahlas.</p></main><script>
const chatBox=document.getElementById('chat'),input=document.getElementById('input'),model=document.getElementById('model'),auto=document.getElementById('auto');
function add(text,who){const d=document.createElement('div');d.className='msg '+who;d.textContent=text;chatBox.appendChild(d);chatBox.scrollTop=chatBox.scrollHeight;return d}
async function send(){const text=input.value.trim();if(!text)return;input.value='';add(text,'u');const d=add('Přemýšlím…','a');try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});const j=await r.json();d.textContent=j.reply||j.error||'Chyba';speak(j.reply||'');}catch(e){d.textContent='JARVIS backend není dostupný: '+e.message}}
function speak(t){if(!t||!('speechSynthesis' in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='cs-CZ';u.rate=.98;u.pitch=.9;speechSynthesis.speak(u)}
document.getElementById('send').onclick=send;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null;if(SR){rec=new SR();rec.lang='cs-CZ';rec.interimResults=false;rec.continuous=false;rec.onresult=e=>{input.value=e.results[0][0].transcript;send()};document.getElementById('mic').onclick=()=>rec.start()}else document.getElementById('mic').disabled=true;
auto.onclick=async()=>{const on=auto.textContent.includes('OFF');const r=await fetch('/autonomy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:on})});const j=await r.json();auto.textContent='AUTONOMY: '+(j.autonomy?'ON':'OFF')};
fetch('/state').then(r=>r.json()).then(s=>{model.textContent=s.model||'';auto.textContent='AUTONOMY: '+(s.autonomy?'ON':'OFF');add('JARVIS online. Řekni mi, co chceš udělat.','a')});
</script></body></html>`;

async function handle(req,res){const u=new URL(req.url,`http://${HOST}:${PORT}`);try{
  if(req.method==='GET'&&u.pathname==='/'){return text(res,200,html,'text/html; charset=utf-8')}
  if(req.method==='GET'&&u.pathname==='/health')return json(res,200,{ok:true,service:'JARVIS',model:MODEL,ollama:OLLAMA_URL,policy:POLICY,projectRoot,autonomy:state.autonomy,busy:state.busy});
  if(req.method==='GET'&&u.pathname==='/state')return json(res,200,{...state,model:MODEL,policy:POLICY});
  if(req.method==='POST'&&u.pathname==='/chat'){const b=await body(req);if(!b.message)return json(res,400,{error:'message required'});return json(res,200,await chat(String(b.message),Boolean(b.approve)))}
  if(req.method==='POST'&&u.pathname==='/autonomy'){const b=await body(req);state.autonomy=Boolean(b.enabled);if(state.autonomy&&!autonomyTimer){autonomyTimer=setInterval(()=>void autonomyTick(),Number(process.env.JARVIS_AUTONOMY_INTERVAL_MS||30000));void autonomyTick();}if(!state.autonomy&&autonomyTimer){clearInterval(autonomyTimer);autonomyTimer=null;}await saveState();return json(res,200,{ok:true,autonomy:state.autonomy})}
  if(req.method==='POST'&&u.pathname==='/speak')return json(res,200,{ok:true});
  return json(res,404,{error:'not found'});
}catch(e){return json(res,500,{error:e.message})}}

await loadState();
http.createServer(handle).listen(PORT,HOST,()=>console.log(`[JARVIS] Online at http://${HOST}:${PORT} | model=${MODEL} | policy=${POLICY}`));
