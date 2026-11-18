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
  if (!ti) return;
  const texts = [ti.content, ti.new_string, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e && e.new_string) : [])];
  if (texts.some((t) => typeof t === 'string' && t.includes('\u2014'))) {
    console.error(`Em dash written to ${ti.file_path}. Rewrite that sentence with a comma, colon, parentheses, or two sentences; do not substitute another dash.`);
    process.exit(2);
  }
});
