const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return ['.git', 'node_modules', 'test-results'].includes(entry.name)
        ? []
        : htmlFiles(path.join(directory, entry.name));
    }
    return entry.isFile() && entry.name.endsWith('.html')
      ? [path.join(directory, entry.name)]
      : [];
  });
}
for (const file of htmlFiles(root)) {
  const source = fs.readFileSync(file, 'utf8');
  const handlers = [...source.matchAll(/\s(on[a-z]+)\s*=/gi)].map((match) => match[1]);
  if (handlers.length) {
    console.error(`Inline event handler(s) in ${path.relative(root, file)}: ${handlers.join(', ')}`);
    process.exit(1);
  }
  if (/\sstyle\s*=\s*["']/i.test(source) || /<style\b/i.test(source)) {
    console.error(`Inline style in ${path.relative(root, file)}`);
    process.exit(1);
  }
}
for (const file of htmlFiles(root)) {
  const source = fs.readFileSync(file, 'utf8');
  if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(source)) {
    console.error(`Inline script in ${path.relative(root, file)}`);
    process.exit(1);
  }
}
for (const relativePath of ['js/bible/reader.js', 'js/bible/plans.js']) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (/\s+on(?:click|change|keydown)\s*=/.test(source)) {
    console.error(`Unexpected generated inline event handler in ${relativePath}`);
    process.exit(1);
  }
}
function firstPartyJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === 'vendor' ? [] : firstPartyJavaScript(path.join(directory, entry.name));
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) return [];
    return [path.join(directory, entry.name)];
  });
}
for (const file of firstPartyJavaScript(path.join(root, 'js'))) {
  const source = fs.readFileSync(file, 'utf8');
  if (/\.style\s*(?:\.|\[|=)|\bcssText\b|setAttribute\s*\(\s*["']style["']|\sstyle\s*=\s*["']/i.test(source)) {
    console.error(`Runtime inline-style pattern in ${path.relative(root, file)}`);
    process.exit(1);
  }
}
const references = [
  ...[...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map((m) => m[1]),
  ...[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]),
];
const external = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;
const localReferences = references
  .filter((reference) => !external.test(reference))
  .map((reference) => reference.split(/[?#]/, 1)[0]);
const missing = localReferences
  .filter((reference) => !fs.existsSync(path.join(root, reference)));

if (missing.length) {
  console.error(`Missing local asset(s): ${missing.join(', ')}`);
  process.exit(1);
}

const javascript = localReferences
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
