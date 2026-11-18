---
name: perf-budget
description: Use when reviewing a diff for performance. Pass/fail thresholds for web vitals, Lighthouse, bundle size, queries, and memory, with how to measure each using Chrome DevTools and Supabase tools, and a template for a project's docs/agent-context/perf-budget.md.
---

# Performance budget

Check the change against the thresholds below. Every verdict rests on a measured number or a concrete code citation, never on an estimate.

## Rules

1. **Precedence:** if the project has `docs/agent-context/perf-budget.md`, its values override the defaults here. Read it first and state which file you used. Thresholds it does not mention fall back to the defaults.
2. **Scope:** only what the diff touches (changed pages, routes, queries, interactions) plus anything it now calls on a hot path.
3. **Measure a production build served locally** (the project's build command, then its start or preview command, for example `npm run build && npm run start`). Never measure a dev server: its numbers are meaningless. If no production build can run, report "could not measure: no production build".
4. **If you cannot measure (no running app, no production build, no database access, tool missing), say so** in the report for that threshold, with the reason. Never estimate a number. Verdict rule: an unmeasured threshold is listed as "not measured" and does not by itself cause FAIL. Code-level evidence of a violation (for example an N+1 or an unbounded query visible in the diff, cited by `path:line`) is a finding at normal severity, measured or not.
5. **Measure the changed state.** When a regression is suspected, also measure the base so the delta is real, not noise, but only without touching the working tree or index: a separate clone, a copy outside the repo (`git archive HEAD | tar -x -C <tempdir>`), or a deployed baseline. Never `git stash` or `git checkout`. If none is possible, report the base as not measured. Run web-vitals measurements at least twice and report both.
6. You review only; you do not edit files.

## Default thresholds

| # | Threshold | Applies when the diff touches |
|---|---|---|
| 1 | LCP 2.5s or less, INP 200ms or less, CLS 0.1 or less (mobile emulation) | A page, layout, image, font, or client component |
| 2 | Lighthouse performance score 90 or more on changed pages | A page or route |
| 3 | Initial JS 170KB gzipped or less per route | Client code, imports, routes |
| 4 | Any single new client dependency over 30KB gzipped needs justification | A client-side dependency |
| 5 | No N+1 queries | Data fetching, loops, resolvers, ORM relations |
| 6 | No unbounded list queries (must paginate or limit) | Any query returning a list |
| 7 | New queries on hot paths need an index or an EXPLAIN showing it is not needed | A new or changed query on a hot path (per-request, per-render, listed in the map's hotspots) |
| 8 | No memory growth across three repeated runs of a changed interaction | A client interaction, subscription, listener, timer, or cache |

## How to measure

Tool names are the Chrome DevTools MCP and Supabase MCP tools. Each has a fallback.

### 1. Core Web Vitals (LCP, INP, CLS)

- `emulate` a mobile device with network and CPU throttling (for example Slow 4G, 4x CPU slowdown).
- `performance_start_trace` with reload, then `performance_stop_trace`. Read LCP and CLS from the trace summary; use `performance_analyze_insight` on the LCP breakdown and layout-shift insights to name the cause.
- INP: start a trace without reload, perform the changed interaction (click, type), stop, and read the interaction latency.
- Fallback: `npx lighthouse <url> --preset=perf --form-factor=mobile --output=json` (reports LCP, CLS, TBT as an INP proxy; say it is a proxy). Otherwise "could not measure".

### 2. Lighthouse score

- `npx lighthouse <url> --only-categories=performance --form-factor=mobile --output=json` on each changed page. Report the performance score and the top failing audits. (The `lighthouse_audit` MCP tool excludes the performance category, so it cannot produce this score.)
- Fallback: "could not measure".

### 3. Initial JS per route

- Build output first: most bundlers print per-route sizes (`next build` First Load JS, `vite build` chunk sizes with gzip, `nuxi analyze`, `sveltekit` build output). Paste the lines for changed routes.
- Live check: `list_network_requests` after a cold load of the route, filtered to scripts; sum transfer sizes of scripts requested before first interaction (transfer size is compressed).
- Fallback: `npx source-map-explorer` or the bundler's analyzer. Otherwise "could not measure".

### 4. New client dependency size

- Check the gzipped size of the version added, for the imported entry point (tree-shaken), via the bundle diff from item 3 (preferred: it is the real cost in this build), or bundlephobia.com for that exact version.
- Over 30KB gzipped: the diff or plan must give a reason and say why a smaller option, an existing dependency, or a native feature does not work. No justification is a should-fix.

### 5. N+1 queries

- Code: look for a query, ORM call, or `fetch` inside a loop, `map`, per-row resolver, or per-item component. Cite `path:line`.
- Live: `list_network_requests` while loading the changed view; repeated near-identical API or PostgREST calls that scale with item count are N+1. Supabase: `query_logs` (postgres or api) during one page load to count statements.
- Pass when the count is constant regardless of item count (join, `in (...)`, embedded select, batch loader).

### 6. Unbounded list queries

- Code: every list query has `limit`, `range`, cursor or keyset pagination, or a server-enforced max. Cite `path:line`. A client-side `slice` after fetching everything does not count.
- Supabase: PostgREST `max_rows` is a safety net, not pagination; the query still needs its own limit.

### 7. Hot-path queries: index or EXPLAIN

- Supabase: `execute_sql` with `EXPLAIN (ANALYZE, BUFFERS)` on the new query with realistic parameters (use `EXPLAIN` without `ANALYZE` for writes, or wrap in a rolled-back transaction). Look for `Seq Scan` on large tables, high `rows removed by filter`, sorts spilling to disk.
- `get_advisors` with type `performance`: paste results for tables in the diff (unindexed foreign keys, RLS calling `auth.uid()` per row without `(select auth.uid())`, duplicate indexes).
- Other Postgres or SQL databases: run `EXPLAIN` through the project's DB CLI (`psql`, `mysql`, `sqlite3`).
- Pass with a matching index (cite migration `path:line`) or an EXPLAIN showing the table is small or the plan is already efficient.
- Fallback without DB access: cite the query and the index (or its absence) from migrations, and say "EXPLAIN not run".

### 8. Memory growth

- Load the page, `take_heapsnapshot` (baseline). Perform the changed interaction three times (open/close, navigate away and back, add/remove), forcing GC between runs if available, and snapshot after each.
- Fail if retained heap grows on each run with no plateau, or detached DOM nodes / listeners grow with run count. Use the `memory-leak-debugging` skill to find the retainer.
- Code evidence: listeners, intervals, subscriptions (including realtime channels), or observers added without cleanup on unmount. Cite `path:line`.
- Fallback: "could not measure" plus any code evidence.

## Severity

- **blocker:** threshold broken by a wide margin or by a pattern that scales with data (N+1, unbounded list, Seq Scan on a growing table, steady memory growth).
- **should-fix:** threshold broken narrowly, or an over-30KB dependency without justification.
- **nit:** within budget but with an obvious cheap win. Nits never cause FAIL.

## Report format

First line is exactly `VERDICT: PASS` or `VERDICT: FAIL`. FAIL if any blocker or should-fix exists. "Not measured" rows do not by themselves cause FAIL (see rule 4); list them so the main session knows what is unverified.

```
VERDICT: FAIL

Budget source: docs/agent-context/perf-budget.md (else: skill defaults)

Findings
- blocker | src/app/orders/page.tsx:31 | Fetches line items per order inside map (N+1). | Evidence: list_network_requests shows 51 requests to /rest/v1/line_items for 50 orders.
- should-fix | package.json:24 | Adds chart-lib (68KB gzipped) with no justification. | Evidence: next build First Load JS /dashboard 142KB -> 210KB.
- should-fix | src/app/orders/page.tsx:12 | New per-request filter on orders.user_id with no index. | Evidence: code only (EXPLAIN not run, no database access); no index on orders.user_id in supabase/migrations/0007.sql:12.

Measurements
| # | Threshold | Result | Method |
| 1 | LCP <= 2.5s | 2.1s, 2.3s | performance trace, Moto G emulation, Slow 4G |
| 2 | Lighthouse >= 90 | 93 | npx lighthouse, mobile, production build |
| 7 | Index or EXPLAIN | not measured: no database access | code evidence only, see should-fix 2 |
| 8 | Memory | N/A: no changed interaction |
```

## Template: `docs/agent-context/perf-budget.md`

Bootstrap and mapping copy this into projects. Edit values per project; delete a line to fall back to the default.

```markdown
# Performance budget

Overrides the defaults in the agent-workflow `perf-budget` skill. Thresholds not listed here use the defaults.

## Web vitals (mobile emulation)
- LCP: 2.5s or less
- INP: 200ms or less
- CLS: 0.1 or less
- Lighthouse performance score: 90 or more on changed pages

## Bundle
- Initial JS per route: 170KB gzipped or less
- New client dependency over 30KB gzipped: needs written justification

## Data
- No N+1 queries
- No unbounded list queries (paginate or limit)
- New hot-path queries: index, or EXPLAIN showing none is needed
- Hot paths in this project: <list routes, endpoints, or tables>

## Memory
- No growth across three repeated runs of a changed interaction

## Project notes
- How to run a production build for measurement (never the dev server): <build command, then start/preview command, URL>
- Exceptions (with reason and date): <none>
```
