import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';

const APP_ID = 'com.robloxforge.desktop';
const DESKTOP_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'forge-config.json');
const MEMORY_FILE = () => path.join(app.getPath('userData'), 'forge-workspace.json');
const children = new Map();
let projectRoot = null;
let mainWindow = null;

app.setAppUserModelId(APP_ID);

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function requirePath(root, ...parts) { return exists(path.join(root, ...parts)); }
async function isValidProject(root) {
  return Boolean(root) && await requirePath(root, 'default.project.json') && await requirePath(root, 'src') && await requirePath(root, 'tools', 'roblox-forge', 'forge-server.mjs');
}
async function findProjectInside(root, maxDepth = 4) {
  if (!root || maxDepth < 0) return null;
  if (await isValidProject(root)) return path.normalize(root);
  if (maxDepth === 0) return null;
  let entries; try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return null; }
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist').sort((a,b) => (a.name.toLowerCase()==='worldshift'?0:1)-(b.name.toLowerCase()==='worldshift'?0:1) || a.name.localeCompare(b.name));
  for (const entry of dirs) { const found = await findProjectInside(path.join(root, entry.name), maxDepth - 1); if (found) return found; }
  return null;
}
async function findProject() {
  const home = os.homedir(); const oneDrive = process.env.OneDrive || process.env.OneDriveConsumer;
  const candidates = [path.join(home,'Desktop'), path.join(home,'OneDrive','Desktop'), oneDrive && path.join(oneDrive,'Desktop'), path.join(home,'Documents'), path.join(home,'OneDrive','Documents'), oneDrive && path.join(oneDrive,'Documents'), process.cwd()].filter(Boolean);
  for (const c of [...new Set(candidates.map(path.normalize))]) { const found = await findProjectInside(c); if (found) return found; }
  return null;
}
async function loadConfig() {
  try { const config = JSON.parse(await fs.readFile(CONFIG_FILE(),'utf8')); projectRoot = await findProjectInside(config.projectRoot, 2); } catch {}
  if (!projectRoot) projectRoot = await findProject();
  if (projectRoot) await saveConfig();
}
async function saveConfig() { await fs.mkdir(app.getPath('userData'),{recursive:true}); await fs.writeFile(CONFIG_FILE(),JSON.stringify({projectRoot},null,2),'utf8'); }
async function loadWorkspace() {
  try { return JSON.parse(await fs.readFile(MEMORY_FILE(),'utf8')); } catch { return { memory:'', tasks:[], decisions:[], updatedAt:null }; }
}
async function saveWorkspace(data) { data.updatedAt = new Date().toISOString(); await fs.mkdir(app.getPath('userData'),{recursive:true}); await fs.writeFile(MEMORY_FILE(),JSON.stringify(data,null,2),'utf8'); return data; }
function forgeServerPath(){ return path.join(projectRoot,'tools','roblox-forge','forge-server.mjs'); }
function rojoProjectPath(){ return path.join(projectRoot,'default.project.json'); }
function agentOrchestratorPath(){ return path.join(projectRoot,'tools','roblox-forge','agents','orchestrator.mjs'); }
function studioPluginSource(){ return path.join(projectRoot,'tools','roblox-forge','studio','ForgePlugin.server.lua'); }
function studioPluginTarget(){ return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),'Roblox','Plugins','RobloxForge.lua'); }
function findOnPath(command){ if(process.platform!=='win32') return null; try { const out=execFileSync('where.exe',[command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}); return out.split(/\r?\n/).map(x=>x.trim()).find(Boolean) || null; } catch { return null; } }
function isFile(p){ try{return fsSync.existsSync(p)&&fsSync.statSync(p).isFile();}catch{return false;} }
function resolveRojo(){ const explicit=process.env.ROJO_PATH?.trim(); if(explicit&&isFile(explicit)) return path.normalize(explicit); const found=findOnPath('rojo'); if(found)return found; const home=os.homedir(),local=process.env.LOCALAPPDATA||path.join(home,'AppData','Local'),roaming=process.env.APPDATA||path.join(home,'AppData','Roaming'); return [path.join('C:','Rojo','rojo.exe'),path.join('C:','Rojo','bin','rojo.exe'),path.join('C:','Program Files','Rojo','rojo.exe'),path.join(home,'.cargo','bin','rojo.exe'),path.join(home,'.aftman','bin','rojo.exe'),path.join(home,'.foreman','bin','rojo.exe'),path.join(roaming,'Aftman','bin','rojo.exe'),path.join(home,'scoop','shims','rojo.exe'),path.join(local,'Rojo','rojo.exe'),path.join(local,'Programs','Rojo','rojo.exe'),path.join(local,'Programs','Aftman','bin','rojo.exe'),...(projectRoot?[path.join(projectRoot,'.aftman','bin','rojo.exe'),path.join(projectRoot,'.foreman','bin','rojo.exe')]:[])].find(isFile)||null; }
function definitions(){ if(!projectRoot)return {}; return { forge:{label:'Forge Bridge',command:process.env.FORGE_NODE||'node',args:[forgeServerPath()]}, rojo:{label:'Rojo',command:resolveRojo()||'rojo',args:['serve',rojoProjectPath()]}, agents:{label:'AI Orchestrator',command:process.env.FORGE_NODE||'node',args:[agentOrchestratorPath()]}}; }
function send(channel,payload){ if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send(channel,payload); }
function start(id){
  if(!projectRoot)throw new Error('Nejdřív vyber projekt WORLDSHIFT.');
  if(children.has(id))return {ok:true,running:true,alreadyRunning:true,pid:children.get(id).entry.pid};
  const def=definitions()[id]; if(!def)throw new Error(`Neznámý proces: ${id}`);
  if(id==='rojo'&&!resolveRojo())throw new Error('Rojo nebyl nalezen. Nainstaluj Rojo nebo nastav ROJO_PATH.');
  if(id==='agents'&&!exists(agentOrchestratorPath()))throw new Error('AI Orchestrator nebyl nalezen.');
  const child=spawn(def.command,def.args,{cwd:projectRoot,env:{...process.env,FORCE_COLOR:'0'},windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  const entry={id,label:def.label,pid:child.pid??null,running:true,log:''}; children.set(id,{child,entry});
  const append=chunk=>{entry.log=(entry.log+String(chunk)).slice(-50000);send('process-log',{id,text:String(chunk)});};
  child.stdout?.on('data',append); child.stderr?.on('data',append);
  child.on('error',e=>{append(`[FORGE ERROR] ${e.message}\n`);entry.running=false;children.delete(id);send('process-exit',{id,code:null,signal:null,error:e.message});});
  child.on('exit',(code,signal)=>{entry.running=false;entry.exitCode=code;entry.signal=signal;children.delete(id);send('process-exit',{id,code,signal});});
  append(`[FORGE] Starting ${def.label} (PID ${child.pid??'unknown'})\n`); return {ok:true,running:true,pid:child.pid??null};
}
function stop(id){const item=children.get(id);if(!item)return{ok:true,running:false,alreadyStopped:true};try{item.child.kill();}catch{}children.delete(id);return{ok:true,running:false};}
function stopAll(){for(const id of [...children.keys()])stop(id);}
function status(){return Object.entries(definitions()).map(([id,def])=>{const item=children.get(id);return{id,label:def.label,running:Boolean(item),pid:item?.entry.pid??null,log:item?.entry.log??''};});}
async function chooseProject(){
  const result=await dialog.showOpenDialog(mainWindow,{title:'Vyber složku projektu WORLDSHIFT',defaultPath:projectRoot||path.join(os.homedir(),'Desktop'),buttonLabel:'PŘIPOJIT PROJEKT',properties:['openDirectory']});
  if(result.canceled||!result.filePaths?.[0])return{ok:false,canceled:true,projectRoot};
  const detected=await findProjectInside(path.normalize(result.filePaths[0]),5); if(!detected){await dialog.showMessageBox(mainWindow,{type:'error',title:'ROBLOX FORGE — projekt nenalezen',message:'V této složce jsem nenašel platný WORLDSHIFT projekt.',detail:'Vyber složku s default.project.json.'});return{ok:false,invalid:true,projectRoot};}
  stopAll();projectRoot=detected;await saveConfig();return{ok:true,projectRoot};
}
async function resetProject(){stopAll();projectRoot=null;try{await fs.rm(CONFIG_FILE(),{force:true});}catch{}return{ok:true,projectRoot:null};}
async function installStudioPlugin(){if(!projectRoot)throw new Error('Nejdřív vyber projekt WORLDSHIFT.');if(!(await exists(studioPluginSource())))throw new Error(`Studio plugin nebyl nalezen: ${studioPluginSource()}`);const target=studioPluginTarget();await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(studioPluginSource(),target);return{ok:true,target};}
async function forgeGet(pathname){const response=await fetch(`http://127.0.0.1:43117${pathname}`);const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={raw:text};}if(!response.ok)throw new Error(data.error||`Forge HTTP ${response.status}`);return data;}
async function studioHealth(){try{const data=await forgeGet('/api/studio/state');return{online:true,connected:Boolean(data.connected),heartbeat:data.heartbeat||null,studio:data.studio||null};}catch(error){return{online:false,connected:false,reason:error.message};}}
async function agentRequest(pathname,body){const response=await fetch(`http://127.0.0.1:43118${pathname}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={raw:text};}if(!response.ok)throw new Error(data.error||`Agent HTTP ${response.status}`);return data;}
async function agentGet(pathname){const response=await fetch(`http://127.0.0.1:43118${pathname}`);const data=await response.json();if(!response.ok)throw new Error(data.error||`Agent HTTP ${response.status}`);return data;}
async function ensureAgents(){if(!children.has('agents'))start('agents');await new Promise(r=>setTimeout(r,300));return agentGet('/agents');}
function createWindow(){
  mainWindow=new BrowserWindow({width:1400,height:900,minWidth:1100,minHeight:720,title:'ROBLOX FORGE',backgroundColor:'#070a10',show:false,webPreferences:{preload:path.join(DESKTOP_DIR,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.loadFile(path.join(DESKTOP_DIR,'index.html'));
  mainWindow.webContents.on('preload-error',(_e,p,error)=>send('app-error',{message:`Preload error: ${p}: ${error.message}`}));
  mainWindow.webContents.on('render-process-gone',(_e,d)=>send('app-error',{message:`Renderer ukončen: ${d.reason}`}));
  mainWindow.once('ready-to-show',()=>mainWindow.show());
}
ipcMain.handle('app-info',()=>({version:app.getVersion(),packaged:app.isPackaged,platform:process.platform}));
ipcMain.handle('project-get',()=>({projectRoot}));
ipcMain.handle('project-choose',chooseProject);ipcMain.handle('project-reset',resetProject);ipcMain.handle('studio-install',installStudioPlugin);ipcMain.handle('studio-health',studioHealth);ipcMain.handle('process-status',()=>status());
ipcMain.handle('process-start',(_e,id)=>start(id));ipcMain.handle('process-stop',(_e,id)=>stop(id));
ipcMain.handle('stack-start',()=>{if(!projectRoot)throw new Error('Nejdřív vyber projekt WORLDSHIFT.');const results={};for(const id of ['forge','rojo','agents']){try{results[id]=start(id);}catch(e){results[id]={ok:false,error:e.message};}}return{ok:true,results,processes:status()};});
ipcMain.handle('stack-stop',()=>{stopAll();return{ok:true,processes:status()};});
ipcMain.handle('process-input',(_e,id,input)=>{const item=children.get(id);if(!item?.child.stdin?.writable)throw new Error(`${id} neběží.`);item.child.stdin.write(String(input));return{ok:true};});
ipcMain.handle('open-folder',()=>projectRoot?shell.openPath(projectRoot):chooseProject());
ipcMain.handle('workspace-get',()=>loadWorkspace());
ipcMain.handle('workspace-save',(_e,data)=>saveWorkspace(data));
ipcMain.handle('diagnostics',async()=>{try{return await forgeGet('/api/diagnostics');}catch(error){return{ok:false,error:error.message};}});
ipcMain.handle('studio-state',async()=>{try{return await forgeGet('/api/studio/state');}catch(error){return{ok:false,error:error.message};}});
ipcMain.handle('agents-list',async()=>{try{return await ensureAgents();}catch(error){return{ok:false,error:error.message,agents:[]};}});
ipcMain.handle('agent-run',async(_e,payload)=>{if(!payload?.prompt)throw new Error('Zadej úkol pro AI.');await ensureAgents();return agentRequest('/run',{role:payload.role||'coder',prompt:payload.prompt,agentId:payload.agentId||undefined,policy:'supervised'});});
ipcMain.handle('agent-stop',(_e,id)=>agentRequest('/stop',{id}));
process.on('uncaughtException',error=>send('app-error',{message:error.message,stack:error.stack}));process.on('unhandledRejection',reason=>send('app-error',{message:String(reason)}));
app.whenReady().then(async()=>{await loadConfig();createWindow();});app.on('before-quit',stopAll);app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
