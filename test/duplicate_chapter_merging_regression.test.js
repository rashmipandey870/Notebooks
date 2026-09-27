const assert = require('assert');
const { parseDikshaHierarchyNodes, searchDikshaBooks, resolveBookReadingResource } = require('../src/services/dikshaService');

function runDuplicateChapterRegressionTests() {
  console.log("========================================================");
  console.log("RUNNING DUPLICATE CHAPTER MERGING & MCQ FILTER SUITE");
  console.log("========================================================\n");

  // TEST 1: Synthetic Hierarchy Fixture Test for Parent Unit + Child Leaf Merging
  console.log("TEST 1: Synthetic hierarchy fixture parent unit + child leaf merging...");
  
  const syntheticHierarchy = [
    {
      identifier: 'unit_dust_of_snow_folder',
      name: 'Dust of Snow',
      mimeType: 'application/vnd.ekstep.content-collection',
      primaryCategory: 'Digital Textbook',
      children: [
        {
          identifier: 'leaf_dust_of_snow_pdf',
          name: 'Dust of Snow',
          mimeType: 'application/pdf',
          artifactUrl: 'https://example.com/dust_of_snow.pdf',
          startPage: '15',
          endPage: '22'
        }
      ]
    },
    {
      identifier: 'mcq_item_fire_and_ice',
      name: 'Multiple Choice Question – Fire and Ice',
      mimeType: 'application/pdf',
      primaryCategory: 'Practice Question Set'
    },
    {
      identifier: 'unit_a_letter_to_god',
      name: 'A Letter to God',
      mimeType: 'application/pdf',
      artifactUrl: 'https://example.com/letter_to_god.pdf',
      startPage: '1',
      endPage: '14'
    }
  ];

  const state = { chapterNumber: 1 };
  const rootBookPdfUrl = 'https://example.com/full_book.pdf';

  const chapters = parseDikshaHierarchyNodes(
    syntheticHierarchy,
    1,
    rootBookPdfUrl,
    state,
    'Class 10',
    'English',
    new Map(),
    rootBookPdfUrl
  );

  console.log(`  Parsed Chapters Count: ${chapters.length}`);
  chapters.forEach(ch => {
    console.log(`  - Ch ${ch.chapterNumber}: "${ch.title}" (PDF: ${ch.pdfUrl}, startPage: ${ch.startPage}, isFallback: ${ch.isFallbackToBookPdf})`);
  });

  // Assertion 1: Exactly 2 real prose/poem chapters must be returned ("Dust of Snow" and "A Letter to God")
  assert.strictEqual(chapters.length, 2, 'Must return exactly 2 distinct chapter entries (duplicate Dust of Snow merged, MCQ filtered out)');

  // Assertion 2: MCQ item must be filtered out
  const hasMcq = chapters.some(ch => ch.title.toLowerCase().includes('multiple choice'));
  assert.strictEqual(hasMcq, false, 'MCQ assessment item must be filtered out of chapter TOC');

  // Assertion 3: Dust of Snow chapter must be forward-merged with child's PDF and page data
  const dustCh = chapters.find(ch => ch.title.toLowerCase().includes('dust of snow'));
  assert.ok(dustCh, 'Dust of Snow chapter entry must exist');
  assert.strictEqual(dustCh.pdfUrl, 'https://example.com/dust_of_snow.pdf', 'Dust of Snow chapter must have upgraded leaf PDF URL');
  assert.strictEqual(dustCh.startPage, 15, 'Dust of Snow chapter must have upgraded leaf startPage 15');
  assert.strictEqual(dustCh.isFallbackToBookPdf, false, 'Dust of Snow chapter must have isFallbackToBookPdf: false');

  console.log("  -> TEST 1 PASSED: Synthetic parent folder + child leaf forward-merging verified!\n");
}

async function runRealBookFirstFlightTest() {
  console.log("TEST 2: Resolving real DIKSHA 'First Flight' Class 10 English Textbook...");
  
  // Clear persistent cache to test fresh resolver run
  const persistentCache = require('../src/services/persistentCache');
  persistentCache.clear();

  const searchRes = await searchDikshaBooks({
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'English',
    query: 'First Flight',
    limit: 5
  });

  assert.ok(searchRes.success, 'Search for First Flight should succeed');
  assert.ok(searchRes.books.length > 0, 'First Flight search should return books');

  const firstFlightBook = searchRes.books[0];
  console.log(`  Target Book ID: [${firstFlightBook.id}] - "${firstFlightBook.title}"`);

  const resolution = await resolveBookReadingResource(firstFlightBook.id);
  assert.strictEqual(resolution.success, true, 'First Flight resolution should succeed');

  const resolvedChapters = resolution.book.chapters || [];
  console.log(`  Resolved TOC Chapter Count: ${resolvedChapters.length}`);

  // Assertion: Chapter count must be reasonable (~10-30 chapters, NOT 202 duplicate rows!)
  assert.ok(resolvedChapters.length > 0 && resolvedChapters.length <= 40, `First Flight chapter count should be reasonable (~10-30), got ${resolvedChapters.length}`);

  // Assertion: No duplicate titles in TOC
  const titlesSeen = new Set();
  const duplicateTitles = [];
  for (const ch of resolvedChapters) {
    const cleanTitle = ch.title.toLowerCase().trim();
    if (titlesSeen.has(cleanTitle)) {
      duplicateTitles.push(ch.title);
    }
    titlesSeen.add(cleanTitle);
  }

  assert.strictEqual(duplicateTitles.length, 0, `TOC must contain zero duplicate chapter titles! Duplicates found: ${duplicateTitles.join(', ')}`);

  // Assertion: Zero MCQ / Assessment items in TOC
  const mcqChapters = resolvedChapters.filter(ch => 
    ch.title.toLowerCase().includes('multiple choice') || 
    ch.title.toLowerCase().includes('mcq') ||
    ch.title.toLowerCase().includes('learning resource')
  );
  assert.strictEqual(mcqChapters.length, 0, 'TOC must contain zero MCQ or supplementary learning resource items');

  console.log("  -> TEST 2 PASSED: First Flight resolved with 0 duplicates and clean chapter count!\n");
}

if (require.main === module) {
  runDuplicateChapterRegressionTests();
  runRealBookFirstFlightTest().catch(err => {
    console.error('\nREAL BOOK TEST FAILED:', err);
    process.exit(1);
  });
}

module.exports = {
  runDuplicateChapterRegressionTests,
  runRealBookFirstFlightTest
};
