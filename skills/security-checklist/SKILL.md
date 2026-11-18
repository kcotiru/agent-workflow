---
name: security-checklist
description: Use when reviewing a diff for security. OWASP-based, stack-neutral checklist walked item by item, each a yes/no check with the evidence that satisfies it, ending in the reviewer report format (VERDICT line, findings with severity, path:line, evidence).
---

# Security checklist

Walk every section below against the diff. Each item is a yes/no question. "Yes" means the code is safe on that point, and you can name the evidence. "No" is a finding.

## Rules

1. **Scope** is the diff plus the code it calls and the code that calls it (one hop each way). Read callers and callees before judging an item; a safe-looking handler can sit behind a route with no auth.
2. **Every item gets an answer:** Yes, No (finding), or N/A with a one-line reason ("N/A: diff touches no file uploads"). Silence is not allowed.
3. **Evidence is mandatory.** Acceptable evidence: a `path:line`, a command and its pasted output, an advisor result, a request/response captured with DevTools. "Looks fine" is not evidence. A finding without evidence is dropped.
4. **Supabase projects:** run `get_advisors` with type `security` and paste every result that touches tables, functions, or policies in the diff. Fallback when the MCP is unavailable: `supabase db lint` or say "could not run advisors" in the report.
5. **Dependency changes** (any lockfile or manifest in the diff): run the project's audit command (`npm audit --omit=dev`, `pnpm audit`, `yarn npm audit`, `pip-audit`, `cargo audit`, `bundle audit`, `govulncheck ./...`, or the stack's equivalent) and paste the result.
6. **Do not guess exploitability.** If you suspect a hole but cannot confirm it from code or a live request, report it as should-fix with what you saw and what would confirm it.
7. You review only; you do not edit files.

## 1. Authentication and sessions

- [ ] Every new or changed route, server action, RPC, or edge function that touches user data checks authentication before doing work. Evidence: `path:line` of the check, or the middleware/guard that covers the route.
- [ ] Identity comes from a verified source (server-side session lookup, verified JWT signature), never from a client-supplied field like `userId` in the body or a decoded-but-unverified token. Evidence: `path:line`. Supabase: server code uses `getUser()` or `getClaims()`, not `getSession()`, for trust decisions.
- [ ] Password, reset, magic-link, and OTP flows have rate limits or lockout and single-use, expiring tokens. Evidence: `path:line` or auth provider config.
- [ ] Session tokens are rotated on login and privilege change, and invalidated on logout. Evidence: `path:line`.
- [ ] Passwords stored by app code are hashed with argon2, bcrypt, or scrypt (not MD5, SHA-1, or plain SHA-256). Evidence: `path:line` of the hash call, or N/A because the auth provider stores passwords.
- [ ] Tokens, reset codes, session IDs, and unguessable resource IDs come from a CSPRNG (`crypto.randomUUID`, `crypto.getRandomValues`, `secrets`, `crypto/rand`), never `Math.random` or timestamps; secrets, tokens, and signatures are compared in constant time (`timingSafeEqual`, `hmac.compare_digest`). Evidence: `path:line` of the generator and comparison.
- [ ] Error messages do not reveal whether an account exists (login, reset, signup). Evidence: `path:line` of the message.

## 2. Authorization and access control (including RLS)

- [ ] Every read and write of a resource checks that the caller owns it or holds the role for it (no IDOR: changing an ID in the request must not expose another user's data). Evidence: `path:line` of the ownership filter or policy.
- [ ] Authorization runs on the server. Hidden buttons and client route guards are UX, not access control. Evidence: the server-side check `path:line`.
- [ ] Every new table in an exposed schema has RLS enabled, with policies for each operation it allows. Evidence: migration `path:line`, plus `get_advisors` security output showing no `rls_disabled_in_public` for it.
- [ ] Policies use `auth.uid()` (or the stack's equivalent) against the owning column. INSERT has `WITH CHECK`, UPDATE has both `USING` and `WITH CHECK`, SELECT and DELETE have `USING`. No `USING (true)` or `WITH CHECK (true)` on user data. Evidence: policy `path:line`.
- [ ] Service-role keys, admin clients, and `SECURITY DEFINER` functions are used only on the server and only where needed; definer functions set `search_path` and check the caller themselves. Evidence: `path:line`.
- [ ] Mass assignment is blocked: the server picks allowed fields; users cannot set `role`, `is_admin`, `owner_id`, `price`, or similar by adding them to the payload. Evidence: `path:line` of the allowlist or schema.

## 3. Input validation and output encoding

- [ ] All untrusted input (body, query, params, headers, cookies, webhooks, file contents) is validated with a schema or explicit checks at the trust boundary (type, length, format, range). Evidence: `path:line` of the validator.
- [ ] SQL uses parameters or a query builder; no string concatenation or template literals with user input, including in `ORDER BY`, column names, and `rpc` arguments built into dynamic SQL. Evidence: `path:line`.
- [ ] No user input reaches a shell, `eval`, `new Function`, template engine compile, deserializer, or regex built from input without escaping. Evidence: `path:line` or "grep for exec/eval/spawn in diff: none".
- [ ] HTML output is escaped by the framework; any raw-HTML sink (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `{@html}`, `|safe`) receives sanitized content (for example DOMPurify). Evidence: `path:line` of the sanitizer.
- [ ] URLs from users are checked for scheme (`http`/`https` only) before use in `href`, `src`, or redirects; redirects go only to an allowlist or relative paths (no open redirect). Evidence: `path:line`.
- [ ] State-changing requests that rely on cookies are protected against CSRF (SameSite cookies plus origin check, or tokens). Evidence: `path:line` or framework default named.

## 4. Secrets and configuration

- [ ] No secrets, keys, tokens, or passwords are hard-coded or committed (including test fixtures and `.env` files). Evidence: grep of the diff for key patterns, with output.
- [ ] Server-only secrets are not exposed to the client bundle (no service-role or private key behind `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, `EXPO_PUBLIC_` prefixes, or similar). Evidence: env var names and where they are read, `path:line`.
- [ ] Debug modes, verbose errors, test routes, and default credentials are off in production config. Evidence: config `path:line`.
- [ ] Security headers and TLS settings are not weakened by the diff. Evidence: config `path:line` or response headers captured with `list_network_requests`.

## 5. Data exposure and logging

- [ ] Responses return only the fields the client needs (no `select *` piped to the client with password hashes, tokens, emails of other users, internal flags). Evidence: `path:line` of the select or serializer.
- [ ] Logs, analytics, and error reports do not contain passwords, tokens, full card numbers, or unnecessary personal data. Evidence: `path:line` of each new log call.
- [ ] Errors returned to clients are generic; stack traces and SQL errors stay server-side. Evidence: `path:line` of the error handler.
- [ ] Security-relevant actions (login failure, permission denied, role change, deletion) are logged without sensitive values. Evidence: `path:line`, or N/A with reason.

## 6. Dependencies

- [ ] The project's audit command reports no high or critical vulnerability introduced by the diff. Evidence: pasted command output.
- [ ] Each new package is maintained (recent release, real download count), the name is spelled correctly (typosquat check), and it is needed (not replaceable by stdlib or an existing dependency). Evidence: package name, version, and registry facts.
- [ ] Versions are pinned through the lockfile, and the lockfile is updated in the diff. Evidence: lockfile `path`.
- [ ] No new install scripts (`postinstall`) from untrusted packages, and no dependency pulled from a git URL or tarball without reason. Evidence: manifest `path:line`.

## 7. File and network handling

- [ ] Uploads check type by content (magic bytes), not only extension or client MIME; enforce a size limit; store outside the web root or in object storage with generated names. Evidence: `path:line`.
- [ ] File paths built from input are normalized and confined to an allowed directory (no `../` traversal). Evidence: `path:line`.
- [ ] Storage buckets have policies: private by default, signed URLs with expiry for private files. Evidence: bucket policy `path:line` or advisor output.
- [ ] Server-side fetches of user-supplied URLs block internal targets (localhost, private ranges, cloud metadata `169.254.169.254`) and redirects to them (no SSRF). Evidence: `path:line` of the allowlist or guard.
- [ ] CORS allows only known origins; no `*` together with credentials, no reflecting the request origin unchecked. Evidence: config `path:line`.
- [ ] Webhooks verify the sender's signature before acting. Evidence: `path:line`.

## 8. Client-side

- [ ] Auth tokens are in `HttpOnly`, `Secure`, `SameSite` cookies, or if a client SDK stores them in `localStorage` that is a known, accepted design and no XSS sink exists in the diff. Evidence: cookie flags from DevTools (`list_network_requests`, `cookie-debugging` skill) or `path:line`.
- [ ] Content Security Policy is present and not loosened by the diff (no new `unsafe-inline`, `unsafe-eval`, or wildcard sources without reason). Evidence: header value or config `path:line`.
- [ ] No sensitive data in URLs (tokens, emails in query strings end up in logs and referrers). Evidence: `path:line`.
- [ ] `postMessage` handlers check `event.origin`; `target="_blank"` links to external sites use `rel="noopener"`. Evidence: `path:line`, or N/A.
- [ ] Third-party scripts are loaded from trusted sources, with Subresource Integrity where the host supports it. Evidence: `path:line`.

## Severity

- **blocker:** exploitable now or exposes data/secrets (missing auth or RLS, injection, leaked key, critical CVE).
- **should-fix:** weakens defense or likely exploitable with more conditions (missing rate limit, loose CORS, verbose errors).
- **nit:** hardening with no current exposure. Nits never cause FAIL.

## Report format

First line is exactly `VERDICT: PASS` or `VERDICT: FAIL`. FAIL if any blocker or should-fix exists.

```
VERDICT: FAIL

Findings
- blocker | src/api/orders.ts:42 | Order lookup filters by id only; any user can read any order (IDOR). | Evidence: query at :42 has no owner_id filter; no RLS on orders (get_advisors: rls_disabled_in_public, table public.orders).
- should-fix | src/auth/reset.ts:18 | Reset endpoint has no rate limit. | Evidence: handler at :18, no limiter in middleware chain (src/middleware.ts:5-30).
- nit | next.config.js:12 | CSP lacks frame-ancestors. | Evidence: header value from list_network_requests.

Checklist
1. Auth: Yes (src/middleware.ts:12), ...
2. Authorization: No, see blocker 1
6. Dependencies: N/A, no manifest or lockfile in diff
...

Commands run
- npm audit --omit=dev: found 0 vulnerabilities
- get_advisors security: <pasted results>
```
