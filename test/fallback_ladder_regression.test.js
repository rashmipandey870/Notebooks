const assert = require('assert');
const { searchDikshaBooks } = require('../src/services/dikshaService');
const persistentCache = require('../src/services/persistentCache');

async function runFallbackLadderRegressionTests() {
  console.log('========================================================');
  console.log('RUNNING FALLBACK LADDER & GAP DIAGNOSTICS REGRESSION TEST');
  console.log('========================================================\n');

  persistentCache.clear();

  // TEST 1: West Bengal Class 9 Gap Diagnostics (NO_CONTENT_PUBLISHED)
  console.log('TEST 1: Querying WB (West Bengal) Class 9 (Upstream Gap)...');
  const wbRes = await searchDikshaBooks({
    board: 'WB',
    gradeLevel: 'Class 9',
    limit: 10
  });

  console.log(`  -> Reason: [${wbRes.reason}], Total Books: ${wbRes.books.length}, ResolvedVia: [${wbRes.resolvedVia}]`);
  console.log(`  -> Message: "${wbRes.message}"`);
  assert.strictEqual(wbRes.reason, 'NO_CONTENT_PUBLISHED', 'WB Class 9 must return reason NO_CONTENT_PUBLISHED');
  assert.strictEqual(wbRes.books.length, 0, 'WB Class 9 must return 0 books');
  assert.strictEqual(wbRes.resolvedVia, 'none', 'WB Class 9 must have resolvedVia none');
  assert.ok(wbRes.message.includes('West Bengal Board'), 'Message must identify West Bengal Board');
  console.log('  -> TEST 1 PASSED: West Bengal Class 9 correctly flagged as NO_CONTENT_PUBLISHED!\n');

  // TEST 2: CBSE Class 10 Primary Query Resolution (Rung 1)
  console.log('TEST 2: Querying CBSE Class 10 Science (Rung 1 Resolution)...');
  const cbseRes = await searchDikshaBooks({
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Science',
    limit: 10
  });

  console.log(`  -> Reason: [${cbseRes.reason}], Total Books: ${cbseRes.books.length}, ResolvedVia: [${cbseRes.resolvedVia}]`);
  assert.strictEqual(cbseRes.reason, 'RESOLVED_PRIMARY', 'CBSE Class 10 Science should resolve via primary query');
  assert.strictEqual(cbseRes.resolvedVia, 'primary_query', 'resolvedVia must be primary_query');
  assert.ok(cbseRes.books.length > 0, 'CBSE Class 10 Science must return books');
  console.log('  -> TEST 2 PASSED: Primary query resolution verified!\n');

  // TEST 3: Fallback Rung 2 Resolution (Drop Medium filter)
  console.log('TEST 3: Querying UP Class 10 with non-existent medium tag (Fallback Rung 2)...');
  const upRes = await searchDikshaBooks({
    board: 'UP',
    gradeLevel: 'Class 10',
    medium: 'NonExistentMedium123',
    subject: 'Science',
    limit: 10
  });

  console.log(`  -> Reason: [${upRes.reason}], Total Books: ${upRes.books.length}, ResolvedVia: [${upRes.resolvedVia}]`);
  assert.strictEqual(upRes.reason, 'RESOLVED_VIA_FALLBACK', 'UP Class 10 with bad medium filter must resolve via fallback');
  assert.ok(upRes.resolvedVia.includes('fallback'), 'resolvedVia must indicate fallback rung');
  assert.ok(upRes.books.length > 0, 'Must return books via relaxed fallback rung');
  console.log('  -> TEST 3 PASSED: Fallback ladder rung 2 resolution verified!\n');

  console.log('========================================================');
  console.log('ALL FALLBACK LADDER REGRESSION TESTS PASSED (100%)');
  console.log('========================================================\n');
}

if (require.main === module) {
  runFallbackLadderRegressionTests().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runFallbackLadderRegressionTests };
