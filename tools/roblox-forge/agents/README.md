# ROBLOX FORGE Agent Layer

Forge is agent-agnostic. The desktop shell can host multiple coding agents while every agent uses the same Forge control plane, project rules, MCP tools and safety policy.

## Current agent adapters

The registry currently supports:

- **OpenCode** — preferred general-purpose local agent when installed; supports role routing and local MCP.
- **Claude Code** — supported when the CLI is installed and authenticated.
- **Codex CLI** — supported when the CLI is installed and authenticated.

Availability is detected at runtime. Forge never assumes that a particular vendor CLI is installed or that a free quota exists.

> **Important:** older Forge prototypes referenced Gemini CLI as a free personal agent. That documentation is obsolete and has been removed. Do not rely on old Gemini CLI installation instructions.

## Agent architecture

```text
                         ROBLOX FORGE
                              │
                      Agent Control API
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          OpenCode       Claude Code       Codex CLI
             │                │                │
             └────────────────┼────────────────┘
                              │
                             MCP
                              │
                     Forge Control Plane
                              │
          Project / Studio / Git / Tests / Memory
```

The agent is not the platform. It is replaceable compute. Adding or removing an agent should not require changing the WORLDSHIFT project model.

## Roles

- `architect` — design before implementation.
- `coder` — implement an approved plan.
- `reviewer` — inspect for regressions, security and maintainability.
- `researcher` — research current documentation and compare approaches.
- `tester` — run diagnostics/tests and reproduce failures.

## Safety

The default policy is `supervised`. Destructive or broad changes should require explicit approval. Keep agent permissions least-privilege and prefer Forge/MCP tools over arbitrary shell access.

## Roadmap

- Agent capability detection and health checks
- Desktop AI Team panel
- Agent profiles and model preferences
- Fallback routing
- Task queue with resumable jobs
- Plan/implement/verify modes
- Git worktree isolation for risky changes
- Plugin-provided agent adapters
