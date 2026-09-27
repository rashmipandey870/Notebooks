const assert = require('assert');
const { parseDikshaHierarchyNodes } = require('../src/services/dikshaService');

function runCrossScriptTransliterationDedupTests() {
  console.log("========================================================");
  console.log("RUNNING CROSS-SCRIPT & TRANSLITERATION MERGING TEST");
  console.log("========================================================\n");

  // Synthetic Hierarchy mirroring nodes 31–36 of 10 हिन्दी वल्लरी
  const syntheticNodes = [
    {
      identifier: 'node_31',
      name: 'अभिनव मनुष्य ABHINAV AMNUSHY (1)',
      mimeType: 'application/pdf',
      artifactUrl: 'https://example.com/abhinav_manushya.pdf',
      startPage: '10',
      endPage: '14'
    },
    {
      identifier: 'node_32',
      name: 'ABHINAV MANUSHYA[ROW]',
      mimeType: 'application/pdf',
      artifactUrl: 'https://example.com/abhinav_manushya.pdf',
      startPage: null,
      endPage: null
    },
    {
      identifier: 'node_33',
      name: 'Mera bachpan',
      mimeType: 'application/pdf',
      artifactUrl: 'https://example.com/mera_bachpan.pdf',
      startPage: '15',
      endPage: '20'
    },
    {
      identifier: 'node_34',
      name: '05 MERA BACHAPANA',
      mimeType: 'application/pdf',
      startPage: '15',
      endPage: '20'
    },
    {
      identifier: 'node_35',
      name: 'मेरा बचपन mera bachapan 10',
      mimeType: 'application/pdf',
      startPage: null,
      endPage: null
    },
    {
      identifier: 'node_36',
      name: 'MERA BACHAPAN',
      mimeType: 'application/pdf',
      artifactUrl: 'https://example.com/mera_bachpan.pdf',
      startPage: '15',
      endPage: '20'
    }
  ];

  const state = { chapterNumber: 1 };
  const rootBookPdfUrl = 'https://example.com/full_book.pdf';

  const chapters = parseDikshaHierarchyNodes(
    syntheticNodes,
    1,
    rootBookPdfUrl,
    state,
    'Class 10',
    'Hindi',
    new Map(),
    rootBookPdfUrl,
    'Hindi'
  );

  console.log(`  Parsed Chapters Count: ${chapters.length}`);
  chapters.forEach(ch => {
    console.log(`  - Ch ${ch.chapterNumber}: "${ch.title}" (PDF: ${ch.pdfUrl}, startPage: ${ch.startPage}, endPage: ${ch.endPage}, isFallback: ${ch.isFallbackToBookPdf})`);
  });

  // Assertion 1: Nodes 31-36 must be collapsed into EXACTLY 2 distinct chapters
  assert.strictEqual(chapters.length, 2, 'Nodes 31-36 must collapse into exactly 2 distinct chapter entries');

  // Assertion 2: Ch 1 display title must be native Devanagari script "अभिनव मनुष्य"
  assert.strictEqual(chapters[0].title, 'अभिनव मनुष्य', 'Chapter 1 must use native Devanagari title "अभिनव मनुष्य"');
  assert.strictEqual(chapters[0].pdfUrl, 'https://example.com/abhinav_manushya.pdf', 'Chapter 1 must have leaf PDF URL');
  assert.strictEqual(chapters[0].startPage, 10, 'Chapter 1 startPage must be 10');
  assert.strictEqual(chapters[0].endPage, 14, 'Chapter 1 endPage must be 14');

  // Assertion 3: Ch 2 display title must elevate native Devanagari "मेरा बचपन" over Roman transliterations
  assert.strictEqual(chapters[1].title, 'मेरा बचपन', 'Chapter 2 must elevate native Devanagari title "मेरा बचपन" over Roman transliterations');
  assert.strictEqual(chapters[1].pdfUrl, 'https://example.com/mera_bachpan.pdf', 'Chapter 2 must merge leaf PDF URL from Node 33/36');
  assert.strictEqual(chapters[1].startPage, 15, 'Chapter 2 startPage must be 15');
  assert.strictEqual(chapters[1].endPage, 20, 'Chapter 2 endPage must be 20');
  assert.strictEqual(chapters[1].isFallbackToBookPdf, false, 'Chapter 2 must have isFallbackToBookPdf: false');

  console.log("  -> SUCCESS: All cross-script & transliteration deduplication assertions passed!\n");
}

if (require.main === module) {
  runCrossScriptTransliterationDedupTests();
}

module.exports = { runCrossScriptTransliterationDedupTests };
