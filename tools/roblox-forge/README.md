# Roblox Forge

Roblox Forge is the local development control plane for AI-assisted Roblox projects.

## v0.1 goals

- Local Node.js bridge on `127.0.0.1:43117`
- Web control panel
- GitHub command inbox/outbox
- Roblox Studio plugin heartbeat
- Studio selection / active-script / workspace snapshot
- Explicit allowlist for executable commands
- Designed to grow into a reusable multi-project Roblox development platform

## Run

From the repository root:

```powershell
$env:FORGE_GITHUB_TOKEN = "YOUR_GITHUB_TOKEN"
$env:FORGE_GITHUB_REPO = "danielcech933-hue/WORLDSHIFT"
$env:FORGE_GITHUB_BRANCH = "main"
$env:FORGE_SECRET = "choose-a-local-secret"
node tools/roblox-forge/forge-server.mjs
```

Then open `http://127.0.0.1:43117`.

Do not commit a GitHub token. Use an environment variable or another local secret store.

## Studio bridge

`studio/ForgePlugin.server.lua` is the first Studio connector. Install it as a local Studio plugin while Forge is running. Roblox Studio plugins can communicate with localhost software through HTTP; Studio may ask for permission the first time.

The plugin sends a small state snapshot every two seconds. v0.1 intentionally does not execute arbitrary code or shell commands.

## GitHub command protocol

AI can place one approved command in:

`.forge/inbox/next-command.json`

Example:

```json
{
  "id": "example-001",
  "type": "ping"
}
```

Forge consumes the command and writes the result to:

`.forge/outbox/last-result.json`

Future versions will add signed commands, project isolation, Studio operations, test orchestration, visual capture, snapshots and rollback.
