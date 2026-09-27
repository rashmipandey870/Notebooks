const https = require('https');
const http = require('http');
const { getBoardByCode, BOARDS } = require('../config/boards');
const cache = require('./persistentCache');

const DIKSHA_BASE_URL = 'https://diksha.gov.in/api';

/**
 * Make HTTPS POST request to DIKSHA API with retry-with-backoff for transient errors
 */
async function makePostRequest(endpoint, payload, maxAttempts = 3) {
  const data = JSON.stringify(payload);
  const url = new URL(`${DIKSHA_BASE_URL}${endpoint}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = https.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
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
              resolve({ error: true, message: `Failed to parse JSON response: ${e.message}` });
            }
          });
        });

        req.on('error', err => resolve({ error: true, message: err.message }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ error: true, message: 'POST request timeout' });
        });
        req.write(data);
        req.end();
      });

      if (!res.error || attempt === maxAttempts) {
        return res;
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        return { error: true, message: err.message };
      }
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
}

/**
 * Make HTTPS GET request to DIKSHA API or direct URLs with retry-with-backoff
 */
async function makeGetRequest(urlStr, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = new URL(urlStr);
      const res = await new Promise((resolve) => {
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
      });

      if (!res.error || attempt === maxAttempts) {
        return res;
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        return { error: true, message: err.message };
      }
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
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
  if (primaryCat.includes('video') || primaryCat.includes('audio')) return;
  if (contentType.includes('video') || contentType.includes('audio')) return;

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

    const inheritedSubject = nodeSubject || (Array.isArray(subject) ? subject : (subject ? [subject] : null));
    const inheritedGradeLevel = nodeGradeLevel || (Array.isArray(grade) ? grade : (grade ? [grade] : null));

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
      subject: inheritedSubject,
      gradeLevel: inheritedGradeLevel
    });
  }

  const nodeSubject = node.subject ? (Array.isArray(node.subject) ? node.subject : [node.subject]) : null;
  const nodeGradeLevel = node.gradeLevel ? (Array.isArray(node.gradeLevel) ? node.gradeLevel : [node.gradeLevel]) : null;
  const currentGrade = nodeGradeLevel || grade;
  const currentSubject = nodeSubject || subject;

  const childArray = node.children || node.childNodes || node.contents || node.linkedContent || node.units;
  if (Array.isArray(childArray)) {
    for (const child of childArray) {
      if (typeof child === 'object' && child !== null) {
        discoverCandidatesFromNode(child, source === 'book' ? 'chapter' : source, candidates, currentGrade, currentSubject);
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
/**
 * Helper to check if node title is a generic non-chapter label, media folder, or unit container
 */
function isIgnoredNodeTitle(name, mimeType, primaryCategory, contentType, hasChildren = false) {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim().toLowerCase();

  // If node has children and has a multi-chapter unit container pattern or category, ignore container header
  if (hasChildren && (
    clean.match(/^\d+[\s\-\:]+[a-z].*\s{2,}[a-z]/) ||
    clean.match(/^\d+[\s\-\:]+[a-z].*\s+-\s+[a-z]/) ||
    (primaryCategory && (primaryCategory.toLowerCase() === 'textbook unit' || primaryCategory.toLowerCase() === 'unit')) ||
    (contentType && contentType.toLowerCase() === 'textbookunit')
  )) {
    return true;
  }

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
    'learning resources',
    'learning resource',
    'course material',
    'study material',
    'explanation content',
    'explanation resource',
    'explanation material',
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
    'multiple choice question',
    'multiple choice questions',
    'mcq',
    'mcqs',
    'mcq practice',
    'objective question',
    'objective questions',
    'fill in the blank',
    'fill in the blanks',
    'practice question set',
    'practice question',
    'practice set',
    'practice items',
    'practice item',
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
    'master lesson plan',
    'reading material',
    'concept map',
    'mind map',
    'ppt',
    'powerpoint',
    'reporting'
  ];

  if (ignoredExactOrContains.some(term => clean === term || clean.startsWith(term))) return true;
  
  if (
    clean.includes('multiple choice') ||
    clean.includes('mcq') ||
    clean.includes('objective question') ||
    clean.includes('fill in the blank') ||
    clean.includes('short answer') ||
    clean.includes('long answer') ||
    clean.includes('lesson plan') ||
    clean.includes('graphic novel') ||
    clean.includes('comparative study') ||
    clean.includes('learning resource') ||
    clean.includes('practice question') ||
    clean.includes('explanation content') ||
    clean.includes('reading material') ||
    clean.includes('concept map') ||
    clean.includes('mind map') ||
    clean.endsWith('ppt') ||
    clean.includes(' ppt') ||
    clean.includes('practice item') ||
    clean.includes('reporting(')
  ) {
    return true;
  }

  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('video') || mime.includes('audio') || mime.includes('image')) return true;

  const cat = (primaryCategory || '').toLowerCase();
  if (
    cat.includes('video') ||
    cat.includes('audio') ||
    cat.includes('practice') ||
    cat.includes('explanation') ||
    cat.includes('assessment')
  ) {
    return true;
  }

  return false;
}

/**
 * Fuzzy Chapter Title Normalizer for deduplication
 */
function normalizeChapterTitleKey(title) {
  if (!title || typeof title !== 'string') return '';
  let clean = title.trim().toLowerCase();

  // Strip chapter prefixes like "1- ", "chapter 1- ", "chapter 1: ", "lesson 1: ", "ch 1 ", "unit 1: ", "1. ", "poem-6-"
  clean = clean.replace(/^(?:chapter|lesson|unit|ch|l|poem)?\s*\d+[\.\s\:\-]+\s*/gi, '');

  // Strip supplementary resource suffix noise
  clean = clean.replace(/\b(reading material|explanation content|explanation resource|concept map|mind map|ppt|powerpoint|activity|practice|lesson plan|rm)\b/gi, '');
  
  // Strip common stopwords
  clean = clean.replace(/\b(a|an|the|of|to|in|on|at|for|from|by|with|and|or)\b/gi, '');

  // Strip non-alphanumeric characters except unicode scripts
  clean = clean.replace(/[^a-z0-9\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F]/g, '');

  if (clean.endsWith('s')) {
    clean = clean.slice(0, -1);
  }

  return clean;
}

/**
 * Helper to check if text contains native regional script characters
 */
function hasNativeScript(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/.test(text);
}

/**
 * Extracts native script title segment if present in title (e.g. "मेरा बचपन" from "मेरा बचपन mera bachapan 10")
 */
function extractNativeScriptTitle(title) {
  if (!title || typeof title !== 'string') return null;
  if (!hasNativeScript(title)) return null;

  const regex = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\s\:\,\.\-\–\—\(\)]+/g;
  const matches = title.match(regex);
  if (!matches) return null;

  let best = '';
  for (const m of matches) {
    const clean = m.trim().replace(/^[\:\,\.\-\–\—\(\)]+|[\:\,\.\-\–\—\(\)]+$/g, '').trim();
    if (hasNativeScript(clean) && clean.length > best.length) {
      best = clean;
    }
  }
  return best.length >= 2 ? best : null;
}

/**
 * Strips numeric chapter prefixes, noise, and transliteration suffixes from chapter display titles
 */
function cleanChapterTitle(title) {
  if (!title || typeof title !== 'string') return '';
  const native = extractNativeScriptTitle(title);
  if (native) return native;

  let clean = title.trim();
  clean = clean.replace(/^(?:chapter|lesson|unit|ch|l|poem)?\s*\d+[\.\s\:\-]+\s*/gi, '');
  clean = clean.replace(/\s*[\(\[\{](?:row|splitpdf|\d+)[\)\]\}]\s*/gi, '');
  clean = clean.replace(/\s+\d+$/g, '');
  return clean.trim() || title.trim();
}

/**
 * Builds consonant skeleton key for cross-script transliteration deduplication (e.g. "Mera bachpan" -> "mrbchpn")
 */
function buildConsonantSkeletonKey(title) {
  if (!title || typeof title !== 'string') return '';

  let clean = title.toLowerCase().trim();
  clean = clean.replace(/^(?:chapter|lesson|unit|ch|l|poem)?\s*\d+[\.\s\:\-]+\s*/gi, '');
  clean = clean.replace(/\s*[\(\[\{](?:row|splitpdf|\d+)[\)\]\}]\s*/gi, '');
  clean = clean.replace(/\s+\d+$/g, '');

  if (hasNativeScript(clean)) {
    clean = clean.replace(/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/g, ' ');
  }

  clean = clean.replace(/\b(a|an|the|of|to|in|on|at|for|from|by|with|and|or)\b/g, ' ');
  clean = clean.replace(/[^a-z0-9\s]/g, ' ');
  clean = clean.replace(/[aeiou]/g, '');
  clean = clean.replace(/\s+/g, '');

  return clean;
}

/**
 * Helper to check if node title script mismatches requested medium (e.g. Tamil script titles in English medium book)
 */
function hasScriptMismatch(title, targetMedium = 'English') {
  if (!title || typeof title !== 'string') return false;
  const tm = (Array.isArray(targetMedium) ? targetMedium.join(' ') : String(targetMedium || 'English')).toLowerCase();

  const hasTamil = /[\u0B80-\u0BFF]/.test(title);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(title);
  const hasHindi = /[\u0900-\u097F]/.test(title);
  const hasBengali = /[\u0980-\u09FF]/.test(title);
  const hasGujarati = /[\u0A80-\u0AFF]/.test(title);
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(title);
  const hasKannada = /[\u0C80-\u0CFF]/.test(title);

  // If requested medium is English/EM, ignore nodes whose titles contain non-Latin regional scripts
  if (tm.includes('english') || tm.includes('em')) {
    if (hasTamil || hasTelugu || hasHindi || hasBengali || hasGujarati || hasMalayalam || hasKannada) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively parse multi-level DIKSHA hierarchy nodes (Levels 1 to 4)
 * Deduplicates by normalized title key, consonant skeleton key, artifact URL, and page ranges.
 * Elevates native script display titles over Roman transliteration variants.
 */
function parseDikshaHierarchyNodes(nodes, level = 1, parentPdfUrl = null, state = { chapterNumber: 1 }, grade = 'Class 10', subject = 'General', seenTitleMap = new Map(), rootBookPdfUrl = null, targetMedium = 'English') {
  let chapters = [];
  if (!Array.isArray(nodes)) return chapters;

  if (!seenTitleMap._skeletonMap) seenTitleMap._skeletonMap = new Map();
  if (!seenTitleMap._pdfMap) seenTitleMap._pdfMap = new Map();
  if (!seenTitleMap._rangeMap) seenTitleMap._rangeMap = new Map();

  const seenSkeletonMap = seenTitleMap._skeletonMap;
  const seenPdfMap = seenTitleMap._pdfMap;
  const seenPageRangeMap = seenTitleMap._rangeMap;

  const rootPdf = rootBookPdfUrl || parentPdfUrl;

  for (const node of nodes) {
    if (!node) continue;
    const title = node.name ? node.name.trim() : '';
    const foundPdf = findPdfUrlInNode(node);

    const hasOwnPdf = !!foundPdf;
    const chapterPdfUrl = hasOwnPdf ? foundPdf : rootPdf;
    const isFallbackToBookPdf = !hasOwnPdf;

    const childNodes = node.children || node.childNodes || node.contents || node.linkedContent || node.units;
    const hasChildren = Array.isArray(childNodes) && childNodes.length > 0;

    const scriptMismatch = hasScriptMismatch(title, targetMedium);
    const isIgnored = scriptMismatch || isIgnoredNodeTitle(title, node.mimeType, node.primaryCategory, node.contentType, hasChildren);

    const titleKey = normalizeChapterTitleKey(title);
    const skeletonKey = buildConsonantSkeletonKey(title);
    const printedStart = (node.startPage && !isNaN(parseInt(node.startPage, 10))) ? parseInt(node.startPage, 10) : null;
    const printedEnd = (node.endPage && !isNaN(parseInt(node.endPage, 10))) ? parseInt(node.endPage, 10) : null;

    if (title && !isIgnored && (titleKey || skeletonKey)) {
      let existingCh = null;

      // 1. Exact normalized title key match
      if (titleKey && seenTitleMap.has(titleKey)) {
        existingCh = seenTitleMap.get(titleKey);
      }

      // 2. Consonant skeleton match (for transliterated/typo variants)
      if (!existingCh && skeletonKey && skeletonKey.length >= 3 && seenSkeletonMap.has(skeletonKey)) {
        existingCh = seenSkeletonMap.get(skeletonKey);
      }

      // 3. Exact chapter-specific PDF URL match (when node has own non-root PDF)
      if (!existingCh && hasOwnPdf && foundPdf && foundPdf !== rootPdf && seenPdfMap.has(foundPdf)) {
        existingCh = seenPdfMap.get(foundPdf);
      }

      // 4. Exact page range + PDF URL match
      if (!existingCh && printedStart !== null && printedEnd !== null && chapterPdfUrl) {
        const rangeKey = `${chapterPdfUrl}:${printedStart}-${printedEnd}`;
        if (seenPageRangeMap.has(rangeKey)) {
          existingCh = seenPageRangeMap.get(rangeKey);
        }
      }

      if (existingCh) {
        // FORWARD MERGE: Update existing chapter with better PDF, pages, or native script title
        if (existingCh.isFallbackToBookPdf && hasOwnPdf) {
          existingCh.pdfUrl = foundPdf;
          existingCh.proxyPdfUrl = `/api/v1/pdf/proxy?url=${encodeURIComponent(foundPdf)}`;
          existingCh.downloadUrl = `/api/v1/download?url=${encodeURIComponent(foundPdf)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${existingCh.chapterNumber}`)}`;
          existingCh.isFallbackToBookPdf = false;
        }

        if (existingCh.startPage === null && printedStart !== null) {
          existingCh.startPage = printedStart;
          existingCh.printedStartPage = printedStart;
          existingCh.endPage = printedEnd;
          existingCh.printedEndPage = printedEnd;
        }

        // Native script title elevation
        const nativeTitle = extractNativeScriptTitle(title);
        const existingHasNative = hasNativeScript(existingCh.title);
        const incomingHasNative = hasNativeScript(title);

        if (!existingHasNative && incomingHasNative && nativeTitle) {
          existingCh.title = nativeTitle;
        } else if (!existingHasNative && !incomingHasNative) {
          const cleanIncoming = cleanChapterTitle(title);
          const cleanExisting = cleanChapterTitle(existingCh.title);
          if (cleanIncoming && cleanIncoming.length < cleanExisting.length && cleanIncoming.length >= 3) {
            existingCh.title = cleanIncoming;
          }
        }
      } else {
        // PUSH NEW LOGICAL CHAPTER
        const currentChNum = state.chapterNumber;
        state.chapterNumber++;

        const cleanDisplayTitle = cleanChapterTitle(title);
        const proxyPdfUrl = chapterPdfUrl ? `/api/v1/pdf/proxy?url=${encodeURIComponent(chapterPdfUrl)}` : null;
        const downloadUrl = chapterPdfUrl ? `/api/v1/download?url=${encodeURIComponent(chapterPdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${currentChNum}`)}` : null;

        const chapterObj = {
          chapterNumber: currentChNum,
          identifier: node.identifier || `ch_${currentChNum}`,
          title: cleanDisplayTitle,
          level: Math.min(Math.max(level, 1), 4),
          startPage: printedStart,
          endPage: printedEnd,
          printedStartPage: printedStart,
          printedEndPage: printedEnd,
          pdfStartPage: null,
          pdfEndPage: null,
          pdfUrl: chapterPdfUrl,
          proxyPdfUrl: proxyPdfUrl,
          downloadUrl: downloadUrl,
          isFallbackToBookPdf: isFallbackToBookPdf
        };

        chapters.push(chapterObj);

        // Register in lookup maps
        if (titleKey) seenTitleMap.set(titleKey, chapterObj);
        if (skeletonKey && skeletonKey.length >= 3) seenSkeletonMap.set(skeletonKey, chapterObj);
        if (hasOwnPdf && foundPdf && foundPdf !== rootPdf) seenPdfMap.set(foundPdf, chapterObj);
        if (printedStart !== null && printedEnd !== null && chapterPdfUrl) {
          seenPageRangeMap.set(`${chapterPdfUrl}:${printedStart}-${printedEnd}`, chapterObj);
        }
      }
    }

    if (Array.isArray(childNodes) && childNodes.length > 0) {
      const nextLevel = isIgnored ? level : level + 1;
      const nextParentPdf = hasOwnPdf ? foundPdf : rootPdf;
      const childChapters = parseDikshaHierarchyNodes(childNodes, nextLevel, nextParentPdf, state, grade, subject, seenTitleMap, rootPdf, targetMedium);
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

  const extractGradeNumFromMetadata = (gStr) => {
    if (!gStr) return null;
    const match = String(gStr).match(/\b(?:class|grade|cl|std|standard)?\s*(\d{1,2}|viii|ix|x|xi|xii)\b/i);
    if (!match) return null;
    const val = match[1].toUpperCase();
    const romanMap = { 'VIII': '8', 'IX': '9', 'X': '10', 'XI': '11', 'XII': '12' };
    return romanMap[val] || val;
  };

  const extractGradeNumFromTitle = (tStr) => {
    if (!tStr) return null;
    const match = String(tStr).match(/\b(?:class|grade|cl|std|standard)\s*(\d{1,2}|viii|ix|x|xi|xii)\b/i);
    if (!match) return null;
    const val = match[1].toUpperCase();
    const romanMap = { 'VIII': '8', 'IX': '9', 'X': '10', 'XI': '11', 'XII': '12' };
    return romanMap[val] || val;
  };

  const reqGradeNum = reqGrades.map(extractGradeNumFromMetadata).find(Boolean);
  const candGradeNum = (candGrades.map(extractGradeNumFromMetadata).find(Boolean)) || extractGradeNumFromTitle(cand.title || cand.nodeTitle);

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
    return cache.get(cacheKey);
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
  let normalizedBook = normalizeDikshaItem(rawContent);

  if (!normalizedBook) {
    const rawGrade = Array.isArray(rawContent.gradeLevel) ? rawContent.gradeLevel[0] : (rawContent.gradeLevel || 'Class 10');
    const rawSubject = Array.isArray(rawContent.subject) ? rawContent.subject[0] : (rawContent.subject || 'General');
    const rawBoard = Array.isArray(rawContent.board) ? rawContent.board[0] : (rawContent.board || 'Central/State Board');
    const resolvedPdf = resolvePdfUrlForItem(rawContent);

    normalizedBook = {
      id: rawContent.identifier,
      dikshaId: rawContent.identifier,
      title: rawContent.name ? rawContent.name.trim() : 'Untitled Textbook',
      description: rawContent.description || `Class ${rawGrade} ${rawSubject} learning resource`,
      board: rawBoard,
      gradeLevel: Array.isArray(rawContent.gradeLevel) ? rawContent.gradeLevel : [rawGrade],
      subject: Array.isArray(rawContent.subject) ? rawContent.subject : [rawSubject],
      medium: Array.isArray(rawContent.medium) ? rawContent.medium : ['English'],
      contentType: rawContent.contentType || 'TextBook',
      primaryCategory: rawContent.primaryCategory || 'Digital Textbook',
      mimeType: rawContent.mimeType || 'application/pdf',
      posterImage: rawContent.posterImage || rawContent.appIcon || null,
      pdfUrl: resolvedPdf,
      proxyPdfUrl: resolvedPdf ? `/api/v1/pdf/proxy?url=${encodeURIComponent(resolvedPdf)}` : null,
      downloadUrl: resolvedPdf ? `/api/v1/download?url=${encodeURIComponent(resolvedPdf)}&filename=${encodeURIComponent(`${rawGrade}_${rawSubject}_${rawBoard}_Textbook`.replace(/[^a-zA-Z0-9_-]/g, '_'))}` : null,
      pdfValid: !!resolvedPdf,
      tocUrl: rawContent.toc_url || null,
      leafNodesCount: rawContent.leafNodesCount || 0,
      createdOn: rawContent.createdOn || null,
      lastUpdatedOn: rawContent.lastUpdatedOn || rawContent.lastPublishedOn || null,
      publisher: (rawContent.originData && rawContent.originData.organisation) ? rawContent.originData.organisation[0] : (rawContent.organisation ? rawContent.organisation[0] : 'NCERT')
    };
  }

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

  const rootBookPdfUrl = identityVerifiedCandidates[0] ? identityVerifiedCandidates[0].url : (validCandidates[0] ? validCandidates[0].url : null);
  const bookMedium = (normalizedBook.medium && normalizedBook.medium[0]) ? normalizedBook.medium[0] : 'English';
  const chapters = parseDikshaHierarchyNodes(
    rootNodes,
    1,
    rootBookPdfUrl,
    state,
    grade,
    subject,
    new Map(),
    rootBookPdfUrl,
    bookMedium
  );

  // Step 8: Select primary resource from identity verified candidates or first chapter PDF
  let selectedResource = null;
  if (identityVerifiedCandidates.length > 0) {
    const bookLevelCand = identityVerifiedCandidates.find(c => c.source === 'book' || c.isBookLevel);
    selectedResource = bookLevelCand || identityVerifiedCandidates[0];
  }

  const firstChapterPdfUrl = (chapters && chapters.find(c => c.pdfUrl)) ? chapters.find(c => c.pdfUrl).pdfUrl : null;
  const activeResourceUrl = selectedResource ? selectedResource.url : firstChapterPdfUrl;

  if (activeResourceUrl) {
    console.log(`[RESOLVER SUCCESS] Selected resource: ${activeResourceUrl}`);
    console.log(`========================================================\n`);

    const proxyPdfUrl = `/api/v1/pdf/proxy?url=${encodeURIComponent(activeResourceUrl)}`;
    const cleanFilename = `${grade}_${subject}_${normalizedBook.board}_Textbook`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadUrl = `/api/v1/download?url=${encodeURIComponent(activeResourceUrl)}&filename=${encodeURIComponent(cleanFilename)}`;

    normalizedBook.pdfUrl = activeResourceUrl;
    normalizedBook.proxyPdfUrl = proxyPdfUrl;
    normalizedBook.downloadUrl = downloadUrl;
    normalizedBook.pdfValid = true;
    normalizedBook.hasCompletePdf = (selectedResource && selectedResource.isBookLevel) || chapters.length === 0;
    normalizedBook.chapters = chapters;
    normalizedBook.resource = selectedResource || { url: activeResourceUrl, title: normalizedBook.title };
    normalizedBook.discoveredCandidates = uniqueCandidates.length;

    const result = {
      success: true,
      bookId: bookId,
      book: normalizedBook
    };

    cache.set(cacheKey, result);
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

    cache.set(cacheKey, result);
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
 * Deduplicate books by primary content identifier (dikshaId or id)
 */
function dedupeByIdentifier(books) {
  if (!Array.isArray(books)) return [];
  const seen = new Set();
  const result = [];
  for (const b of books) {
    const key = b.dikshaId || b.id;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(b);
  }
  return result;
}

/**
 * Secondary-layer guard: Deduplicate books by composite metadata key
 * Key: (title, subject[0], gradeLevel[0], medium.sort().join(','), board)
 * Preserves distinct medium editions (e.g. Gujarati vs English editions of same book)
 */
function dedupeByCompositeKey(books) {
  if (!Array.isArray(books)) return [];
  const seen = new Set();
  const result = [];
  for (const b of books) {
    const title = (b.title || '').toLowerCase().trim();
    const grade = (Array.isArray(b.gradeLevel) ? b.gradeLevel[0] : (b.gradeLevel || '')).toString().toLowerCase().trim();
    const subj = (Array.isArray(b.subject) ? b.subject[0] : (b.subject || '')).toString().toLowerCase().trim();
    const mediumArr = Array.isArray(b.medium) ? [...b.medium].sort() : [b.medium || ''];
    const mediumStr = mediumArr.join(',').toLowerCase().trim();
    const board = (b.board || '').toString().toLowerCase().trim();

    const compositeKey = `${title}|${subj}|${grade}|${mediumStr}|${board}`;
    if (seen.has(compositeKey)) continue;
    seen.add(compositeKey);
    result.push(b);
  }
  return result;
}

/**
 * Search textbooks & notebooks across DIKSHA portal
 * Uses a 5-Rung Progressive Relaxation Ladder for state board queries
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
    return cache.get(cacheKey);
  }

  const boardObj = board ? getBoardByCode(board) : null;
  const stateName = boardObj ? (boardObj.state || boardObj.shortName || boardObj.name) : (board || '');
  const fallbackMedium = (boardObj && boardObj.supportedMediums) ? boardObj.supportedMediums[0] : null;

  // Generate medium case variants & canonical taxonomy aliases (e.g. 'Bengali'/'Bangla', 'Odia'/'Oriya', 'Arabi'/'Arabic', 'ENGLISH'/'English')
  let mediumFilterList = null;
  if (medium || fallbackMedium) {
    const rawM = medium || fallbackMedium;
    const mArray = Array.isArray(rawM) ? rawM : [rawM];
    const mVariants = new Set();
    
    // Include board-specific medium aliases from board configuration
    if (boardObj) {
      if (boardObj.dikshaMediumAliases) {
        boardObj.dikshaMediumAliases.forEach(alias => mVariants.add(alias));
      }
      if (boardObj.supportedMediums) {
        boardObj.supportedMediums.forEach(sm => mVariants.add(sm));
      }
    }

    mArray.forEach(m => {
      if (m && typeof m === 'string') {
        const s = m.trim();
        mVariants.add(s);
        mVariants.add(s.toLowerCase());
        mVariants.add(s.toUpperCase());
        mVariants.add(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
        if (s.toLowerCase() === 'bengali') mVariants.add('Bangla');
        if (s.toLowerCase() === 'bangla') mVariants.add('Bengali');
        if (s.toLowerCase() === 'odia') mVariants.add('Oriya');
        if (s.toLowerCase() === 'oriya') mVariants.add('Odia');
        if (s.toLowerCase() === 'arabic') mVariants.add('Arabi');
        if (s.toLowerCase() === 'arabi') mVariants.add('Arabic');
        if (s.toLowerCase() === 'persian') mVariants.add('Pharsi');
        if (s.toLowerCase() === 'pharsi') mVariants.add('Persian');
        if (s.toLowerCase() === 'gujarati') mVariants.add('Gujrati');
        if (s.toLowerCase() === 'punjabi') mVariants.add('PUNJABI');
      }
    });
    mediumFilterList = Array.from(mVariants);
  }

  const requestedLimit = parseInt(limit, 10) || 20;
  const apiFetchLimit = Math.max(requestedLimit * 5, 100);

  // Progressive Relaxation Fallback Ladder:
  // Rung 1: board + gradeLevel + subject + medium (strict taxonomy filter)
  // Rung 2: board + gradeLevel + subject (drop medium filter)
  // Rung 3: board + gradeLevel (drop subject filter)
  // Rung 4: stateName free-text + gradeLevel (drop board taxonomy filter)
  // Rung 5: stateName free-text only (drop gradeLevel filter too)

  const rungNames = {
    1: 'primary_query',
    2: 'fallback_rung_2_drop_medium',
    3: 'fallback_rung_3_drop_subject',
    4: 'fallback_rung_4_state_query_class',
    5: 'fallback_rung_5_state_query_only'
  };

  let normalizedBooks = [];
  let rawDuplicatesCount = 0;
  let resolvedVia = 'none';
  let totalApiCount = 0;
  const executedRungs = [];

  for (let rung = 1; rung <= 5; rung++) {
    // Skip redundant rungs if optional parameters were not provided
    if (rung === 2 && (!medium && !fallbackMedium)) continue;
    if (rung === 3 && !subject) continue;
    if (rung === 4 && !board && !stateName) continue;
    if (rung === 5 && gradeLevel) continue; // Do not drop gradeLevel in Rung 5 if user explicitly requested a specific class

    const rungFilters = {};

    // Board taxonomy filter (Rungs 1 - 3)
    if (rung <= 3 && board) {
      rungFilters.board = boardObj ? (boardObj.dikshaAliases || [boardObj.dikshaFilter]) : [board];
    }

    // Grade level filter (Rungs 1 - 4)
    if (rung <= 4 && gradeLevel) {
      const rawClass = Array.isArray(gradeLevel) ? gradeLevel[0] : gradeLevel;
      const numMatch = String(rawClass).match(/\d+/);
      const num = numMatch ? numMatch[0] : '';
      const romanMap = { '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
      const roman = romanMap[num] || '';

      rungFilters.gradeLevel = [
        rawClass.startsWith('Class') ? rawClass : `Class ${rawClass}`,
        num ? `Class ${num}` : null,
        roman ? `Class ${roman}` : null,
        num ? `${num}th` : null,
        num ? `${num}` : null
      ].filter(Boolean);
    }

    // Subject filter (Rungs 1 - 2)
    if (rung <= 2 && subject) {
      rungFilters.subject = Array.isArray(subject) ? subject : [subject];
    }

    // Medium filter (Rung 1)
    if (rung === 1 && mediumFilterList && mediumFilterList.length > 0) {
      rungFilters.medium = mediumFilterList;
    }

    // Category filter
    if (contentType) {
      rungFilters.primaryCategory = Array.isArray(contentType) ? contentType : [contentType];
    } else {
      rungFilters.primaryCategory = [
        'Digital Textbook',
        'eTextbook',
        'TextBook',
        'eTextBook'
      ];
    }

    let rungQuery = query || '';
    if (rung >= 4 && !query && stateName) {
      rungQuery = stateName;
    }

    const payload = {
      request: {
        filters: rungFilters,
        query: rungQuery,
        limit: apiFetchLimit,
        offset: parseInt(offset, 10) || 0
      }
    };

    executedRungs.push(rungNames[rung]);

    try {
      const response = await makePostRequest('/content/v1/search', payload);

      if (response && !response.error && response.result && response.result.content) {
        const count = response.result.count || 0;
        const contents = response.result.content || [];

        const rawNormalized = contents.map(normalizeDikshaItem).filter(Boolean);
        const dedupedById = dedupeByIdentifier(rawNormalized);
        const deduped = dedupeByCompositeKey(dedupedById);

        if (deduped.length > 0) {
          normalizedBooks = deduped;
          rawDuplicatesCount = rawNormalized.length - deduped.length;
          resolvedVia = rungNames[rung];
          totalApiCount = count > 0 ? count : deduped.length;
          console.log(`[SEARCH LADDER] Board [${board || 'ANY'}] Grade [${gradeLevel || 'ANY'}] resolved ${deduped.length} books via Rung ${rung} (${rungNames[rung]})`);
          break;
        }
      }
    } catch (rErr) {
      console.warn(`[SEARCH LADDER] Rung ${rung} failed for ${board}: ${rErr.message}`);
    }
  }

  // EXPLICIT GAP DIAGNOSTICS: If Rungs 1-4 return zero, run Rung 5 as a diagnostic-only probe
  if (normalizedBooks.length === 0) {
    const displayBoard = boardObj ? boardObj.name : (board || 'Selected Board');
    const displayClass = gradeLevel ? (Array.isArray(gradeLevel) ? gradeLevel[0] : gradeLevel) : 'Class 8-12';

    let hasBoardContentAnyGrade = false;
    executedRungs.push('fallback_rung_5_state_query_only');

    try {
      // Diagnostic Probe: Query DIKSHA for the board with zero grade / subject / medium filters
      const probeFilters = {
        primaryCategory: contentType ? (Array.isArray(contentType) ? contentType : [contentType]) : ['Digital Textbook', 'eTextbook', 'TextBook', 'eTextBook']
      };
      if (board) {
        probeFilters.board = boardObj ? (boardObj.dikshaAliases || [boardObj.dikshaFilter]) : [board];
      }

      const probePayload = {
        request: {
          filters: probeFilters,
          query: query || (board ? '' : stateName),
          limit: 20,
          offset: 0
        }
      };

      const probeRes = await makePostRequest('/content/v1/search', probePayload);
      if (probeRes && !probeRes.error && probeRes.result && probeRes.result.content) {
        const probeNormalized = probeRes.result.content.map(normalizeDikshaItem).filter(Boolean);
        if (probeNormalized.length > 0) {
          hasBoardContentAnyGrade = true;
        }
      }
    } catch (pErr) {
      console.warn(`[SEARCH LADDER DIAGNOSTIC PROBE] Probe failed for ${board}: ${pErr.message}`);
    }

    const failureReason = hasBoardContentAnyGrade ? 'GRADE_TAG_MISMATCH' : 'NO_CONTENT_PUBLISHED';
    const failureMessage = hasBoardContentAnyGrade
      ? `${displayBoard} has digital textbooks published on DIKSHA, but none tagged specifically for ${displayClass} (grade-level tagging discrepancy).`
      : `${displayBoard} has no digital textbooks published on DIKSHA yet.`;

    const noContentResult = {
      success: true,
      total: 0,
      limit: requestedLimit,
      offset: parseInt(offset, 10) || 0,
      books: [],
      reason: failureReason,
      resolvedVia: 'none',
      message: failureMessage,
      executedRungs: executedRungs
    };

    cache.set(cacheKey, noContentResult);
    return noContentResult;
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
    total: totalApiCount,
    limit: requestedLimit,
    offset: parseInt(offset, 10),
    books: finalBooks,
    resolvedVia: resolvedVia,
    reason: resolvedVia === 'primary_query' ? 'RESOLVED_PRIMARY' : 'RESOLVED_VIA_FALLBACK',
    rawDuplicatesCount: rawDuplicatesCount,
    postDedupDuplicatesCount: finalBooks.length - new Set(finalBooks.map(b => b.dikshaId || b.id)).size,
    executedRungs: executedRungs
  };

  cache.set(cacheKey, resultData);
  return resultData;
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
  createNormalizedBookModel,
  dedupeByIdentifier,
  dedupeByCompositeKey
};
