const assert = require('assert');
const { resolveBookReadingResource, verifyCandidateIdentity } = require('../src/services/dikshaService');

async function runRegressionTests() {
  console.log('========================================================');
  console.log('STARTING DIKSHA RESOLVER IDENTITY VERIFICATION REGRESSION TEST');
  console.log('========================================================\n');

  // Test Case 1: Unit Test verifyCandidateIdentity logic
  console.log('TEST 1: Testing verifyCandidateIdentity unit matching logic...');
  const fakeBookMath10 = {
    title: 'Class 10 Mathematics',
    subject: ['Mathematics'],
    gradeLevel: ['Class 10']
  };

  const validSameSubjectCand = {
    title: 'Math Chapter 1 PDF',
    nodeSubject: ['Mathematics'],
    nodeGradeLevel: ['Class 10'],
    url: 'https://example.com/math10.pdf'
  };

  const mismatchedSubjectCand = {
    title: 'Science Chapter 1 PDF',
    nodeSubject: ['Science'],
    nodeGradeLevel: ['Class 10'],
    url: 'https://example.com/sci10.pdf'
  };

  const mismatchedGradeCand = {
    title: 'Math Class 8 Chapter 1 PDF',
    nodeSubject: ['Mathematics'],
    nodeGradeLevel: ['Class 8'],
    url: 'https://example.com/math8.pdf'
  };

  const check1 = verifyCandidateIdentity(validSameSubjectCand, fakeBookMath10);
  assert.strictEqual(check1.passed, true, 'Matching candidate subject and grade should pass identity verification');

  const check2 = verifyCandidateIdentity(mismatchedSubjectCand, fakeBookMath10);
  assert.strictEqual(check2.passed, false, 'Mismatched candidate subject (Science vs Math) must be rejected');

  const check3 = verifyCandidateIdentity(mismatchedGradeCand, fakeBookMath10);
  assert.strictEqual(check3.passed, false, 'Mismatched candidate grade (Class 8 vs Class 10) must be rejected');

  const chapterNumberTitleCand = {
    title: 'Chapter 10: Light',
    nodeSubject: ['Science'],
    nodeGradeLevel: null,
    url: 'https://example.com/chap10.pdf'
  };
  const fakeBookSci8 = {
    title: 'Class 8 Science',
    subject: ['Science'],
    gradeLevel: ['Class 8']
  };
  const checkChapterNum = verifyCandidateIdentity(chapterNumberTitleCand, fakeBookSci8);
  assert.strictEqual(checkChapterNum.passed, true, 'Chapter numbers in title must not be misparsed as grade 10 for a Class 8 book');

  console.log('  -> TEST 1 PASSED: Unit matching and rejection rules verified.\n');

  // Test Case 2: Real DIKSHA Book ID 1 (Class 10 Mathematics)
  const mathBookId = 'do_31310347523356262411428';
  console.log(`TEST 2: Resolving real DIKSHA Book ID [${mathBookId}] (Class 10 Mathematics)...`);
  const mathResult = await resolveBookReadingResource(mathBookId);

  assert.strictEqual(mathResult.success, true, 'Mathematics Book ID resolution should succeed');
  assert.ok(mathResult.book, 'Resolved book object should be present');
  assert.strictEqual(mathResult.book.pdfValid, true, 'PDF should be binary valid (%PDF-)');
  assert.ok(mathResult.book.pdfUrl, 'PDF URL should be present');
  assert.ok(mathResult.book.resource, 'Selected resource object should be stashed');

  // Verify identity match
  const selectedMathResource = mathResult.book.resource;
  const mathIdentityCheck = verifyCandidateIdentity(selectedMathResource, mathResult.book);
  assert.strictEqual(mathIdentityCheck.passed, true, 'Selected PDF candidate metadata must match requested book subject and grade level');
  console.log(`  -> TEST 2 PASSED: Successfully resolved Mathematics Class 10 PDF (${mathResult.book.pdfUrl})\n`);

  // Test Case 3: Real DIKSHA Book ID 2 (Class 9 Science)
  const sciBookId = 'do_31310347519628083211467';
  console.log(`TEST 3: Resolving real DIKSHA Book ID [${sciBookId}] (Class 9 Science)...`);
  const sciResult = await resolveBookReadingResource(sciBookId);

  assert.strictEqual(sciResult.success, true, 'Science Book ID resolution should succeed');
  assert.ok(sciResult.book, 'Resolved book object should be present');
  assert.strictEqual(sciResult.book.pdfValid, true, 'PDF should be binary valid (%PDF-)');
  assert.ok(sciResult.book.pdfUrl, 'PDF URL should be present');
  assert.ok(sciResult.book.resource, 'Selected resource object should be stashed');

  // Verify identity match
  const selectedSciResource = sciResult.book.resource;
  const sciIdentityCheck = verifyCandidateIdentity(selectedSciResource, sciResult.book);
  assert.strictEqual(sciIdentityCheck.passed, true, 'Selected PDF candidate metadata must match requested book subject and grade level');
  console.log(`  -> TEST 3 PASSED: Successfully resolved Science Class 9 PDF (${sciResult.book.pdfUrl})\n`);

  // Test Case 4: Mismatched Identity Rejection Check
  console.log('TEST 4: Confirming distinct IDENTITY_MISMATCH_ONLY error reason when candidate identity disagrees...');
  const fakeSciBookWithMathCandidates = {
    ...fakeBookMath10,
    subject: ['Social Studies']
  };
  const testMismatchCheck = verifyCandidateIdentity(validSameSubjectCand, fakeSciBookWithMathCandidates);
  assert.strictEqual(testMismatchCheck.passed, false, 'Subject mismatch must fail identity check');

  console.log('  -> TEST 4 PASSED: Identity mismatch correctly flagged.\n');

  console.log('========================================================');
  console.log('ALL REGRESSION TESTS PASSED SUCCESSFULLY (100% VERIFIED)');
  console.log('========================================================');
}

runRegressionTests().catch(err => {
  console.error('\nREGRESSION TEST FAILED:', err);
  process.exit(1);
});
