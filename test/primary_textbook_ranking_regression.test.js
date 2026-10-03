const assert = require('assert');
const { searchDikshaBooks } = require('../src/services/dikshaService');

async function runPrimaryTextbookRankingTests() {
  console.log("========================================================");
  console.log("RUNNING PRIMARY TEXTBOOK RANKING & NOISE FILTER TEST");
  console.log("========================================================\n");

  // TEST 1: CBSE Class 10 Science - Noise Filter & Primary Badge
  console.log("TEST 1: Verifying CBSE Class 10 Science primary textbook ranking...");
  const sciRes = await searchDikshaBooks({ board: 'CBSE', gradeLevel: 'Class 10', subject: 'Science', primaryOnly: 'true' });

  assert.ok(sciRes.success, 'Search for CBSE Class 10 Science must succeed');
  assert.ok(sciRes.books.length > 0, 'Must return at least 1 book');

  console.log(`  Returned ${sciRes.books.length} primary textbook(s):`);
  sciRes.books.forEach((b, i) => {
    console.log(`  - [${b.isPrimaryTextbook ? 'PRIMARY BADGE' : 'REGULAR'}] "${b.title}" (${b.publisher})`);
  });

  // Assertion 1: Top book must be marked as primary textbook
  const topSci = sciRes.books[0];
  assert.strictEqual(topSci.isPrimaryTextbook, true, 'Top Science book must be marked isPrimaryTextbook: true');
  assert.ok(topSci.badgeText && topSci.badgeText.includes('Official Main Textbook'), 'Top Science book must carry Official Main Textbook badge text');

  // Assertion 2: Zero experiment PDFs or comic books in primary results
  const hasNoise = sciRes.books.some(b => b.title.toLowerCase().includes('experiment') || b.title.toLowerCase().includes('comic book'));
  assert.strictEqual(hasNoise, false, 'Primary textbook results must contain zero experiment PDFs or comic books');

  console.log("  -> TEST 1 PASSED: CBSE Class 10 Science noise filtering and primary badging verified!\n");

  // TEST 2: CBSE Class 10 Mathematics - Primary Badge
  console.log("TEST 2: Verifying CBSE Class 10 Mathematics primary textbook ranking...");
  const mathRes = await searchDikshaBooks({ board: 'CBSE', gradeLevel: 'Class 10', subject: 'Mathematics', primaryOnly: 'true' });

  assert.ok(mathRes.success, 'Search for CBSE Class 10 Mathematics must succeed');
  assert.ok(mathRes.books.length > 0, 'Must return at least 1 book');

  console.log(`  Returned ${mathRes.books.length} primary textbook(s):`);
  mathRes.books.forEach((b, i) => {
    console.log(`  - [${b.isPrimaryTextbook ? 'PRIMARY BADGE' : 'REGULAR'}] "${b.title}" (${b.publisher})`);
  });

  const topMath = mathRes.books[0];
  assert.strictEqual(topMath.isPrimaryTextbook, true, 'Top Mathematics book must be marked isPrimaryTextbook: true');

  console.log("  -> TEST 2 PASSED: CBSE Class 10 Mathematics primary textbook ranking verified!\n");
  console.log("========================================================");
  console.log("ALL PRIMARY TEXTBOOK RANKING TESTS PASSED CLEANLY!");
  console.log("========================================================");
}

if (require.main === module) {
  runPrimaryTextbookRankingTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
}

module.exports = { runPrimaryTextbookRankingTests };
