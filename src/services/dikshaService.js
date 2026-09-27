const https = require('https');
const http = require('http');
const { getBoardByCode, BOARDS } = require('../config/boards');

const DIKSHA_BASE_URL = 'https://diksha.gov.in/api';
const cache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 mins cache

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
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const req = https.request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        timeout: 8000
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
            resolve({ error: true, message: e.message });
          }
        });
      });

      req.on('error', err => resolve({ error: true, message: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ error: true, message: 'GET request timeout' });
      });
      req.end();
    } catch (err) {
      resolve({ error: true, message: err.message });
    }
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
  const name = (node.name || '').toLowerCase();

  // Reject non-reading media (video, audio, image) and supplementary non-textbook materials
  if (mime.includes('video') || mime.includes('audio') || mime.includes('image')) return;
  if (primaryCat.includes('video') || primaryCat.includes('audio') || primaryCat.includes('teacher')) return;
  if (contentType.includes('video') || contentType.includes('audio') || contentType.includes('teacher')) return;

  if (name.includes('short answer') || name.includes('long answer') || name.includes('lesson plan') || name.includes('graphic novel') || name.includes('comparative study') || name.includes('assessment') || name.includes('quiz') || name.includes('worksheet')) {
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
    const filename = candidateUrl.split('/').pop().toLowerCase();
    const isOfficialTextbookPdf = filename.includes('textbook') || filename.includes('book') || filename.match(/^[a-z]{4}\d{3}\.pdf$/);

    const nodeSubject = node.subject ? (Array.isArray(node.subject) ? node.subject : [node.subject]) : null;
    const nodeGradeLevel = node.gradeLevel ? (Array.isArray(node.gradeLevel) ? node.gradeLevel : [node.gradeLevel]) : null;

    candidates.push({
      id: node.identifier || `cand_${candidates.length + 1}`,
      contentId: node.identifier,
      parentId: node.parent || null,
      title: node.name ? node.name.trim() : 'Textbook Content',
      resourceType: 'pdf',
      mimeType: node.mimeType || 'application/pdf',
      url: candidateUrl,
      source: source,
      isBookLevel: source === 'book' || source === 'hierarchy_root' || isOfficialTextbookPdf,
      nodeSubject: nodeSubject,
      nodeGradeLevel: nodeGradeLevel,
      nodeTitle: node.name ? node.name.trim() : null,
      subject: nodeSubject,
      gradeLevel: nodeGradeLevel
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
 * Check if a raw DIKSHA item is a genuine textbook (not teacher resource, practice set, etc.)
 */
function isGenuineTextbookItem(item) {
  if (!item) return false;
  const primaryCat = (item.primaryCategory || '').toLowerCase();
  const contentType = (item.contentType || '').toLowerCase();
  const name = (item.name || '').toLowerCase();

  // Explicit rejections for non-textbook supplementary content
  const nonTextbookTerms = [
    'teacher resource', 'explanation content', 'practice question', 'question set',
    'lesson plan', 'activity', 'graphic novel', 'comparative study', 'assessment',
    'quiz', 'worksheet', 'short answer', 'long answer', 'audio content', 'video content'
  ];

  if (nonTextbookTerms.some(term => primaryCat.includes(term) || contentType.includes(term) || name.includes(term))) {
    return false;
  }

  // Must match genuine textbook categories
  const validCatTerms = ['digital textbook', 'etextbook', 'textbook', 'digitaltextbook'];
  const validContentTypeTerms = ['textbook', 'etextbook'];

  if (validCatTerms.some(t => primaryCat.includes(t)) || validContentTypeTerms.some(t => contentType.includes(t))) {
    return true;
  }

  if (item.mimeType === 'application/vnd.ekstep.content-collection' || item.mimeType === 'application/pdf') {
    return true;
  }

  return false;
}

/**
 * Normalize DIKSHA raw item into clean Notebook API format
 */
function normalizeDikshaItem(item) {
  if (!item || !isGenuineTextbookItem(item)) return null;

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
 * Helper to check if node title is a generic non-chapter label or media folder
 */
function isIgnoredNodeTitle(name, mimeType, primaryCategory) {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim().toLowerCase();

  const ignoredExactOrContains = [
    'book',
    'collection',
    'textbook',
    'digital textbook',
    'e-textbook',
    'etextbook',
    'text content',
    'textual content',
    'video content',
    'audio content',
    'interactive content',
    'question bank',
    'practice content',
    'learning material',
    'course material',
    'study material',
    'content',
    'resources',
    'materials',
    'unit',
    'module',
    'pack',
    'package',
    'mp4 video',
    'mp4',
    'video',
    'video lesson',
    'mp3 audio',
    'audio',
    'assessment',
    'quiz',
    'worksheet',
    'practice question',
    'practice set',
    'explanation content',
    'teacher resource',
    'short answer',
    'short answer questions',
    'long answer',
    'long answer questions',
    'lesson plan',
    'lesson plan & activity',
    'activity',
    'graphic novel',
    'comparative study',
    'master lesson plan'
  ];

  if (ignoredExactOrContains.some(term => clean === term || clean.startsWith(term))) return true;
  if (clean.includes('short answer') || clean.includes('long answer') || clean.includes('lesson plan') || clean.includes('graphic novel') || clean.includes('comparative study')) return true;

  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('video') || mime.includes('audio') || mime.includes('image')) return true;

  const cat = (primaryCategory || '').toLowerCase();
  if (cat.includes('video') || cat.includes('audio') || cat.includes('teacher')) return true;

  return false;
}

/**
 * Fuzzy Chapter Title Normalizer for deduplication
 */
function normalizeChapterTitleKey(title) {
  if (!title || typeof title !== 'string') return '';
  let clean = title.trim().toLowerCase();

  // Strip chapter prefixes like "1- ", "chapter 1- ", "chapter 1: ", "lesson 1: ", "ch 1 ", "unit 1: ", "1. "
  clean = clean.replace(/^(?:chapter|lesson|unit|ch|l)?\s*\d+[\.\s\:\-]+\s*/gi, '');
  
  // Strip non-alphanumeric characters except unicode scripts
  clean = clean.replace(/[^a-z0-9\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F]/g, '');

  if (clean.endsWith('s')) {
    clean = clean.slice(0, -1);
  }

  return clean;
}

/**
 * Recursively parse multi-level DIKSHA hierarchy nodes (Levels 1 to 4)
 * Strictly filters out non-chapter media labels ("Book", "MP4 VIDEO") and deduplicates titles
 */
function parseDikshaHierarchyNodes(nodes, level = 1, parentPdfUrl = null, state = { chapterNumber: 1 }, grade = 'Class 10', subject = 'General', seenTitles = new Set()) {
  let chapters = [];
  if (!Array.isArray(nodes)) return chapters;

  for (const node of nodes) {
    if (!node) continue;
    const title = node.name ? node.name.trim() : '';
    const foundPdf = findPdfUrlInNode(node);
    const chapterPdfUrl = foundPdf || parentPdfUrl;

    const isIgnored = isIgnoredNodeTitle(title, node.mimeType, node.primaryCategory);
    const titleKey = normalizeChapterTitleKey(title);
    const isDuplicate = titleKey && seenTitles.has(titleKey);

    if (title && !isIgnored && !isDuplicate) {
      if (titleKey) seenTitles.add(titleKey);
      const printedStart = (node.startPage && !isNaN(parseInt(node.startPage, 10))) ? parseInt(node.startPage, 10) : null;
      const printedEnd = (node.endPage && !isNaN(parseInt(node.endPage, 10))) ? parseInt(node.endPage, 10) : null;

      const currentChNum = state.chapterNumber;
      state.chapterNumber++;

      const proxyPdfUrl = chapterPdfUrl ? `/api/v1/pdf/proxy?url=${encodeURIComponent(chapterPdfUrl)}` : null;
      const downloadUrl = chapterPdfUrl ? `/api/v1/download?url=${encodeURIComponent(chapterPdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${currentChNum}`)}` : null;

      const chapterObj = {
        chapterNumber: currentChNum,
        identifier: node.identifier || `ch_${currentChNum}`,
        title: title,
        level: Math.min(Math.max(level, 1), 4),
        startPage: printedStart,
        endPage: printedEnd,
        printedStartPage: printedStart,
        printedEndPage: printedEnd,
        pdfStartPage: null,
        pdfEndPage: null,
        pdfUrl: chapterPdfUrl,
        proxyPdfUrl: proxyPdfUrl,
        downloadUrl: downloadUrl
      };

      chapters.push(chapterObj);
    }

    const childNodes = node.children || node.childNodes || node.contents || node.linkedContent || node.units;
    if (Array.isArray(childNodes) && childNodes.length > 0) {
      const nextLevel = isIgnored ? level : level + 1;
      const childChapters = parseDikshaHierarchyNodes(childNodes, nextLevel, chapterPdfUrl, state, grade, subject, seenTitles);
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
 * Verify candidate's own metadata/identity against the requested book before selection
 */
function verifyCandidateIdentity(cand, requestedBook) {
  if (!cand || !requestedBook) return { passed: false, reason: 'INVALID_PARAMETERS' };

  const reqSubjects = (requestedBook.subject || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
  const reqGrades = (requestedBook.gradeLevel || []).map(g => String(g).toLowerCase().trim()).filter(Boolean);

  const candSubjectRaw = cand.nodeSubject || cand.subject;
  const candGradeRaw = cand.nodeGradeLevel || cand.gradeLevel;

  const candSubjects = candSubjectRaw ? (Array.isArray(candSubjectRaw) ? candSubjectRaw : [candSubjectRaw]).map(s => String(s).toLowerCase().trim()).filter(Boolean) : [];
  const candGrades = candGradeRaw ? (Array.isArray(candGradeRaw) ? candGradeRaw : [candGradeRaw]).map(g => String(g).toLowerCase().trim()).filter(Boolean) : [];

  const normalizeSubj = (s) => s.replace(/^(?:vocational|subject)[\:\s]+/gi, '').trim();
  const normReqSubjs = reqSubjects.map(normalizeSubj);
  const normCandSubjs = candSubjects.map(normalizeSubj);

  let subjectMatch = true;
  let subjectReason = 'Subject matches or candidate has no contradicting subject metadata';

  if (normCandSubjs.length > 0 && normReqSubjs.length > 0) {
    const hasOverlap = normCandSubjs.some(cs =>
      normReqSubjs.some(rs => rs.includes(cs) || cs.includes(rs))
    );
    if (!hasOverlap) {
      subjectMatch = false;
      subjectReason = `Subject mismatch (Candidate: [${candSubjects.join(', ')}] vs Requested: [${reqSubjects.join(', ')}])`;
    }
  }

  const extractGradeNum = (gStr) => {
    if (!gStr) return null;
    const match = String(gStr).match(/\b(?:class|grade|cl|std)?\s*(\d{1,2}|viii|ix|x|xi|xii)\b/i);
    if (!match) return null;
    const val = match[1].toUpperCase();
    const romanMap = { 'VIII': '8', 'IX': '9', 'X': '10', 'XI': '11', 'XII': '12' };
    return romanMap[val] || val;
  };

  const reqGradeNum = reqGrades.map(extractGradeNum).find(Boolean);
  const candGradeNum = (candGrades.map(extractGradeNum).find(Boolean)) || extractGradeNum(cand.title || cand.nodeTitle);

  let gradeMatch = true;
  let gradeReason = 'Grade matches or candidate has no contradicting grade metadata';

  if (candGradeNum && reqGradeNum && candGradeNum !== reqGradeNum) {
    gradeMatch = false;
    gradeReason = `Grade mismatch (Candidate Grade: ${candGradeNum} vs Requested Grade: ${reqGradeNum})`;
  }

  const passed = subjectMatch && gradeMatch;

  return {
    passed: passed,
    candidateSubjects: candSubjects,
    candidateGrades: candGrades,
    requestedSubjects: reqSubjects,
    requestedGrades: reqGrades,
    reason: passed ? 'IDENTITY_VERIFIED' : (!subjectMatch ? subjectReason : gradeReason)
  };
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

  // Step 5: Perform fast parallel binary PDF validation on candidates
  const validCandidates = [];
  const rejectedCandidates = [];

  // Sort candidates so book-level candidates are checked first
  uniqueCandidates.sort((a, b) => (b.isBookLevel ? 1 : 0) - (a.isBookLevel ? 1 : 0));

  const candidatesToTest = uniqueCandidates.slice(0, 30);
  const validationResults = await Promise.all(
    candidatesToTest.map(cand => 
      validatePdfHeader(cand.url).then(check => ({ cand, check }))
    )
  );

  for (const { cand, check } of validationResults) {
    console.log(`VALIDATING CANDIDATE: [${cand.title}] (${cand.source}) -> ${cand.url}`);
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

  // Step 6: Identity Verification Scoring / Filtering Pass
  const identityVerifiedCandidates = [];
  const identityRejectedCandidates = [];

  for (const cand of validCandidates) {
    const check = verifyCandidateIdentity(cand, normalizedBook);
    const candSubjStr = (cand.nodeSubject || cand.subject || ['Unspecified']).join(', ');
    const candGradeStr = (cand.nodeGradeLevel || cand.gradeLevel || ['Unspecified']).join(', ');
    const reqSubjStr = normalizedBook.subject.join(', ');
    const reqGradeStr = normalizedBook.gradeLevel.join(', ');

    console.log(`IDENTITY CHECK FOR CANDIDATE: [${cand.title}]`);
    console.log(`  - Requested: Subject=[${reqSubjStr}], Grade=[${reqGradeStr}]`);
    console.log(`  - Candidate: Subject=[${candSubjStr}], Grade=[${candGradeStr}]`);
    console.log(`  - Result: ${check.passed ? 'VERIFIED PASSED' : 'REJECTED MISMATCH'} (${check.reason})`);

    if (check.passed) {
      identityVerifiedCandidates.push(cand);
    } else {
      identityRejectedCandidates.push({ candidate: cand, reason: check.reason });
    }
  }

  console.log(`IDENTITY VERIFIED CANDIDATES COUNT: ${identityVerifiedCandidates.length}`);
  console.log(`IDENTITY REJECTED CANDIDATES COUNT: ${identityRejectedCandidates.length}`);

  // Step 7: Parse multi-level Table of Contents hierarchy
  const state = { chapterNumber: 1 };
  const rootNodes = (hierarchyContent && (hierarchyContent.children || hierarchyContent.childNodes || hierarchyContent.contents))
    || (rawContent.children || rawContent.childNodes || rawContent.contents)
    || [];

  const chapters = parseDikshaHierarchyNodes(
    rootNodes,
    1,
    identityVerifiedCandidates[0] ? identityVerifiedCandidates[0].url : (validCandidates[0] ? validCandidates[0].url : null),
    state,
    grade,
    subject
  );

  // Step 8: Select primary resource ONLY from identity verified candidates
  let selectedResource = null;
  if (identityVerifiedCandidates.length > 0) {
    const bookLevelCand = identityVerifiedCandidates.find(c => c.source === 'book' || c.isBookLevel);
    selectedResource = bookLevelCand || identityVerifiedCandidates[0];
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
    console.log(`[RESOLVER FAIL] No valid reading resource passed identity verification`);
    console.log(`========================================================\n`);

    let reason = 'RESOURCE_NOT_FOUND';
    let message = 'Reading resource is not available for this textbook.';

    if (validCandidates.length > 0 && identityVerifiedCandidates.length === 0) {
      reason = 'IDENTITY_MISMATCH_ONLY';
      message = 'The verified reading resources belong to a different subject or grade level than the requested textbook.';
    } else if (uniqueCandidates.length > 0) {
      reason = 'RESOURCE_VALIDATION_FAILED';
      message = 'We could not verify the textbook resource.';
    }

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
      rejectedCount: rejectedCandidates.length + identityRejectedCandidates.length,
      rejectedCandidates: rejectedCandidates.concat(identityRejectedCandidates)
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
    filters.board = boardObj ? (boardObj.dikshaAliases || [boardObj.dikshaFilter]) : [board];
  }

  if (gradeLevel) {
    const rawClass = Array.isArray(gradeLevel) ? gradeLevel[0] : gradeLevel;
    const numMatch = String(rawClass).match(/\d+/);
    const num = numMatch ? numMatch[0] : '';
    const romanMap = { '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
    const roman = romanMap[num] || '';

    filters.gradeLevel = [
      rawClass.startsWith('Class') ? rawClass : `Class ${rawClass}`,
      num ? `Class ${num}` : null,
      roman ? `Class ${roman}` : null,
      num ? `${num}th` : null,
      num ? `${num}` : null
    ].filter(Boolean);
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
      'TextBook',
      'eTextBook'
    ];
  }

  const requestedLimit = parseInt(limit, 10) || 20;
  const apiFetchLimit = Math.max(requestedLimit * 5, 100);

  const payload = {
    request: {
      filters: filters,
      query: query || '',
      limit: apiFetchLimit,
      offset: parseInt(offset, 10) || 0
    }
  };

  try {
    const response = await makePostRequest('/content/v1/search', payload);

    if (response.error) {
      return { success: false, total: 0, books: [], message: `Search API returned status ${response.statusCode}` };
    }

    const count = response.result ? (response.result.count || 0) : 0;
    const contents = response.result ? (response.result.content || []) : [];
    let normalizedBooks = contents.map(normalizeDikshaItem).filter(Boolean);

    // SMART BOARD FALLBACK: If strict board filter returned 0 books, search by state name / regional medium
    if (normalizedBooks.length === 0 && board) {
      const boardObj = getBoardByCode(board);
      const fallbackMedium = (boardObj && boardObj.supportedMediums) ? boardObj.supportedMediums[0] : null;

      const fallbackFilters = { ...filters };
      delete fallbackFilters.board;
      if (fallbackMedium && !medium) {
        fallbackFilters.medium = [fallbackMedium];
      }

      const fallbackPayload = {
        request: {
          filters: fallbackFilters,
          query: query || (boardObj ? boardObj.state : ''),
          limit: apiFetchLimit,
          offset: parseInt(offset, 10) || 0
        }
      };

      try {
        const fallbackRes = await makePostRequest('/content/v1/search', fallbackPayload);
        if (fallbackRes && !fallbackRes.error && fallbackRes.result && fallbackRes.result.content) {
          const fallbackContents = fallbackRes.result.content || [];
          const fallbackBooks = fallbackContents.map(normalizeDikshaItem).filter(Boolean);
          if (fallbackBooks.length > 0) {
            normalizedBooks = fallbackBooks;
          }
        }
      } catch (fErr) {
        console.warn(`[SEARCH FALLBACK] Board search fallback failed: ${fErr.message}`);
      }
    }

    // SMART RANKING ENGINE:
    // 1. Prioritize full textbook collections (mimeType === 'application/vnd.ekstep.content-collection')
    // 2. Prioritize core academic subjects (Math, Science, Social Studies, English, Hindi, Sanskrit) over vocational training
    // 3. Deprioritize isolated single-chapter topic files (e.g. titles starting with numbers/grammar topics)
    const coreSubjectsList = ['mathematics', 'science', 'social science', 'social studies', 'history', 'geography', 'political science', 'civics', 'economics', 'english', 'hindi', 'sanskrit'];

    normalizedBooks.sort((a, b) => {
      const aColl = a.mimeType === 'application/vnd.ekstep.content-collection' ? 1 : 0;
      const bColl = b.mimeType === 'application/vnd.ekstep.content-collection' ? 1 : 0;
      if (aColl !== bColl) return bColl - aColl;

      const aSubj = (a.subject && a.subject[0]) ? a.subject[0].toLowerCase() : '';
      const bSubj = (b.subject && b.subject[0]) ? b.subject[0].toLowerCase() : '';
      const aCore = coreSubjectsList.some(cs => aSubj.includes(cs)) ? 1 : 0;
      const bCore = coreSubjectsList.some(cs => bSubj.includes(cs)) ? 1 : 0;
      if (aCore !== bCore) return bCore - aCore;

      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      const aChapterDoc = aTitle.match(/^(?:\d+[\.\-\s]|chapter)/) ? 1 : 0;
      const bChapterDoc = bTitle.match(/^(?:\d+[\.\-\s]|chapter)/) ? 1 : 0;
      if (aChapterDoc !== bChapterDoc) return aChapterDoc - bChapterDoc;

      return 0;
    });

    // SUBJECT ROUND-ROBIN INTERLEAVER:
    // If user hasn't explicitly filtered by a single subject, balance results across subjects (Math, Science, Social, English, Hindi, Sanskrit)
    let finalBooks = normalizedBooks;
    if (!subject && normalizedBooks.length > 0) {
      const subjectMap = {};
      normalizedBooks.forEach(item => {
        const itemSubj = (item.subject && item.subject[0]) ? item.subject[0].trim() : 'General';
        if (!subjectMap[itemSubj]) subjectMap[itemSubj] = [];
        subjectMap[itemSubj].push(item);
      });

      // Sort subjectKeys so core academic subjects take precedence over vocational training
      const subjectKeys = Object.keys(subjectMap).sort((sA, sB) => {
        const sACore = coreSubjectsList.some(cs => sA.toLowerCase().includes(cs)) ? 1 : 0;
        const sBCore = coreSubjectsList.some(cs => sB.toLowerCase().includes(cs)) ? 1 : 0;
        return sBCore - sACore;
      });

      if (subjectKeys.length > 1) {
        const interleaved = [];
        let added = true;
        let round = 0;
        while (added && interleaved.length < requestedLimit) {
          added = false;
          for (const sKey of subjectKeys) {
            if (subjectMap[sKey][round]) {
              interleaved.push(subjectMap[sKey][round]);
              added = true;
              if (interleaved.length >= requestedLimit) break;
            }
          }
          round++;
        }
        finalBooks = interleaved;
      } else {
        finalBooks = normalizedBooks.slice(0, requestedLimit);
      }
    } else {
      finalBooks = normalizedBooks.slice(0, requestedLimit);
    }

    const resultData = {
      success: true,
      total: count > 0 ? count : finalBooks.length,
      limit: requestedLimit,
      offset: parseInt(offset, 10),
      books: finalBooks
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
  verifyCandidateIdentity,
  validateBookResource,
  validateBookTOC,
  createNormalizedBookModel
};
