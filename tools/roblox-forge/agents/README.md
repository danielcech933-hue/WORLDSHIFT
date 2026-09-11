# ROBLOX FORGE Agent Layer

Forge is agent-agnostic. The desktop shell can host multiple coding agents while every agent uses the same Forge control plane and project rules.

## Current agents

### Gemini CLI — primary free local agent

Gemini CLI is the first-class free agent integration. It supports MCP servers and headless/automation workflows, so it can connect directly to the local `roblox-forge` MCP server from the project workspace.

The repository includes `.gemini/settings.json` with the Forge MCP connection already configured.

Install:

```powershell
npm install -g @google/gemini-cli
```

Then run `gemini` once and authenticate with a personal Google account.

## Agent architecture

```text
                  ROBLOX FORGE
                       │
                Agent Control API
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Gemini CLI      Codex CLI     Future agents
        │              │              │
        └──────────────┼──────────────┘
                       │
                     MCP
                       │
                Forge Control Plane
                       │
       Project / Studio / Git / Tests / Memory
```

The agent is not the platform. It is replaceable compute. This means we can add or remove agents without rebuilding WORLDSHIFT or changing the Forge project model.

## Safety

Forge MCP keeps destructive operations explicit. The Gemini workspace uses normal approval mode by default. Do not enable YOLO mode for a shared or untrusted project unless you intentionally accept automatic tool execution.

## Roadmap

- Agent capability detection and health checks
- Agent profiles and model preferences
- Agent fallback routing
- Task queue with resumable jobs
- Plan/implement/verify modes
- Git worktree isolation for risky changes
- Plugin-provided agent adapters
