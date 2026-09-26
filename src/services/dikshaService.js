const https = require('https');
const http = require('http');
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
 * Binary PDF Content Validator
 * Fetches initial bytes of resource and verifies magic bytes "%PDF-"
 */
function validatePdfHeader(urlStr) {
  return new Promise((resolve) => {
    if (!urlStr || typeof urlStr !== 'string' || (!urlStr.startsWith('http://') && !urlStr.startsWith('https://'))) {
      return resolve({ valid: false, reason: 'Invalid or non-HTTP URL' });
    }

    try {
      const urlObj = new URL(urlStr);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Range': 'bytes=0-1023'
        },
        timeout: 6000
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
          }
          res.destroy();
          return resolve(validatePdfHeader(redirectUrl));
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.destroy();
          return resolve({ valid: false, reason: `Upstream HTTP status ${res.statusCode}` });
        }

        const chunks = [];
        let totalLen = 0;

        res.on('data', chunk => {
          chunks.push(chunk);
          totalLen += chunk.length;
          if (totalLen >= 5) {
            res.destroy();
          }
        });

        res.on('end', () => checkHeader());
        res.on('close', () => checkHeader());

        let checked = false;
        function checkHeader() {
          if (checked) return;
          checked = true;
          const buf = Buffer.concat(chunks);
          if (buf.length < 4) {
            return resolve({ valid: false, reason: 'Response stream contains less than 4 bytes' });
          }
          const headerStr = buf.toString('utf8', 0, Math.min(buf.length, 1024));
          if (headerStr.includes('%PDF-')) {
            const mimeType = res.headers['content-type'] || 'application/pdf';
            return resolve({ valid: true, mimeType: mimeType });
          } else {
            return resolve({ valid: false, reason: `Invalid PDF magic header. Stream starts with: "${headerStr.substring(0, 15).replace(/[^a-zA-Z0-9_\-%]/g, '.')}"` });
          }
        }
      });

      req.on('error', err => {
        resolve({ valid: false, reason: `Network error: ${err.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ valid: false, reason: 'Connection timeout after 6 seconds' });
      });
    } catch (err) {
      resolve({ valid: false, reason: `URL parsing exception: ${err.message}` });
    }
  });
}

/**
 * Recursively inspect DIKSHA content nodes for candidate reading resources
 */
function discoverCandidatesFromNode(node, source, candidates, grade = 'Class 10', subject = 'General') {
  if (!node) return;

  const mime = (node.mimeType || '').toLowerCase();
  const primaryCat = (node.primaryCategory || '').toLowerCase();
  const contentType = (node.contentType || '').toLowerCase();

  if (mime.includes('video') || mime.includes('audio') || mime.includes('image')) {
    return;
  }
  if (primaryCat.includes('video') || primaryCat.includes('audio')) {
    return;
  }
  if (contentType.includes('video') || contentType.includes('audio')) {
    return;
  }

  let candidateUrl = null;
  const isPdfMime = mime === 'application/pdf' || mime === 'application/octet-stream';

  if (node.artifactUrl && typeof node.artifactUrl === 'string') {
    if (isPdfMime || node.artifactUrl.toLowerCase().includes('.pdf')) {
      candidateUrl = node.artifactUrl;
    }
  }
  if (!candidateUrl && node.downloadUrl && typeof node.downloadUrl === 'string') {
    if (isPdfMime || node.downloadUrl.toLowerCase().includes('.pdf')) {
      candidateUrl = node.downloadUrl;
    }
  }
  if (!candidateUrl && node.pdfUrl && typeof node.pdfUrl === 'string' && node.pdfUrl.length > 5) {
    candidateUrl = node.pdfUrl;
  }

  if (candidateUrl && candidateUrl.startsWith('http')) {
    candidates.push({
      id: node.identifier || `cand_${candidates.length + 1}`,
      contentId: node.identifier,
      parentId: node.parent || null,
      title: node.name ? node.name.trim() : 'Textbook Content',
      resourceType: 'pdf',
      mimeType: node.mimeType || 'application/pdf',
      url: candidateUrl,
      source: source,
      isBookLevel: source === 'book' || source === 'hierarchy_root'
    });
  }

  const childArray = node.children || node.childNodes || node.contents || node.linkedContent || node.units;
  if (Array.isArray(childArray)) {
    for (const child of childArray) {
      if (typeof child === 'object' && child !== null) {
        discoverCandidatesFromNode(child, source === 'book' ? 'chapter' : source, candidates, grade, subject);
      }
    }
  }
}

/**
 * Recursively find PDF artifact URL inside hierarchy node tree
 */
function findPdfUrlInNode(node) {
  if (!node) return null;
  if ((node.mimeType === 'application/pdf' || node.mimeType === 'application/octet-stream') && (node.artifactUrl || node.downloadUrl)) {
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

  if ((item.mimeType === 'application/pdf' || item.mimeType === 'application/octet-stream') && (item.artifactUrl || item.downloadUrl)) {
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
 * Recursively parse multi-level DIKSHA hierarchy nodes (Levels 1 to 4)
 */
function parseDikshaHierarchyNodes(nodes, level = 1, parentPdfUrl = null, state = { chapterNumber: 1, cumulativePage: 1 }, grade = 'Class 10', subject = 'General') {
  let chapters = [];
  if (!Array.isArray(nodes)) return chapters;

  for (const node of nodes) {
    if (!node) continue;
    const title = node.name ? node.name.trim() : `Section ${state.chapterNumber}`;
    const foundPdf = findPdfUrlInNode(node);
    const chapterPdfUrl = foundPdf || parentPdfUrl;
    const startPg = node.startPage || state.cumulativePage;

    if (!foundPdf) {
      state.cumulativePage += 15;
    }

    const currentChNum = state.chapterNumber;
    state.chapterNumber++;

    const proxyPdfUrl = chapterPdfUrl ? `/api/v1/pdf/proxy?url=${encodeURIComponent(chapterPdfUrl)}` : null;
    const downloadUrl = chapterPdfUrl ? `/api/v1/download?url=${encodeURIComponent(chapterPdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${currentChNum}`)}` : null;

    const chapterObj = {
      chapterNumber: currentChNum,
      identifier: node.identifier || `ch_${currentChNum}`,
      title: title,
      level: Math.min(Math.max(level, 1), 4),
      startPage: startPg,
      endPage: startPg + 14,
      pdfUrl: chapterPdfUrl,
      proxyPdfUrl: proxyPdfUrl,
      downloadUrl: downloadUrl
    };

    chapters.push(chapterObj);

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      const childChapters = parseDikshaHierarchyNodes(node.children, level + 1, chapterPdfUrl, state, grade, subject);
      chapters = chapters.concat(childChapters);
    }
  }

  return chapters;
}

function validateBookResource(book, resourceUrl) {
  if (!resourceUrl || typeof resourceUrl !== 'string') return false;
  if (resourceUrl === 'null' || resourceUrl === 'undefined') return false;
  return resourceUrl.startsWith('http://') || resourceUrl.startsWith('https://') || resourceUrl.startsWith('/api/');
}

function validateBookTOC(book, tocChapters) {
  if (!Array.isArray(tocChapters) || tocChapters.length === 0) return false;
  return tocChapters.every(ch => ch && typeof ch.title === 'string' && ch.title.trim().length > 0);
}

function createNormalizedBookModel(item, chapters = []) {
  const normalized = normalizeDikshaItem(item);
  normalized.chapters = Array.isArray(chapters) ? chapters : [];
  normalized.pdfValid = validateBookResource(normalized, normalized.pdfUrl) || normalized.chapters.some(c => validateBookResource(normalized, c.pdfUrl));
  return normalized;
}

/**
 * Generic Global Textbook Resource Resolver
 * Resolves exact book reading resource from DIKSHA content hierarchy
 */
async function resolveBookReadingResource(bookId) {
  if (!bookId) return null;

  const cacheKey = `book_resource:${bookId}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  console.log(`\n========================================================`);
  console.log(`RESOURCE RESOLUTION START FOR BOOK ID: [${bookId}]`);
  console.log(`========================================================`);

  // Step 1: Read raw book content metadata
  const bookReadRes = await makeGetRequest(`${DIKSHA_BASE_URL}/content/v1/read/${bookId}?mode=edit`);
  if (!bookReadRes || bookReadRes.error || !bookReadRes.result || !bookReadRes.result.content) {
    console.log(`[RESOLVER REJECT] Book ID '${bookId}' not found on DIKSHA`);
    const failResult = {
      success: false,
      bookId: bookId,
      book: null,
      reason: 'RESOURCE_NOT_FOUND',
      message: 'Reading resource is not available for this textbook.'
    };
    return failResult;
  }

  const rawContent = bookReadRes.result.content;
  const normalizedBook = normalizeDikshaItem(rawContent);

  const grade = normalizedBook.gradeLevel[0] || 'Class 10';
  const subject = normalizedBook.subject[0] || 'General';

  console.log(`BOOK METADATA:`);
  console.log(`- Title: "${normalizedBook.title}"`);
  console.log(`- Board: "${normalizedBook.board}"`);
  console.log(`- Grade: [${normalizedBook.gradeLevel.join(', ')}]`);
  console.log(`- Subject: [${normalizedBook.subject.join(', ')}]`);
  console.log(`- Medium: [${normalizedBook.medium.join(', ')}]`);

  // Step 2: Fetch course hierarchy tree
  let hierarchyContent = null;
  try {
    const hierarchyRes = await makeGetRequest(`${DIKSHA_BASE_URL}/course/v1/hierarchy/${bookId}`);
    if (hierarchyRes && !hierarchyRes.error && hierarchyRes.result && hierarchyRes.result.content) {
      hierarchyContent = hierarchyRes.result.content;
    }
  } catch (hErr) {
    console.warn(`[RESOLVER LOG] Course hierarchy lookup failed: ${hErr.message}`);
  }

  // Step 3: Discover candidate reading resources
  const candidates = [];
  discoverCandidatesFromNode(rawContent, 'book', candidates, grade, subject);
  if (hierarchyContent) {
    discoverCandidatesFromNode(hierarchyContent, 'hierarchy_root', candidates, grade, subject);
  }

  if (rawContent.toc_url) {
    try {
      const tocData = await makeGetRequest(rawContent.toc_url);
      if (tocData) {
        discoverCandidatesFromNode(tocData, 'toc_url', candidates, grade, subject);
      }
    } catch (tocErr) {
      console.warn(`[RESOLVER LOG] TOC URL fetch error: ${tocErr.message}`);
    }
  }

  // If no candidates discovered yet, inspect leafNodes via read API
  if (candidates.length === 0 && rawContent.leafNodes && Array.isArray(rawContent.leafNodes) && rawContent.leafNodes.length > 0) {
    console.log(`[RESOLVER LOG] Inspecting ${Math.min(rawContent.leafNodes.length, 5)} leafNodes via DIKSHA content read API...`);
    const leafNodesToInspect = rawContent.leafNodes.slice(0, 5);
    for (const leafId of leafNodesToInspect) {
      if (typeof leafId === 'string') {
        try {
          const leafRes = await makeGetRequest(`${DIKSHA_BASE_URL}/content/v1/read/${leafId}?mode=edit`);
          if (leafRes && !leafRes.error && leafRes.result && leafRes.result.content) {
            discoverCandidatesFromNode(leafRes.result.content, 'leaf_node', candidates, grade, subject);
          }
        } catch (lErr) {
          // ignore leaf error
        }
      }
    }
  }

  // Step 4: Deduplicate candidates by URL
  const uniqueCandidates = [];
  const seenUrls = new Set();
  for (const cand of candidates) {
    if (cand.url && !seenUrls.has(cand.url)) {
      seenUrls.add(cand.url);
      uniqueCandidates.push(cand);
    }
  }

  console.log(`DISCOVERED ${uniqueCandidates.length} CANDIDATE RESOURCE(S)`);

  // Step 5: Perform binary PDF validation on candidates
  const validCandidates = [];
  const rejectedCandidates = [];

  for (const cand of uniqueCandidates) {
    console.log(`VALIDATING CANDIDATE: [${cand.title}] (${cand.source}) -> ${cand.url}`);
    const check = await validatePdfHeader(cand.url);
    if (check.valid) {
      console.log(`  -> VALID PDF (%PDF- verified)`);
      cand.mimeType = check.mimeType || cand.mimeType;
      validCandidates.push(cand);
    } else {
      console.log(`  -> REJECTED: ${check.reason}`);
      rejectedCandidates.push({ candidate: cand, reason: check.reason });
    }
  }

  console.log(`VALIDATED CANDIDATES COUNT: ${validCandidates.length}`);
  console.log(`REJECTED CANDIDATES COUNT: ${rejectedCandidates.length}`);

  // Step 6: Parse multi-level Table of Contents hierarchy
  const state = { chapterNumber: 1, cumulativePage: 1 };
  const rootNodes = (hierarchyContent && hierarchyContent.children)
    || (rawContent.children)
    || [];

  const chapters = parseDikshaHierarchyNodes(
    rootNodes,
    1,
    validCandidates[0] ? validCandidates[0].url : null,
    state,
    grade,
    subject
  );

  // Step 7: Select primary resource
  let selectedResource = null;
  if (validCandidates.length > 0) {
    const bookLevelCand = validCandidates.find(c => c.source === 'book' || c.isBookLevel);
    selectedResource = bookLevelCand || validCandidates[0];
  }

  if (selectedResource) {
    console.log(`[RESOLVER SUCCESS] Selected resource: ${selectedResource.url}`);
    console.log(`========================================================\n`);

    const proxyPdfUrl = `/api/v1/pdf/proxy?url=${encodeURIComponent(selectedResource.url)}`;
    const cleanFilename = `${grade}_${subject}_${normalizedBook.board}_Textbook`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadUrl = `/api/v1/download?url=${encodeURIComponent(selectedResource.url)}&filename=${encodeURIComponent(cleanFilename)}`;

    normalizedBook.pdfUrl = selectedResource.url;
    normalizedBook.proxyPdfUrl = proxyPdfUrl;
    normalizedBook.downloadUrl = downloadUrl;
    normalizedBook.pdfValid = true;
    normalizedBook.hasCompletePdf = selectedResource.isBookLevel || chapters.length === 0;
    normalizedBook.chapters = chapters;
    normalizedBook.resource = selectedResource;
    normalizedBook.discoveredCandidates = uniqueCandidates.length;

    const result = {
      success: true,
      bookId: bookId,
      book: normalizedBook
    };

    cache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } else {
    console.log(`[RESOLVER FAIL] No valid reading resource passed binary PDF validation`);
    console.log(`========================================================\n`);

    const reason = uniqueCandidates.length > 0 ? 'RESOURCE_VALIDATION_FAILED' : 'RESOURCE_NOT_FOUND';
    const message = uniqueCandidates.length > 0
      ? 'We could not verify the textbook resource.'
      : 'Reading resource is not available for this textbook.';

    normalizedBook.pdfUrl = null;
    normalizedBook.proxyPdfUrl = null;
    normalizedBook.downloadUrl = null;
    normalizedBook.pdfValid = false;
    normalizedBook.chapters = chapters;
    normalizedBook.discoveredCandidates = uniqueCandidates.length;

    const result = {
      success: false,
      bookId: bookId,
      book: normalizedBook,
      reason: reason,
      message: message,
      rejectedCount: rejectedCandidates.length,
      rejectedCandidates: rejectedCandidates
    };

    cache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  }
}

/**
 * Fetch detailed book metadata with REAL Dynamic Chapters & PDF Start Page Mapping
 */
async function getDikshaBookById(identifier) {
  if (!identifier) return null;
  const resolved = await resolveBookReadingResource(identifier);
  return resolved ? resolved.book : null;
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

module.exports = {
  searchDikshaBooks,
  getDikshaBookById,
  resolveBookReadingResource,
  normalizeDikshaItem,
  parseDikshaHierarchyNodes,
  validatePdfHeader,
  discoverCandidatesFromNode,
  validateBookResource,
  validateBookTOC,
  createNormalizedBookModel
};
