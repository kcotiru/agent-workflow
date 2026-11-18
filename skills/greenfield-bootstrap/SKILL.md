---
name: greenfield-bootstrap
description: Use when starting a new software project after brainstorming and before writing the plan (stage G2). Confirms stack versions, gets a design system, scaffolds the project, and writes docs/agent-context/.
---

# Greenfield bootstrap (G2)

Runs after `superpowers:brainstorming` has a design doc with the chosen stack. Never commit.

## Steps

0. **Git.** If the folder is not a git repository (`git rev-parse --git-dir` fails), run `git init`. Later stages diff against the index.
1. **Versions.** Dispatch `researcher` to confirm the current stable version of each part of the chosen stack (framework, language runtime, database, test runner, key libraries) and any setup changes in those versions. Use what it reports, not remembered versions.
2. **Design system.** If the project has a UI, dispatch `agent-workflow:ui-designer` to write `docs/agent-context/design-system.md`: tokens (color, radius, shadow), type scale, spacing scale, base components, and states (hover, focus, disabled, loading, empty, error).
3. **Scaffold.** Dispatch the owning builder (see `agent-workflow:task-routing`; `worker` when no layer owns it). Use the framework's own CLI when one exists. The builder gets the lint, test, and dev commands working and reports their output.
4. **Stack notes.** Have the builder write `docs/agent-context/stack.md`:
   - Stack and exact versions
   - Commands: install, dev, build, test, lint
   - Conventions: folder layout, naming, styling approach, test location
5. **Perf budget.** Copy the template from the `agent-workflow:perf-budget` skill (section "Template: `docs/agent-context/perf-budget.md`") into `docs/agent-context/perf-budget.md` and fill in the hot paths and production build command.

## Exit check

Run it yourself or have the builder show output: the dev server starts, and the test command runs (zero tests is fine; a crash is not). Until both hold, G2 is not done.

Then stage everything bootstrap produced (scaffold, `stack.md`, `design-system.md`, `perf-budget.md`) with `git add -A` as the baseline (first check `.gitignore` excludes dependencies, build output, and env files), so the dirty-tree check in `agent-workflow:task-routing` does not trip on it. Do not commit.

Result:

```
docs/agent-context/
  stack.md
  design-system.md   (UI projects)
  perf-budget.md
```
