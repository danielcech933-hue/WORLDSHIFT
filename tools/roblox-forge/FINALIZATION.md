# ROBLOX FORGE — Finalization checklist

This branch is the final integration pass for the desktop development workspace.

## Target workflow

1. Start Forge.
2. Select the WORLDSHIFT project.
3. Start the development stack.
4. Confirm Roblox Studio bridge connectivity.
5. Use the AI Team workspace to inspect, plan, approve and implement changes.
6. Review project memory/tasks and live diagnostics.
7. Run verification/playtest checks before committing.

## Safety

- AI writes are explicit and auditable.
- Project file writes use SHA-256 optimistic concurrency.
- Forge remains bound to localhost by default.
- The desktop shell never exposes arbitrary shell execution to the AI workspace.
- Destructive operations require explicit user action.
