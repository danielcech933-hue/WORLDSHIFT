import process from 'node:process';

const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const models = process.argv.slice(2);
const selected = models.length ? models : [process.env.JARVIS_FAST_MODEL || 'qwen2.5-coder:3b', process.env.JARVIS_HEAVY_MODEL || 'qwen2.5-coder:7b'];
const prompt = 'In one short paragraph, explain how a Roblox server-authoritative inventory system should validate an item purchase.';

async function run(model) {
  const started = performance.now();
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.1, num_ctx: 2048 },
      keep_alive: '0',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  const elapsed = (performance.now() - started) / 1000;
  const evalCount = Number(data.eval_count || 0);
  const evalDuration = Number(data.eval_duration || 0) / 1e9;
  const promptCount = Number(data.prompt_eval_count || 0);
  const promptDuration = Number(data.prompt_eval_duration || 0) / 1e9;
  return {
    model,
    elapsed_s: Number(elapsed.toFixed(2)),
    output_tokens: evalCount,
    output_tok_s: evalDuration > 0 ? Number((evalCount / evalDuration).toFixed(2)) : null,
    prompt_tokens: promptCount,
    prompt_tok_s: promptDuration > 0 ? Number((promptCount / promptDuration).toFixed(2)) : null,
    response: String(data.message?.content || '').slice(0, 300),
  };
}

console.log(`[JARVIS] Ollama benchmark: ${base}`);
for (const model of selected) {
  try {
    console.log(JSON.stringify(await run(model)));
  } catch (error) {
    console.error(JSON.stringify({ model, error: error.message }));
  }
}
