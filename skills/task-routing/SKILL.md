---
name: task-routing
description: Use when writing or executing an implementation plan in a software project. Assigns each plan task an Owner builder and Reviewers, and overrides superpowers:subagent-driven-development so tasks run without commits, reviewed through git diff.
---

# Task routing

Stages, contracts, and the no-commit rules live in `rules/orchestration.md`. This skill adds who does each task and how `superpowers:subagent-driven-development` (SDD) runs without commits.

## 1. Tag every plan task

Add two lines under each task heading:

```markdown
**Owner:** agent-workflow:frontend
**Reviewers:** agent-workflow:code-reviewer, agent-workflow:ui-ux-reviewer
```

One Owner per task. Reviewers are cumulative; every code task includes `agent-workflow:code-reviewer`.

### Owner by what the task changes

| Task touches | Owner |
|---|---|
| New screen, page, or significant visual change | `agent-workflow:ui-designer` first (brief), then `agent-workflow:frontend` |
| Components, styles, client state, client routing | `agent-workflow:frontend` |
| API, server logic, auth, jobs, integrations | `agent-workflow:backend` |
| Schema, migrations, RLS, SQL | `agent-workflow:database` |
| Test suites, e2e, test infra | `agent-workflow:test-engineer` |
| Anything else | `worker` |

For the first row, write the design brief as its own task placed before the frontend task: Owner `agent-workflow:ui-designer`, Reviewers `agent-workflow:ui-ux-reviewer` only, output `docs/agent-context/briefs/<feature>.md`. Name that path in the frontend task.

### Reviewers by what the diff touches

| Trigger | Add reviewer |
|---|---|
| Every code task | `agent-workflow:code-reviewer` |
| Any UI file | `agent-workflow:ui-ux-reviewer` |
| Auth, sessions, input handling, file upload, secrets, external calls, RLS, permissions, new dependency | `agent-workflow:security-reviewer` |
| New route or page, list rendering, images or large assets, queries in loops, new query on a hot path, new dependency in the client bundle | `agent-workflow:performance-reviewer` |
| Schema or migration | `agent-workflow:db-reviewer` |

## 2. Fast path

Skip brainstorm, plan, and SDD when the change touches one layer, adds no new behaviour (or a trivially testable one), and fits in roughly one file: a typo, a copy change, a small bug with an obvious cause. Dispatch the Owner, then `agent-workflow:code-reviewer` (for code changes) plus any reviewer whose trigger fires (a one-line auth change still gets `agent-workflow:security-reviewer`). Build the task diff for the reviewers (`git add -N` on new untracked files, then `git diff`), and run `git add -A` after all pass. Say you are taking the fast path so the user can object.

## 3. SDD overrides

Follow SDD as written (ledger, task briefs, pre-flight review, statuses) except for these steps.

**Baseline first.** Every stage that writes files stages them with `git add` when it finishes, so they are not mistaken for the user's changes: the spec and plan docs from brainstorming and planning, the bootstrap output (`agent-workflow:greenfield-bootstrap`), and the map (`agent-workflow:brownfield-mapping`). Staging is the allowed checkpoint; the dirty-tree check below then fires only on the user's own changes.

**Task diff** (used everywhere below): run `git add -N` on every file from `git ls-files --others --exclude-standard`, then `git diff > <workspace>/task-<N>.diff`. Run both every time, including before each re-review.

| SDD step | Do instead |
|---|---|
| Setup: `superpowers:using-git-worktrees` | Skip it. Work in the user's tree on the current branch. |
| Setup: "never start on main/master without consent" | Does not apply. Work stays uncommitted in the user's tree and nothing is committed, so do not stall for consent. |
| Setup, before the first task | Run `git diff --quiet` and `git ls-files --others --exclude-standard`. Any unstaged change or untracked file: stop and ask the user before dispatching anything. Staged changes are fine. |
| Record BASE (`git rev-parse HEAD`) | Not needed. The index is the checkpoint: everything staged has passed review. |
| Dispatch the implementer | Subagent type is the task's `Owner`. Replace "Commit your work" in the prompt with "leave changes unstaged; never run git add or git commit". Ask for files changed instead of commits in the reply. |
| `scripts/review-package PLAN_FILE BASE HEAD` | Write the task diff. |
| Dispatch the task reviewer | Dispatch every agent on the task's `Reviewers` line, in parallel, each with: the diff file path, the plan task text, and for UI tasks the design brief path. Exception: when both `agent-workflow:ui-ux-reviewer` and `agent-workflow:performance-reviewer` are listed, run ui-ux-reviewer first and performance-reviewer after it finishes (both start app servers and builds). |
| All reviewers return `VERDICT: PASS` | Run `git add -A`, then write the ledger line `Task <N>: complete (staged, review clean)`. This is the only time a task's work gets staged. |
| Fix loop (`references/fix-loop.md`) | The task stays unstaged through the whole loop. Before each round, keep the current task diff as `task-<N>-r<round>-prefix.diff`. Send blockers and should-fixes from every failing reviewer to the Owner in one message. Then write a fresh task diff and re-run only the reviewers that failed, each with its findings, the saved pre-fix diff, and the new full task diff. Two fix rounds max; then stop, leave the task unstaged, and tell the user the open findings and which files hold unreviewed work. |
| Final review (`references/final-review.md`) | Write `git diff HEAD > <workspace>/final.diff` (in a repo with no commits, where HEAD does not exist: `git diff --cached` plus `git diff` instead) and give it to `agent-workflow:security-reviewer` and `agent-workflow:performance-reviewer` in parallel. On FAIL: one fix wave by the relevant Owner, then one re-review with the fix's task diff. Still FAIL: stop and bring the findings to the user. |
| `superpowers:finishing-a-development-branch` | Report what is staged and ready to commit. No commit, merge, push, or PR. |

Never run `git commit`, `git push`, `git merge`, `git rebase`, or `git worktree add`, and never tell a subagent to.
