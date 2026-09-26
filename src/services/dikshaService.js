const https = require('https');
const { getBoardByCode, BOARDS } = require('../config/boards');

const DIKSHA_BASE_URL = 'https://diksha.gov.in/api';
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins cache

/**
 * Make HTTPS POST request to DIKSHA API
 */
function makePostRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(`${DIKSHA_BASE_URL}${endpoint}`);
    
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            resolve({ error: true, statusCode: res.statusCode, message: body });
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Make HTTPS GET request to DIKSHA API or direct URLs
 */
function makeGetRequest(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            resolve({ error: true, statusCode: res.statusCode, message: body });
          }
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', err => reject(err));
    req.end();
  });
}

/**
 * Normalize DIKSHA raw item into clean Notebook API format
 */
function normalizeDikshaItem(item) {
  if (!item) return null;

  let directPdfUrl = null;
  if (item.mimeType === 'application/pdf') {
    directPdfUrl = item.artifactUrl || item.downloadUrl;
  } else if (item.pdfUrl) {
    directPdfUrl = item.pdfUrl;
  } else if (item.artifactUrl && item.artifactUrl.endsWith('.pdf')) {
    directPdfUrl = item.artifactUrl;
  }

  // Generate local proxy URL for CORS safety
  const proxyPdfUrl = directPdfUrl 
    ? `/api/v1/pdf/proxy?url=${encodeURIComponent(directPdfUrl)}`
    : null;

  return {
    id: item.identifier,
    dikshaId: item.identifier,
    title: item.name ? item.name.trim() : 'Untitled Textbook',
    description: item.description || `Class ${item.gradeLevel ? item.gradeLevel.join(', ') : ''} ${item.subject ? item.subject.join(', ') : ''} learning resource from DIKSHA`,
    board: Array.isArray(item.board) ? item.board[0] : (item.board || 'Central/State Board'),
    gradeLevel: item.gradeLevel || [],
    subject: item.subject || [],
    medium: item.medium || [],
    contentType: item.contentType || 'TextBook',
    primaryCategory: item.primaryCategory || 'Digital Textbook',
    mimeType: item.mimeType || 'application/pdf',
    posterImage: item.posterImage || item.appIcon || 'https://diksha.gov.in/assets/images/diksha-logo.png',
    artifactUrl: item.artifactUrl || null,
    downloadUrl: item.downloadUrl || null,
    directPdfUrl: directPdfUrl,
    proxyPdfUrl: proxyPdfUrl,
    tocUrl: item.toc_url || null,
    leafNodesCount: item.leafNodesCount || 0,
    createdOn: item.createdOn || null,
    lastUpdatedOn: item.lastUpdatedOn || item.lastPublishedOn || null,
    publisher: (item.originData && item.originData.organisation) ? item.originData.organisation[0] : (item.organisation ? item.organisation[0] : 'DIKSHA Portal')
  };
}

/**
 * Search textbooks & notebooks on DIKSHA portal
 */
async function searchDikshaBooks(options = {}) {
  const {
    board,
    gradeLevel,
    medium,
    subject,
    query,
    contentType,
    limit = 20,
    offset = 0
  } = options;

  const cacheKey = `search:${JSON.stringify({ board, gradeLevel, medium, subject, query, contentType, limit, offset })}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const filters = {};

  // Board filter mapping
  if (board) {
    const boardObj = getBoardByCode(board);
    if (boardObj) {
      filters.board = [boardObj.dikshaFilter];
    } else {
      filters.board = [board];
    }
  }

  // Grade filter normalization
  if (gradeLevel) {
    if (typeof gradeLevel === 'string') {
      filters.gradeLevel = [gradeLevel.startsWith('Class') ? gradeLevel : `Class ${gradeLevel}`];
    } else if (Array.isArray(gradeLevel)) {
      filters.gradeLevel = gradeLevel.map(g => g.startsWith('Class') ? g : `Class ${g}`);
    }
  }

  if (medium) {
    filters.medium = Array.isArray(medium) ? medium : [medium];
  }

  if (subject) {
    filters.subject = Array.isArray(subject) ? subject : [subject];
  }

  if (contentType) {
    filters.primaryCategory = Array.isArray(contentType) ? contentType : [contentType];
  } else {
    // Default categories for books and explanation materials
    filters.primaryCategory = [
      'Digital Textbook',
      'eTextbook',
      'Explanation Content',
      'Teacher Resource',
      'Practice Question Set'
    ];
  }

  const payload = {
    request: {
      filters: filters,
      query: query || '',
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
      sort_by: { lastUpdatedOn: 'desc' }
    }
  };

  try {
    const response = await makePostRequest('/content/v1/search', payload);

    if (response.error) {
      return {
        success: false,
        total: 0,
        books: [],
        message: `DIKSHA API returned status ${response.statusCode}`
      };
    }

    const count = response.result ? (response.result.count || 0) : 0;
    const contents = response.result ? (response.result.content || []) : [];
    const normalizedBooks = contents.map(normalizeDikshaItem).filter(Boolean);

    const resultData = {
      success: true,
      total: count,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      books: normalizedBooks
    };

    cache.set(cacheKey, { timestamp: Date.now(), data: resultData });
    return resultData;
  } catch (err) {
    console.error('Error querying DIKSHA search API:', err.message);
    return {
      success: false,
      total: 0,
      books: [],
      error: err.message
    };
  }
}

/**
 * Fetch detailed content/book by DIKSHA ID
 */
async function getDikshaBookById(identifier) {
  if (!identifier) return null;

  const cacheKey = `book:${identifier}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const response = await makeGetRequest(`${DIKSHA_BASE_URL}/content/v1/read/${identifier}?mode=edit`);

    if (response.error || !response.result || !response.result.content) {
      return null;
    }

    const rawContent = response.result.content;
    const normalized = normalizeDikshaItem(rawContent);

    // Fetch Table of Contents (TOC) if available
    let chapters = [];
    if (rawContent.toc_url) {
      try {
        const tocData = await makeGetRequest(rawContent.toc_url);
        if (tocData && tocData.children) {
          chapters = tocData.children.map((ch, idx) => ({
            chapterNumber: idx + 1,
            identifier: ch.identifier,
            title: ch.name,
            topic: ch.topic || [],
            subTopics: ch.children ? ch.children.map(sub => ({
              identifier: sub.identifier,
              title: sub.name,
              mimeType: sub.mimeType,
              artifactUrl: sub.artifactUrl || sub.downloadUrl
            })) : []
          }));
        }
      } catch (tocErr) {
        console.warn(`Could not fetch TOC for ${identifier}: ${tocErr.message}`);
      }
    }

    normalized.chapters = chapters;

    cache.set(cacheKey, { timestamp: Date.now(), data: normalized });
    return normalized;
  } catch (err) {
    console.error(`Error fetching DIKSHA book ${identifier}:`, err.message);
    return null;
  }
}

module.exports = {
  searchDikshaBooks,
  getDikshaBookById,
  normalizeDikshaItem
};
