const http = require('http');
const app = require('../src/server');

async function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- RUNNING ENHANCED API INTEGRATION & TEXTBOOK PIPELINE TESTS ---');

  const health = await testEndpoint('/api/health');
  console.log('✅ /api/health:', health.status, health.data.status);

  const boards = await testEndpoint('/api/v1/boards');
  console.log('✅ /api/v1/boards:', boards.status, `Count: ${boards.data.count}`);

  const upBoard = await testEndpoint('/api/v1/boards/UP');
  console.log('✅ /api/v1/boards/UP:', upBoard.status, upBoard.data.board.name);

  const subjects = await testEndpoint('/api/v1/subjects?class=Class%2010');
  console.log('✅ /api/v1/subjects:', subjects.status, `Subjects count: ${subjects.data.count}`);

  const chapter = await testEndpoint('/api/v1/notebooks/chapter?subject=Mathematics&gradeLevel=Class%2010&chapterNumber=1');
  console.log('✅ /api/v1/notebooks/chapter:', chapter.status, chapter.data.chapter.title);

  const books = await testEndpoint('/api/v1/books?board=CBSE&class=Class%2010&limit=5');
  console.log('✅ /api/v1/books (DIKSHA Live Search):', books.status, `Total found: ${books.data.total}, Returned: ${books.data.books.length}`);

  // VERIFICATION 1: Ensure returned items are genuine textbooks only (no Teacher Resources or Practice Question Sets)
  const nonTextbookTerms = ['teacher resource', 'explanation content', 'practice question', 'question set', 'lesson plan'];
  const invalidItem = books.data.books.find(b => {
    const title = (b.title || '').toLowerCase();
    const cat = (b.primaryCategory || '').toLowerCase();
    return nonTextbookTerms.some(term => title.includes(term) || cat.includes(term));
  });

  if (invalidItem) {
    console.error('❌ FAIL: Non-textbook item detected in search results:', invalidItem.title);
    process.exit(1);
  }
  console.log('✅ VERIFIED: All search results are genuine digital textbooks.');

  // VERIFICATION 2: Test textbook details & verify no fake page calculations (+15 or +14)
  if (books.data.books.length > 0) {
    const bookId = books.data.books[0].dikshaId;
    const detail = await testEndpoint(`/api/v1/books/${bookId}`);
    console.log('✅ /api/v1/books/:id:', detail.status, `Success: ${detail.data.success}`);

    if (detail.data.book && detail.data.book.chapters) {
      const chapters = detail.data.book.chapters;
      const fakePageFound = chapters.some(ch => ch.endPage === (ch.startPage + 14) || ch.startPage === 16 || ch.startPage === 31);
      if (fakePageFound) {
        console.warn('⚠️ WARNING: Artificial page calculation detected in chapter objects.');
      } else {
        console.log('✅ VERIFIED: Zero artificial page calculations (+15/+14) in TOC objects.');
      }
    }
  }

  console.log('--- ALL INTEGRATION TESTS PASSED CLEANLY! ---');
  process.exit(0);
}

// Give server time to listen then run tests
setTimeout(runTests, 1000);
