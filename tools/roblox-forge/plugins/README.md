# ROBLOX FORGE Plugins

ROBLOX FORGE is designed as a capability-based plugin host. Plugins extend Forge without requiring a new Forge binary for every feature.

## Plugin package contract

Each plugin will eventually contain:

```text
plugin-id/
├── forge-plugin.json
├── README.md
├── src/
└── tests/
```

`forge-plugin.json` declares:

- `id`, `name`, `version`
- `engineRange`
- `entry`
- `capabilities`
- `permissions`
- `update.channel`
- `integrity.sha256`
- optional `repository`

## Capability model

Plugins do not receive unrestricted machine access by default. Capabilities are explicit, for example:

- `project.read`
- `project.write`
- `studio.read`
- `studio.scene.write`
- `studio.playtest`
- `git.read`
- `git.write`
- `process.spawn`
- `network.github`

Destructive capabilities must be surfaced in the Forge UI and can be disabled independently.

## GitHub-first updates

A plugin can be distributed from a trusted GitHub repository. Forge should:

1. read the signed/allowlisted manifest;
2. compare the installed version with the registry;
3. download the declared package;
4. verify SHA-256 before activation;
5. install it into the per-user Forge plugin directory;
6. run its health check;
7. activate it only after its declared capabilities are accepted.

The plugin system must never silently execute arbitrary downloaded code.

## Long-term goal

The registry becomes the Forge extension layer: Studio inspectors, world generators, quest editors, NPC tools, performance profilers, test runners, asset pipelines, Git operations, analytics, and AI-specific tools can be added independently of the Forge core.
