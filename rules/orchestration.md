# Agent Orchestration Rules

These rules apply to software development tasks in any project. For anything else (questions, writing, non-code work), ignore them.

The main session never does bulk reading or editing; it plans, routes, and verifies reports.

## Roster

Builders (one task at a time, each owns a layer):

| Agent | Owns |
|---|---|
| `agent-workflow:ui-designer` | Design brief before code: layout, hierarchy, tokens, states. Writes no product code. |
| `agent-workflow:frontend` | UI implementation against the brief; screenshots at 390px and 1440px before reporting. |
| `agent-workflow:backend` | APIs, services, business logic, auth flows, integrations. |
| `agent-workflow:database` | Schema, migrations, RLS, indexes, queries, seed data. |
| `agent-workflow:test-engineer` | Integration, e2e, regression tests, test infrastructure. |
| `worker` | Fallback for tasks no specialist owns (build config, scripts, docs tooling). |

Reviewers (read-only, evidence required):

| Agent | Checks |
|---|---|
| `agent-workflow:ui-ux-reviewer` | Design brief match, responsive 390/768/1440, accessibility, states. |
| `agent-workflow:security-reviewer` | `agent-workflow:security-checklist` item by item against the diff. |
| `agent-workflow:performance-reviewer` | The change against `agent-workflow:perf-budget`. |
| `agent-workflow:code-reviewer` | Correctness against the plan task, then over-engineering. Runs on every code task. |
| `agent-workflow:db-reviewer` | Migration safety, indexes, constraints, RLS correctness. |

Readers:

| Agent | Role |
|---|---|
| `explorer` | Locate code, trace flows, map a change's blast radius. |
| `researcher` | Docs lookup, installed version first. |
| `agent-workflow:codebase-mapper` | Brownfield only: writes `docs/agent-context/map.md`. |

## Stages

Greenfield:

- G1 Brainstorm: `superpowers:brainstorming`.
- G2 Bootstrap: `agent-workflow:greenfield-bootstrap` (stack, design system, scaffold, `docs/agent-context/`).
- G3 Plan: `superpowers:writing-plans`, tagged via `agent-workflow:task-routing`.
- G4 Build and review: `superpowers:subagent-driven-development`, each task to its Owner then its Reviewers.
- G5 Verify: `superpowers:verification-before-completion`, then a final full-diff pass by security and performance reviewers.
- G6 Hand off: `superpowers:finishing-a-development-branch`, minus any commit, merge, or push.

Brownfield:

- B0 Map: `agent-workflow:brownfield-mapping` (map missing or older than the last 50 commits).
- B1 Brainstorm: `superpowers:brainstorming`, reading the map first.
- B2 Impact: `explorer` traces every file and caller the change touches.
- B3 Plan: `superpowers:writing-plans` plus a regression test task for any changed behaviour.
- B4 Build and review: same as G4; builders follow the map's conventions over their own.
- B5 Verify: same as G5, and the full existing test suite must pass.
- B6 Hand off: same as G6.

## Fast path

A change that touches one layer, has no new behaviour or a trivially testable one, and fits in roughly one file (typo, copy change, small bug with obvious cause) skips brainstorm and plan: owner builder, then `agent-workflow:code-reviewer` for code changes, plus any concern reviewer whose trigger fires. Build the task diff for the reviewers (`git add -N` on new untracked files, then `git diff`), and run `git add -A` after all pass. Say you are taking the fast path so the user can object.

## Routing

Every plan task gets `Owner:` and `Reviewers:` lines. Load `agent-workflow:task-routing` when planning or dispatching. Never pass a `model` when dispatching a roster agent; its frontmatter sets model and effort.

## Change tracking (no commits, ever)

- Work in the user's working tree on the current branch. No worktree or agent branch; skip `superpowers:using-git-worktrees`. No consent stall for main/master, since nothing is committed.
- Stages that write files (spec, plan, bootstrap output, map) stage them when they finish, as the baseline.
- Before G4/B4 starts, unstaged changes or untracked files in the tree mean: stop and ask the user. Staged changes are fine.
- A task's diff is `git diff` (unstaged vs index). New files need `git add -N` first, before every diff, so reviewers see them.
- A task stays unstaged through its fix loop. Only when all its reviewers pass, run `git add -A`; the next task starts from that index. Staged means reviewed.
- The final review (G5/B5) uses `git diff HEAD` (no commits yet: `git diff --cached` plus `git diff`).
- At hand-off everything is staged and uncommitted; the user groups and commits. Never run `git commit`, push, merge, or rebase. Implementer prompts say "leave changes unstaged" instead of "commit".

## Contracts

- Builder report: files changed, what each change does, verification commands with actual output (pass/fail), screenshots for UI work, anything left open.
- Reviewer report: first line `VERDICT: PASS` or `VERDICT: FAIL`; then findings with severity (blocker / should-fix / nit), `path:line`, what is wrong, and evidence. No finding without evidence; nits never cause FAIL.
- Review loop: on FAIL the owning builder fixes blockers and should-fixes, then only the failing reviewers re-run. Maximum two fix rounds, then stop and bring the open findings to the user.
