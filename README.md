# WORLDSHIFT

**One player. Infinite worlds.**

WORLDSHIFT is a Roblox multiverse experience built around player choice, living worlds, progression, relationships, economy and exploration.

## Current build

- Anime Reality
- Hoshikawa starting region
- Rojo project structure
- Server bootstrap
- Initial client HUD
- Data-driven architecture foundation

## Development flow

```text
GitHub → Rojo → Roblox Studio → Roblox Experience
```

The repository is the source of truth for gameplay code. Roblox Studio is used to run, test and publish the Experience.

## Architecture

- `src/shared` — shared configuration and definitions
- `src/server` — authoritative server systems
- `src/client` — UI and client controllers

Future systems include player data, inventory, equipment, masteries, quests, NPC simulation, crafting, economy, housing, businesses, clans, world state, events and the World Director.
