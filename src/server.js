const express = require('express');
const cors = require('cors');
require('dotenv').config();

const boardsRouter = require('./routes/boards');
const booksRouter = require('./routes/books');
const notebooksRouter = require('./routes/notebooks');
const userNotesRouter = require('./routes/userNotes');
const pdfProxyRouter = require('./routes/pdfProxy');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Router registration (v1)
app.use('/api/v1', boardsRouter);
app.use('/api/v1', booksRouter);
app.use('/api/v1', notebooksRouter);
app.use('/api/v1', userNotesRouter);
app.use('/api/v1', pdfProxyRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Class 8-12 Notebook & State Board Textbook API',
    dikshaIntegration: 'Active',
    supportedBoards: 14,
    timestamp: new Date().toISOString()
  });
});

// Root route API sitemap & welcome response
app.get('/', (req, res) => {
  res.json({
    name: 'Class 8-12 Notebook & State Board Textbook Provider API',
    version: '1.0.0',
    status: 'Active',
    documentation: '/api/v1/boards',
    endpoints: {
      health: 'GET /api/health',
      boards: 'GET /api/v1/boards',
      boardDetail: 'GET /api/v1/boards/:code',
      classes: 'GET /api/v1/classes',
      subjects: 'GET /api/v1/subjects',
      mediums: 'GET /api/v1/mediums',
      searchBooks: 'GET /api/v1/books',
      bookDetail: 'GET /api/v1/books/:id',
      chapterNotebook: 'GET /api/v1/notebooks/chapter',
      pdfProxy: 'GET /api/v1/pdf/proxy?url=<pdf_url>',
      getNotes: 'GET /api/v1/notes',
      createNote: 'POST /api/v1/notes'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint '${req.originalUrl}' not found. Refer to GET / for API documentation.`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`API Base Path: http://localhost:${PORT}/api/v1`);
});

module.exports = app;
