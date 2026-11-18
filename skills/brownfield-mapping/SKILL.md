---
name: brownfield-mapping
description: Use when starting work in an existing codebase (stage B0), before brainstorming. Checks whether docs/agent-context/map.md is missing or stale and has agent-workflow:codebase-mapper write it.
---

# Brownfield mapping (B0)

## Is the map stale?

The map is stale when either holds:

- `docs/agent-context/map.md` does not exist.
- `git rev-list --count <sha>..HEAD` is 50 or more, where `<sha>` is the commit recorded in the map's "Mapped at commit" line. An unknown or missing sha, a recorded "no commits", or a repo with no HEAD also counts as stale.

Fresh map: skip to B1 and read it first.

## Write the map

Dispatch `agent-workflow:codebase-mapper` to write `docs/agent-context/map.md` with these sections:

1. Stack and versions
2. Commands (install, dev, build, test, lint)
3. Layout
4. Design system and components
5. Conventions
6. Hotspots and debt
7. Mapped at commit `<sha>` (output of `git rev-parse HEAD`; if the repo has no commits, write `no commits`)

Then, if `docs/agent-context/perf-budget.md` is absent, copy the template from the `agent-workflow:perf-budget` skill (section "Template: `docs/agent-context/perf-budget.md`") and fill in the hot paths from the map's hotspots.

Finally stage just these two files as the baseline, `git add docs/agent-context/map.md docs/agent-context/perf-budget.md`, so the dirty-tree check in `agent-workflow:task-routing` does not trip on them. Never commit.

## graphify (optional)

When the `graphify` skill is installed, the mapper may use it to build a graph of the codebase. graphify can send file content to external LLM APIs, so ask the user before running it on private code. Subagents cannot ask, so ask before dispatching and tell the mapper the answer. Without graphify, the mapper reads the code directly.
