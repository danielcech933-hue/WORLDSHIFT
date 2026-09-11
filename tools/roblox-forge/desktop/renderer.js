const state = new Map();
let selected = 'forge';
let busy = false;

const labels = { forge: 'Forge Bridge', rojo: 'Rojo', codex: 'Codex CLI' };
const cards = document.getElementById('cards');
const log = document.getElementById('log');
const select = document.getElementById('logSelect');
const status = document.getElementById('status');
const projectPath = document.getElementById('projectPath');
const projectBadge = document.getElementById('projectBadge');
const chooseButton = document.getElementById('openFolder');
const startButton = document.getElementById('startStack');
const stopButton = document.getElementById('stopStack');
const resetButton = document.getElementById('resetProject');
const sendButton = document.getElementById('send');
const input = document.getElementById('input');

function setStatus(text, kind = '') {
  status.textContent = text;
  status.dataset.kind = kind;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function render(items) {
  items.forEach(item => state.set(item.id, item));
  cards.innerHTML = items.length ? items.map(item => `
    <article class="process panel ${item.running ? 'running' : ''}">
      <div class="process-top">
        <div><div class="eyebrow">PROCESS</div><h3>${escapeHtml(item.label)}</h3></div>
        <span class="dot"></span>
      </div>
      <div class="meta">${item.running ? `RUNNING · PID ${item.pid ?? '—'}` : 'STOPPED'}</div>
      <div class="buttons">
        <button data-start="${item.id}" ${item.running ? 'disabled' : ''}>START</button>
        <button data-stop="${item.id}" ${item.running ? '' : 'disabled'}>STOP</button>
        <button data-view="${item.id}">LOG</button>
      </div>
    </article>`).join('') : '<div class="empty panel">Vyber projekt WORLDSHIFT a Forge načte jeho nástroje.</div>';

  select.innerHTML = items.map(item => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join('');
  if (items.some(item => item.id === selected)) select.value = selected;
  else if (items[0]) selected = items[0].id;
  showLog(selected);
}

function showLog(id) {
  selected = id;
  if (select.options.length) select.value = id;
  log.textContent = state.get(id)?.log || 'Žádný výstup.';
  log.scrollTop = log.scrollHeight;
}

async function refresh() {
  try {
    const [items, project, info] = await Promise.all([
      window.forge.status(),
      window.forge.project(),
      window.forge.info(),
    ]);
    render(items);
    const pathValue = project.projectRoot;
    projectPath.textContent = pathValue || 'Projekt není vybrán.';
    projectBadge.textContent = pathValue ? 'PROJECT READY' : 'NO PROJECT';
    projectBadge.dataset.kind = pathValue ? 'ok' : 'warn';
    if (!busy) setStatus(pathValue ? `READY · v${info.version}` : 'VYBER PROJEKT', pathValue ? 'ok' : 'warn');
  } catch (error) {
    setStatus(`CHYBA: ${error.message}`, 'error');
  }
}

async function chooseProject() {
  if (busy) return;
  busy = true;
  chooseButton.disabled = true;
  setStatus('OTEVÍRÁM VÝBĚR PROJEKTU…');
  try {
    const result = await window.forge.chooseProject();
    if (result.ok) setStatus('PROJEKT PŘIPOJEN', 'ok');
    else if (result.invalid) setStatus('NEPLATNÁ SLOŽKA', 'error');
    else if (result.canceled) setStatus('VÝBĚR ZRUŠEN', 'warn');
  } catch (error) {
    setStatus(`CHYBA: ${error.message}`, 'error');
  } finally {
    busy = false;
    chooseButton.disabled = false;
    await refresh();
  }
}

async function runAction(action, message) {
  if (busy) return;
  busy = true;
  setStatus(message);
  try {
    await action();
  } catch (error) {
    setStatus(`CHYBA: ${error.message}`, 'error');
  } finally {
    busy = false;
    await refresh();
  }
}

cards.addEventListener('click', async event => {
  const start = event.target.dataset.start;
  const stop = event.target.dataset.stop;
  const view = event.target.dataset.view;
  if (view) showLog(view);
  if (start) await runAction(() => window.forge.start(start), `STARTING ${labels[start].toUpperCase()}…`);
  if (stop) await runAction(() => window.forge.stop(stop), `STOPPING ${labels[stop].toUpperCase()}…`);
});

startButton.onclick = () => runAction(() => window.forge.startStack(), 'STARTING DEV STACK…');
stopButton.onclick = () => runAction(() => window.forge.stopStack(), 'STOPPING ALL…');
chooseButton.onclick = chooseProject;
resetButton.onclick = async () => {
  if (!confirm('Opravdu odebrat uložený projekt z ROBLOX FORGE?')) return;
  await runAction(() => window.forge.resetProject(), 'RESETUJI PROJEKT…');
};
sendButton.onclick = async () => {
  const value = input.value;
  if (!value) return;
  try {
    await window.forge.input(selected, value.endsWith('\n') ? value : `${value}\n`);
    input.value = '';
  } catch (error) {
    setStatus(`CHYBA: ${error.message}`, 'error');
  }
};
input.addEventListener('keydown', event => { if (event.key === 'Enter') sendButton.click(); });
select.onchange = () => showLog(select.value);
window.forge.onLog(payload => {
  const item = state.get(payload.id) || { id: payload.id, label: labels[payload.id] || payload.id, running: true, log: '' };
  item.log = `${item.log || ''}${payload.text}`.slice(-50000);
  item.running = true;
  state.set(payload.id, item);
  if (payload.id === selected) showLog(selected);
});
window.forge.onExit(payload => {
  setStatus(`${labels[payload.id] || payload.id} stopped`, payload.error ? 'error' : 'warn');
  refresh();
});
window.forge.onError(payload => setStatus(`CHYBA APLIKACE: ${payload.message}`, 'error'));

refresh();
setInterval(refresh, 2500);
