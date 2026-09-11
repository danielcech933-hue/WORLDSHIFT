const state = new Map();
let selected = 'forge';
const labels = { forge: 'Forge Bridge', rojo: 'Rojo', codex: 'Codex CLI' };
const cards = document.getElementById('cards');
const log = document.getElementById('log');
const select = document.getElementById('logSelect');
const status = document.getElementById('status');
const projectPath = document.getElementById('projectPath');

function setStatus(text) { status.textContent = text; }

function render(items) {
  items.forEach(item => state.set(item.id, item));
  cards.innerHTML = items.map(item => `<article class="process panel ${item.running ? 'running' : ''}"><div class="process-top"><div><div class="eyebrow">PROCESS</div><h3>${item.label}</h3></div><span class="dot"></span></div><div class="meta">${item.running ? `RUNNING · PID ${item.pid ?? '—'}` : 'STOPPED'}</div><div class="buttons"><button data-start="${item.id}">START</button><button data-stop="${item.id}">STOP</button><button data-view="${item.id}">LOG</button></div></article>`).join('');
  select.innerHTML = items.map(item => `<option value="${item.id}">${item.label}</option>`).join('');
  select.value = selected;
  showLog(selected);
}

function showLog(id) {
  selected = id;
  if (select.options.length) select.value = id;
  log.textContent = state.get(id)?.log || 'No output yet.';
  log.scrollTop = log.scrollHeight;
}

async function refresh() {
  try {
    render(await window.forge.status());
    const project = await window.forge.project();
    projectPath.textContent = project.projectRoot ? `PROJECT: ${project.projectRoot}` : 'Projekt není vybrán.';
  } catch (err) {
    setStatus(`CHYBA: ${err.message}`);
  }
}

cards.addEventListener('click', async e => {
  const start = e.target.dataset.start, stop = e.target.dataset.stop, view = e.target.dataset.view;
  if (view) showLog(view);
  if (start) { setStatus(`STARTING ${labels[start].toUpperCase()}…`); try { await window.forge.start(start); } catch (err) { setStatus(`CHYBA: ${err.message}`); } await refresh(); }
  if (stop) { setStatus(`STOPPING ${labels[stop].toUpperCase()}…`); try { await window.forge.stop(stop); } catch (err) { setStatus(`CHYBA: ${err.message}`); } await refresh(); }
});

document.getElementById('startStack').onclick = async () => { setStatus('STARTING DEV STACK…'); try { await window.forge.startStack(); } catch (err) { setStatus(`CHYBA: ${err.message}`); } await refresh(); };
document.getElementById('stopStack').onclick = async () => { setStatus('STOPPING ALL…'); try { await window.forge.stopStack(); } catch (err) { setStatus(`CHYBA: ${err.message}`); } await refresh(); };
document.getElementById('openFolder').onclick = async () => {
  setStatus('OTEVÍRÁM VÝBĚR PROJEKTU…');
  try {
    const result = await window.forge.chooseProject();
    if (result?.ok) setStatus('PROJEKT VYBRÁN');
    else if (result?.canceled) setStatus('VÝBĚR ZRUŠEN');
    else setStatus('PROJEKT NEBYL VYBRÁN');
  } catch (err) {
    setStatus(`CHYBA VÝBĚRU: ${err.message}`);
  }
  await refresh();
};
select.onchange = () => showLog(select.value);
document.getElementById('send').onclick = async () => { const value = document.getElementById('input').value; if (!value) return; try { await window.forge.input(selected, value.endsWith('\n') ? value : value + '\n'); } catch (err) { setStatus(`CHYBA: ${err.message}`); } document.getElementById('input').value = ''; };
document.getElementById('input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('send').click(); });
window.forge.onLog(payload => { const item = state.get(payload.id) || { id: payload.id, label: labels[payload.id], running: true, log: '' }; item.log = (item.log || '') + payload.text; state.set(payload.id, item); if (payload.id === selected) showLog(selected); });
window.forge.onExit(payload => { setStatus(`${labels[payload.id] || payload.id} stopped`); refresh(); });
refresh();
setInterval(refresh, 2000);
