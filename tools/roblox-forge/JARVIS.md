# JARVIS — local AI assistant

JARVIS is designed to run locally so normal development does not require a paid AI API.

## First run

1. Install Ollama on the Windows PC.
2. Pull a local coding model, for example `ollama pull qwen2.5-coder:7b`.
3. Run `tools/roblox-forge/start-jarvis.bat`.
4. Open `http://127.0.0.1:43119`.
5. Allow microphone access when using the voice button.

## Modes

- `supervised` (default): JARVIS can inspect and reason, but file writes require approval.
- `autonomous`: JARVIS may perform its local development loop without asking for every file write. Keep this enabled only when you trust the selected model and project state.

Environment variables:

- `JARVIS_MODEL` — local Ollama model.
- `JARVIS_POLICY` — `supervised` or `autonomous`.
- `JARVIS_PORT` — default `43119`.
- `JARVIS_AUTONOMY_INTERVAL_MS` — default 30000.
- `OLLAMA_URL` — default `http://127.0.0.1:11434`.

## Free-first architecture

The local model is the primary worker. Roblox Forge, Studio Bridge, Rojo, Git, project files and web search are tools. ChatGPT remains the human-facing expert in the existing conversation; no OpenAI API key is required for this local JARVIS service.

## Safety

The backend is bound to `127.0.0.1` by default. Project file access is sandboxed to the WORLDSHIFT project root. Do not expose port 43119 publicly. Do not put API keys in Roblox, GitHub or frontend code.
