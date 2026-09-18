/* ===== GOD4.US WORD STUDY BIBLE-WIDE COVERAGE AUDIT ===== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BIBLE_DIRECTORY = path.join(ROOT, 'js', 'bible');
const DICTIONARY_DIRECTORY = path.join(ROOT, 'data', 'word-study');

const TRANSLATIONS = [
  { id: 'web', abbreviation: 'WEB', file: 'web.js', variable: 'webLibrary' },
  { id: 'asv', abbreviation: 'ASV', file: 'asv.js', variable: 'asvLibrary' },
  { id: 'kjv', abbreviation: 'KJV', file: 'kjv.js', variable: 'kjvLibrary' },
  { id: 'ylt', abbreviation: 'YLT', file: 'ylt.js', variable: 'yltLibrary' },
  { id: 'dby', abbreviation: 'DBY', file: 'dby.js', variable: 'dbyLibrary' },
  { id: 'webster', abbreviation: 'WBS', file: 'webster.js', variable: 'websterLibrary' },
  { id: 'rv', abbreviation: 'RV', file: 'rv.js', variable: 'rvLibrary' },
  { id: 'gnv', abbreviation: 'GNV', file: 'gnv.js', variable: 'gnvLibrary' }
];

/*
 * Match the live Reader's renderStudyWordTokens() tokenizer exactly.
 *
 * Examples kept as one token:
 *   king's
 *   king’s
 *   well-being
 */
const READER_TOKEN_PATTERN = /[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g;

function normalizeLookupTerm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '');
}

function normalizeDictionaryTerm(value) {
  return normalizeLookupTerm(
    String(value || '').replace(/[\u2018\u2019]/g, "'")
  );
}

function tokenizeVerseText(text) {
  return String(text || '').match(READER_TOKEN_PATTERN) || [];
}

/*
 * Load a browser-style Bible data file safely in an isolated VM context.
 *
 * The translation files declare top-level const variables rather than
 * CommonJS exports, so evaluating the variable name in the same VM context
 * retrieves the library without modifying production Bible files.
 */
function loadBibleLibrary(fileName, variableName) {
  const filePath = path.join(BIBLE_DIRECTORY, fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const context = vm.createContext({});

  vm.runInContext(source, context, {
    filename: filePath,
    timeout: 30000
  });

  const library = vm.runInContext(variableName, context, {
    filename: filePath,
    timeout: 30000
  });

  if (!library || typeof library !== 'object') {
    throw new Error(`Unable to load ${variableName} from ${fileName}.`);
  }

  return library;
}

/*
 * Load the production dictionary provider itself so this audit uses the
 * same inflection-candidate logic as the browser application.
 *
 * fetch() is intentionally unnecessary here because the audit performs
 * dictionary existence checks directly against the complete local headword
 * set. We only reuse getInflectionCandidates().
 */
function loadProductionInflectionGenerator() {
  const providerPath = path.join(
    ROOT,
    'js',
    'word-study',
    'dictionary-provider.js'
  );

  const source = fs.readFileSync(providerPath, 'utf8');

  const context = vm.createContext({
    Set,
    Promise,
    String,
    Array,
    Object,
    WordStudyProvider: {
      normalizeLookupTerm
    }
  });

  vm.runInContext(source, context, {
    filename: providerPath,
    timeout: 10000
  });

  const provider = vm.runInContext(
    'DictionaryWordStudyProvider',
    context,
    {
      filename: providerPath,
      timeout: 10000
    }
  );

  if (
    !provider ||
    typeof provider.getInflectionCandidates !== 'function'
  ) {
    throw new Error(
      'DictionaryWordStudyProvider.getInflectionCandidates() is unavailable.'
    );
  }

  return function getInflectionCandidates(term) {
    return Array.from(provider.getInflectionCandidates(term));
  };
}

function loadDictionaryHeadwords() {
  if (!fs.existsSync(DICTIONARY_DIRECTORY)) {
    throw new Error(
      `Dictionary directory does not exist: ${DICTIONARY_DIRECTORY}`
    );
  }

  const headwords = new Set();

  const files = fs
    .readdirSync(DICTIONARY_DIRECTORY)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  files.forEach((fileName) => {
    const filePath = path.join(DICTIONARY_DIRECTORY, fileName);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (
      !data ||
      typeof data !== 'object' ||
      !data.entries ||
      typeof data.entries !== 'object'
    ) {
      throw new Error(`Malformed dictionary shard: ${fileName}`);
    }

    Object.keys(data.entries).forEach((word) => {
      const normalized = normalizeDictionaryTerm(word);

      if (normalized) {
        headwords.add(normalized);
      }
    });
  });

  return {
    headwords,
    shardCount: files.length
  };
}

function classifyTerm(term, headwords, getInflectionCandidates) {
  const normalized = normalizeDictionaryTerm(term);

  if (!normalized) {
    return {
      status: 'ignored',
      term: normalized
    };
  }

  if (headwords.has(normalized)) {
    return {
      status: 'exact',
      term: normalized,
      headword: normalized
    };
  }

  const candidates = getInflectionCandidates(term);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeDictionaryTerm(candidate);

    if (headwords.has(normalizedCandidate)) {
      return {
        status: 'fallback',
        term: normalized,
        headword: normalizedCandidate
      };
    }
  }

  return {
    status: 'unresolved',
    term: normalized
  };
}

function countToken(frequencies, term) {
  frequencies.set(term, (frequencies.get(term) || 0) + 1);
}

function auditTranslation(
  translation,
  library,
  headwords,
  getInflectionCandidates
) {
  const frequencies = new Map();

  let books = 0;
  let chapters = 0;
  let verses = 0;
  let occurrences = 0;

  Object.keys(library).forEach((bookId) => {
    const book = library[bookId];

    if (!book || typeof book !== 'object') {
      return;
    }

    books++;

    const chapterCount = Number(book.chapters) || 0;

    for (
      let chapterNumber = 1;
      chapterNumber <= chapterCount;
      chapterNumber++
    ) {
      const chapter = book[chapterNumber];

      if (!chapter || !Array.isArray(chapter.verses)) {
        continue;
      }

      chapters++;

      chapter.verses.forEach((verseText) => {
        verses++;

        tokenizeVerseText(verseText).forEach((token) => {
          const term = normalizeDictionaryTerm(token);

          if (!term) {
            return;
          }

          occurrences++;
          countToken(frequencies, term);
        });
      });
    }
  });

  let exactUnique = 0;
  let fallbackUnique = 0;
  let unresolvedUnique = 0;

  let exactOccurrences = 0;
  let fallbackOccurrences = 0;
  let unresolvedOccurrences = 0;

  const fallbackTerms = [];
  const unresolvedTerms = [];

  frequencies.forEach((frequency, term) => {
    const result = classifyTerm(
      term,
      headwords,
      getInflectionCandidates
    );

    if (result.status === 'exact') {
      exactUnique++;
      exactOccurrences += frequency;
      return;
    }

    if (result.status === 'fallback') {
      fallbackUnique++;
      fallbackOccurrences += frequency;

      fallbackTerms.push({
        term,
        headword: result.headword,
        frequency
      });

      return;
    }

    unresolvedUnique++;
    unresolvedOccurrences += frequency;

    unresolvedTerms.push({
      term,
      frequency
    });
  });

  fallbackTerms.sort((left, right) => {
    return (
      right.frequency - left.frequency ||
      left.term.localeCompare(right.term)
    );
  });

  unresolvedTerms.sort((left, right) => {
    return (
      right.frequency - left.frequency ||
      left.term.localeCompare(right.term)
    );
  });

  return {
    translation,
    books,
    chapters,
    verses,
    occurrences,
    uniqueTerms: frequencies.size,
    exactUnique,
    fallbackUnique,
    unresolvedUnique,
    exactOccurrences,
    fallbackOccurrences,
    unresolvedOccurrences,
    fallbackTerms,
    unresolvedTerms
  };
}

function percentage(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

function getTopLimit() {
  const argument = process.argv.find((value) => {
    return /^--top=\d+$/.test(value);
  });

  if (!argument) {
    return 50;
  }

  const value = Number(argument.split('=')[1]);

  return Number.isFinite(value) && value >= 0
    ? value
    : 50;
}

function printTranslationResult(result, topLimit) {
  const resolvedUnique =
    result.exactUnique + result.fallbackUnique;

  const resolvedOccurrences =
    result.exactOccurrences + result.fallbackOccurrences;

  console.log('');
  console.log(
    `=== ${result.translation.abbreviation} ` +
    `(${result.translation.id}) ===`
  );

  console.log(
    `Books: ${formatNumber(result.books)} | ` +
    `Chapters: ${formatNumber(result.chapters)} | ` +
    `Verses: ${formatNumber(result.verses)}`
  );

  console.log(
    `Word occurrences: ${formatNumber(result.occurrences)} | ` +
    `Unique terms: ${formatNumber(result.uniqueTerms)}`
  );

  console.log(
    `Unique coverage: ` +
    `${formatPercentage(percentage(resolvedUnique, result.uniqueTerms))} ` +
    `(${formatNumber(resolvedUnique)}/${formatNumber(result.uniqueTerms)})`
  );

  console.log(
    `Occurrence coverage: ` +
    `${formatPercentage(
      percentage(resolvedOccurrences, result.occurrences)
    )} ` +
    `(${formatNumber(resolvedOccurrences)}/` +
    `${formatNumber(result.occurrences)})`
  );

  console.log(
    `Exact: ${formatNumber(result.exactUnique)} unique / ` +
    `${formatNumber(result.exactOccurrences)} occurrences`
  );

  console.log(
    `Inflection fallback: ` +
    `${formatNumber(result.fallbackUnique)} unique / ` +
    `${formatNumber(result.fallbackOccurrences)} occurrences`
  );

  console.log(
    `Unresolved: ${formatNumber(result.unresolvedUnique)} unique / ` +
    `${formatNumber(result.unresolvedOccurrences)} occurrences`
  );

  if (topLimit > 0) {
    console.log('');
    console.log(`Top ${topLimit} unresolved terms:`);

    result.unresolvedTerms
      .slice(0, topLimit)
      .forEach((entry, index) => {
        console.log(
          `${String(index + 1).padStart(3, ' ')}. ` +
          `${entry.term} — ${formatNumber(entry.frequency)}`
        );
      });

    console.log('');
    console.log(`Top ${topLimit} inflection fallbacks:`);

    result.fallbackTerms
      .slice(0, topLimit)
      .forEach((entry, index) => {
        console.log(
          `${String(index + 1).padStart(3, ' ')}. ` +
          `${entry.term} -> ${entry.headword} — ` +
          `${formatNumber(entry.frequency)}`
        );
      });
  }
}

function printOverallSummary(results) {
  console.log('');
  console.log('=== GOD4.us WORD STUDY COVERAGE SUMMARY ===');
  console.log('');

  console.log(
    [
      'Bible',
      'Unique coverage',
      'Occurrence coverage',
      'Fallback unique',
      'Unresolved unique'
    ].join('\t')
  );

  results.forEach((result) => {
    const resolvedUnique =
      result.exactUnique + result.fallbackUnique;

    const resolvedOccurrences =
      result.exactOccurrences + result.fallbackOccurrences;

    console.log(
      [
        result.translation.abbreviation,
        formatPercentage(
          percentage(resolvedUnique, result.uniqueTerms)
        ),
        formatPercentage(
          percentage(resolvedOccurrences, result.occurrences)
        ),
        formatNumber(result.fallbackUnique),
        formatNumber(result.unresolvedUnique)
      ].join('\t')
    );
  });
}

function main() {
  const topLimit = getTopLimit();

  console.log('GOD4.us Word Study Bible-wide coverage audit');
  console.log('============================================');
  console.log('');

  const dictionary = loadDictionaryHeadwords();
  const getInflectionCandidates =
    loadProductionInflectionGenerator();

  console.log(
    `Loaded ${formatNumber(dictionary.headwords.size)} ` +
    `dictionary headwords from ` +
    `${formatNumber(dictionary.shardCount)} shards.`
  );

  const results = TRANSLATIONS.map((translation) => {
    console.log('');
    console.log(
      `Auditing ${translation.abbreviation}...`
    );

    const library = loadBibleLibrary(
      translation.file,
      translation.variable
    );

    return auditTranslation(
      translation,
      library,
      dictionary.headwords,
      getInflectionCandidates
    );
  });

  printOverallSummary(results);

  results.forEach((result) => {
    printTranslationResult(result, topLimit);
  });

  console.log('');
  console.log('Audit complete.');
}

if (require.main === module) {
  main();
}

module.exports = {
  TRANSLATIONS,
  READER_TOKEN_PATTERN,
  normalizeLookupTerm,
  normalizeDictionaryTerm,
  tokenizeVerseText,
  loadBibleLibrary,
  loadDictionaryHeadwords,
  classifyTerm,
  auditTranslation,
  percentage
};