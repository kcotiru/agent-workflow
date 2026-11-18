const fs = require('node:fs');
const path = require('node:path');

try {
  process.stdout.write(fs.readFileSync(path.join(__dirname, '..', 'rules', 'orchestration.md'), 'utf8'));
} catch {
  // Rules missing: print nothing, never block session start.
}
