const fs = require('fs');
const path = require('path');
const { BOARDS } = require('../src/config/boards');
const { CLASSES, SUBJECTS_BY_CLASS } = require('../src/config/subjects');
const { searchDikshaBooks, resolveBookReadingResource } = require('../src/services/dikshaService');

const REPORT_FILE = path.join(__dirname, '..', 'data', 'coverage_report.json');

async function runCoverageAudit() {
  console.log('========================================================');
  console.log('STARTING DIKSHA 14 BOARDS x CLASSES 8-12 COVERAGE AUDIT');
  console.log('========================================================\n');

  const startTime = Date.now();
  const matrixResults = [];
  const summary = {
    totalCombinationsTested: 0,
    successfulResolutions: 0,
    genuinelyAbsentOnDiksha: 0,
    identityMismatches: 0,
    resourceValidationFailures: 0,
    networkFailures: 0
  };

  // Run audit across all 14 boards x Classes 8-12 x Representative Core Subjects
  for (const board of BOARDS) {
    console.log(`\nAUDITING BOARD: [${board.code}] (${board.shortName})`);

    for (const cls of CLASSES) {
      const subjectsForClass = SUBJECTS_BY_CLASS[cls] || [];
      // Pick representative subjects per class (Math, Science, Social Science/Physics, English, Hindi)
      const targetSubjects = subjectsForClass.filter(s =>
        ['MATH', 'SCI', 'SOC', 'PHY', 'CHEM', 'ENG', 'HIN'].includes(s.code)
      );

      for (const subjObj of targetSubjects) {
        summary.totalCombinationsTested++;
        const entryKey = `${board.code}_${cls.replace(/\s+/g, '')}_${subjObj.code}`;

        try {
          // Step A: Search books on DIKSHA
          const searchResult = await searchDikshaBooks({
            board: board.code,
            gradeLevel: cls,
            subject: subjObj.name,
            limit: 3
          });

          if (!searchResult || !searchResult.books || searchResult.books.length === 0) {
            summary.genuinelyAbsentOnDiksha++;
            matrixResults.push({
              key: entryKey,
              board: board.code,
              class: cls,
              subject: subjObj.name,
              status: 'GENUINELY_ABSENT_ON_DIKSHA',
              reason: 'No textbook metadata entries returned from DIKSHA search API for this filter combination',
              bookCount: 0,
              bookId: null,
              pdfValid: false,
              chaptersCount: 0
            });
            console.log(`  [${entryKey}] -> GENUINELY ABSENT ON DIKSHA`);
            continue;
          }

          // Step B: Resolve the top candidate book
          const topBook = searchResult.books[0];
          const resolution = await resolveBookReadingResource(topBook.id);

          if (resolution && resolution.success && resolution.book && resolution.book.pdfValid) {
            summary.successfulResolutions++;
            matrixResults.push({
              key: entryKey,
              board: board.code,
              class: cls,
              subject: subjObj.name,
              status: 'SUCCESS',
              reason: 'RESOLVED_AND_VERIFIED',
              bookCount: searchResult.books.length,
              bookId: topBook.id,
              bookTitle: topBook.title,
              pdfUrl: resolution.book.pdfUrl,
              pdfValid: true,
              chaptersCount: resolution.book.chapters ? resolution.book.chapters.length : 0
            });
            console.log(`  [${entryKey}] -> SUCCESS (Book ID: ${topBook.id}, Chapters: ${resolution.book.chapters ? resolution.book.chapters.length : 0})`);
          } else {
            const failReason = resolution ? resolution.reason : 'RESOURCE_NOT_FOUND';
            if (failReason === 'IDENTITY_MISMATCH_ONLY') {
              summary.identityMismatches++;
            } else if (failReason === 'RESOURCE_VALIDATION_FAILED') {
              summary.resourceValidationFailures++;
            } else {
              summary.genuinelyAbsentOnDiksha++;
            }

            matrixResults.push({
              key: entryKey,
              board: board.code,
              class: cls,
              subject: subjObj.name,
              status: failReason,
              reason: resolution ? resolution.message : 'Reading resource not found',
              bookCount: searchResult.books.length,
              bookId: topBook.id,
              bookTitle: topBook.title,
              pdfValid: false,
              chaptersCount: (resolution && resolution.book && resolution.book.chapters) ? resolution.book.chapters.length : 0
            });
            console.log(`  [${entryKey}] -> FAILED: ${failReason} (${resolution ? resolution.message : 'Not found'})`);
          }
        } catch (err) {
          summary.networkFailures++;
          matrixResults.push({
            key: entryKey,
            board: board.code,
            class: cls,
            subject: subjObj.name,
            status: 'NETWORK_ERROR',
            reason: err.message,
            bookCount: 0,
            bookId: null,
            pdfValid: false,
            chaptersCount: 0
          });
          console.log(`  [${entryKey}] -> NETWORK ERROR: ${err.message}`);
        }
      }
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  const report = {
    generatedAt: new Date().toISOString(),
    durationSeconds: durationSec,
    summary: summary,
    matrix: matrixResults
  };

  const dataDir = path.dirname(REPORT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n========================================================');
  console.log('COVERAGE AUDIT SUMMARY');
  console.log('========================================================');
  console.log(`Total Combinations Tested  : ${summary.totalCombinationsTested}`);
  console.log(`Successful Resolutions     : ${summary.successfulResolutions}`);
  console.log(`Genuinely Absent on DIKSHA : ${summary.genuinelyAbsentOnDiksha}`);
  console.log(`Identity Mismatches        : ${summary.identityMismatches}`);
  console.log(`Resource Validation Fails  : ${summary.resourceValidationFailures}`);
  console.log(`Network Failures           : ${summary.networkFailures}`);
  console.log(`Report written to          : ${REPORT_FILE}`);
  console.log('========================================================\n');

  return report;
}

if (require.main === module) {
  runCoverageAudit().catch(err => {
    console.error('Audit Script Failed:', err);
    process.exit(1);
  });
}

module.exports = {
  runCoverageAudit
};
