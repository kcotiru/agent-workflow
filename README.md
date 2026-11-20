# agent-workflow

A Claude Code plugin that turns the main session into a router. It plans, then dispatches specialist builders and evidence-based reviewers. It covers greenfield and brownfield work, and never commits.

## Prerequisites

- Claude Code, and Node 22 (hooks and tests run on Node).
- These plugins installed: 
  - `superpowers` 
  - `ponytail` 
  - `ui-ux-pro-max`
  - `frontend-design`
  - `chrome-devtools-mcp`
  - `supabase`.
- Optional: 
  - `graphify` - Note: it can send content to external LLM APIs, so skip it for sensitive code.

## Install

Installed at user scope, so it applies in every project:

```bash
claude plugin marketplace add D:/Github/AgentWorkflow/agent-workflow
claude plugin install agent-workflow@agent-workflow --scope user
```

Update: this repo has no remote, and the plugin cache is keyed by version. Edit files here, bump `version` in `.claude-plugin/plugin.json`, then run:

```bash
claude plugin marketplace update agent-workflow
claude plugin update agent-workflow@agent-workflow
```

## Manual steps (outside this repo)

1. In `~/.claude/agents/explorer.md`, `researcher.md` and `worker.md`, set `model: claude-sonnet-5-5`.
2. In `~/.claude/CLAUDE.md`, replace the "Agent workflow" section with a two-line pointer to this plugin, for example:

   ```
   # Agent workflow
   Orchestration rules come from the `agent-workflow` plugin (injected at session start); follow them.
   ```

   The injected rules supersede the old section. Keeping both would give the main session two rosters.

## Hooks

| Hook | Event | Does |
|---|---|---|
| `session-start.js` | SessionStart | Injects `rules/orchestration.md` into context. |
| `block-git.js` | PreToolUse (Bash, PowerShell) | Blocks `git commit`, `push`, `merge`, `rebase`, and `worktree add`. |
| `pin-model.js` | PreToolUse (Agent) | Strips a `model` passed when dispatching a roster agent (`agent-workflow:*`, `explorer`, `worker`, `researcher`), so the agent's own frontmatter model always wins over skills such as superpowers' Model Selection. |
| `emdash-guard.js` | PostToolUse (Write, Edit, MultiEdit) | Flags any em dash written to a file. |

The blocker and the guard apply in every project once the plugin is installed at user scope. You commit; the agents never do.

## Roster

| Agent | Role | Model | Effort |
|---|---|---|---|
| `ui-designer` | Design brief before UI code | opus | high |
| `frontend` | UI implementation, screenshots at 390 and 1440 px | opus | high |
| `backend` | APIs, services, auth, integrations | opus | medium |
| `database` | Schema, migrations, RLS, queries | opus | high |
| `test-engineer` | Integration, e2e, regression tests | sonnet | medium |
| `ui-ux-reviewer` | Brief match, responsive, accessibility | opus | high |
| `security-reviewer` | Security checklist against the diff | opus | xhigh |
| `performance-reviewer` | Diff against the perf budget | opus | high |
| `code-reviewer` | Correctness, then over-engineering; every task | opus | medium |
| `db-reviewer` | Migration safety, indexes, RLS | opus | high |
| `codebase-mapper` | Brownfield map at `docs/agent-context/map.md` | opus | high |

Existing `explorer`, `researcher` and `worker` (sonnet, medium) handle reading and leftover tasks. Reviewers are read-only and open their report with `VERDICT: PASS` or `VERDICT: FAIL`.

Skills: `task-routing`, `greenfield-bootstrap`, `brownfield-mapping`, `security-checklist`, `perf-budget`.

## Stages

- Greenfield: G1 brainstorm, G2 bootstrap (stack, design system, scaffold), G3 plan, G4 build and review, G5 verify, G6 hand off.
- Brownfield: B0 map, B1 brainstorm, B2 impact trace, B3 plan, B4 build and review, B5 verify (full suite must pass), B6 hand off.
- Fast path: a one-layer, roughly one-file change skips brainstorm and plan. Owner builder, then `code-reviewer` for code changes, plus any reviewer whose trigger fires. Reviewers get the task diff (`git add -N` on new untracked files, then `git diff`), and `git add -A` runs once all pass.

Every plan task carries `Owner:` and `Reviewers:`. A task that passes review is staged (`git add -A`); at hand-off everything is staged and uncommitted for you to group and commit.

## Tests

```bash
node --test
```

Use bare `node --test`; `node --test tests/` fails on Windows with Node 22. The suite validates agent and skill frontmatter, the hooks, and scans for em dashes.
