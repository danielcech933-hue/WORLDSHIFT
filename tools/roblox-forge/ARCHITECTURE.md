# ROBLOX FORGE — AI-Native Architecture

## Goal

Forge is not a launcher around Roblox Studio. It is the local development control plane for AI-assisted Roblox development.

```text
                         AI / ChatGPT / Codex
                                  │
                          MCP / approved tools
                                  │
                    ┌─────────────▼─────────────┐
                    │       FORGE CONTROL       │
                    │ diagnostics · policy      │
                    │ memory · tasks · events   │
                    └───────┬─────────┬──────────┘
                            │         │
                 ┌──────────▼───┐ ┌──▼────────────┐
                 │ Project Core │ │ Plugin Host    │
                 │ files · git  │ │ capabilities  │
                 └──────┬───────┘ └──────┬────────┘
                        │                │
                 ┌──────▼────────────────▼──────┐
                 │       Studio Bridge          │
                 │ state · selection · scene   │
                 │ output · playtest · actions  │
                 └────────────────┬─────────────┘
                                  │
                           Roblox Studio
                                  │
                               WORLDSHIFT
```

## Agent loop

```text
OBSERVE → PLAN → PROPOSE → APPROVE → IMPLEMENT
   ↑                                      ↓
VERIFY ← TEST ← INSPECT ← BUILD ←─────────┘
```

The important part is that the model receives structured state rather than screenshots alone.

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

## Plugin system

Plugins extend Forge through declared capabilities. The plugin registry lives in `plugins/registry.json`. GitHub is a distribution channel, not an implicit trust boundary: manifests, integrity hashes and permissions must be verified before activation.

## Self-improvement

Forge core should remain small and stable. Fast-moving features belong in plugins. This means adding a new AI tool, inspector, generator or workflow does not require replacing the entire Forge executable.

Core updates are reserved for security, runtime, protocol and compatibility changes.

## ChatGPT connectivity

MCP is the canonical AI integration layer. Local stdio MCP is ideal for local agent hosts such as Codex. A future remote connection can use Streamable HTTP behind an authenticated tunnel. ChatGPT does not directly connect to arbitrary localhost MCP servers; supported OpenAI products require a supported MCP/app connection or secure tunnel.

## Security boundaries

1. Bind local Forge to `127.0.0.1` by default.
2. Require a Forge secret when remote access is enabled.
3. Keep project paths sandboxed.
4. Never expose arbitrary shell execution as a generic AI tool.
5. Give plugins least-privilege capabilities.
6. Record write operations and their originating tool/plugin.
7. Require explicit confirmation for destructive operations.
8. Verify downloaded plugin integrity before activation.
