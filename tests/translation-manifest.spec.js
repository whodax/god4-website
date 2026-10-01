const {test, expect} = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const generator = require('../tools/generate-translation-manifest.js');

const root = path.resolve(__dirname, '..');

function generatedManifest() {
  const context = vm.createContext(Object.create(null));
  const source = fs.readFileSync(path.join(root, 'js', 'bible', 'translation-manifest.js'), 'utf8');
  vm.runInContext(source, context, {filename:'translation-manifest.js'});
  return JSON.parse(JSON.stringify(context.BibleTranslationManifest));
}

function directMetadata(bytes) {
  const digest = crypto.createHash('sha256').update(bytes).digest();
  return {
    revision:digest.toString('hex').slice(0, 16),
    integrity:`sha256-${digest.toString('base64')}`,
    bytes:bytes.length
  };
}

test('LF and CRLF source representations produce identical canonical metadata', () => {
  const lf = Buffer.from('var fixture = {\n  value: "Scripture"\n};\n', 'utf8');
  const crlf = Buffer.from(lf.toString('utf8').replace(/\n/g, '\r\n'), 'utf8');
  const lfMetadata = generator.contentMetadata(lf);
  const crlfMetadata = generator.contentMetadata(crlf);

  expect(crlfMetadata.canonicalBytes.equals(lf)).toBe(true);
  expect({
    revision:crlfMetadata.revision,
    integrity:crlfMetadata.integrity,
    bytes:crlfMetadata.byteLength,
    source:crlfMetadata.source
  }).toEqual({
    revision:lfMetadata.revision,
    integrity:lfMetadata.integrity,
    bytes:lfMetadata.byteLength,
    source:lfMetadata.source
  });
});

test('generated manifest matches canonical content for all approved translations', () => {
  const manifest = generatedManifest();
  expect(Object.keys(manifest)).toEqual(generator.translations.map(translation => translation.id));
  expect(manifest).toEqual(generator.buildManifest());
  expect(generator.validateManifest(manifest)).toBe(true);
});

test('WEB metadata matches the committed and deployed LF representation', () => {
  expect(generatedManifest().web).toMatchObject({
    revision:'e05fd1ce8dd85087',
    integrity:'sha256-4F/Rzo3YUIfkD4k+z7m1qZyxnr3Gp1/uKByyn3a13MU=',
    bytes:4194375
  });
});

test('raw CRLF metadata is rejected as stale', () => {
  const canonicalWeb = generator.canonicalDeployBytes(
    fs.readFileSync(path.join(root, 'js', 'bible', 'web.js'))
  );
  const rawCrlfWeb = Buffer.from(canonicalWeb.toString('utf8').replace(/\n/g, '\r\n'), 'utf8');
  const canonicalManifest = generator.buildManifest();
  const rawMetadata = directMetadata(rawCrlfWeb);
  const stale = {...canonicalManifest, web:{...canonicalManifest.web, ...rawMetadata}};

  expect(rawMetadata).not.toEqual({
    revision:canonicalManifest.web.revision,
    integrity:canonicalManifest.web.integrity,
    bytes:canonicalManifest.web.bytes
  });
  expect(() => generator.validateManifest(stale)).toThrow(
    'Translation manifest metadata does not match canonical deploy bytes'
  );
});
