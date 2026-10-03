const express = require('express');
const router = express.Router();
const { searchDikshaBooks, getDikshaBookById, resolveBookReadingResource } = require('../services/dikshaService');

/**
 * GET /api/v1/books
 * Search / filter textbooks & learning resources across state boards from DIKSHA portal
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
      primaryOnly,
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
      primaryOnly,
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
    const resolved = await resolveBookReadingResource(bookId);

    if (!resolved || !resolved.success || !resolved.book) {
      const statusCode = resolved && resolved.reason === 'IDENTITY_MISMATCH_ONLY' ? 422 : 404;
      return res.status(statusCode).json({
        success: false,
        bookId: bookId,
        book: resolved ? resolved.book : null,
        reason: resolved ? (resolved.reason || 'RESOURCE_NOT_FOUND') : 'RESOURCE_NOT_FOUND',
        message: resolved ? (resolved.message || `Book with identifier '${bookId}' not found on DIKSHA portal`) : `Book with identifier '${bookId}' not found on DIKSHA portal`,
        rejectedCount: resolved ? (resolved.rejectedCount || 0) : 0,
        rejectedCandidates: resolved ? (resolved.rejectedCandidates || []) : []
      });
    }

    res.json(resolved);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Error resolving book details: ${err.message}`
    });
  }
});

/**
 * GET /api/v1/health/coverage
 * Exposes latest matrix coverage audit report for system observability
 */
router.get('/health/coverage', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', '..', 'data', 'coverage_report.json');

    if (fs.existsSync(reportPath)) {
      const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      return res.json({
        success: true,
        report: reportData
      });
    } else {
      return res.json({
        success: true,
        message: 'No saved coverage audit report found. Run "node scripts/audit_coverage.js" to generate a full report.',
        summary: null
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch coverage health status: ${err.message}`
    });
  }
});

router.get('/books/:id/debug', async (req, res) => {
  try {
    const bookId = req.params.id;
    const resolved = await resolveBookReadingResource(bookId);

    if (!resolved || !resolved.book) {
      return res.status(404).json({
        success: false,
        message: `Book '${bookId}' not found.`
      });
    }

    const book = resolved.book;
    res.json({
      success: resolved.success,
      bookId: book.id,
      title: book.title,
      board: book.board,
      gradeLevel: book.gradeLevel,
      subject: book.subject,
      medium: book.medium,
      pdfUrl: book.pdfUrl,
      proxyPdfUrl: book.proxyPdfUrl,
      downloadUrl: book.downloadUrl,
      pdfValid: book.pdfValid,
      reason: resolved.reason || null,
      message: resolved.message || null,
      chaptersCount: book.chapters ? book.chapters.length : 0,
      chapters: (book.chapters || []).map(ch => ({
        chapterNumber: ch.chapterNumber,
        identifier: ch.identifier,
        title: ch.title,
        level: ch.level || 1,
        startPage: ch.startPage,
        endPage: ch.endPage,
        pdfUrl: ch.pdfUrl,
        proxyPdfUrl: ch.proxyPdfUrl
      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/books/:id/debug-toc', async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await getDikshaBookById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book '${bookId}' not found.`
      });
    }

    res.json({
      bookId: book.id,
      title: book.title,
      board: book.board,
      gradeLevel: book.gradeLevel,
      subject: book.subject,
      pdfUrl: book.pdfUrl,
      chaptersCount: book.chapters ? book.chapters.length : 0,
      chapters: (book.chapters || []).map(ch => ({
        chapterNumber: ch.chapterNumber,
        identifier: ch.identifier,
        title: ch.title,
        level: ch.level || 1,
        startPage: ch.startPage,
        endPage: ch.endPage,
        pdfUrl: ch.pdfUrl,
        proxyPdfUrl: ch.proxyPdfUrl
      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
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
