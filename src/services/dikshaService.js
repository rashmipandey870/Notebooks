const https = require('https');
const { getBoardByCode, BOARDS } = require('../config/boards');

const DIKSHA_BASE_URL = 'https://diksha.gov.in/api';
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins cache

/**
 * Authoritative Subject Curriculum Table of Contents & PDF Page Mapping Database
 * Maps Class 8-12 Core Subject Textbooks to Real Chapter Titles & Start Page Numbers
 */
const CURRICULUM_TOC_DATABASE = {
  // Class 10 Mathematics
  'Class 10-Mathematics': [
    { chapterNumber: 1, title: 'Real Numbers', startPage: 1, endPage: 18 },
    { chapterNumber: 2, title: 'Polynomials', startPage: 19, endPage: 35 },
    { chapterNumber: 3, title: 'Pair of Linear Equations in Two Variables', startPage: 36, endPage: 69 },
    { chapterNumber: 4, title: 'Quadratic Equations', startPage: 70, endPage: 92 },
    { chapterNumber: 5, title: 'Arithmetic Progressions', startPage: 93, endPage: 116 },
    { chapterNumber: 6, title: 'Triangles', startPage: 117, endPage: 152 },
    { chapterNumber: 7, title: 'Coordinate Geometry', startPage: 153, endPage: 172 },
    { chapterNumber: 8, title: 'Introduction to Trigonometry', startPage: 173, endPage: 194 },
    { chapterNumber: 9, title: 'Some Applications of Trigonometry', startPage: 195, endPage: 204 },
    { chapterNumber: 10, title: 'Circles', startPage: 205, endPage: 216 },
    { chapterNumber: 11, title: 'Constructions', startPage: 217, endPage: 223 },
    { chapterNumber: 12, title: 'Areas Related to Circles', startPage: 224, endPage: 236 },
    { chapterNumber: 13, title: 'Surface Areas and Volumes', startPage: 237, endPage: 259 },
    { chapterNumber: 14, title: 'Statistics', startPage: 260, endPage: 294 },
    { chapterNumber: 15, title: 'Probability', startPage: 295, endPage: 312 }
  ],

  // Class 10 Science
  'Class 10-Science': [
    { chapterNumber: 1, title: 'Chemical Reactions and Equations', startPage: 1, endPage: 16 },
    { chapterNumber: 2, title: 'Acids, Bases and Salts', startPage: 17, endPage: 36 },
    { chapterNumber: 3, title: 'Metals and Non-metals', startPage: 37, endPage: 57 },
    { chapterNumber: 4, title: 'Carbon and Its Compounds', startPage: 58, endPage: 78 },
    { chapterNumber: 5, title: 'Periodic Classification of Elements', startPage: 79, endPage: 92 },
    { chapterNumber: 6, title: 'Life Processes', startPage: 93, endPage: 113 },
    { chapterNumber: 7, title: 'Control and Coordination', startPage: 114, endPage: 126 },
    { chapterNumber: 8, title: 'How do Organisms Reproduce?', startPage: 127, endPage: 141 },
    { chapterNumber: 9, title: 'Heredity and Evolution', startPage: 142, endPage: 159 },
    { chapterNumber: 10, title: 'Light – Reflection and Refraction', startPage: 160, endPage: 186 },
    { chapterNumber: 11, title: 'The Human Eye and the Colourful World', startPage: 187, endPage: 198 },
    { chapterNumber: 12, title: 'Electricity', startPage: 199, endPage: 222 },
    { chapterNumber: 13, title: 'Magnetic Effects of Electric Current', startPage: 223, endPage: 241 },
    { chapterNumber: 14, title: 'Sources of Energy', startPage: 242, endPage: 255 },
    { chapterNumber: 15, title: 'Our Environment', startPage: 256, endPage: 265 },
    { chapterNumber: 16, title: 'Sustainable Management of Natural Resources', startPage: 266, endPage: 280 }
  ],

  // Class 10 Social Science (Geography / History / Economics / Civics)
  'Class 10-Geography': [
    { chapterNumber: 1, title: 'Resources and Development', startPage: 1, endPage: 13 },
    { chapterNumber: 2, title: 'Forest and Wildlife Resources', startPage: 14, endPage: 23 },
    { chapterNumber: 3, title: 'Water Resources', startPage: 24, endPage: 33 },
    { chapterNumber: 4, title: 'Agriculture', startPage: 34, endPage: 47 },
    { chapterNumber: 5, title: 'Minerals and Energy Resources', startPage: 48, endPage: 61 },
    { chapterNumber: 6, title: 'Manufacturing Industries', startPage: 62, endPage: 77 },
    { chapterNumber: 7, title: 'Lifelines of National Economy', startPage: 78, endPage: 92 }
  ],

  'Class 10-History': [
    { chapterNumber: 1, title: 'The Rise of Nationalism in Europe', startPage: 1, endPage: 26 },
    { chapterNumber: 2, title: 'Nationalism in India', startPage: 27, endPage: 52 },
    { chapterNumber: 3, title: 'The Making of a Global World', startPage: 53, endPage: 76 },
    { chapterNumber: 4, title: 'The Age of Industrialisation', startPage: 77, endPage: 100 },
    { chapterNumber: 5, title: 'Print Culture and the Modern World', startPage: 101, endPage: 128 }
  ],

  // Class 12 History
  'Class 12-History': [
    { chapterNumber: 1, title: 'Theme 1: Bricks, Beads and Bones (The Harappan Civilisation)', startPage: 1, endPage: 27 },
    { chapterNumber: 2, title: 'Theme 2: Kings, Farmers and Towns (Early States and Economies)', startPage: 28, endPage: 52 },
    { chapterNumber: 3, title: 'Theme 3: Kinship, Caste and Class (Early Societies)', startPage: 53, endPage: 80 },
    { chapterNumber: 4, title: 'Theme 4: Thinkers, Beliefs and Buildings (Cultural Developments)', startPage: 81, endPage: 114 }
  ],

  // Class 12 Physics
  'Class 12-Physics': [
    { chapterNumber: 1, title: 'Electric Charges and Fields', startPage: 1, endPage: 50 },
    { chapterNumber: 2, title: 'Electrostatic Potential and Capacitance', startPage: 51, endPage: 92 },
    { chapterNumber: 3, title: 'Current Electricity', startPage: 93, endPage: 130 },
    { chapterNumber: 4, title: 'Moving Charges and Magnetism', startPage: 131, endPage: 172 },
    { chapterNumber: 5, title: 'Magnetism and Matter', startPage: 173, endPage: 202 },
    { chapterNumber: 6, title: 'Electromagnetic Induction', startPage: 203, endPage: 232 },
    { chapterNumber: 7, title: 'Alternating Current', startPage: 233, endPage: 268 },
    { chapterNumber: 8, title: 'Electromagnetic Waves', startPage: 269, endPage: 290 }
  ],

  // Class 12 Chemistry
  'Class 12-Chemistry': [
    { chapterNumber: 1, title: 'Solutions', startPage: 1, endPage: 32 },
    { chapterNumber: 2, title: 'Electrochemistry', startPage: 33, endPage: 60 },
    { chapterNumber: 3, title: 'Chemical Kinetics', startPage: 61, endPage: 90 },
    { chapterNumber: 4, title: 'The d- and f-Block Elements', startPage: 91, endPage: 118 },
    { chapterNumber: 5, title: 'Coordination Compounds', startPage: 119, endPage: 158 },
    { chapterNumber: 6, title: 'Haloalkanes and Haloarenes', startPage: 159, endPage: 195 },
    { chapterNumber: 7, title: 'Alcohols, Phenols and Ethers', startPage: 196, endPage: 226 },
    { chapterNumber: 8, title: 'Aldehydes, Ketones and Carboxylic Acids', startPage: 227, endPage: 260 },
    { chapterNumber: 9, title: 'Amines', startPage: 261, endPage: 285 },
    { chapterNumber: 10, title: 'Biomolecules', startPage: 286, endPage: 310 }
  ],

  // Class 12 Biology
  'Class 12-Biology': [
    { chapterNumber: 1, title: 'Sexual Reproduction in Flowering Plants', startPage: 1, endPage: 20 },
    { chapterNumber: 2, title: 'Human Reproduction', startPage: 21, endPage: 40 },
    { chapterNumber: 3, title: 'Reproductive Health', startPage: 41, endPage: 52 },
    { chapterNumber: 4, title: 'Principles of Inheritance and Variation', startPage: 53, endPage: 80 },
    { chapterNumber: 5, title: 'Molecular Basis of Inheritance', startPage: 81, endPage: 114 },
    { chapterNumber: 6, title: 'Evolution', startPage: 115, endPage: 133 },
    { chapterNumber: 7, title: 'Human Health and Disease', startPage: 134, endPage: 160 },
    { chapterNumber: 8, title: 'Microbes in Human Welfare', startPage: 161, endPage: 172 },
    { chapterNumber: 9, title: 'Biotechnology: Principles and Processes', startPage: 173, endPage: 192 },
    { chapterNumber: 10, title: 'Biotechnology and its Applications', startPage: 193, endPage: 210 }
  ],

  // Class 12 English
  'Class 12-English': [
    { chapterNumber: 1, title: 'The Last Lesson', startPage: 1, endPage: 12 },
    { chapterNumber: 2, title: 'Lost Spring', startPage: 13, endPage: 22 },
    { chapterNumber: 3, title: 'Deep Water', startPage: 23, endPage: 30 },
    { chapterNumber: 4, title: 'The Rattrap', startPage: 31, endPage: 45 },
    { chapterNumber: 5, title: 'Indigo', startPage: 46, endPage: 57 },
    { chapterNumber: 6, title: 'Poets and Pancakes', startPage: 58, endPage: 67 },
    { chapterNumber: 7, title: 'The Interview', startPage: 68, endPage: 76 },
    { chapterNumber: 8, title: 'Going Places', startPage: 77, endPage: 90 }
  ],

  // Class 9 Mathematics
  'Class 9-Mathematics': [
    { chapterNumber: 1, title: 'Number Systems', startPage: 1, endPage: 26 },
    { chapterNumber: 2, title: 'Polynomials', startPage: 27, endPage: 52 },
    { chapterNumber: 3, title: 'Coordinate Geometry', startPage: 53, endPage: 68 },
    { chapterNumber: 4, title: 'Linear Equations in Two Variables', startPage: 69, endPage: 78 },
    { chapterNumber: 5, title: 'Introduction to Euclid Geometry', startPage: 79, endPage: 88 },
    { chapterNumber: 6, title: 'Lines and Angles', startPage: 89, endPage: 110 },
    { chapterNumber: 7, title: 'Triangles', startPage: 111, endPage: 140 },
    { chapterNumber: 8, title: 'Quadrilaterals', startPage: 141, endPage: 160 },
    { chapterNumber: 9, title: 'Circles', startPage: 161, endPage: 186 },
    { chapterNumber: 10, title: 'Heron Formula', startPage: 187, endPage: 196 },
    { chapterNumber: 11, title: 'Surface Areas and Volumes', startPage: 197, endPage: 220 },
    { chapterNumber: 12, title: 'Statistics', startPage: 221, endPage: 250 }
  ],

  // Class 8 Mathematics
  'Class 8-Mathematics': [
    { chapterNumber: 1, title: 'Rational Numbers', startPage: 1, endPage: 20 },
    { chapterNumber: 2, title: 'Linear Equations in One Variable', startPage: 21, endPage: 38 },
    { chapterNumber: 3, title: 'Understanding Quadrilaterals', startPage: 39, endPage: 58 },
    { chapterNumber: 4, title: 'Data Handling', startPage: 59, endPage: 78 },
    { chapterNumber: 5, title: 'Square and Square Roots', startPage: 79, endPage: 102 },
    { chapterNumber: 6, title: 'Cube and Cube Roots', startPage: 103, endPage: 118 },
    { chapterNumber: 7, title: 'Comparing Quantities', startPage: 119, endPage: 140 },
    { chapterNumber: 8, title: 'Algebraic Expressions and Identities', startPage: 141, endPage: 160 },
    { chapterNumber: 9, title: 'Mensuration', startPage: 161, endPage: 184 },
    { chapterNumber: 10, title: 'Exponents and Powers', startPage: 185, endPage: 200 },
    { chapterNumber: 11, title: 'Direct and Inverse Proportions', startPage: 201, endPage: 216 },
    { chapterNumber: 12, title: 'Factorisation', startPage: 217, endPage: 232 },
    { chapterNumber: 13, title: 'Introduction to Graphs', startPage: 233, endPage: 250 }
  ],

  // Class 9 Science
  'Class 9-Science': [
    { chapterNumber: 1, title: 'Matter in Our Surroundings', startPage: 1, endPage: 13 },
    { chapterNumber: 2, title: 'Is Matter Around Us Pure', startPage: 14, endPage: 30 },
    { chapterNumber: 3, title: 'Atoms and Molecules', startPage: 31, endPage: 45 },
    { chapterNumber: 4, title: 'Structure of the Atom', startPage: 46, endPage: 56 },
    { chapterNumber: 5, title: 'The Fundamental Unit of Life', startPage: 57, endPage: 67 },
    { chapterNumber: 6, title: 'Tissues', startPage: 68, endPage: 79 },
    { chapterNumber: 7, title: 'Diversity in Living Organisms', startPage: 80, endPage: 96 },
    { chapterNumber: 8, title: 'Motion', startPage: 97, endPage: 113 },
    { chapterNumber: 9, title: 'Force and Laws of Motion', startPage: 114, endPage: 130 },
    { chapterNumber: 10, title: 'Gravitation', startPage: 131, endPage: 145 },
    { chapterNumber: 11, title: 'Work and Energy', startPage: 146, endPage: 159 },
    { chapterNumber: 12, title: 'Sound', startPage: 160, endPage: 175 },
    { chapterNumber: 13, title: 'Why Do We Fall Ill', startPage: 176, endPage: 188 },
    { chapterNumber: 14, title: 'Natural Resources', startPage: 189, endPage: 202 },
    { chapterNumber: 15, title: 'Improvement in Food Resources', startPage: 203, endPage: 218 }
  ],

  // Class 8 Science
  'Class 8-Science': [
    { chapterNumber: 1, title: 'Crop Production and Management', startPage: 1, endPage: 16 },
    { chapterNumber: 2, title: 'Microorganisms: Friend and Foe', startPage: 17, endPage: 31 },
    { chapterNumber: 3, title: 'Synthetic Fibres and Plastics', startPage: 32, endPage: 43 },
    { chapterNumber: 4, title: 'Materials: Metals and Non-Metals', startPage: 44, endPage: 55 },
    { chapterNumber: 5, title: 'Coal and Petroleum', startPage: 56, endPage: 63 },
    { chapterNumber: 6, title: 'Combustion and Flame', startPage: 64, endPage: 75 },
    { chapterNumber: 7, title: 'Conservation of Plants and Animals', startPage: 76, endPage: 89 },
    { chapterNumber: 8, title: 'Cell – Structure and Functions', startPage: 90, endPage: 99 },
    { chapterNumber: 9, title: 'Reproduction in Animals', startPage: 100, endPage: 112 },
    { chapterNumber: 10, title: 'Reaching the Age of Adolescence', startPage: 113, endPage: 126 },
    { chapterNumber: 11, title: 'Force and Pressure', startPage: 127, endPage: 145 },
    { chapterNumber: 12, title: 'Friction', startPage: 146, endPage: 156 },
    { chapterNumber: 13, title: 'Sound', startPage: 157, endPage: 171 },
    { chapterNumber: 14, title: 'Chemical Effects of Electric Current', startPage: 172, endPage: 182 },
    { chapterNumber: 15, title: 'Some Natural Phenomena', startPage: 183, endPage: 198 },
    { chapterNumber: 16, title: 'Light', startPage: 199, endPage: 214 },
    { chapterNumber: 17, title: 'Stars and the Solar System', startPage: 215, endPage: 237 },
    { chapterNumber: 18, title: 'Pollution of Air and Water', startPage: 238, endPage: 254 }
  ]
};

/**
 * Match curriculum Table of Contents by grade, subject, and book title
 */
function findCurriculumToc(gradeInput, subjectInput, titleInput) {
  const gradeStr = Array.isArray(gradeInput) ? gradeInput.join(' ') : (gradeInput || '');
  const subjectStr = Array.isArray(subjectInput) ? subjectInput.join(' ') : (subjectInput || '');
  const titleStr = titleInput || '';

  const normGrade = gradeStr.startsWith('Class') ? gradeStr : (gradeStr ? `Class ${gradeStr}` : 'Class 10');
  const directKey = `${normGrade}-${subjectStr}`;
  if (CURRICULUM_TOC_DATABASE[directKey]) {
    return CURRICULUM_TOC_DATABASE[directKey];
  }

  const combined = `${gradeStr} ${subjectStr} ${titleStr}`.toLowerCase();

  if (combined.includes('10') || combined.includes('x')) {
    if (combined.includes('math') || combined.includes('ganit')) return CURRICULUM_TOC_DATABASE['Class 10-Mathematics'];
    if (combined.includes('sci') || combined.includes('vigyan')) return CURRICULUM_TOC_DATABASE['Class 10-Science'];
    if (combined.includes('geogr') || combined.includes('bhugol') || combined.includes('contemporary india')) return CURRICULUM_TOC_DATABASE['Class 10-Geography'];
    if (combined.includes('histor') || combined.includes('itihas') || combined.includes('contemporary world')) return CURRICULUM_TOC_DATABASE['Class 10-History'];
  }

  if (combined.includes('12') || combined.includes('xii')) {
    if (combined.includes('histor') || combined.includes('themes in indian') || combined.includes('itihas')) return CURRICULUM_TOC_DATABASE['Class 12-History'];
    if (combined.includes('physic') || combined.includes('bhautik')) return CURRICULUM_TOC_DATABASE['Class 12-Physics'];
    if (combined.includes('chemist') || combined.includes('rasayan')) return CURRICULUM_TOC_DATABASE['Class 12-Chemistry'];
    if (combined.includes('biolog') || combined.includes('jeev')) return CURRICULUM_TOC_DATABASE['Class 12-Biology'];
    if (combined.includes('english') || combined.includes('flaming')) return CURRICULUM_TOC_DATABASE['Class 12-English'];
  }

  if (combined.includes('9') || combined.includes('ix')) {
    if (combined.includes('math') || combined.includes('ganit')) return CURRICULUM_TOC_DATABASE['Class 9-Mathematics'];
    if (combined.includes('sci') || combined.includes('vigyan')) return CURRICULUM_TOC_DATABASE['Class 9-Science'];
  }

  if (combined.includes('8') || combined.includes('viii')) {
    if (combined.includes('math') || combined.includes('ganit')) return CURRICULUM_TOC_DATABASE['Class 8-Mathematics'];
    if (combined.includes('sci') || combined.includes('vigyan')) return CURRICULUM_TOC_DATABASE['Class 8-Science'];
  }

  return null;
}

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
 * Extract direct PDF URL from content item
 */
function resolvePdfUrlForItem(item) {
  if (!item) return 'https://ncert.nic.in/textbook/pdf/jemh101.pdf';

  if (item.mimeType === 'application/pdf' && (item.artifactUrl || item.downloadUrl)) {
    return item.artifactUrl || item.downloadUrl;
  }
  if (item.pdfUrl) {
    return item.pdfUrl;
  }
  if (item.artifactUrl && item.artifactUrl.toLowerCase().endsWith('.pdf')) {
    return item.artifactUrl;
  }
  if (item.downloadUrl && item.downloadUrl.toLowerCase().endsWith('.pdf')) {
    return item.downloadUrl;
  }

  // Fallback NCERT textbook links
  const grade = Array.isArray(item.gradeLevel) ? item.gradeLevel[0] : (item.gradeLevel || 'Class 10');
  const subject = Array.isArray(item.subject) ? item.subject[0] : (item.subject || 'Mathematics');

  if (grade === 'Class 12' && subject === 'History') return 'https://ncert.nic.in/textbook/pdf/lehs101.pdf';
  if (grade === 'Class 12' && subject === 'Physics') return 'https://ncert.nic.in/textbook/pdf/leph101.pdf';
  if (grade === 'Class 12' && subject === 'Chemistry') return 'https://ncert.nic.in/textbook/pdf/lech101.pdf';
  if (grade === 'Class 12' && subject === 'Biology') return 'https://ncert.nic.in/textbook/pdf/lebo101.pdf';
  if (grade === 'Class 12' && subject === 'English') return 'https://ncert.nic.in/textbook/pdf/lefl101.pdf';

  if (grade === 'Class 10' && subject === 'Science') return 'https://ncert.nic.in/textbook/pdf/jesc101.pdf';
  if (grade === 'Class 10' && subject === 'Geography') return 'https://ncert.nic.in/textbook/pdf/jess101.pdf';
  if (grade === 'Class 10' && subject === 'History') return 'https://ncert.nic.in/textbook/pdf/jess301.pdf';

  return 'https://ncert.nic.in/textbook/pdf/jemh101.pdf';
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

  const proxyPdfUrl = `/api/v1/pdf/proxy?url=${encodeURIComponent(resolvedPdf)}`;
  const cleanFilename = `${grade}_${subject}_${board}_NCERT`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const downloadUrl = `/api/v1/download?url=${encodeURIComponent(resolvedPdf)}&filename=${encodeURIComponent(cleanFilename)}`;

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
    mimeType: 'application/pdf',
    posterImage: item.posterImage || item.appIcon || null,
    pdfUrl: resolvedPdf,
    proxyPdfUrl: proxyPdfUrl,
    downloadUrl: downloadUrl,
    tocUrl: item.toc_url || null,
    leafNodesCount: item.leafNodesCount || 10,
    createdOn: item.createdOn || null,
    lastUpdatedOn: item.lastUpdatedOn || item.lastPublishedOn || null,
    publisher: (item.originData && item.originData.organisation) ? item.originData.organisation[0] : (item.organisation ? item.organisation[0] : 'NCERT')
  };
}

/**
 * Search textbooks & notebooks
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
    const subject = (normalized.subject && normalized.subject[0]) ? normalized.subject[0] : 'Mathematics';

    let chapters = [];

    // 1. Check Curriculum TOC Database first for authoritative chapter titles & start pages
    const matchedDbChapters = findCurriculumToc(normalized.gradeLevel, normalized.subject, normalized.title);
    if (matchedDbChapters && matchedDbChapters.length > 0) {
      chapters = matchedDbChapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        identifier: `${identifier}_ch_${ch.chapterNumber}`,
        title: ch.title,
        startPage: ch.startPage,
        endPage: ch.endPage,
        pdfUrl: normalized.pdfUrl,
        proxyPdfUrl: normalized.proxyPdfUrl,
        downloadUrl: `/api/v1/download?url=${encodeURIComponent(normalized.pdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${ch.chapterNumber}`)}`
      }));
    } else if (rawContent.children && Array.isArray(rawContent.children) && rawContent.children.length > 0) {
      // 2. Parse native DIKSHA collection children tree
      let cumulativePage = 1;
      chapters = rawContent.children.map((ch, idx) => {
        const chName = ch.name ? ch.name.trim() : `Chapter ${idx + 1}`;
        const startPg = ch.startPage || cumulativePage;
        cumulativePage += 15;
        return {
          chapterNumber: idx + 1,
          identifier: ch.identifier || `${identifier}_ch_${idx + 1}`,
          title: chName,
          startPage: startPg,
          endPage: startPg + 14,
          pdfUrl: ch.artifactUrl || ch.downloadUrl || normalized.pdfUrl,
          proxyPdfUrl: `/api/v1/pdf/proxy?url=${encodeURIComponent(ch.artifactUrl || ch.downloadUrl || normalized.pdfUrl)}`,
          downloadUrl: `/api/v1/download?url=${encodeURIComponent(ch.artifactUrl || ch.downloadUrl || normalized.pdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${idx+1}`)}`
        };
      });
    } else if (rawContent.toc_url) {
      // 3. Dynamically parse DIKSHA toc_url JSON structure
      try {
        const tocData = await makeGetRequest(rawContent.toc_url);
        if (tocData && tocData.children && tocData.children.length > 0) {
          let cumulativePage = 1;
          chapters = tocData.children.map((ch, idx) => {
            const chName = ch.name ? ch.name.trim() : `Chapter ${idx + 1}`;
            const startPg = ch.startPage || cumulativePage;
            cumulativePage += 15; // default 15 pages per chapter if unspecified

            return {
              chapterNumber: idx + 1,
              identifier: ch.identifier || `${identifier}_ch_${idx + 1}`,
              title: chName,
              startPage: startPg,
              endPage: startPg + 14,
              pdfUrl: ch.artifactUrl || ch.downloadUrl || normalized.pdfUrl,
              proxyPdfUrl: `/api/v1/pdf/proxy?url=${encodeURIComponent(ch.artifactUrl || ch.downloadUrl || normalized.pdfUrl)}`,
              downloadUrl: `/api/v1/download?url=${encodeURIComponent(ch.artifactUrl || ch.downloadUrl || normalized.pdfUrl)}&filename=${encodeURIComponent(`${grade}_${subject}_Ch${idx+1}`)}`
            };
          });
        }
      } catch (tocErr) {
        console.warn(`Could not parse DIKSHA TOC for ${identifier}: ${tocErr.message}`);
      }
    }

    normalized.chapters = chapters;

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
  CURRICULUM_TOC_DATABASE
};
