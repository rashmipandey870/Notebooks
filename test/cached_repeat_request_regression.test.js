const assert = require('assert');
const { searchDikshaBooks, resolveBookReadingResource } = require('../src/services/dikshaService');
const persistentCache = require('../src/services/persistentCache');

async function runCacheRepeatRequestRegressionTests() {
  console.log("========================================================");
  console.log("RUNNING REPEAT REQUEST & CACHE WRAPPER REGRESSION SUITE");
  console.log("========================================================\n");

  // Step 0: Clear persistent cache before testing to start clean
  persistentCache.clear();

  const testBookId = 'do_3131034751904808961736'; // Known Class 9 Science textbook ID

  // Test Case 1: Repeat Request for Book Resource Resolver (Book Details)
  console.log(`TEST 1: Resolving Book ID [${testBookId}] (Uncached 1st call)...`);
  const res1 = await resolveBookReadingResource(testBookId);

  assert.strictEqual(typeof res1, 'object', 'Response must be an object');
  assert.strictEqual(res1.success, true, 'Uncached resolution must succeed');
  assert.ok(res1.book, 'Uncached response must contain top-level book property');
  assert.ok(Array.isArray(res1.book.chapters), 'Book object must contain chapters array');
  assert.strictEqual(res1.timestamp, undefined, 'Response must NOT contain outer timestamp envelope property');
  assert.strictEqual(res1.data, undefined, 'Response must NOT contain outer data envelope property');

  console.log(`  -> 1st Call Succeeded (Book Title: "${res1.book.title}", Chapters: ${res1.book.chapters.length})`);

  console.log(`TEST 2: Resolving Book ID [${testBookId}] AGAIN (Cached 2nd call)...`);
  const res2 = await resolveBookReadingResource(testBookId);

  assert.strictEqual(typeof res2, 'object', 'Cached response must be an object');
  assert.strictEqual(res2.success, true, 'Cached resolution MUST return success: true (not undefined from envelope)');
  assert.ok(res2.book, 'Cached response MUST contain top-level book property (not wrapped inside data envelope)');
  assert.strictEqual(res2.timestamp, undefined, 'Cached response MUST NOT be double-wrapped in timestamp envelope');
  assert.strictEqual(res2.data, undefined, 'Cached response MUST NOT be double-wrapped in data envelope');
  assert.strictEqual(res2.book.title, res1.book.title, 'Cached book title must match uncached title');
  assert.strictEqual(res2.book.chapters.length, res1.book.chapters.length, 'Cached chapters count must match uncached count');

  console.log(`  -> 2nd Call (Cached) PASSED cleanly! Top-level shape is identical to uncached call.\n`);

  // Test Case 3: Repeat Request for DIKSHA Books Search
  const searchOptions = { board: 'CBSE', gradeLevel: 'Class 10', subject: 'Mathematics' };
  console.log('TEST 3: Querying searchDikshaBooks (Uncached 1st call)...');
  const s1 = await searchDikshaBooks(searchOptions);

  assert.strictEqual(s1.success, true, 'Uncached search must succeed');
  assert.ok(Array.isArray(s1.books), 'Uncached search must return books array');
  assert.strictEqual(s1.timestamp, undefined, 'Search response must NOT contain timestamp envelope');
  assert.strictEqual(s1.data, undefined, 'Search response must NOT contain data envelope');

  console.log(`  -> 1st Search Call Succeeded (Returned ${s1.books.length} books)`);

  console.log('TEST 4: Querying searchDikshaBooks AGAIN (Cached 2nd call)...');
  const s2 = await searchDikshaBooks(searchOptions);

  assert.strictEqual(s2.success, true, 'Cached search MUST return success: true (not undefined)');
  assert.ok(Array.isArray(s2.books), 'Cached search MUST contain top-level books array (not nested in data envelope)');
  assert.strictEqual(s2.timestamp, undefined, 'Cached search MUST NOT be double-wrapped in timestamp envelope');
  assert.strictEqual(s2.data, undefined, 'Cached search MUST NOT be double-wrapped in data envelope');
  assert.strictEqual(s2.books.length, s1.books.length, 'Cached books count must match uncached books count');

  console.log(`  -> 2nd Search Call (Cached) PASSED cleanly! Top-level shape is identical to uncached call.\n`);

  console.log("========================================================");
  console.log("ALL CACHE REPEAT REQUEST REGRESSION TESTS PASSED (100%)");
  console.log("========================================================\n");
}

if (require.main === module) {
  runCacheRepeatRequestRegressionTests().catch(err => {
    console.error('\nREGRESSION TEST FAILED:', err);
    process.exit(1);
  });
}

module.exports = {
  runCacheRepeatRequestRegressionTests
};
