import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.env.FORGE_PROJECT_ROOT || process.cwd();
const FORGE_ROOT = process.env.FORGE_FORGE_ROOT || path.join(PROJECT_ROOT, 'tools', 'roblox-forge');
const PORT = Number(process.env.FORGE_AGENT_PORT || 43118);
const HOST = process.env.FORGE_AGENT_HOST || '127.0.0.1';
const REGISTRY_PATH = process.env.FORGE_REGISTRY_PATH || path.join(FORGE_ROOT, 'agents', 'registry.json');
const DEFAULT_POLICY = process.env.FORGE_AGENT_POLICY || 'supervised';
const MAX_BODY_BYTES = 128 * 1024;
const RUN_TIMEOUT_MS = Number(process.env.FORGE_AGENT_TIMEOUT_MS || 20 * 60 * 1000);
const running = new Map();

async function readRegistry() { return JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8')); }
function commandExists(command) {
    return new Promise(resolve => {
        const checker = process.platform === 'win32' ? 'where.exe' : 'which';
        const child = spawn(checker, [command], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
        let output = '';
        child.stdout?.on('data', c => output += String(c));
        child.on('close', code => {
            if (code !== 0) return resolve(null);
            const matches = output.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
            if (!matches.length) return resolve(command);
            if (process.platform === 'win32') {
                const launcher = matches.find(x => /\.(cmd|bat|exe)$/i.test(x));
                return resolve(launcher || matches[0]);
            }
            resolve(matches[0]);
        });
        child.on('error', () => resolve(null));
    });
}
function discoverAgents() { return readRegistry().then(registry => Promise.all(registry.agents.map(async agent => { const executable = await commandExists(agent.command); return { ...agent, executable, available: Boolean(executable), running: [...running.values()].some(x => x.agent === agent.id) }; }))); }
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'http://127.0.0.1:43117','Access-Control-Allow-Headers':'content-type'});res.end(JSON.stringify(body,null,2));}
async function body(req){let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>MAX_BODY_BYTES)throw new Error('Request body too large.');chunks.push(chunk);}if(!chunks.length)return{};const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Request body must be a JSON object.');return parsed;}
function chooseAgent(agents,role,requested){if(requested){const match=agents.find(a=>a.id===requested&&a.available&&a.roles.includes(role));if(match)return match;throw new Error(`Requested agent '${requested}' is not available for role '${role}'.`);}return agents.filter(a=>a.available&&a.roles.includes(role)).sort((a,b)=>b.priority-a.priority)[0]||null;}
function spawnAgent(executable,args){
    if(process.platform !== 'win32' || !/\.(cmd|bat)$/i.test(executable)) {
        return spawn(executable,args,{cwd:PROJECT_ROOT,env:{...process.env},windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
    }
    // Do not manually concatenate/quote the command line. Node's Windows argv quoting
    // keeps the prompt as one argument; cmd.exe then invokes the .cmd launcher.
    return spawn('cmd.exe',['/d','/c','call',executable,...args],{cwd:PROJECT_ROOT,env:{...process.env},windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
}
function buildArgs(agent,prompt,role,policy){const roleHint=`You are the ${role} agent inside ROBLOX FORGE. Work in the connected project at ${PROJECT_ROOT}. ${prompt}`;const args=[...(agent.run?.argsPrefix||[])];if(agent.id==='opencode'){args.push('--agent',role==='reviewer'?'plan':'build');if(policy==='auto')args.push('--auto');}args.push(roleHint);return args;}
async function runAgent({role='coder',prompt,agentId,policy=DEFAULT_POLICY}){if(!prompt||typeof prompt!=='string')throw new Error('prompt is required');if(!['architect','coder','reviewer','researcher','tester'].includes(role))throw new Error(`Unsupported role '${role}'.`);const registry=await readRegistry();const agents=await Promise.all(registry.agents.map(async agent=>{const executable=await commandExists(agent.command);return {...agent,executable,available:Boolean(executable)};}));const agent=chooseAgent(agents,role,agentId);if(!agent)throw new Error(`No available agent for role '${role}'. Install/configure an agent or use a local model through OpenCode.`);const id=`${agent.id}-${Date.now()}`;const child=spawnAgent(agent.executable,buildArgs(agent,prompt,role,policy));running.set(id,{id,agent:agent.id,role,pid:child.pid||null,startedAt:new Date().toISOString(),child});let stdout='',stderr='';const append=(target,chunk,limit)=>(target+String(chunk)).slice(-limit);child.stdout?.on('data',c=>stdout=append(stdout,c,200000));child.stderr?.on('data',c=>stderr=append(stderr,c,100000));return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{try{child.kill();}catch{}running.delete(id);resolve({ok:false,id,agent:agent.id,role,code:null,signal:'TIMEOUT',stdout,stderr,error:'Agent timed out.'});},RUN_TIMEOUT_MS);child.on('error',e=>{clearTimeout(timer);running.delete(id);reject(e);});child.on('close',(code,signal)=>{clearTimeout(timer);running.delete(id);resolve({ok:code===0,id,agent:agent.id,role,code,signal,stdout,stderr});});});}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,`http://${req.headers.host||`${HOST}:${PORT}`}`);try{if(req.method==='OPTIONS')return json(res,204,{});if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,port:PORT,policy:DEFAULT_POLICY,projectRoot:PROJECT_ROOT,registryPath:REGISTRY_PATH,agents:await discoverAgents(),running:[...running.values()].map(({child,...item})=>item)});if(req.method==='GET'&&url.pathname==='/agents')return json(res,200,{ok:true,agents:await discoverAgents()});if(req.method==='POST'&&url.pathname==='/run')return json(res,200,await runAgent(await body(req)));if(req.method==='POST'&&url.pathname==='/stop'){const data=await body(req);const item=running.get(data.id);if(!item)return json(res,404,{ok:false,error:'run not found'});try{item.child.kill();}catch{}running.delete(data.id);return json(res,200,{ok:true,stopped:data.id});}return json(res,404,{ok:false,error:'not found'});}catch(error){return json(res,400,{ok:false,error:error.message});}});
readRegistry().then(()=>server.listen(PORT,HOST,()=>console.log(`[ROBLOX FORGE] Agent Orchestrator listening on http://${HOST}:${PORT}`))).catch(error=>{console.error(`[ROBLOX FORGE] Agent Orchestrator startup failed: ${error.message}`);process.exitCode=1;});