// Agents in this roster set model and effort in their own frontmatter; a `model`
// passed at dispatch (e.g. by superpowers' Model Selection) would override it.
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let ti;
  try {
    ti = JSON.parse(input).tool_input;
  } catch {
    return;
  }
  const type = ti && ti.subagent_type;
  const pinned = typeof type === 'string' && (type.startsWith('agent-workflow:') || ['explorer', 'worker', 'researcher'].includes(type));
  if (!pinned || ti.model === undefined) return;
  const { model, ...rest } = ti;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: `Dropped model "${model}": ${type} uses the model in its own frontmatter.`,
      updatedInput: rest,
    },
  }));
});
