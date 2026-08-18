const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const references = [
  ...[...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map((m) => m[1]),
  ...[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]),
];
const external = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;
const missing = references
  .filter((reference) => !external.test(reference))
  .filter((reference) => !fs.existsSync(path.join(root, reference)));

if (missing.length) {
  console.error(`Missing local asset(s): ${missing.join(', ')}`);
  process.exit(1);
}

const javascript = references
  .filter((reference) => /\.js$/i.test(reference))
  .map((reference) => path.join(root, reference));
for (const file of javascript) {
  try {
    cp.execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    console.error(`JavaScript syntax error in ${path.relative(root, file)}\n${error.stderr.toString()}`);
    process.exit(1);
  }
}

console.log(`Parsed ${references.length} asset reference(s); checked local files for existence.`);
console.log(`Checked JavaScript syntax for ${javascript.length} file(s).`);
