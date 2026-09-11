# ROBLOX FORGE 1.0

ROBLOX FORGE is the local Windows development control plane for WORLDSHIFT. It replaces a wall of CMD windows with one desktop application.

## What the desktop app manages

- Forge Bridge on `127.0.0.1:43117`
- Rojo project sync
- Codex CLI (start/stop/log from the app)
- Roblox Studio bridge plugin
- project selection and persistent project memory
- live process logs
- start/stop development stack
- Studio bridge installation and heartbeat status
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

3. In `tools/roblox-forge/dist/` use either:
   - `ROBLOX-FORGE-1.0.0-x64.exe` for the portable version, or
   - the generated NSIS setup executable for an installed desktop shortcut.

## Daily workflow

1. Open **ROBLOX FORGE**.
2. Forge automatically looks for `Desktop\WORLDSHIFT\WORLDSHIFT` and remembers the last valid project.
3. If needed, click **VYBRAT PROJEKT** and select the WORLDSHIFT root.
4. Click **⚡ INSTALOVAT STUDIO BRIDGE** once after a fresh machine/plugin reset.
5. Click **▶ SPUSTIT DEV STACK**.
6. Work in Roblox Studio. Rojo and Forge run in the background; their output appears in Developer Console.
7. Use the process cards to start/stop individual tools when needed.

## Project validation

Forge accepts a project only when the selected folder contains:

- `default.project.json`
- `src/`
- `tools/roblox-forge/forge-server.mjs`

This prevents accidentally selecting the wrong directory.

## Studio bridge

The app can install `studio/ForgePlugin.server.lua` to:

`%LOCALAPPDATA%\Roblox\Plugins\RobloxForge.lua`

The plugin posts a state heartbeat to Forge every two seconds. The desktop app reports the bridge as connected when a recent heartbeat is available.

## Security model

Forge uses an explicit process allowlist. It does not expose an arbitrary shell-command textbox. The desktop UI can only control the known development processes and the approved Forge bridge operations.

Optional GitHub integration uses environment variables. Never commit a GitHub token.

## Web bridge

The local server can be opened at:

`http://127.0.0.1:43117`

Available core endpoints include `/api/health`, `/api/studio/state`, and `/api/command`.

## Uninstall Studio plugin

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\roblox-forge\uninstall.ps1
```
