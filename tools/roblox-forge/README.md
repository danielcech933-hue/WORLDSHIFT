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

## Quick install (Windows)

From the repository root, after `git pull`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\roblox-forge\install.ps1
```

The installer copies the Forge Studio plugin into Roblox Studio's local Plugins folder and checks that Node.js is available. Roblox documents local plugins and the local Plugins directory in the Studio plugin documentation. urlRoblox Studio plugin documentationhttps://create.roblox.com/docs/studio/plugins

Then restart Roblox Studio once so the local plugin loads cleanly.

## Start Forge

From the repository root:

```powershell
node tools/roblox-forge/forge-server.mjs
```

Then open `http://127.0.0.1:43117`.

Optional GitHub configuration:

```powershell
$env:FORGE_GITHUB_TOKEN = "YOUR_GITHUB_TOKEN"
$env:FORGE_GITHUB_REPO = "danielcech933-hue/WORLDSHIFT"
$env:FORGE_GITHUB_BRANCH = "main"
$env:FORGE_SECRET = "choose-a-local-secret"
node tools/roblox-forge/forge-server.mjs
```

Do not commit a GitHub token. Use an environment variable or another local secret store.

## Studio bridge

`studio/ForgePlugin.server.lua` is the first Studio connector. The Windows installer copies it to `%LOCALAPPDATA%\Roblox\Plugins\RobloxForge.lua`.

The plugin sends a small state snapshot every two seconds. v0.1 intentionally does not execute arbitrary code or shell commands.

## Uninstall

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\roblox-forge\uninstall.ps1
```

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
