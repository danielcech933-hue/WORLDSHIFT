import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const DESKTOP_DIR = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'jarvis-config.json');
const PORT = 43119;
const WORKER_PORT = 43120;
let projectRoot = null;
let backend = null;
let worker = null;
let windowRef = null;

async function exists(p){try{await fs.access(p);return true}catch{return false}}
async function validProject(root){return Boolean(root)&&await exists(path.join(root,'default.project.json'))&&await exists(path.join(root,'tools','roblox-forge','jarvis-backend-v2.mjs'))}
async function findProjectInside(root,depth=5){if(!root||depth<0)return null;if(await validProject(root))return path.normalize(root);if(!depth)return null;let entries;try{entries=await fs.readdir(root,{withFileTypes:true})}catch{return null}const dirs=entries.filter(e=>e.isDirectory()&&!e.name.startsWith('.')&&!['node_modules','dist'].includes(e.name));dirs.sort((a,b)=>(a.name.toLowerCase()==='worldshift'?-1:1)-(b.name.toLowerCase()==='worldshift'?-1:1));for(const e of dirs){const found=await findProjectInside(path.join(root,e.name),depth-1);if(found)return found}return null}
async function findProject(){const home=os.homedir();for(const root of [path.join(home,'Desktop'),path.join(home,'Documents'),process.cwd()]){const found=await findProjectInside(root,5);if(found)return found}return null}
async function loadProject(){try{const c=JSON.parse(await fs.readFile(CONFIG_FILE,'utf8'));if(await validProject(c.projectRoot))projectRoot=path.normalize(c.projectRoot)}catch{}if(!projectRoot)projectRoot=await findProject();if(projectRoot)await saveProject()}
async function saveProject(){await fs.mkdir(USER_DATA,{recursive:true});await fs.writeFile(CONFIG_FILE,JSON.stringify({projectRoot},null,2),'utf8')}
function startNode(script){const env={...process.env,FORGE_PROJECT_ROOT:projectRoot,JARVIS_PORT:String(PORT),JARVIS_WORKER_PORT:String(WORKER_PORT),JARVIS_POLICY:process.env.JARVIS_POLICY||'supervised'};const child=spawn(process.execPath,[script],{cwd:projectRoot,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>console.log(`[JARVIS] ${String(d).trimEnd()}`));child.stderr.on('data',d=>console.error(`[JARVIS] ${String(d).trimEnd()}`));return child}
async function waitHttp(url,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){try{const r=await fetch(url);if(r.ok)return true}catch{}await new Promise(r=>setTimeout(r,250))}return false}
async function ensureRuntime(){if(!projectRoot)throw new Error('WORLDSHIFT project was not found.');if(!backend||backend.exitCode!==undefined)backend=startNode(path.join(projectRoot,'tools','roblox-forge','jarvis-backend-v2.mjs'));const backendOk=await waitHttp(`http://127.0.0.1:${PORT}/health`);if(!backendOk)throw new Error('JARVIS backend did not become ready. Is Ollama running?');if(!worker||worker.exitCode!==undefined)worker=startNode(path.join(projectRoot,'tools','roblox-forge','jarvis-autonomous-worker.mjs'));const workerOk=await waitHttp(`http://127.0.0.1:${WORKER_PORT}/health`);return{backend:backendOk,worker:workerOk,projectRoot}}
async function chooseProject(){const result=await dialog.showOpenDialog(windowRef,{title:'Vyber projekt pro JARVISE',defaultPath:path.join(os.homedir(),'Desktop'),buttonLabel:'PŘIPOJIT PROJEKT',properties:['openDirectory']});if(result.canceled||!result.filePaths?.[0])return{ok:false,canceled:true};const found=await findProjectInside(path.normalize(result.filePaths[0]),6);if(!found){await dialog.showMessageBox(windowRef,{type:'error',title:'JARVIS — projekt nenalezen',message:'Vybraná složka neobsahuje platný WORLDSHIFT/ROBLOX FORGE projekt.'});return{ok:false}}stopRuntime();projectRoot=found;await saveProject();await ensureRuntime();return{ok:true,projectRoot}}
function stopRuntime(){for(const child of [backend,worker]){try{child?.kill()}catch{}}backend=null;worker=null}

ipcMain.handle('project-info',()=>({projectRoot}));
ipcMain.handle('choose-project',chooseProject);
ipcMain.handle('runtime-status',async()=>({backend:await waitHttp(`http://127.0.0.1:${PORT}/health`,1000),worker:await waitHttp(`http://127.0.0.1:${WORKER_PORT}/health`,1000),projectRoot}));
ipcMain.handle('jarvis-request',async(_event,{path:requestPath,body:requestBody})=>{
  const clean=String(requestPath||'');
  if(!/^\/(health|state|chat|autonomy|pc|tasks)(\/.*)?$/.test(clean)) throw new Error('Unsupported JARVIS endpoint.');
  const options={method:requestBody===undefined?'GET':'POST',headers:{'Content-Type':'application/json'}};
  if(requestBody!==undefined)options.body=JSON.stringify(requestBody);
  const response=await fetch(`http://127.0.0.1:${PORT}${clean}`,options);
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}};
  if(!response.ok)throw new Error(data.error||`JARVIS HTTP ${response.status}`);
  return data;
});

async function createWindow(){windowRef=new BrowserWindow({width:1280,height:820,minWidth:900,minHeight:600,title:'JARVIS',backgroundColor:'#05070b',webPreferences:{preload:path.join(DESKTOP_DIR,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});await windowRef.loadFile(path.join(DESKTOP_DIR,'index.html'));windowRef.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:'deny'}})}
app.whenReady().then(async()=>{await loadProject();try{await ensureRuntime()}catch(e){console.error(e.message)}await createWindow();if(!projectRoot)await dialog.showMessageBox(windowRef,{type:'warning',title:'JARVIS',message:'Projekt nebyl automaticky nalezen. Připoj ho z JARVIS nastavení.'})});
app.on('before-quit',stopRuntime);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
