const express = require('express');
const router = express.Router();
const { searchDikshaBooks, getDikshaBookById } = require('../services/dikshaService');

/**
 * GET /api/v1/books
 * Search / filter textbooks & learning resources across state boards from DIKSHA portal
 * Query Params:
 *   - board: Board code or filter (e.g. CBSE, UP, MP, MH, BIHAR, RJ, TN, KA)
 *   - class / gradeLevel: Class 8, 9, 10, 11, 12
 *   - medium: English, Hindi, Marathi, Tamil, etc.
 *   - subject: Mathematics, Science, Physics, Chemistry, etc.
 *   - query: Search keyword (e.g. Real Numbers, Organic Chemistry)
 *   - limit: Number of results (default 20, max 100)
 *   - offset: Pagination offset
 */
router.get('/books', async (req, res) => {
  try {
    const {
      board,
      class: gradeClass,
      gradeLevel,
      medium,
      subject,
      query,
      contentType,
      limit = 20,
      offset = 0
    } = req.query;

    const selectedGrade = gradeLevel || gradeClass;

    const result = await searchDikshaBooks({
      board,
      gradeLevel: selectedGrade,
      medium,
      subject,
      query,
      contentType,
      limit,
      offset
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch books: ${err.message}`
    });
  }
});

/**
 * GET /api/v1/books/:id
 * Get detailed metadata, chapter index & PDF links for a book by DIKSHA ID
 */
router.get('/books/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await getDikshaBookById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book with identifier '${bookId}' not found on DIKSHA portal`
      });
    }

    res.json({
      success: true,
      book: book
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Error fetching book details: ${err.message}`
    });
  }
});

/**
 * GET /api/v1/diksha/search
 * Proxy directly to raw DIKSHA Sunbird search endpoint
 */
router.get('/diksha/search', async (req, res) => {
  try {
    const result = await searchDikshaBooks(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
