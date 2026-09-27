const assert = require('assert');
const { searchDikshaBooks, resolveBookReadingResource } = require('../src/services/dikshaService');

async function runGlobalResolverTests() {
  console.log("========================================================");
  console.log("RUNNING GLOBAL TEXTBOOK RESOURCE RESOLVER & ISOLATION SUITE");
  console.log("========================================================\n");

  const testBooks = [
    { name: 'CBSE Class 10 Math', board: 'CBSE', class: 'Class 10', subject: 'Mathematics' },
    { name: 'CBSE Class 9 Science', board: 'CBSE', class: 'Class 9', subject: 'Science' },
    { name: 'UP Board Class 10 Hindi', board: 'UP', class: 'Class 10', subject: 'Hindi' },
    { name: 'MP Board Class 8 Math', board: 'MP', class: 'Class 8', subject: 'Mathematics' },
    { name: 'MH Board Class 10 Science', board: 'MH', class: 'Class 10', subject: 'Science' }
  ];

  const resolvedBookMap = new Map();

  for (const item of testBooks) {
    console.log(`--- Testing: [${item.name}] (${item.board} - ${item.class} - ${item.subject}) ---`);
    const searchRes = await searchDikshaBooks({
      board: item.board,
      gradeLevel: item.class,
      subject: item.subject,
      limit: 5
    });

    assert.ok(searchRes.success, `Search should succeed for ${item.name}`);
    if (searchRes.books.length > 0) {
      const topBook = searchRes.books[0];
      const detailRes = await resolveBookReadingResource(topBook.id);
      if (detailRes && detailRes.success && detailRes.book) {
        const book = detailRes.book;
        console.log(`  Resolved Book ID: [${book.id}] - "${book.title}"`);
        console.log(`  PDF Valid: ${book.pdfValid}`);
        console.log(`  PDF URL: ${book.pdfUrl}`);
        console.log(`  Chapters Count: ${book.chapters ? book.chapters.length : 0}`);

        resolvedBookMap.set(book.id, {
          title: book.title,
          subject: book.subject,
          pdfUrl: book.pdfUrl,
          chapters: book.chapters || []
        });

        // Verify chapter fallback property is present
        if (book.chapters && book.chapters.length > 0) {
          const sampleCh = book.chapters[0];
          assert.strictEqual(typeof sampleCh.isFallbackToBookPdf, 'boolean', 'Chapter must contain isFallbackToBookPdf boolean property');
        }
      }
    }
  }

  console.log("\n========================================================");
  console.log("CROSS-BOOK PDF ISOLATION VERIFICATION");
  console.log("========================================================");

  const bookIds = Array.from(resolvedBookMap.keys());
  for (let i = 0; i < bookIds.length; i++) {
    for (let j = i + 1; j < bookIds.length; j++) {
      const bookA = resolvedBookMap.get(bookIds[i]);
      const bookB = resolvedBookMap.get(bookIds[j]);

      if (bookA.pdfUrl && bookB.pdfUrl) {
        assert.notStrictEqual(
          bookA.pdfUrl,
          bookB.pdfUrl,
          `Distinct books "${bookA.title}" and "${bookB.title}" must NOT share the same primary PDF URL!`
        );
      }
    }
  }

  console.log("✅ CROSS-BOOK PDF ISOLATION PASSED: All distinct books resolved unique PDF URLs!");
  console.log("========================================================\n");
}

runGlobalResolverTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
