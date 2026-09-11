const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, options);
  return response.json();
}

function render(data) {
  $("bridge").textContent = data.bridge === "online" ? "● ONLINE" : "● OFFLINE";
  $("bridge").className = `status ${data.bridge === "online" ? "ok" : "bad"}`;
  $("bridgeState").textContent = data.bridge?.toUpperCase() || "—";
  $("githubState").textContent = data.github?.connected ? "CONNECTED" : "NOT CONFIGURED";
  $("studioState").textContent = data.lastStudioHeartbeat ? "CONNECTED" : "WAITING";
  $("heartbeat").textContent = data.lastStudioHeartbeat ? new Date(data.lastStudioHeartbeat).toLocaleTimeString() : "—";
  $("snapshot").textContent = data.lastStudioState ? JSON.stringify(data.lastStudioState, null, 2) : "Waiting for the Forge Studio plugin…";
}

async function refresh() {
  try { render(await api('/api/health')); }
  catch (error) { $("bridge").textContent = "● OFFLINE"; }
}

$("refresh").onclick = refresh;
$("ping").onclick = async () => {
  const data = await api('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: crypto.randomUUID(), type: 'ping' })
  });
  $("result").textContent = JSON.stringify(data, null, 2);
  refresh();
};

$("send").onclick = async () => {
  try {
    const command = JSON.parse($("command").value);
    const data = await api('/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(command)
    });
    $("result").textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    $("result").textContent = `ERROR: ${error.message}`;
  }
};

refresh();
setInterval(refresh, 2000);
