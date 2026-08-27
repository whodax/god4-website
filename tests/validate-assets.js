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
  .filter((reference) => !external.test(reference))
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

const dbyFile = path.join(root, 'js', 'bible', 'dby.js');
if (fs.existsSync(dbyFile)) {
  const dbySource = fs.readFileSync(dbyFile, 'utf8');
  if (/\\\+?w(?:\*|\s)|strong="/i.test(dbySource)) {
    console.error('Residual USFM markup found in js/bible/dby.js');
    process.exit(1);
  }
}

const websterFile = path.join(root, 'js', 'bible', 'webster.js');
if (fs.existsSync(websterFile)) {
  const websterSource = fs.readFileSync(websterFile, 'utf8');
  if (/\\[A-Za-z+]|strong="/i.test(websterSource)) {
    console.error('Residual source-format markup found in js/bible/webster.js');
    process.exit(1);
  }
}

const rvFile = path.join(root, 'js', 'bible', 'rv.js');
if (fs.existsSync(rvFile)) {
  const rvSource = fs.readFileSync(rvFile, 'utf8');
  if (/\\[A-Za-z+]|strong="/i.test(rvSource)) {
    console.error('Residual source-format markup found in js/bible/rv.js');
    process.exit(1);
  }
}

const gnvFile = path.join(root, 'js', 'bible', 'gnv.js');
if (fs.existsSync(gnvFile)) {
  const gnvSource = fs.readFileSync(gnvFile, 'utf8');
  if (/\\[A-Za-z+]|strong="/i.test(gnvSource)) {
    console.error('Residual source-format markup found in js/bible/gnv.js');
    process.exit(1);
  }
}

console.log(`Parsed ${references.length} asset reference(s); checked local files for existence.`);
console.log(`Checked JavaScript syntax for ${javascript.length} file(s).`);
