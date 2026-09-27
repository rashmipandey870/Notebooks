const assert = require('assert');
const { searchDikshaBooks, dedupeByIdentifier, dedupeByCompositeKey } = require('../src/services/dikshaService');
const persistentCache = require('../src/services/persistentCache');

async function runSearchDeduplicationRegressionTests() {
  console.log('========================================================');
  console.log('RUNNING SEARCH DEDUPLICATION REGRESSION TEST SUITE');
  console.log('========================================================\n');

  // TEST 1: Unit Test for dedupeByIdentifier
  console.log('TEST 1: Testing dedupeByIdentifier with duplicate content IDs...');
  const duplicateIdInput = [
    { id: 'do_123', title: 'Book A', board: 'Gujarat', gradeLevel: ['Class 10'], subject: ['Science'], medium: ['Gujarati'] },
    { id: 'do_123', title: 'Book A (Duplicate)', board: 'State (Gujarat)', gradeLevel: ['Class 10'], subject: ['Science'], medium: ['Gujarati'] },
    { id: 'do_456', title: 'Book B', board: 'Gujarat', gradeLevel: ['Class 10'], subject: ['Science'], medium: ['Gujarati'] }
  ];
  const dedupedIds = dedupeByIdentifier(duplicateIdInput);
  assert.strictEqual(dedupedIds.length, 2, 'dedupeByIdentifier should reduce 3 items to 2 unique IDs');
  assert.strictEqual(dedupedIds[0].id, 'do_123');
  assert.strictEqual(dedupedIds[1].id, 'do_456');
  console.log('  -> TEST 1 PASSED: dedupeByIdentifier verified!\n');

  // TEST 2: Unit Test for dedupeByCompositeKey (Same metadata under different IDs vs distinct medium editions)
  console.log('TEST 2: Testing dedupeByCompositeKey for edition dedup & medium preservation...');
  const compositeKeyInput = [
    { id: 'do_101', title: 'Science Class 10', board: 'Gujarat', gradeLevel: ['Class 10'], subject: ['Science'], medium: ['Gujarati'] },
    { id: 'do_102', title: 'Science Class 10', board: 'Gujarat', gradeLevel: ['Class 10'], subject: ['Science'], medium: ['Gujarati'] }, // Duplicate metadata edition
    { id: 'do_103', title: 'Science Class 10', board: 'Gujarat', gradeLevel: ['Class 10'], subject: ['Science'], medium: ['English'] }   // Distinct English medium edition
  ];
  const dedupedComposite = dedupeByCompositeKey(compositeKeyInput);
  assert.strictEqual(dedupedComposite.length, 2, 'Should collapse identical metadata edition but preserve English medium edition');
  assert.strictEqual(dedupedComposite[0].medium[0], 'Gujarati');
  assert.strictEqual(dedupedComposite[1].medium[0], 'English');
  console.log('  -> TEST 2 PASSED: dedupeByCompositeKey preserves distinct mediums while deduplicating editions!\n');

  // Clear cache for live search API test runs
  persistentCache.clear();

  // TEST 3: Multi-alias State Board Search (Gujarat, Maharashtra, Bihar)
  const testBoards = [
    { code: 'GJ', name: 'Gujarat', grade: 'Class 10', subject: 'Science' },
    { code: 'MH', name: 'Maharashtra', grade: 'Class 10', subject: 'Science' },
    { code: 'BIHAR', name: 'Bihar', grade: 'Class 10', subject: 'Science' },
    { code: 'CBSE', name: 'CBSE', grade: 'Class 10', subject: 'English' }
  ];

  for (const b of testBoards) {
    console.log(`TEST 3 [${b.code}]: Resolving live search results for ${b.name} (${b.grade} ${b.subject})...`);
    persistentCache.delete(`search:${JSON.stringify({ board: b.code, gradeLevel: b.grade, medium: undefined, subject: b.subject, query: undefined, contentType: undefined, limit: 20, offset: 0 })}`);

    const searchRes = await searchDikshaBooks({
      board: b.code,
      gradeLevel: b.grade,
      subject: b.subject,
      limit: 20
    });

    assert.ok(searchRes.success, `Search for ${b.code} should succeed`);
    const books = searchRes.books || [];
    console.log(`  -> Returned ${books.length} books (Raw duplicates filtered: ${searchRes.rawDuplicatesCount || 0})`);

    const seenIds = new Set();
    const duplicateIds = [];
    for (const item of books) {
      const idKey = item.dikshaId || item.id;
      if (seenIds.has(idKey)) {
        duplicateIds.push(idKey);
      }
      seenIds.add(idKey);
    }

    assert.strictEqual(duplicateIds.length, 0, `Search results for ${b.code} must contain ZERO duplicate IDs, found duplicates: [${duplicateIds.join(', ')}]`);
    assert.strictEqual(searchRes.postDedupDuplicatesCount, 0, `postDedupDuplicatesCount for ${b.code} must be 0`);
    console.log(`  -> TEST 3 [${b.code}] PASSED: 100% unique book IDs verified!\n`);
  }

  console.log('========================================================');
  console.log('ALL SEARCH DEDUPLICATION REGRESSION TESTS PASSED (100%)');
  console.log('========================================================\n');
}

if (require.main === module) {
  runSearchDeduplicationRegressionTests().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runSearchDeduplicationRegressionTests };
