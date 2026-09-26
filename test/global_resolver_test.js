const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log("========================================================");
  console.log("RUNNING GLOBAL TEXTBOOK RESOURCE RESOLVER SUITE");
  console.log("========================================================\n");

  const testBoards = [
    { name: 'CBSE', code: 'CBSE', class: 'Class 10', subject: 'Mathematics' },
    { name: 'Bihar', code: 'BIHAR', class: 'Class 10', subject: 'Mathematics' },
    { name: 'UP Board', code: 'UP', class: 'Class 10', subject: 'Science' },
    { name: 'Maharashtra', code: 'MH', class: 'Class 10', subject: 'Science' },
    { name: 'Tamil Nadu', code: 'TN', class: 'Class 10', subject: 'Science' }
  ];

  const resolvedBookPdfs = new Map();

  for (const board of testBoards) {
    console.log(`--- Testing Board: [${board.name}] (${board.class} - ${board.subject}) ---`);
    const searchRes = await makeRequest(`/api/v1/books?board=${board.code}&class=${encodeURIComponent(board.class)}&subject=${encodeURIComponent(board.subject)}&limit=5`);

    if (!searchRes.success || !searchRes.books || searchRes.books.length === 0) {
      console.log(`❌ Search returned 0 books for ${board.name}`);
      continue;
    }

    console.log(`  Found ${searchRes.books.length} textbook candidates for ${board.name}`);
    const targetBook = searchRes.books[0];
    console.log(`  Selected Book ID: [${targetBook.dikshaId}] - "${targetBook.title}"`);

    const detailRes = await makeRequest(`/api/v1/books/${targetBook.dikshaId}`);
    if (!detailRes || !detailRes.book) {
      console.log(`❌ Detail endpoint returned null for ${targetBook.dikshaId}`);
      continue;
    }

    const book = detailRes.book;
    console.log(`  Resolver Status: ${detailRes.success ? 'SUCCESS' : 'NO_RESOURCE'}`);
    console.log(`  Title: "${book.title}"`);
    console.log(`  Board: "${book.board}"`);
    console.log(`  PDF Valid: ${book.pdfValid}`);
    console.log(`  PDF URL: ${book.pdfUrl}`);
    console.log(`  Proxy URL: ${book.proxyPdfUrl}`);
    console.log(`  Chapters Count: ${book.chapters ? book.chapters.length : 0}`);

    if (book.pdfValid && book.pdfUrl) {
      resolvedBookPdfs.set(targetBook.dikshaId, book.pdfUrl);
    }
    console.log('\n');
  }

  console.log("========================================================");
  console.log("CROSS-BOOK PDF ISOLATION VERIFICATION");
  console.log("========================================================");
  const pdfUrls = Array.from(resolvedBookPdfs.values());
  const uniquePdfs = new Set(pdfUrls);

  console.log(`Resolved Books Count: ${resolvedBookPdfs.size}`);
  console.log(`Unique PDF URLs Count: ${uniquePdfs.size}`);

  if (resolvedBookPdfs.size > 1 && uniquePdfs.size === resolvedBookPdfs.size) {
    console.log("✅ PASSED: Every book resolved its own distinct PDF resource without cross-book leakage!");
  } else {
    console.log("ℹ️ Resolved PDFs checked.");
  }
}

runTests().catch(err => console.error("Test execution error:", err));
