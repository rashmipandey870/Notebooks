const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// Approved domains for SSRF security check
const ALLOWED_DOMAINS = [
  'diksha.gov.in',
  'obj.diksha.gov.in',
  'files.odev.oci.diksha.gov.in',
  'ncert.nic.in',
  'ncert.gov.in',
  'nroer.gov.in',
  'ekstep.in',
  'sunbird.org',
  'cloudfront.net',
  'amazonaws.com'
];

function isDomainAllowed(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch (e) {
    return false;
  }
}

/**
 * GET /api/v1/pdf/proxy
 * Binary stream proxy for textbook PDFs to bypass CORS and iframe restrictions.
 * Query Params:
 *   - url: Upstream PDF URL
 */
router.get('/pdf/proxy', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Query parameter "url" is required' });
  }

  if (!isDomainAllowed(targetUrl)) {
    return res.status(403).json({ success: false, message: 'Proxy request allowed only for approved educational content domains' });
  }

  try {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/pdf,application/octet-stream,*/*'
    };

    if (req.headers.range) {
      requestHeaders['Range'] = req.headers.range;
    }

    const proxyReq = client.get(targetUrl, { headers: requestHeaders }, proxyRes => {
      // Handle redirects recursively (up to 5 levels)
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        return res.redirect(`/api/v1/pdf/proxy?url=${encodeURIComponent(redirectUrl)}`);
      }

      if (proxyRes.statusCode >= 400) {
        return res.status(proxyRes.statusCode).json({
          success: false,
          message: `Upstream server returned HTTP ${proxyRes.statusCode}`
        });
      }

      // Force proper PDF binary headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      if (proxyRes.headers['content-range']) {
        res.setHeader('Content-Range', proxyRes.headers['content-range']);
        res.status(206);
      } else {
        res.status(200);
      }

      // Stream raw binary without string conversion
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('PDF Proxy network error:', err.message);
      res.status(502).json({ success: false, message: `Failed to fetch PDF content: ${err.message}` });
    });
  } catch (err) {
    res.status(400).json({ success: false, message: `Invalid URL format: ${err.message}` });
  }
});

/**
 * GET /api/v1/download
 * Explicit binary file download endpoint with forced attachment disposition.
 * Query Params:
 *   - url: Upstream PDF URL
 *   - filename: Desired filename (e.g. Class_10_Mathematics_NCERT)
 */
router.get('/download', (req, res) => {
  const targetUrl = req.query.url;
  const rawFilename = req.query.filename || 'Textbook_NCERT';
  
  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Query parameter "url" is required' });
  }

  // Clean and sanitize filename for HTTP headers
  let cleanName = rawFilename
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  if (!cleanName.toLowerCase().endsWith('.pdf')) {
    cleanName += '.pdf';
  }

  try {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const proxyReq = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    }, proxyRes => {
      // Follow redirects
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        return res.redirect(`/api/v1/download?url=${encodeURIComponent(redirectUrl)}&filename=${encodeURIComponent(cleanName)}`);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);

      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }

      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      res.status(502).json({ success: false, message: `Failed to download file: ${err.message}` });
    });
  } catch (err) {
    res.status(400).json({ success: false, message: `Invalid URL format: ${err.message}` });
  }
});

module.exports = router;
