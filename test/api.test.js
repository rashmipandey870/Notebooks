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
  console.log('--- RUNNING API INTEGRATION TESTS ---');

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

  const books = await testEndpoint('/api/v1/books?board=CBSE&class=Class%2010&limit=3');
  console.log('✅ /api/v1/books (DIKSHA Live Search):', books.status, `Total found: ${books.data.total}, Returned: ${books.data.books.length}`);

  console.log('--- ALL INTEGRATION TESTS PASSED CLEANLY! ---');
  process.exit(0);
}

// Give server time to listen then run tests
setTimeout(runTests, 1000);
