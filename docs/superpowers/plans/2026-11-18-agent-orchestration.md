# Agent Orchestration Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this repo into a Claude Code plugin (`agent-workflow`) that adds specialist builder and reviewer subagents, five workflow skills, and three hooks on top of superpowers.

**Architecture:** A plain Claude Code plugin: `agents/*.md` (frontmatter plus prompt), `skills/<name>/SKILL.md`, and Node hook scripts wired in `hooks/hooks.json`. A SessionStart hook injects `rules/orchestration.md` into the main session. One Node test file validates the whole plugin (frontmatter, model table, em dashes); one tests the hook scripts.

**Tech Stack:** Markdown, JSON, Node 22 (stdlib only, `node:test` for tests). No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-18-agent-orchestration-design.md`

## Global Constraints

- Never run `git commit`, `git push`, `git merge`, `git rebase`, or `git worktree add`. Where superpowers says "commit", leave changes unstaged; the main session stages each task with `git add` after its review passes.
- No U+2014 (em dash) in any file in this repo. Tests refer to it as `\u2014`, never literally.
- No npm dependencies; Node stdlib only. Hook scripts must run on Windows 11 (paths quoted, `node "${CLAUDE_PLUGIN_ROOT}/..."`).
- Plugin name: `agent-workflow`. Plugin agents are addressed as `agent-workflow:<name>`; the existing `explorer`, `researcher`, `worker` keep their bare names.
- Model ids: `claude-opus-5-5`, `claude-sonnet-5-5` only. Effort values: `medium`, `high`, `xhigh`.
- Reviewers never edit: frontmatter `disallowedTools: Write, Edit, NotebookEdit`.
- Global by default: installed at user scope, so the agents, skills, hooks, and rules apply in every project. Everything project-specific lives in that project's `docs/agent-context/`, never in this repo.
- Supabase skills are used only "when the project uses Supabase"; agents must work in projects without it.

## Review Focus

1. `git` invoked in compound or flagged forms (`cd x && git commit -m y`, `git -C repo push`, `git  commit`): must be blocked; `git add -A`, `git diff --cached`, `git status`, `git log` must pass. Test in Task 2.
2. Malformed or empty hook stdin (no `tool_input`, invalid JSON): hooks exit 0 without crashing, so a hook bug never wedges a session. Test in Task 2.
3. Em dash guard on each edit shape: `Write.content`, `Edit.new_string`, `MultiEdit.edits[].new_string`; em dashes already in untouched parts of the file are not flagged. Test in Task 2.
4. A frontmatter typo (wrong model id, misspelled skill name, reviewer missing `disallowedTools`) silently degrades an agent: the validator catches it. Test in Task 1, exercised in Tasks 5 and 6.
5. Starting a build with unstaged changes would mix the user's edits into the first task's diff: `rules/orchestration.md` and `task-routing` must say to stop and ask. Checked by a content assertion in Task 4.

---

### Task 1: Plugin skeleton, rules injection, and the validator

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- Create: `hooks/hooks.json`, `hooks/session-start.js`
- Create: `rules/orchestration.md`
- Create: `tests/validate.test.js`, `tests/session-start.test.js`

**Interfaces:**
- Produces: `hooks/hooks.json` with a `SessionStart` entry (matcher `startup|resume|clear|compact`) running `node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js"`. Task 2 appends `PreToolUse` and `PostToolUse` entries to the same file.
- Produces: `tests/validate.test.js` exporting nothing; it holds the `EXPECTED` table (agent name to `{model, effort, reviewer: bool}`) that Tasks 5 and 6 must satisfy. Agents missing from disk are skipped until their task lands; agents present must match.
- Produces: run command `node --test tests/` for every later task.

- [ ] **Step 1: Write `tests/session-start.test.js`**

Spawn `node hooks/session-start.js` with `CLAUDE_PLUGIN_ROOT` set to the repo root; assert exit code 0 and that stdout contains the heading `# Agent Orchestration Rules` and the strings `agent-workflow:task-routing` and `git add`.

- [ ] **Step 2: Write `tests/validate.test.js`**

Tests:
- `no em dashes`: walk every file in the repo except `.git/`, `node_modules/`, `.devswarm-temp/`; assert none contains `'\u2014'`; failure message lists `path:line`.
- `agent frontmatter`: for each `agents/*.md`, parse the `---` block (simple `key: value` lines plus `- item` lists under `skills:`); assert `name` equals the filename stem, `description` non-empty, `model` and `effort` equal `EXPECTED[name]`, and when `EXPECTED[name].reviewer` is true, `disallowedTools` contains `Write` and `Edit`.
- `skill frontmatter`: each `skills/*/SKILL.md` has `name` equal to its folder and a non-empty `description`.
- `local skill refs`: every `agent-workflow:<x>` in any agent's `skills:` list has `skills/<x>/SKILL.md`.

`EXPECTED` (from the spec's Models table):

```js
const EXPECTED = {
  'ui-designer':          { model: 'claude-opus-5-5',   effort: 'high',   reviewer: false },
  'frontend':             { model: 'claude-opus-5-5',   effort: 'high',   reviewer: false },
  'backend':              { model: 'claude-opus-5-5',   effort: 'medium', reviewer: false },
  'database':             { model: 'claude-opus-5-5',   effort: 'high',   reviewer: false },
  'test-engineer':        { model: 'claude-sonnet-5-5', effort: 'medium', reviewer: false },
  'ui-ux-reviewer':       { model: 'claude-opus-5-5',   effort: 'high',   reviewer: true },
  'security-reviewer':    { model: 'claude-opus-5-5',   effort: 'xhigh',  reviewer: true },
  'performance-reviewer': { model: 'claude-opus-5-5',   effort: 'high',   reviewer: true },
  'code-reviewer':        { model: 'claude-opus-5-5',   effort: 'medium', reviewer: true },
  'db-reviewer':          { model: 'claude-opus-5-5',   effort: 'high',   reviewer: true },
  'codebase-mapper':      { model: 'claude-opus-5-5',   effort: 'high',   reviewer: true },
};
```

Also assert every file in `agents/` has an `EXPECTED` entry (no unplanned agents).

- [ ] **Step 3: Run `node --test tests/` and confirm `session-start` fails (script missing) and `validate` passes trivially (no agents yet)**

- [ ] **Step 4: Write the plugin files**

- `plugin.json`: `name: "agent-workflow"`, `version: "0.1.0"`, `description`, `author: {"name": "kctiru"}`. No `hooks` field: Claude Code loads `hooks/hooks.json` automatically, and naming the default file again can register the hooks twice.
- `marketplace.json`: shape copied from the ponytail marketplace (`$schema`, `name: "agent-workflow"`, `owner`, `plugins: [{name: "agent-workflow", source: "./", description}]`).
- `session-start.js`: read `rules/orchestration.md` relative to `__dirname/..` and write it to stdout; on any read error write nothing and exit 0.
- `rules/orchestration.md`, heading `# Agent Orchestration Rules`, sections in this order, content taken from the spec:
  0. Scope line: these rules apply to software development tasks in any project; for anything else (questions, writing, non-code work) ignore them.
  1. Roster: three tables (builders, reviewers, readers) with agent type names as dispatched (`agent-workflow:frontend`, `explorer`, ...), one line on what each owns.
  2. Stages: greenfield G1 to G6 and brownfield B0 to B6, one line each naming the skill used.
  3. Fast path: criteria and "say you are taking it".
  4. Routing: "every plan task gets `Owner:` and `Reviewers:` lines; load `agent-workflow:task-routing` when planning or dispatching".
  5. Change tracking: the six bullets of the spec's "Change tracking without commits", including "unstaged changes before a build: stop and ask the user".
  6. Contracts: builder report, reviewer report (`VERDICT: PASS|FAIL`, severity, `path:line`, evidence), two-round fix limit then escalate.
  7. "The main session never does bulk reading or editing; it plans, routes, and verifies reports."

- [ ] **Step 5: Run `node --test tests/`; expected: all pass**

- [ ] **Step 6: Leave changes unstaged and report**

---

### Task 2: Guard hooks (block git integration, flag em dashes)

**Files:**
- Create: `hooks/block-git.js`, `hooks/emdash-guard.js`
- Modify: `hooks/hooks.json`
- Create: `tests/hooks.test.js`

**Interfaces:**
- Consumes: `hooks/hooks.json` from Task 1.
- Produces: `PreToolUse` matcher `Bash|PowerShell` running `block-git.js`; `PostToolUse` matcher `Write|Edit|MultiEdit` running `emdash-guard.js`. Both read hook JSON from stdin. Exit 2 with a stderr message means block (PreToolUse) or feed back to the agent (PostToolUse); exit 0 otherwise.

- [ ] **Step 1: Write `tests/hooks.test.js`**

Helper `run(script, obj)` spawns `node hooks/<script>` with `JSON.stringify(obj)` on stdin and returns `{code, stderr}`.

`block-git.js` with `{tool_name: 'Bash', tool_input: {command}}`:
- exit 2 for: `git commit -m x`, `cd a && git commit -m x`, `git -C repo push`, `git  merge main`, `git rebase main`, `git worktree add ../w`.
- exit 0 for: `git add -A`, `git diff --cached`, `git status`, `git log --oneline`, `npm test`.
- same `git commit -m x` with `tool_name: 'PowerShell'` exits 2.
- stderr on block mentions `never commits` and `git add`.

`emdash-guard.js`:
- exit 2 for `Write` with `content` containing `'\u2014'`; for `Edit` with `new_string` containing it; for `MultiEdit` with one of `edits[].new_string` containing it. stderr names `tool_input.file_path`.
- exit 0 for `Edit` whose `old_string` contains it but `new_string` does not.
- Both scripts: exit 0 on stdin `''` and on `'not json'`.

- [ ] **Step 2: Run `node --test tests/hooks.test.js`; expected: FAIL (scripts missing)**

- [ ] **Step 3: Implement `block-git.js`**

Match against `tool_input.command` with
`/\bgit\b(?:\s+-{1,2}[\w-]+(?:[ =](?!commit|push|merge|rebase|worktree)\S+)?)*\s+(commit|push|merge|rebase|worktree\s+add)\b/`
(handles `-C path` style flags). On match: stderr `Blocked: this workflow never commits, pushes, merges, or rebases. Leave changes in the working tree; the main session stages finished tasks with git add and the user commits.`, exit 2. Add `// ponytail: regex, not a shell parser; a quoted "git commit" inside echo is also blocked, acceptable false positive`.

- [ ] **Step 4: Implement `emdash-guard.js`**

Collect `content`, `new_string`, and every `edits[].new_string`; if any contains `'\u2014'`, stderr `Em dash written to <file_path>. Rewrite that sentence with a comma, colon, parentheses, or two sentences; do not substitute another dash.`, exit 2.

- [ ] **Step 5: Add both entries to `hooks/hooks.json`; run `node --test tests/`; expected: all pass**

- [ ] **Step 6: Leave changes unstaged and report**

---

### Task 3: Checklist skills (`security-checklist`, `perf-budget`)

**Files:**
- Create: `skills/security-checklist/SKILL.md`, `skills/perf-budget/SKILL.md`

**Interfaces:**
- Produces: skill names `agent-workflow:security-checklist` and `agent-workflow:perf-budget`, preloaded by reviewers in Task 6.

- [ ] **Step 1: Write `security-checklist/SKILL.md`**

Frontmatter `name: security-checklist`, description starting "Use when reviewing a diff for security". Body: the eight sections from the spec (authentication and sessions; authorization and access control including RLS; input validation and output encoding; secrets and configuration; data exposure and logging; dependencies; file and network handling; client-side). Each item is a yes/no check plus "Evidence:" naming what satisfies it (a `path:line`, a command output, an advisor result). Rules at the top: scope is the diff plus code it calls; N/A items need a one-line reason; for Supabase projects run the security advisors; for dependency changes run the project's audit command (`npm audit`, `pip-audit`, or equivalent) and paste the result. Ends with the reviewer report format from the spec.

- [ ] **Step 2: Write `perf-budget/SKILL.md`**

Frontmatter `name: perf-budget`. Body: precedence rule (project `docs/agent-context/perf-budget.md` overrides defaults); the default thresholds verbatim from the spec (LCP 2.5s or less, INP 200ms or less, CLS 0.1 or less on mobile emulation; Lighthouse performance 90 or more on changed pages; initial JS 170KB gzipped or less per route; new client dependency over 30KB gzipped needs justification; no N+1; no unbounded list queries; hot-path queries need an index or an EXPLAIN; no memory growth across three repeated runs); for each threshold, how to measure it with the installed Chrome DevTools MCP tools or Supabase tools; "if you cannot measure (no running app), say so; never estimate a number". Include a template of `docs/agent-context/perf-budget.md` that bootstrap and mapping copy into projects.

- [ ] **Step 3: Run `node --test tests/`; expected: pass (skill frontmatter, no em dashes)**

- [ ] **Step 4: Leave changes unstaged and report**

---

### Task 4: Stage skills (`task-routing`, `greenfield-bootstrap`, `brownfield-mapping`)

**Files:**
- Create: `skills/task-routing/SKILL.md`, `skills/greenfield-bootstrap/SKILL.md`, `skills/brownfield-mapping/SKILL.md`
- Modify: `tests/validate.test.js` (add one content test)

**Interfaces:**
- Consumes: agent names from the Global Constraints; `perf-budget` template from Task 3.
- Produces: the `Owner:` / `Reviewers:` line format used in plans: `**Owner:** agent-workflow:frontend` and `**Reviewers:** agent-workflow:code-reviewer, agent-workflow:ui-ux-reviewer`.
- Produces: `docs/agent-context/` layout written into target projects: `map.md` (brownfield), `stack.md` (greenfield), `design-system.md`, `perf-budget.md`.

- [ ] **Step 1: Add test `routing guards dirty tree` to `validate.test.js`**

Assert `skills/task-routing/SKILL.md` and `rules/orchestration.md` both contain `unstaged` and `stop and ask`. Run; expected FAIL for the missing skill.

- [ ] **Step 2: Write `task-routing/SKILL.md`**

Body: the spec's owner table and reviewer-trigger table (agent names fully qualified); the line format above; overrides of `superpowers:subagent-driven-development`: skip `using-git-worktrees`; check `git diff --quiet` before the first task and stop and ask if unstaged changes exist; implementer subagent type is the task's `Owner`; replace "Commit your work" with "leave changes unstaged"; reviewers receive `git diff` output for the task, the plan task text, and (UI) the design brief path; run the listed reviewers in parallel; on all PASS run `git add -A`; on FAIL send blockers and should-fixes to the Owner, re-run only failing reviewers, two rounds max then stop and bring findings to the user; final pass uses `git diff HEAD` with security and performance reviewers. Fast path criteria from the spec.

- [ ] **Step 3: Write `greenfield-bootstrap/SKILL.md`**

Steps G2 from the spec: researcher confirms current stable versions of the chosen stack; `agent-workflow:ui-designer` writes `docs/agent-context/design-system.md` (tokens, type scale, spacing, base components, states); the owning builder scaffolds (framework CLI when one exists) and gets lint, test, and dev commands working; write `docs/agent-context/stack.md` (stack, versions, run/test/lint commands, conventions) and copy the `perf-budget` template. Exit check: dev server starts and the test command runs.

- [ ] **Step 4: Write `brownfield-mapping/SKILL.md`**

Stale rule: `map.md` is missing, or `git rev-list --count <commit recorded in map.md>..HEAD` is 50 or more. Dispatch `agent-workflow:codebase-mapper` to write `docs/agent-context/map.md` with sections: Stack and versions; Commands; Layout; Design system and components; Conventions; Hotspots and debt; Mapped at commit `<sha>`. Copy the `perf-budget` template if absent. Mention: use `graphify` when installed, and that graphify can send content to external LLM APIs, so ask the user before running it on private code.

- [ ] **Step 5: Run `node --test tests/`; expected: all pass**

- [ ] **Step 6: Leave changes unstaged and report**

---

### Task 5: Builder agents

**Files:**
- Create: `agents/ui-designer.md`, `agents/frontend.md`, `agents/backend.md`, `agents/database.md`, `agents/test-engineer.md`

**Interfaces:**
- Consumes: `EXPECTED` from Task 1; report contracts from `rules/orchestration.md`.

Every builder: frontmatter `name`, `description` (one line: what it owns and when to dispatch it), `model`, `effort` per `EXPECTED`, `color`, `skills:` list beginning `ponytail:ponytail`, `superpowers:test-driven-development`. Prompt modelled on the existing `~/.claude/agents/worker.md` (read callers first, follow the plan, targeted edits, verify with real command output, never commit), plus "read `docs/agent-context/` first and follow its conventions over your own preferences" and the builder report contract. Leave changes unstaged.

| Agent | Extra skills | Role-specific rules |
|---|---|---|
| `ui-designer` | `ui-ux-pro-max:ui-ux-pro-max`, `ui-ux-pro-max:design-system`, `frontend-design:frontend-design` | Writes a design brief (`docs/agent-context/briefs/<feature>.md`: layout per breakpoint 390/768/1440, hierarchy, tokens used, components, empty/loading/error states, ASCII wireframe); never writes product code; reuses `design-system.md`. Drop `test-driven-development` from its list. |
| `frontend` | `frontend-design:frontend-design`, `ui-ux-pro-max:ui-styling`, `chrome-devtools-mcp:chrome-devtools` | Implements against the brief; screenshots at 390 and 1440 before reporting and lists their paths; uses existing components and tokens before new ones. |
| `backend` | `superpowers:systematic-debugging`, `supabase:supabase` | Supabase skill only when the project uses Supabase; validates input at every trust boundary; flags anything matching the security or performance triggers in its report. |
| `database` | `supabase:supabase-postgres-best-practices`, `supabase:supabase` | Every migration reversible or states why not; no destructive change without an explicit plan step; RLS on every new table in Supabase projects. |
| `test-engineer` | `superpowers:verification-before-completion`, `run` | Writes integration, e2e, and regression tests; a regression test must fail on the old code first and the report shows that output. |

- [ ] **Step 1: Write the five files**
- [ ] **Step 2: Run `node --test tests/`; expected: pass with five agents validated**
- [ ] **Step 3: Leave changes unstaged and report**

---

### Task 6: Reviewer and reader agents

**Files:**
- Create: `agents/ui-ux-reviewer.md`, `agents/security-reviewer.md`, `agents/performance-reviewer.md`, `agents/code-reviewer.md`, `agents/db-reviewer.md`, `agents/codebase-mapper.md`

**Interfaces:**
- Consumes: `agent-workflow:security-checklist`, `agent-workflow:perf-budget` (Task 3); `EXPECTED` (Task 1).

Every reviewer: frontmatter as in Task 5 plus `disallowedTools: Write, Edit, NotebookEdit`. Prompt: you receive a task's `git diff`, the plan task, and context paths; review only what you own; first line `VERDICT: PASS` or `VERDICT: FAIL`; findings with severity (blocker, should-fix, nit), `path:line`, evidence; a finding without evidence is not allowed; nits never fail; say what you could not check. Bash only for read-only commands and measurements.

| Agent | Skills | What it checks |
|---|---|---|
| `ui-ux-reviewer` | `chrome-devtools-mcp:a11y-debugging`, `chrome-devtools-mcp:chrome-devtools`, `ui-ux-pro-max:ui-ux-pro-max` | Brief match; screenshots at 390/768/1440 taken by itself; contrast, focus order, labels, keyboard; states present; generic "template" look counts as should-fix with a concrete fix. |
| `security-reviewer` | `agent-workflow:security-checklist`, `chrome-devtools-mcp:cookie-debugging`, `supabase:supabase` | Walks the checklist item by item. |
| `performance-reviewer` | `agent-workflow:perf-budget`, `chrome-devtools-mcp:debug-optimize-lcp`, `chrome-devtools-mcp:memory-leak-debugging`, `supabase:supabase-postgres-best-practices` | Measures against the budget; numbers or "could not measure", never estimates. |
| `code-reviewer` | `ponytail:ponytail-review`, `simplify` | Correctness against the plan task first, then over-engineering. |
| `db-reviewer` | `supabase:supabase-postgres-best-practices` | Reversibility, locking on large tables, data loss, indexes, constraints, RLS. |
| `codebase-mapper` | `ponytail:ponytail-audit`, `graphify` | Not a diff reviewer: writes only `docs/agent-context/map.md`, so it gets `disallowedTools: Edit, NotebookEdit` plus a rule "Write is allowed only for `docs/agent-context/map.md`". Adjust its `EXPECTED.reviewer` check: the validator requires `Edit` but not `Write` for this agent. |

- [ ] **Step 1: Adjust the validator for `codebase-mapper` (requires `Edit`, not `Write`, in `disallowedTools`)**
- [ ] **Step 2: Write the six files**
- [ ] **Step 3: Run `node --test tests/`; expected: all pass, eleven agents validated**
- [ ] **Step 4: Leave changes unstaged and report**

---

### Task 7: README, install, and end-to-end trial

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**: what it is; prerequisites (superpowers, ponytail, ui-ux-pro-max, frontend-design, chrome-devtools-mcp, supabase plugins; Node 22; graphify optional); install (`claude plugin marketplace add D:/Github/AgentWorkflow/agent-workflow`, then `claude plugin install agent-workflow@agent-workflow --scope user` so it applies in every project; `git pull` in this repo plus `claude plugin marketplace update agent-workflow` picks up changes); the user's manual steps: set `model: claude-sonnet-5-5` in `~/.claude/agents/explorer.md`, `researcher.md`, `worker.md`, and replace the "Agent workflow" section of `~/.claude/CLAUDE.md` with a two-line pointer to this plugin (the injected rules supersede it; keeping both would give the main session two rosters); how to run tests (`node --test tests/`).
- [ ] **Step 2: Main session (with the user's go-ahead) runs the install commands, starts a new session, and checks:** `/agents` lists all eleven `agent-workflow:*` agents with no load errors (if `disallowedTools`, `effort`, or a preloaded built-in skill such as `simplify` or `run` is rejected, fix the frontmatter and note it in the README); the rules appear in context; `git commit -m test` is blocked; a Write containing `\u2014` is flagged.
- [ ] **Step 3: End-to-end trial** in a scratch copy of a small existing web project: one brownfield change touching UI and an API route. Confirm: map written, plan tasks carry `Owner`/`Reviewers`, the right specialists are dispatched, reviewers return `VERDICT` lines with evidence, tasks end staged and uncommitted. Record which Sonnet agents (if any) fell short; those go back to Opus.
- [ ] **Step 4: Leave everything unstaged and report what is ready to commit**
