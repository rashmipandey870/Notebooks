const express = require('express');
const router = express.Router();
const { getChapterNotebook } = require('../services/notebookService');

/**
 * GET /api/v1/notebooks/chapter
 * Fetch structured chapter notebook notes (Summary, Key Formulas, Concepts, Q&A, Flashcards)
 * Query Params:
 *   - subject: Mathematics, Science, Physics, Chemistry, etc.
 *   - gradeLevel / class: Class 8, Class 9, Class 10, Class 11, Class 12
 *   - chapterNumber / chapter: Chapter number (e.g. 1, 2, 3)
 */
router.get('/notebooks/chapter', (req, res) => {
  const {
    subject = 'Mathematics',
    class: gradeClass,
    gradeLevel,
    chapterNumber,
    chapter
  } = req.query;

  let grade = gradeLevel || gradeClass || 'Class 10';
  if (!grade.startsWith('Class')) {
    grade = `Class ${grade}`;
  }

  const chapNum = chapterNumber || chapter || 1;

  const result = getChapterNotebook(subject, grade, chapNum);
  res.json(result);
});

/**
 * GET /api/v1/notebooks/:bookId/chapter/:chapterNum
 * Fetch chapter notebook notes by bookId and chapter number
 */
router.get('/notebooks/:bookId/chapter/:chapterNum', (req, res) => {
  const { bookId, chapterNum } = req.params;
  const { subject = 'Mathematics', gradeLevel = 'Class 10' } = req.query;

  const result = getChapterNotebook(subject, gradeLevel, chapterNum);
  result.bookId = bookId;
  res.json(result);
});

module.exports = router;
