let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cmd;
  try {
    cmd = JSON.parse(input).tool_input.command;
  } catch {
    return;
  }
  // ponytail: regex, not a shell parser; a quoted "git commit" inside echo is also blocked, acceptable false positive
  const re = /\bgit(?:\.exe)?\b(?:\s+-{1,2}[\w-]+(?:[ =](?!commit|push|merge|rebase|worktree)\S+)?)*\s+(commit|push|merge|rebase|worktree\s+add)(?![\w-])/;
  if (typeof cmd === 'string' && re.test(cmd)) {
    console.error('Blocked: this workflow never commits, pushes, merges, or rebases. Leave changes in the working tree; the main session stages finished tasks with git add and the user commits.');
    process.exit(2);
  }
});
