const $ = (id) => document.getElementById(id);
let selectedProcess = null;

async function api(path, options = {}) {
  const response = await fetch(path, options);
  return response.json();
}

async function command(type, args = {}) {
  return api('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: crypto.randomUUID(), type, args })
  });
}

function renderProcesses(processes = []) {
  const root = $("processes");
  root.innerHTML = '';

  for (const process of processes) {
    const card = document.createElement('div');
    card.className = `process ${process.running ? 'running' : ''} ${selectedProcess === process.id ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="process-main">
        <div class="process-name">${process.label}</div>
        <div class="process-meta">${process.running ? `RUNNING · PID ${process.pid || '—'}` : 'STOPPED'}</div>
      </div>
      <div class="process-actions">
        <button data-action="log">LOG</button>
        ${process.running ? '<button data-action="stop">STOP</button>' : '<button data-action="start" class="primary">START</button>'}
      </div>`;

    card.addEventListener('click', async (event) => {
      const action = event.target?.dataset?.action;
      if (!action) return;
      if (action === 'start') await command('process_start', { id: process.id });
      if (action === 'stop') await command('process_stop', { id: process.id });
      if (action === 'log') selectedProcess = process.id;
      await refresh();
      renderLog(processes);
    });

    root.appendChild(card);
  }
}

function renderLog(processes = []) {
  const process = processes.find(item => item.id === selectedProcess);
  if (!process) {
    $("logTitle").textContent = 'Vyber proces';
    $("processLog").textContent = 'Klikni na LOG u Rojo nebo Codex.';
    $("processInputRow").classList.add('hidden');
    return;
  }
  $("logTitle").textContent = `${process.label} ${process.running ? '· RUNNING' : '· STOPPED'}`;
  $("processLog").textContent = process.log || 'Zatím žádný výstup.';
  $("processLog").scrollTop = $("processLog").scrollHeight;
  $("processInputRow").classList.toggle('hidden', !process.running);
}

function render(data) {
  $("bridge").textContent = data.bridge === "online" ? "● ONLINE" : "● OFFLINE";
  $("bridge").className = `status ${data.bridge === "online" ? "ok" : "bad"}`;
  $("bridgeState").textContent = data.bridge?.toUpperCase() || "—";
  $("githubState").textContent = data.github?.connected ? "CONNECTED" : "NOT CONFIGURED";
  $("studioState").textContent = data.lastStudioHeartbeat ? "CONNECTED" : "WAITING";
  $("heartbeat").textContent = data.lastStudioHeartbeat ? new Date(data.lastStudioHeartbeat).toLocaleTimeString() : "—";
  $("snapshot").textContent = data.lastStudioState ? JSON.stringify(data.lastStudioState, null, 2) : "Waiting for the Forge Studio plugin…";
  renderProcesses(data.processes || []);
  renderLog(data.processes || []);
}

async function refresh() {
  try {
    render(await api('/api/health'));
  } catch (error) {
    $("bridge").textContent = "● OFFLINE";
    $("bridge").className = 'status bad';
  }
}

$("startAll").onclick = async () => {
  for (const id of ['rojo', 'codex']) await command('process_start', { id });
  await refresh();
};

$("stopAll").onclick = async () => {
  for (const id of ['codex', 'rojo']) await command('process_stop', { id });
  await refresh();
};

$("ping").onclick = async () => {
  const data = await command('ping');
  $("result").textContent = JSON.stringify(data, null, 2);
  refresh();
};

$("sendInput").onclick = async () => {
  if (!selectedProcess) return;
  const input = $("processInput").value;
  if (!input) return;
  await command('process_input', { id: selectedProcess, input: input + '\n' });
  $("processInput").value = '';
  await refresh();
};

$("processInput").addEventListener('keydown', event => {
  if (event.key === 'Enter') $("sendInput").click();
});

$("send").onclick = async () => {
  try {
    const parsed = JSON.parse($("command").value);
    const data = await api('/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed)
    });
    $("result").textContent = JSON.stringify(data, null, 2);
    await refresh();
  } catch (error) {
    $("result").textContent = `ERROR: ${error.message}`;
  }
};

refresh();
setInterval(refresh, 1000);
