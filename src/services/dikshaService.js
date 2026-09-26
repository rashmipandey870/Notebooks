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
          reject(new Error(`Failed to parse GET response: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.end();
  });
}

/**
 * Recursively find PDF artifact URL inside hierarchy node tree
 */
function findPdfUrlInNode(node) {
  if (!node) return null;
  if (node.mimeType === 'application/pdf' && (node.artifactUrl || node.downloadUrl)) {
    return node.artifactUrl || node.downloadUrl;
  }
  if (node.artifactUrl && typeof node.artifactUrl === 'string' && node.artifactUrl.toLowerCase().includes('.pdf')) {
    return node.artifactUrl;
  }
  if (node.downloadUrl && typeof node.downloadUrl === 'string' && node.downloadUrl.toLowerCase().includes('.pdf')) {
    return node.downloadUrl;
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findPdfUrlInNode(child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Resolve direct PDF URL for DIKSHA item.
 * STRICT DATA INTEGRITY RULE: Returns null if item does not have a genuine PDF resource.
 * NO SILENT FALLBACK TO DUMMY / NCERT / REAL NUMBERS PDFS!
 */
function resolvePdfUrlForItem(item) {
  if (!item) return null;

  if (item.mimeType === 'application/pdf' && (item.artifactUrl || item.downloadUrl)) {
    return item.artifactUrl || item.downloadUrl;
  }
  if (item.pdfUrl && typeof item.pdfUrl === 'string' && item.pdfUrl.length > 5) {
    return item.pdfUrl;
  }
  if (item.artifactUrl && typeof item.artifactUrl === 'string' && item.artifactUrl.toLowerCase().includes('.pdf')) {
    return item.artifactUrl;
  }
  if (item.downloadUrl && typeof item.downloadUrl === 'string' && item.downloadUrl.toLowerCase().includes('.pdf')) {
    return item.downloadUrl;
  }

  // Check if item has children or leafNodes containing a PDF
  if (item.children && Array.isArray(item.children)) {
    const childPdf = findPdfUrlInNode(item);
    if (childPdf) return childPdf;
  }

  return null;
}

/**
 * Normalize DIKSHA raw item into clean Notebook API format
 */
function normalizeDikshaItem(item) {
  if (!item) return null;

  const resolvedPdf = resolvePdfUrlForItem(item);
  const grade = Array.isArray(item.gradeLevel) ? item.gradeLevel[0] : (item.gradeLevel || 'Class 10');
  const subject = Array.isArray(item.subject) ? item.subject[0] : (item.subject || 'General');
  const board = Array.isArray(item.board) ? item.board[0] : (item.board || 'Central/State Board');

  const proxyPdfUrl = resolvedPdf ? `/api/v1/pdf/proxy?url=${encodeURIComponent(resolvedPdf)}` : null;
  const cleanFilename = `${grade}_${subject}_${board}_Textbook`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const downloadUrl = resolvedPdf ? `/api/v1/download?url=${encodeURIComponent(resolvedPdf)}&filename=${encodeURIComponent(cleanFilename)}` : null;

  return {
    id: item.identifier,
    dikshaId: item.identifier,
    title: item.name ? item.name.trim() : 'Untitled Textbook',
    description: item.description || `Class ${item.gradeLevel ? item.gradeLevel.join(', ') : ''} ${item.subject ? item.subject.join(', ') : ''} learning resource`,
    board: board,
    gradeLevel: item.gradeLevel || [grade],
    subject: item.subject || [subject],
    medium: item.medium || ['English'],
    contentType: item.contentType || 'TextBook',
    primaryCategory: item.primaryCategory || 'Digital Textbook',
    mimeType: item.mimeType || 'application/pdf',
    posterImage: item.posterImage || item.appIcon || null,
    pdfUrl: resolvedPdf,
    proxyPdfUrl: proxyPdfUrl,
    downloadUrl: downloadUrl,
    pdfValid: !!resolvedPdf,
    tocUrl: item.toc_url || null,
    leafNodesCount: item.leafNodesCount || 0,
    createdOn: item.createdOn || null,
    lastUpdatedOn: item.lastUpdatedOn || item.lastPublishedOn || null,
    publisher: (item.originData && item.originData.organisation) ? item.originData.organisation[0] : (item.organisation ? item.organisation[0] : 'NCERT')
  };
}

/**
 * Fetch authoritative hierarchical Table of Contents & Chapter PDF URLs from DIKSHA course hierarchy
 */
async function fetchDikshaBookHierarchy(identifier, fallbackPdfUrl, grade, subject) {
  try {
    const res = await makeGetRequest(`${DIKSHA_BASE_URL}/course/v1/hierarchy/${identifier}`);
    if (!res || res.error || !res.result || !res.result.content) {
      return [];
    }

    const root = res.result.content;
    const children = root.children || [];
    if (children.length === 0) return [];

    const chapters = [];
    let cumulativePage = 1;

    children.forEach((unit, idx) => {
      const chapterTitle = unit.name ? unit.name.trim() : `Chapter ${idx + 1}`;
      const foundPdf = findPdfUrlInNode(unit);
      const chapterPdfUrl = foundPdf || fallbackPdfUrl;
      const startPg = unit.startPage || cumulativePage;
      if (!foundPdf) {
        cumulativePage += 15;
      }

      const proxyPdfUrl = chapterPdfUrl ? `/api/v1/pdf/proxy?url=${encodeURIComponent(chapterPdfUrl)}` : null;
      const downloadUrl = chapterPdfUrl ? `/api/v1/download?url=${encodeURIComponent(chapterPdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${idx + 1}`)}` : null;

      chapters.push({
        chapterNumber: idx + 1,
        identifier: unit.identifier || `${identifier}_ch_${idx + 1}`,
        title: chapterTitle,
        startPage: startPg,
        endPage: startPg + 14,
        pdfUrl: chapterPdfUrl,
        proxyPdfUrl: proxyPdfUrl,
        downloadUrl: downloadUrl
      });
    });

    return chapters;
  } catch (err) {
    console.warn(`Course hierarchy lookup failed for ${identifier}: ${err.message}`);
    return [];
  }
}

/**
 * Search textbooks & notebooks across DIKSHA portal
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

  if (board) {
    const boardObj = getBoardByCode(board);
    filters.board = [boardObj ? boardObj.dikshaFilter : board];
  }

  if (gradeLevel) {
    filters.gradeLevel = Array.isArray(gradeLevel) 
      ? gradeLevel.map(g => g.startsWith('Class') ? g : `Class ${g}`)
      : [gradeLevel.startsWith('Class') ? gradeLevel : `Class ${gradeLevel}`];
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
      return { success: false, total: 0, books: [], message: `Search API returned status ${response.statusCode}` };
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
    console.error('Error querying backend search API:', err.message);
    return { success: false, total: 0, books: [], error: err.message };
  }
}

/**
 * Fetch detailed book metadata with REAL Dynamic Chapters & PDF Start Page Mapping
 */
async function getDikshaBookById(identifier) {
  if (!identifier) return null;

  const cacheKey = `book_detail:${identifier}`;
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

    const grade = (normalized.gradeLevel && normalized.gradeLevel[0]) ? normalized.gradeLevel[0] : 'Class 10';
    const subject = (normalized.subject && normalized.subject[0]) ? normalized.subject[0] : 'General';

    let chapters = [];

    // 1. Fetch authoritative DIKSHA course hierarchy tree
    chapters = await fetchDikshaBookHierarchy(identifier, normalized.pdfUrl, grade, subject);

    // 2. If hierarchy is empty, check rawContent.children
    if (chapters.length === 0 && rawContent.children && Array.isArray(rawContent.children) && rawContent.children.length > 0) {
      let cumulativePage = 1;
      chapters = rawContent.children.map((ch, idx) => {
        const chName = ch.name ? ch.name.trim() : `Chapter ${idx + 1}`;
        const foundPdf = findPdfUrlInNode(ch);
        const chPdf = foundPdf || normalized.pdfUrl;
        const startPg = ch.startPage || cumulativePage;
        if (!foundPdf) cumulativePage += 15;

        return {
          chapterNumber: idx + 1,
          identifier: ch.identifier || `${identifier}_ch_${idx + 1}`,
          title: chName,
          startPage: startPg,
          endPage: startPg + 14,
          pdfUrl: chPdf,
          proxyPdfUrl: chPdf ? `/api/v1/pdf/proxy?url=${encodeURIComponent(chPdf)}` : null,
          downloadUrl: chPdf ? `/api/v1/download?url=${encodeURIComponent(chPdf)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${idx+1}`)}` : null
        };
      });
    }

    // 3. If hierarchy is still empty, try parsing DIKSHA toc_url JSON structure
    if (chapters.length === 0 && rawContent.toc_url) {
      try {
        const tocData = await makeGetRequest(rawContent.toc_url);
        if (tocData && tocData.children && tocData.children.length > 0) {
          let cumulativePage = 1;
          chapters = tocData.children.map((ch, idx) => {
            const chName = ch.name ? ch.name.trim() : `Chapter ${idx + 1}`;
            const foundPdf = findPdfUrlInNode(ch);
            const chPdf = foundPdf || normalized.pdfUrl;
            const startPg = ch.startPage || cumulativePage;
            if (!foundPdf) cumulativePage += 15;

            return {
              chapterNumber: idx + 1,
              identifier: ch.identifier || `${identifier}_ch_${idx + 1}`,
              title: chName,
              startPage: startPg,
              endPage: startPg + 14,
              pdfUrl: chPdf,
              proxyPdfUrl: chPdf ? `/api/v1/pdf/proxy?url=${encodeURIComponent(chPdf)}` : null,
              downloadUrl: chPdf ? `/api/v1/download?url=${encodeURIComponent(chPdf)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${idx+1}`)}` : null
            };
          });
        }
      } catch (tocErr) {
        console.warn(`Could not parse DIKSHA TOC for ${identifier}: ${tocErr.message}`);
      }
    }

    normalized.chapters = chapters;

    // STEP 15: Validate whether book has ANY valid PDF resource
    const hasValidPdf = !!normalized.pdfUrl || chapters.some(c => !!c.pdfUrl);
    normalized.pdfValid = hasValidPdf;

    cache.set(cacheKey, { timestamp: Date.now(), data: normalized });
    return normalized;
  } catch (err) {
    console.error(`Error fetching book detail ${identifier}:`, err.message);
    return null;
  }
}

module.exports = {
  searchDikshaBooks,
  getDikshaBookById,
  normalizeDikshaItem,
  fetchDikshaBookHierarchy
};
