const { resolveBookReadingResource, searchDikshaBooks } = require('../src/services/dikshaService');
const cache = require('../src/services/persistentCache');
const assert = require('assert');

async function runTeacherHandbookRegression() {
  console.log('\n=======================================================');
  console.log('RUNNING TEACHER HANDBOOK RESOURCE RESOLUTION REGRESSION');
  console.log('=======================================================\n');

  // Clear cache for test book ID to force fresh resolution pass
  const testBookId = 'do_31428972883351961611407';
  cache.delete(`book_resource:${testBookId}`);

  console.log(`TEST: Resolving reading resources for Teacher Handbook [${testBookId}]...`);
  const resolved = await resolveBookReadingResource(testBookId);

  assert.strictEqual(resolved.success, true, 'Resource resolution should succeed for Teacher Handbook');
  assert.strictEqual(resolved.book.pdfValid, true, 'PDF should be marked valid for Teacher Handbook');
  assert.ok(resolved.book.pdfUrl, 'PDF URL must be resolved');
  assert.ok(resolved.book.chapters.length > 0, 'Chapters TOC should be populated for Teacher Handbook');

  console.log(`✅ SUCCESS: Teacher Handbook resolved ${resolved.book.chapters.length} chapters & valid PDF URL: ${resolved.book.pdfUrl}`);
  console.log('-------------------------------------------------------\n');
}

runTeacherHandbookRegression().catch(err => {
  console.error('❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
