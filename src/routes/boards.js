const express = require('express');
const router = express.Router();
const { BOARDS, getBoardByCode } = require('../config/boards');
const { CLASSES, SUBJECTS_BY_CLASS, MEDIUMS } = require('../config/subjects');

/**
 * GET /api/v1/boards
 * List all supported Indian State & Central Boards
 */
router.get('/boards', (req, res) => {
  res.json({
    success: true,
    count: BOARDS.length,
    boards: BOARDS
  });
});

/**
 * GET /api/v1/boards/:code
 * Get details for a specific board by code (e.g., UP, MP, MH, CBSE, BIHAR)
 */
router.get('/boards/:code', (req, res) => {
  const board = getBoardByCode(req.params.code);
  if (!board) {
    return res.status(404).json({
      success: false,
      message: `Board '${req.params.code}' not found. Supported codes: ${BOARDS.map(b => b.code).join(', ')}`
    });
  }
  res.json({
    success: true,
    board: board
  });
});

/**
 * GET /api/v1/classes
 * List supported classes (Class 8 to Class 12)
 */
router.get('/classes', (req, res) => {
  res.json({
    success: true,
    count: CLASSES.length,
    classes: CLASSES
  });
});

/**
 * GET /api/v1/subjects
 * Get supported subjects filtered by class (e.g. ?class=Class 10 or ?class=10)
 */
router.get('/subjects', (req, res) => {
  let grade = req.query.class || req.query.gradeLevel || 'Class 10';
  if (!grade.startsWith('Class')) {
    grade = `Class ${grade}`;
  }

  const subjects = SUBJECTS_BY_CLASS[grade] || SUBJECTS_BY_CLASS['Class 10'];

  res.json({
    success: true,
    gradeLevel: grade,
    count: subjects.length,
    subjects: subjects
  });
});

/**
 * GET /api/v1/mediums
 * List supported mediums of instruction
 */
router.get('/mediums', (req, res) => {
  res.json({
    success: true,
    count: MEDIUMS.length,
    mediums: MEDIUMS
  });
});

module.exports = router;
