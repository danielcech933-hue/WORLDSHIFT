# ROBLOX FORGE — AI-Native Architecture

## Goal

Forge is not a launcher around Roblox Studio. It is the local development control plane for AI-assisted Roblox development.

```text
                         HUMAN / CHATGPT
                               │
                    ┌──────────▼──────────┐
                    │    AI ORCHESTRATOR  │
                    │ roles · routing     │
                    │ approvals · memory  │
                    └──────┬───────┬──────┘
                           │       │
              ┌────────────┘       └─────────────┐
              ▼                                  ▼
       OpenCode / Claude /                 other agents
       Codex / local models                    │
              │                                  │
              └──────────────┬───────────────────┘
                             ▼
                    ┌─────────────────────┐
                    │     FORGE CONTROL   │
                    │ MCP · policy · Git  │
                    │ diagnostics · tasks │
                    └───────┬───────┬─────┘
                            │       │
                 ┌──────────▼───┐ ┌─▼────────────┐
                 │ Project Core │ │ Plugin Host  │
                 │ files · git  │ │ capabilities │
                 └──────┬───────┘ └──────┬───────┘
                        │                │
                 ┌──────▼────────────────▼──────┐
                 │       Studio Bridge          │
                 │ state · selection · scene   │
                 │ output · playtest · actions  │
                 └────────────────┬─────────────┘
                                  │
                           Roblox Studio
```

## Multi-agent loop

```text
OBSERVE → PLAN → REVIEW PLAN → APPROVE → IMPLEMENT
   ↑                                         ↓
VERIFY ← TEST ← INSPECT ← BUILD ←────────────┘
```

Agents are replaceable workers. The orchestrator chooses the best available worker for each role instead of coupling Forge to one vendor or model.

## Agent roles

- `architect` — system design and dependency boundaries
- `coder` — implementation
- `reviewer` — correctness, security and maintainability review
- `researcher` — current documentation and technical comparison
- `tester` — diagnostics, tests and regression reproduction

## Core resources

- project manifest and architecture
- source files
- Git history and diffs
- Studio state snapshot
- active selection
- active script
- Output/errors
- running processes
- playtest state
- performance metrics
- Forge/plugin health
- persistent project decisions

## Write safety

All AI writes use optimistic concurrency (`expectedSha256`) so an edit cannot silently overwrite a newer human change. Destructive operations must be explicit and auditable.

## Plugin and skill system

Plugins extend Forge through declared capabilities. The plugin registry lives in `plugins/registry.json`. GitHub is a distribution channel, not an implicit trust boundary: manifests, integrity hashes and permissions must be verified before activation.

Agent skills are project resources. OpenCode agents and Gemini-compatible skills can live in the repository so the development team shares the same specialized knowledge.

## Self-improvement

Forge core should remain small and stable. Fast-moving features belong in plugins, agents and skills. This means adding a new AI tool, inspector, generator or workflow does not require replacing the entire Forge executable.

Core updates are reserved for security, runtime, protocol and compatibility changes.

## Roblox Cloud

Forge is designed to grow into a CI/CD layer using Roblox Open Cloud. Publishing and other cloud operations should use scoped API keys or OAuth, with production writes behind approval. Roblox's Place Publishing API supports automated publishing of existing places and is suitable for a controlled release pipeline.

## ChatGPT connectivity

MCP is the canonical AI integration layer. Local stdio MCP is ideal for local agent hosts. ChatGPT cannot directly connect to arbitrary localhost MCP servers; supported OpenAI products require a supported MCP/app connection or secure tunnel. Forge therefore keeps its local MCP gateway independent of any single ChatGPT capability.

## Security boundaries

1. Bind local Forge to `127.0.0.1` by default.
2. Require a Forge secret when remote access is enabled.
3. Keep project paths sandboxed.
4. Never expose arbitrary shell execution as a generic AI tool.
5. Give plugins and agents least-privilege capabilities.
6. Record write operations and their originating tool/plugin.
7. Require explicit confirmation for destructive operations.
8. Verify downloaded plugin integrity before activation.
