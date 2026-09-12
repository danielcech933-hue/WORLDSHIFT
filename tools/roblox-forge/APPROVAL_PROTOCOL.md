# ROBLOX FORGE approval protocol

The Forge bridge already polls `.forge/inbox/next-command.json` from the configured GitHub branch. This file defines the approval contract used by the AI side.

## Approval command

```json
{
  "id": "uuid",
  "type": "approval",
  "args": {
    "action": "continue",
    "instruction": "Human approved the current AI plan. Continue implementation, testing and safe sync."
  }
}
```

The AI side writes this command only after the human explicitly approves a proposed change. Forge consumes the command and writes the result to `.forge/outbox/last-result.json`.

## Safety

- Approval never authorizes destructive resets.
- Git sync is fast-forward-only.
- Tracked local changes pause automatic sync.
- Diverged branches pause automatic sync.
- The local project remains the source of truth for the running Studio session.
