const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const EM = '\u2014';

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

const SKIP_DIRS = new Set(['.git', 'node_modules', '.devswarm-temp', '.superpowers']);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(path.join(dir, e.name));
    } else yield path.join(dir, e.name);
  }
}

// Parses the leading --- block: `key: value` lines and `- item` lists.
function frontmatter(file) {
  const m = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${file}: no frontmatter`);
  const fm = {};
  let key = null;
  for (const line of m[1].split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/);
    const kv = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (item && key) (fm[key] = Array.isArray(fm[key]) ? fm[key] : []).push(item[1].trim());
    else if (kv) { key = kv[1]; fm[key] = kv[2].trim(); }
  }
  return fm;
}

const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean));
const ls = (d) => (fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)) : []);
const agentFiles = ls('agents').filter((f) => f.endsWith('.md'));

test('no em dashes', () => {
  const hits = [];
  for (const f of walk(root)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (l.includes(EM)) hits.push(`${path.relative(root, f)}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(hits, []);
});

test('agent frontmatter', () => {
  for (const f of agentFiles) {
    const stem = f.replace(/\.md$/, '');
    const exp = EXPECTED[stem];
    assert.ok(exp, `unplanned agent: ${f}`);
    const fm = frontmatter(path.join(root, 'agents', f));
    assert.strictEqual(fm.name, stem, `${f}: name`);
    assert.ok(fm.description, `${f}: description`);
    assert.strictEqual(fm.model, exp.model, `${f}: model`);
    assert.strictEqual(fm.effort, exp.effort, `${f}: effort`);
    if (exp.reviewer) {
      const dis = list(fm.disallowedTools);
      // codebase-mapper writes only docs/agent-context/map.md, so Write is allowed.
      const need = stem === 'codebase-mapper' ? ['Edit'] : ['Write', 'Edit'];
      for (const t of need) assert.ok(dis.includes(t), `${f}: disallowedTools lacks ${t}`);
    }
  }
});

test('skill frontmatter', () => {
  for (const d of ls('skills')) {
    const file = path.join(root, 'skills', d, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const fm = frontmatter(file);
    assert.strictEqual(fm.name, d, `${d}: name`);
    assert.ok(fm.description, `${d}: description`);
  }
});

test('routing guards dirty tree', () => {
  for (const f of ['skills/task-routing/SKILL.md', 'rules/orchestration.md']) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const s of ['unstaged', 'stop and ask']) assert.ok(text.includes(s), `${f}: lacks "${s}"`);
  }
});

test('local skill refs', () => {
  for (const f of agentFiles) {
    for (const s of list(frontmatter(path.join(root, 'agents', f)).skills)) {
      const m = s.match(/^agent-workflow:(.+)$/);
      if (m) assert.ok(fs.existsSync(path.join(root, 'skills', m[1], 'SKILL.md')), `${f}: missing skill ${m[1]}`);
    }
  }
});
