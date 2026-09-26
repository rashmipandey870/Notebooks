const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

/**
 * GET /api/v1/pdf/proxy
 * Proxy PDF stream from storage to bypass CORS / iframe blocking
 * Query Params:
 *   - url: Target file URL
 */
router.get('/pdf/proxy', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Query parameter "url" is required' });
  }

  try {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    }, proxyRes => {
      // Follow redirects
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return res.redirect(`/api/v1/pdf/proxy?url=${encodeURIComponent(proxyRes.headers.location)}`);
      }

      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/pdf');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Disposition', 'inline');

      proxyRes.pipe(res);
    }).on('error', err => {
      res.status(502).json({ success: false, message: `Failed to fetch target asset: ${err.message}` });
    });
  } catch (err) {
    res.status(400).json({ success: false, message: `Invalid URL format: ${err.message}` });
  }
});

/**
 * GET /api/v1/download
 * Explicit file download endpoint with forced attachment disposition
 * Query Params:
 *   - url: Target file URL
 *   - filename: Desired file name for download
 */
router.get('/download', (req, res) => {
  const targetUrl = req.query.url;
  const rawFilename = req.query.filename || 'Textbook_Package';
  const sanitizeFilename = rawFilename.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Query parameter "url" is required' });
  }

  try {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    }, proxyRes => {
      // Follow redirects
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return res.redirect(`/api/v1/download?url=${encodeURIComponent(proxyRes.headers.location)}&filename=${encodeURIComponent(sanitizeFilename)}`);
      }

      const ext = targetUrl.endsWith('.pdf') ? '.pdf' : (targetUrl.endsWith('.ecar') ? '.ecar' : '.zip');
      const finalFilename = sanitizeFilename.endsWith(ext) ? sanitizeFilename : `${sanitizeFilename}${ext}`;

      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);

      proxyRes.pipe(res);
    }).on('error', err => {
      res.status(502).json({ success: false, message: `Failed to download target asset: ${err.message}` });
    });
  } catch (err) {
    res.status(400).json({ success: false, message: `Invalid URL format: ${err.message}` });
  }
});

module.exports = router;
