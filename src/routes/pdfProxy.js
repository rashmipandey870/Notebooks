const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

/**
 * GET /api/v1/pdf/proxy
 * Proxy PDF stream from DIKSHA portal storage to bypass CORS / X-Frame-Options blocking
 * Query Param:
 *   - url: Target PDF URL (must be valid HTTP/HTTPS URL from diksha.gov.in or obj.diksha.gov.in)
 */
router.get('/pdf/proxy', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Query parameter "url" is required' });
  }

  try {
    const urlObj = new URL(targetUrl);
    
    // Security check: Only allow fetching from diksha domains or cloud storage
    const hostname = urlObj.hostname;
    if (!hostname.includes('diksha.gov.in') && !hostname.includes('sunbird') && !hostname.includes('amazonaws.com')) {
      return res.status(403).json({ success: false, message: 'Proxy request allowed only for DIKSHA/Sunbird storage assets' });
    }

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
      res.status(502).json({ success: false, message: `Failed to fetch target PDF: ${err.message}` });
    });
  } catch (err) {
    res.status(400).json({ success: false, message: `Invalid URL format: ${err.message}` });
  }
});

module.exports = router;
