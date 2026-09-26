const express = require('express');
const router = express.Router();
const {
  getUserNotes,
  saveUserNote,
  updateUserNote,
  deleteUserNote
} = require('../services/notebookService');

/**
 * GET /api/v1/notes
 * Fetch all user personal notes & bookmarks
 */
router.get('/notes', (req, res) => {
  const notes = getUserNotes();
  res.json({
    success: true,
    count: notes.length,
    notes: notes
  });
});

/**
 * POST /api/v1/notes
 * Save a new user note or bookmark
 */
router.post('/notes', (req, res) => {
  const { title, content } = req.body;
  if (!title && !content) {
    return res.status(400).json({
      success: false,
      message: 'Note must contain a title or content'
    });
  }

  const newNote = saveUserNote(req.body);
  res.status(201).json({
    success: true,
    note: newNote
  });
});

/**
 * PUT /api/v1/notes/:id
 * Update an existing user note
 */
router.put('/notes/:id', (req, res) => {
  const updated = updateUserNote(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: `Note '${req.params.id}' not found`
    });
  }
  res.json({
    success: true,
    note: updated
  });
});

/**
 * DELETE /api/v1/notes/:id
 * Delete a user note
 */
router.delete('/notes/:id', (req, res) => {
  const deleted = deleteUserNote(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: `Note '${req.params.id}' not found`
    });
  }
  res.json({
    success: true,
    message: 'Note deleted successfully'
  });
});

module.exports = router;
