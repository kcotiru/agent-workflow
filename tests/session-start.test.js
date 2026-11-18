const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('session-start prints the orchestration rules', () => {
  const r = spawnSync('node', [path.join(root, 'hooks', 'session-start.js')], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const s of ['# Agent Orchestration Rules', 'agent-workflow:task-routing', 'git add']) {
    assert.ok(r.stdout.includes(s), `stdout missing: ${s}`);
  }
});
