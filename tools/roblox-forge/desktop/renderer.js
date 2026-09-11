const state = new Map();
let selected = 'forge';
const labels = { forge: 'Forge Bridge', rojo: 'Rojo', codex: 'Codex CLI' };
const cards = document.getElementById('cards');
const log = document.getElementById('log');
const select = document.getElementById('logSelect');
const status = document.getElementById('status');
const projectPath = document.getElementById('projectPath');
function render(items) { items.forEach(item => state.set(item.id, item)); cards.innerHTML = items.map(item => `<article class="process panel ${item.running ? 'running' : ''}"><div class="process-top"><div><div class="eyebrow">PROCESS</div><h3>${item.label}</h3></div><span class="dot"></span></div><div class="meta">${item.running ? `RUNNING · PID ${item.pid ?? '—'}` : 'STOPPED'}</div><div class="buttons"><button data-start="${item.id}">START</button><button data-stop="${item.id}">STOP</button><button data-view="${item.id}">LOG</button></div></article>`).join(''); select.innerHTML = items.map(item => `<option value="${item.id}">${item.label}</option>`).join(''); select.value = selected; showLog(selected); }
function showLog(id) { selected = id; if (select.options.length) select.value = id; log.textContent = state.get(id)?.log || 'No output yet.'; log.scrollTop = log.scrollHeight; }
async function refresh() { render(await window.forge.status()); const project = await window.forge.project(); projectPath.textContent = project.projectRoot ? `PROJECT: ${project.projectRoot}` : 'Projekt není vybrán.'; status.textContent = 'SYSTEM READY'; }
cards.addEventListener('click', async e => { const start = e.target.dataset.start, stop = e.target.dataset.stop, view = e.target.dataset.view; if (view) showLog(view); if (start) { status.textContent = `STARTING ${labels[start].toUpperCase()}…`; try { await window.forge.start(start); } catch (err) { status.textContent = err.message; } await refresh(); } if (stop) { status.textContent = `STOPPING ${labels[stop].toUpperCase()}…`; await window.forge.stop(stop); await refresh(); } });
document.getElementById('startStack').onclick = async () => { status.textContent = 'STARTING DEV STACK…'; try { await window.forge.startStack(); } catch (err) { status.textContent = err.message; } await refresh(); };
document.getElementById('stopStack').onclick = async () => { status.textContent = 'STOPPING ALL…'; await window.forge.stopStack(); await refresh(); };
document.getElementById('openFolder').onclick = async () => { await window.forge.chooseProject(); await refresh(); };
select.onchange = () => showLog(select.value);
document.getElementById('send').onclick = async () => { const value = document.getElementById('input').value; if (!value) return; try { await window.forge.input(selected, value.endsWith('\n') ? value : value + '\n'); } catch (err) { status.textContent = err.message; } document.getElementById('input').value = ''; };
document.getElementById('input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('send').click(); });
window.forge.onLog(payload => { const item = state.get(payload.id) || { id: payload.id, label: labels[payload.id], running: true, log: '' }; item.log = (item.log || '') + payload.text; state.set(payload.id, item); if (payload.id === selected) showLog(selected); });
window.forge.onExit(payload => { status.textContent = `${labels[payload.id] || payload.id} stopped`; refresh(); });
refresh(); setInterval(refresh, 2000);
