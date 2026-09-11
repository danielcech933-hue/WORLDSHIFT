# ROBLOX FORGE 1.2

ROBLOX FORGE is the local Windows development control plane for WORLDSHIFT. It combines the desktop workspace, Forge bridge, Rojo sync, Studio bridge, MCP gateway and an agent-agnostic AI layer.

## What the desktop app manages

- Forge Bridge on `127.0.0.1:43117`
- Rojo project sync
- Roblox Studio bridge plugin and heartbeat
- project discovery and persistent project selection
- live process logs and development-stack controls
- MCP gateway for project/Studio operations
- agent orchestration with OpenCode, Claude Code and Codex when installed
- supervised agent roles: architect, coder, reviewer, researcher and tester
- GitHub command inbox/outbox through the Forge server

## First setup

1. From the repository root run:

```powershell
git pull
```

2. Build the Windows release:

```powershell
.\tools\roblox-forge\build-windows.bat
```

3. In `tools/roblox-forge/dist/` use the generated portable EXE or NSIS installer.

## Daily workflow

1. Open **ROBLOX FORGE**.
2. Forge automatically searches common Desktop/Documents locations for a valid WORLDSHIFT project and remembers the last valid project.
3. If needed, use **VYBRAT PROJEKT** and select the project root.
4. Install the **Studio Bridge** once after a fresh machine/plugin reset.
5. Start the **DEV STACK**. Forge and Rojo run in the background.
6. Open Roblox Studio and connect Rojo.
7. Use the Forge MCP/agent layer for supervised AI-assisted implementation, inspection and testing.

## Validation

The release workflow runs `npm run verify` before packaging. The verification step parses project JSON files and runs Node syntax checks over Forge `.mjs`/`.cjs` files.

Forge accepts a project only when the selected folder contains:

- `default.project.json`
- `src/`
- `tools/roblox-forge/forge-server.mjs`

## Studio bridge

The app can install `studio/ForgePlugin.server.lua` to:

`%LOCALAPPDATA%\Roblox\Plugins\RobloxForge.lua`

The plugin posts Studio state to Forge every two seconds. Roblox Studio plugins can communicate with local software through `localhost` / `127.0.0.1` when the required HTTP permission is granted.

## Agent layer

Forge is deliberately agent-agnostic. Agent CLIs are detected at runtime from the registry; Forge does not assume a vendor, model or free quota. See `agents/README.md` and `agents/registry.json` for the supported adapters and roles.

The default policy is **supervised**. Sensitive or destructive operations should require explicit approval.

## Security model

Forge uses explicit process/tool allowlists, a project-root sandbox for file operations, optimistic concurrency for project writes, bounded request bodies and a local-only default network binding. It does not expose an arbitrary shell textbox.

Never commit API tokens or credentials.

## MCP / ChatGPT

MCP is the canonical integration boundary. Local agents can use stdio MCP directly. ChatGPT custom MCP apps require the supported developer-mode/app setup; ChatGPT does not directly connect to an arbitrary localhost MCP server, so a secure tunnel or supported remote deployment is required when connecting ChatGPT itself.

## Local bridge

The Forge server runs at:

`http://127.0.0.1:43117`

Core endpoints include `/api/health`, `/api/studio/state`, `/api/project`, `/api/project/file/read`, `/api/project/file/write` and `/api/command`.

## Uninstall Studio plugin

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\roblox-forge\uninstall.ps1
```
