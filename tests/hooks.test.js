const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const DASH = '\u2014';

function run(script, obj, raw) {
  const r = spawnSync('node', [path.join(root, 'hooks', script)], {
    input: raw !== undefined ? raw : JSON.stringify(obj),
    encoding: 'utf8',
  });
  return { code: r.status, stderr: r.stderr };
}

const bash = (command, tool_name = 'Bash') => run('block-git.js', { tool_name, tool_input: { command } });

test('block-git blocks commit, push, merge, rebase, worktree add', () => {
  for (const c of ['git commit -m x', 'cd a && git commit -m x', 'git -C repo push', 'git  merge main', 'git rebase main', 'git worktree add ../w', 'git.exe commit -m x']) {
    assert.strictEqual(bash(c).code, 2, c);
  }
});

test('block-git allows add, diff, status, log, npm', () => {
  for (const c of ['git add -A', 'git diff --cached', 'git status', 'git log --oneline', 'npm test', 'git merge-base HEAD main', 'git merge-tree a b', 'git commit-graph verify']) {
    assert.strictEqual(bash(c).code, 0, c);
  }
});

test('block-git blocks PowerShell too, with guidance', () => {
  const r = bash('git commit -m x', 'PowerShell');
  assert.strictEqual(r.code, 2);
  assert.ok(r.stderr.includes('never commits'));
  assert.ok(r.stderr.includes('git add'));
});

test('emdash-guard flags Write, Edit, MultiEdit new text', () => {
  const fp = 'a.md';
  const cases = [
    { tool_name: 'Write', tool_input: { file_path: fp, content: `a ${DASH} b` } },
    { tool_name: 'Edit', tool_input: { file_path: fp, old_string: 'x', new_string: `a ${DASH} b` } },
    { tool_name: 'MultiEdit', tool_input: { file_path: fp, edits: [{ old_string: 'x', new_string: 'ok' }, { old_string: 'y', new_string: `${DASH}` }] } },
  ];
  for (const c of cases) {
    const r = run('emdash-guard.js', c);
    assert.strictEqual(r.code, 2, c.tool_name);
    assert.ok(r.stderr.includes(fp), c.tool_name);
  }
});

test('emdash-guard allows an em dash only in old_string', () => {
  const r = run('emdash-guard.js', { tool_name: 'Edit', tool_input: { file_path: 'a.md', old_string: DASH, new_string: ',' } });
  assert.strictEqual(r.code, 0);
});

test('pin-model drops model for roster agents, keeps other fields', () => {
  for (const t of ['agent-workflow:backend', 'explorer', 'worker', 'researcher']) {
    const r = spawnSync('node', [path.join(root, 'hooks', 'pin-model.js')], {
      input: JSON.stringify({ tool_name: 'Agent', tool_input: { subagent_type: t, model: 'sonnet', prompt: 'p', description: 'd' } }),
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, t);
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    assert.strictEqual(out.permissionDecision, 'allow', t);
    assert.deepStrictEqual(out.updatedInput, { subagent_type: t, prompt: 'p', description: 'd' }, t);
  }
});

test('pin-model leaves other agents and model-less calls alone', () => {
  for (const ti of [{ subagent_type: 'general-purpose', model: 'haiku', prompt: 'p' }, { subagent_type: 'agent-workflow:frontend', prompt: 'p' }, { prompt: 'p', model: 'haiku' }]) {
    const r = spawnSync('node', [path.join(root, 'hooks', 'pin-model.js')], { input: JSON.stringify({ tool_name: 'Agent', tool_input: ti }), encoding: 'utf8' });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '', JSON.stringify(ti));
  }
});

test('all guards exit 0 on empty or invalid stdin', () => {
  for (const s of ['block-git.js', 'emdash-guard.js', 'pin-model.js']) {
    assert.strictEqual(run(s, null, '').code, 0, s);
    assert.strictEqual(run(s, null, 'not json').code, 0, s);
  }
});

test('manifests parse and hook commands use quoted plugin root', () => {
  for (const f of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'hooks/hooks.json']) {
    JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
  }
  const hooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks/hooks.json'), 'utf8')).hooks;
  const cmds = Object.values(hooks).flat().flatMap((e) => e.hooks.map((h) => h.command));
  assert.ok(cmds.length >= 3);
  for (const c of cmds) assert.ok(c.startsWith('node "${CLAUDE_PLUGIN_ROOT}/hooks/'), c);
});
