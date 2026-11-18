# Agent Orchestration Workflow: Design

Date: 2026-11-18
Status: draft, awaiting approval

## Intent

The current setup (main session plus three generic agents: `explorer`, `worker`, `researcher`) produces work that is not acceptable in the areas that cost the most time: UI/UX, security, and performance. The fix is a full software development workflow for Claude Code with:

- defined stages for both greenfield (new project) and brownfield (existing codebase) work,
- specialist builders split by layer (frontend, backend, database, and so on),
- specialist reviewers split by concern, with UI/UX, security, and performance as the strongest gates,
- complementary skills preloaded into each agent so it starts with the right expertise.

## Goals

1. Every task in a plan goes to the builder that owns that layer, never a generic coder by default.
2. Every task is reviewed by the reviewers whose concern it touches, and a reviewer's verdict must carry evidence (screenshot, audit output, file:line), not opinion.
3. UI work gets design direction before code and visual verification after.
4. Greenfield and brownfield each have an entry stage that sets up the context the rest of the workflow depends on.
5. Thresholds for security and performance are written down, so reviews are pass or fail against a list rather than taste.

## Non-goals

- A standalone orchestrator program, task queue, or server (approach C, rejected).
- Replacing superpowers' brainstorming, planning, execution, or review skills.
- Stack-specific builders (React agent, Django agent). Builders are layer-specific and read the project's stack from context.

## Anti-goals (failure even if it works)

- Process heavier than the task: a one-line fix dragged through six stages and five reviewers.
- Reviewers that rubber-stamp ("looks good") or that flood findings without evidence.
- Agents that commit, push, or merge. The user commits everything personally.
- Em dashes in any text an agent writes.

## Constraints

- Runs inside Claude Code as a plugin; uses subagents (`agents/*.md`), skills, and hooks only.
- Depends on the installed `superpowers` plugin (v7.x) and the skills listed below. A missing optional skill (for example `supabase:*` in a non-Supabase project) must not break an agent.
- Must respect the user's global rules: never `git commit`, no em dashes, ponytail applied to all coding.
- Platform is Windows 11 with PowerShell and Git Bash; hook scripts must run there.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Layer on superpowers: add specialist agents, two entry-stage skills, a routing skill, two checklist skills, and hooks. Superpowers keeps brainstorming, planning, plan execution, and review mechanics. | Smallest build; inherits superpowers improvements. Coupled to superpowers' stage shape. |
| B | Standalone plugin with every stage rewritten. | Full control; roughly 3x the writing and duplicates skills the user already likes. |
| C | Custom orchestrator via the Agent SDK. | Only worth it for unattended or server runs; does not address the quality problem, which lives in the prompts and gates. |

The user picked A.

## Deliverable shape

This repo becomes a Claude Code plugin:

```
.claude-plugin/plugin.json
agents/        one .md per agent (14 files)
skills/        greenfield-bootstrap, brownfield-mapping, task-routing,
               security-checklist, perf-budget
hooks/hooks.json + hooks/*.ps1 or *.sh
rules/orchestration.md   the main-session rules, injected by a SessionStart hook
README.md      install and usage
```

Installed at user scope via a local marketplace entry pointing at this repo, so it applies to every project on the machine. The injected rules state they apply to software development tasks only. Per-project state (the map, stack notes, design system, perf budget overrides) lives in each project's `docs/agent-context/`.

## The roster

All builders preload `ponytail:ponytail` and `superpowers:test-driven-development`. All reviewers are read-only (no Write/Edit tools) and follow the reviewer report contract below.

### Builders

| Agent | Owns | Preloaded skills |
|---|---|---|
| `ui-designer` | Design direction before code: layout, visual hierarchy, tokens, component choices, states (empty, loading, error). Produces a design brief, writes no product code. | `ui-ux-pro-max:ui-ux-pro-max`, `ui-ux-pro-max:design-system`, `frontend-design:frontend-design` |
| `frontend` | UI implementation against the design brief. Must screenshot its result at mobile (390px) and desktop (1440px) widths before reporting. | `frontend-design:frontend-design`, `ui-ux-pro-max:ui-styling`, `chrome-devtools-mcp:chrome-devtools` |
| `backend` | APIs, services, business logic, auth flows, integrations. | `superpowers:systematic-debugging`; `supabase:supabase` when the project uses Supabase |
| `database` | Schema, migrations, RLS policies, indexes, queries, seed data. | `supabase:supabase-postgres-best-practices`, `supabase:supabase` |
| `test-engineer` | Test suites beyond unit level: integration, end-to-end, regression tests for bugs, test infrastructure. | `superpowers:verification-before-completion`, `run` |
| `worker` (existing, kept) | Fallback for tasks no specialist owns (build config, scripts, docs tooling). | unchanged |

### Reviewers

| Agent | Checks | Preloaded skills |
|---|---|---|
| `ui-ux-reviewer` | Matches the design brief; responsive at 390/768/1440; accessibility (contrast, focus, labels, keyboard); states present; no generic "template" look. Evidence: screenshots, a11y audit output. | `chrome-devtools-mcp:a11y-debugging`, `chrome-devtools-mcp:chrome-devtools`, `ui-ux-pro-max:ui-ux-pro-max` |
| `security-reviewer` | Walks `security-checklist` item by item against the diff; for Supabase projects also runs the security advisors. Evidence: file:line per finding. | `security-checklist`, `chrome-devtools-mcp:cookie-debugging`, `supabase:supabase` |
| `performance-reviewer` | Checks the change against `perf-budget`. Evidence: Lighthouse/trace numbers for UI, query plans or query counts for data paths. | `perf-budget`, `chrome-devtools-mcp:debug-optimize-lcp`, `chrome-devtools-mcp:memory-leak-debugging`, `supabase:supabase-postgres-best-practices` |
| `code-reviewer` | Correctness against the plan task, then over-engineering. Runs on every task. | `ponytail:ponytail-review`, `simplify` |
| `db-reviewer` | Migration safety (reversibility, locking, data loss), indexes, constraints, RLS correctness. | `supabase:supabase-postgres-best-practices` |

### Readers

| Agent | Role | Preloaded skills |
|---|---|---|
| `explorer` (existing) | Locate code, trace flows, map a change's blast radius. | unchanged |
| `researcher` (existing) | Docs lookup, installed version first. | unchanged |
| `codebase-mapper` | Brownfield only: produces the project map (see stage B0). | `ponytail:ponytail-audit`; uses `graphify` if installed, otherwise reads the codebase directly (my call: graphify is not installed on this machine, so it stays optional) |

The existing `explorer`, `researcher`, and `worker` live in `~/.claude/agents/`. The plugin does not duplicate them; it references them by name. (My call: avoids two copies drifting.)

## Contracts

**Builder report.** Files changed, what each change does, verification commands run with their actual output (pass/fail), screenshots for UI work, anything left open.

**Reviewer report.** First line is `VERDICT: PASS` or `VERDICT: FAIL`. Then findings, each with severity (blocker / should-fix / nit), `path:line`, what is wrong, and evidence. A finding with no evidence is not allowed. Nits never cause FAIL.

**Review loop.** On FAIL, the owning builder fixes blockers and should-fixes, then only the failing reviewers re-run. Maximum two fix rounds; after that the main session stops and brings the open findings to the user. (My call: prevents endless loops.)

## Change tracking without commits

The user chose to use the git index as the per-task checkpoint (option A of the builder check).

- Work happens in the user's working tree on the current branch. No worktree or agent branch is created; `superpowers:using-git-worktrees` is skipped because it commits.
- Before G4/B4 starts, the working tree must be clean of unstaged changes (staged changes are fine). If it is not, the main session stops and asks the user.
- A task's diff is `git diff` (unstaged vs index). Builders and reviewers see only the current task.
- When a task passes review, the main session runs `git add -A` for that task's files. The next task starts from that index.
- The final full-change review (G5/B5) uses `git diff --cached` plus any unstaged changes against `HEAD`.
- At hand-off everything is staged and uncommitted; the user groups and commits.
- `task-routing` overrides the commit steps of `superpowers:subagent-driven-development`: the implementer prompt's "Commit your work" becomes "leave changes unstaged", and reviewers receive `git diff` output instead of a commit range.

## Workflow stages

### Greenfield

| Stage | What happens | Who |
|---|---|---|
| G1 Brainstorm | `superpowers:brainstorming` produces the design doc. | main |
| G2 Bootstrap | `greenfield-bootstrap` skill: stack decision (researcher checks current versions), `ui-designer` produces the design system (tokens, type scale, base components), scaffold the project, write `docs/agent-context/` (stack, commands, conventions, `perf-budget.md` copied from defaults). | main, researcher, ui-designer, owning builder |
| G3 Plan | `superpowers:writing-plans`, with `task-routing` tagging every task with `Owner:` and `Reviewers:`. | main |
| G4 Build and review | `superpowers:subagent-driven-development`, dispatching each task to its `Owner` and then its `Reviewers` (reviewers in parallel). Builders run one task at a time (my call: superpowers forbids parallel implementers, and parallel builders in one working tree would mix their diffs so no reviewer sees only its task). | builders, reviewers |
| G5 Verify | `superpowers:verification-before-completion`, then a final full-diff pass by `security-reviewer` and `performance-reviewer`. | main, reviewers |
| G6 Hand off | `superpowers:finishing-a-development-branch`, minus any commit, merge, or push. Report what is staged and ready to commit. | main |

### Brownfield

| Stage | What happens | Who |
|---|---|---|
| B0 Map | `brownfield-mapping` skill: if `docs/agent-context/map.md` is missing or older than the last 50 commits, `codebase-mapper` writes it: stack and versions, run/test/lint commands, folder layout, existing design system and components, conventions, hotspots and known debt. Also creates `perf-budget.md` from defaults if absent. | codebase-mapper |
| B1 Brainstorm | `superpowers:brainstorming`, reading the map first. | main |
| B2 Impact | `explorer` traces every file and caller the change touches; result feeds the plan. | explorer |
| B3 Plan | Same as G3, plus a regression test task for any changed behaviour. | main |
| B4 Build and review | Same as G4. Builders must follow conventions from the map over their own preferences. | builders, reviewers |
| B5 Verify, B6 Hand off | Same as G5, G6, plus the project's full existing test suite must pass. | main |

### Fast path

A change that touches one layer, has no new behaviour or a trivially testable one, and fits in roughly one file (typo, copy change, small bug with obvious cause) skips brainstorm and plan: owner builder, then `code-reviewer`, plus any concern reviewer whose trigger fires (a one-line auth change still gets `security-reviewer`). The main session states that it is taking the fast path so the user can object.

## Routing rules (`task-routing` skill)

Owner by what the task changes:

| Task touches | Owner |
|---|---|
| New screen, page, or significant visual change | `ui-designer` first (brief), then `frontend` |
| Components, styles, client state, client routing | `frontend` |
| API, server logic, auth, jobs, integrations | `backend` |
| Schema, migrations, RLS, SQL | `database` |
| Test suites, e2e, test infra | `test-engineer` |
| Anything else | `worker` |

Reviewers by what the diff touches (cumulative; `code-reviewer` always):

| Trigger | Add reviewer |
|---|---|
| Any UI file | `ui-ux-reviewer` |
| Auth, sessions, input handling, file upload, secrets, external calls, RLS, permissions, new dependency | `security-reviewer` |
| New route or page, list rendering, images or large assets, queries in loops, new query on a hot path, new dependency in the client bundle | `performance-reviewer` |
| Schema or migration | `db-reviewer` |

## New skills

**`greenfield-bootstrap`** and **`brownfield-mapping`**: stage procedures as described above, each ending with `docs/agent-context/` populated.

**`task-routing`**: the two tables above plus how to write `Owner:` / `Reviewers:` lines into plan tasks, and how the main session dispatches them during `subagent-driven-development` (implementer subagent type = `Owner`; review step = the listed reviewers instead of the generic reviewer).

**`security-checklist`**: OWASP-based, stack-neutral. Sections: authentication and sessions; authorization and access control (including RLS); input validation and output encoding (injection, XSS); secrets and configuration; data exposure and logging; dependencies (new packages, known CVEs via the project's audit command); file and network handling (uploads, SSRF, CORS); client-side (CSP, cookies, storage of tokens). Each item phrased as a yes/no check with what evidence satisfies it. Items that do not apply to the diff are marked N/A with a one-line reason.

**`perf-budget`**: default thresholds, overridable per project in `docs/agent-context/perf-budget.md`:

- LCP 2.5s or less, INP 200ms or less, CLS 0.1 or less (mobile emulation).
- Lighthouse performance score 90 or more on changed pages.
- Initial JS 170KB gzipped or less per route; any single new client dependency over 30KB gzipped needs justification.
- No N+1 queries; no unbounded list queries (must paginate or limit); new queries on hot paths need an index or an EXPLAIN showing it is not needed.
- No memory growth across three repeated runs of a changed interaction.

Plus how to measure each with the installed Chrome DevTools and Supabase tools, and what to report when a measurement is impossible (for example no running app): say so explicitly, never guess a number.

## Hooks

1. **Block commits.** PreToolUse on Bash/PowerShell: reject any command containing `git commit`, `git push`, `git merge`, `git rebase`, or `git worktree add` (`git add` and `git diff` stay allowed, since staging is the checkpoint), with a message pointing to the user's rule. Applies to subagents too.
2. **Em dash guard.** PostToolUse on Write/Edit: if the written content contains U+2014, report the file and line back to the agent so it rewrites the sentence.

3. **Inject orchestration rules.** SessionStart: prints `rules/orchestration.md` into the session context, the same way ponytail and superpowers load their rules on this machine. (Builder check finding: a plugin cannot ship a `CLAUDE.md` that the session reads.)

(My call: hooks 1 and 2 cover the rules agents break most and are cheap to enforce mechanically; hook 3 is the only way a plugin can reach the main session. Nothing else is hooked.)

## Main session rules (`rules/orchestration.md`)

The orchestration rules: the stage tables, "always route through `task-routing`", the contracts, the review loop limit, the fast path, and "the main session never does bulk reading or editing". The user's global `~/.claude/CLAUDE.md` agent table is updated to point at the new roster. That edit is outside this repo, so the plan lists it as a manual step for the user.

## Models and effort

Rule of thumb: high effort where the user's pain points are (UI/UX, security, performance) or where a mistake is hard to undo (data, migrations); medium where the work is well specified by the plan; the always-on reviewer stays medium because the specialists cover the hard concerns.

| Agent | Model | Effort | Runs | Why |
|---|---|---|---|---|
| main session | `claude-opus-5-5` | high | always | Plans, routes, judges reports (user's existing setting). |
| `ui-designer` | `claude-opus-5-5` | high | new screens / big visual changes | Taste and design judgment; root of the UI complaints. |
| `frontend` | `claude-opus-5-5` | high | every UI task | UI quality is the top pain point; raised from the existing worker's medium. |
| `backend` | `claude-opus-5-5` | medium | every server task | Plan specifies the work; security/perf reviewers catch the risky parts. |
| `database` | `claude-opus-5-5` | high | schema/migration tasks | Mistakes lose data and are hard to reverse. |
| `test-engineer` | `claude-sonnet-5-5` | medium | test tasks | Well specified by the plan. |
| `worker` (existing) | `claude-sonnet-5-5` | medium | fallback | Only gets leftover, low-risk tasks (config, scripts). |
| `ui-ux-reviewer` | `claude-opus-5-5` | high | any UI diff | Pain point; must judge screenshots, not just code. |
| `security-reviewer` | `claude-opus-5-5` | xhigh | when triggered + final pass | Pain point; a missed finding is the costliest failure; only runs when triggered, so cost stays bounded. |
| `performance-reviewer` | `claude-opus-5-5` | high | when triggered + final pass | Pain point; must interpret traces and query plans. |
| `code-reviewer` | `claude-opus-5-5` | medium | every task | Runs most often; correctness and over-engineering only. |
| `db-reviewer` | `claude-opus-5-5` | high | schema/migration diffs | Same reasoning as `database`. |
| `codebase-mapper` | `claude-opus-5-5` | high | rarely (brownfield, when map is stale) | One map feeds every later stage. |
| `explorer` (existing) | `claude-sonnet-5-5` | medium | often | Reading and tracing; no noticeable quality gap. |
| `researcher` (existing) | `claude-sonnet-5-5` | medium | as needed | Docs lookup; no noticeable quality gap. |

User rule: use Sonnet wherever it does not cost noticeable quality. Sonnet takes the reading roles and the well-specified, lower-risk building roles. `backend` and `code-reviewer` stay on Opus because writing server logic and catching subtle correctness bugs are where the Opus gap shows; everything on the pain points stays on Opus. The existing `explorer`, `researcher`, and `worker` files in `~/.claude/agents/` change from Opus to Sonnet (a one-line edit each, outside this repo, listed as a user step). The end-to-end trial checks the Sonnet agents; any that fall short go back to Opus.

## Left to the builder

- Exact prompt wording of each agent and skill, within the contracts above.
- Hook script language (PowerShell vs bash), as long as it runs on the user's Windows setup.
- How `docs/agent-context/` files are formatted.
- Whether `greenfield-bootstrap` scaffolds by running a framework CLI or by hand, per stack.
- Plugin manifest details and README content.

## Verification of the workflow itself

- Each agent file loads without frontmatter errors (`claude --debug` or `/agents` lists them).
- Hooks: a dry run of `git commit` is blocked; writing a file with U+2014 is flagged.
- One end-to-end trial on a small brownfield change in a scratch project, confirming the routing picks the right owner and reviewers and that reviewers return evidence-backed verdicts.
