// Configure PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let currentBoard = 'CBSE';
let currentClass = 'Class 10';
let currentSubject = '';
let currentMedium = '';
let currentSearch = '';
let boardsList = [
  { code: 'CBSE', shortName: 'CBSE / NCERT', badgeColor: '#2563eb' },
  { code: 'UP', shortName: 'UP Board', badgeColor: '#dc2626' },
  { code: 'MP', shortName: 'MP Board', badgeColor: '#059669' },
  { code: 'MH', shortName: 'Maharashtra Board', badgeColor: '#7c3aed' },
  { code: 'BIHAR', shortName: 'Bihar Board', badgeColor: '#d97706' },
  { code: 'RJ', shortName: 'Rajasthan Board', badgeColor: '#ea580c' },
  { code: 'TN', shortName: 'Tamil Nadu Board', badgeColor: '#0891b2' },
  { code: 'KA', shortName: 'Karnataka Board', badgeColor: '#4f46e5' },
  { code: 'WB', shortName: 'West Bengal Board', badgeColor: '#be123c' },
  { code: 'GJ', shortName: 'Gujarat Board', badgeColor: '#15803d' },
  { code: 'KL', shortName: 'Kerala Board', badgeColor: '#0369a1' },
  { code: 'AP', shortName: 'AP Board', badgeColor: '#854d0e' },
  { code: 'TS', shortName: 'Telangana Board', badgeColor: '#6b21a8' },
  { code: 'PB', shortName: 'Punjab Board', badgeColor: '#991b1b' }
];

// PDF.js State Management
let pdfDoc = null;
let pdfPageNum = 1;
let pdfPageRendering = false;
let pdfPageNumPending = null;
let pdfScale = 1.2;
let currentPdfProxyUrl = '';
let currentPdfDownloadUrl = '';
let currentPdfTitle = '';

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  renderBoardBadges();
  fetchBoards();
  await loadBooks();
  loadSavedNotes();
});

// Switch Tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`${tabName}-tab`).classList.add('active');
  event.currentTarget.classList.add('active');

  if (tabName === 'notebooks') {
    loadNotebookNotes();
  } else if (tabName === 'my-notes') {
    loadSavedNotes();
  }
}

// Fetch Board list from API
async function fetchBoards() {
  try {
    const res = await fetch('/api/v1/boards');
    const data = await res.json();
    if (data.success) {
      boardsList = data.boards;
      renderBoardBadges();
    }
  } catch (err) {
    console.error('Error fetching boards:', err);
  }
}

// Render Board Badges
function renderBoardBadges() {
  const container = document.getElementById('board-badges-container');
  if (!container) return;

  container.innerHTML = boardsList.map(b => `
    <button class="board-badge ${b.code === currentBoard ? 'active' : ''}" 
            style="${b.code === currentBoard ? `background-color: ${b.badgeColor}; border-color: ${b.badgeColor}; color: #fff;` : ''}"
            onclick="selectBoard('${b.code}', '${b.badgeColor}')">
      ${b.shortName}
    </button>
  `).join('');
}

// Select Board
function selectBoard(code, color) {
  currentBoard = code;
  renderBoardBadges();
  loadBooks();
}

// Select Class
function selectClass(className) {
  currentClass = className;
  document.querySelectorAll('.class-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.class === className);
  });
  loadBooks();
}

// Apply Filters
function applyFilters() {
  currentSubject = document.getElementById('subject-filter').value;
  currentMedium = document.getElementById('medium-filter').value;
  currentSearch = document.getElementById('search-input').value.trim();
  loadBooks();
}

function handleSearchKey(event) {
  if (event.key === 'Enter') {
    applyFilters();
  }
}

// Load Books from Backend API
async function loadBooks() {
  const grid = document.getElementById('books-grid');
  const countEl = document.getElementById('results-count');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Loading textbooks & digital notes...</div>';

  try {
    const params = new URLSearchParams({
      board: currentBoard,
      class: currentClass,
      limit: 24
    });

    if (currentSubject) params.append('subject', currentSubject);
    if (currentMedium) params.append('medium', currentMedium);
    if (currentSearch) params.append('query', currentSearch);

    const res = await fetch(`/api/v1/books?${params.toString()}`);
    const data = await res.json();

    if (data.success && data.books && data.books.length > 0) {
      countEl.innerHTML = `Found <strong>${data.total}</strong> digital textbooks & learning materials for <strong>${currentBoard}</strong> (${currentClass})`;
      renderBooks(data.books);
    } else {
      countEl.innerHTML = `No books found for ${currentBoard} (${currentClass}).`;
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <i class="fa-solid fa-folder-open fa-3x" style="color: #cbd5e1;"></i>
          <h3 style="margin-top: 1rem; color: #334155;">No matching textbooks found</h3>
          <p style="color: #64748b;">Try clearing subject/medium filters or search for another keyword.</p>
        </div>
      `;
    }
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; color: #ef4444; padding: 2rem;">Error loading books: ${err.message}</div>`;
  }
}

// Render Books Grid
function renderBooks(books) {
  const grid = document.getElementById('books-grid');
  grid.innerHTML = books.map(book => {
    const proxyPdfUrl = book.proxyPdfUrl;
    const downloadUrl = book.downloadUrl;
    const hasCover = !!book.posterImage;

    const coverStyle = hasCover
      ? `background-image: url('${book.posterImage}');`
      : `background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);`;

    return `
      <div class="book-card">
        <div class="book-cover-area" style="${coverStyle}">
          ${hasCover ? '<div class="book-cover-overlay">' : ''}
            <span class="book-board-tag">${book.board || currentBoard}</span>
            <div class="book-cover-title">${escapeHtml(book.title)}</div>
          ${hasCover ? '</div>' : ''}
        </div>
        <div class="book-card-body">
          <div class="book-meta-tags">
            <span class="tag">${book.gradeLevel.join(', ') || currentClass}</span>
            <span class="tag">${book.subject.join(', ') || 'General'}</span>
            <span class="tag" style="background: #fef3c7; color: #d97706;">${book.medium.join(', ') || 'English'}</span>
          </div>
          <div class="book-desc">${escapeHtml(book.description)}</div>
          <div class="book-actions">
            <button class="btn-card primary" onclick="openBookModal('${book.dikshaId}')">
              <i class="fa-solid fa-book-open"></i> Open Book
            </button>
            <a href="${downloadUrl || '#'}" ${downloadUrl ? 'download target="_blank"' : 'onclick="alert(\'Download PDF is not available for this textbook.\'); return false;"'} class="btn-card download">
              <i class="fa-solid fa-download"></i> Download PDF
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let currentBookId = null;
let currentChapterId = null;
let currentBookChapters = [];

// Open Internal PDF.js Book Reader Modal
async function openBookModal(dikshaId, initialTitle = 'Loading Book...') {
  const modal = document.getElementById('pdf-modal');
  const modalTitle = document.getElementById('pdf-modal-title');
  const downloadBtn = document.getElementById('pdf-download-btn');
  const sidebarList = document.getElementById('sidebar-chapter-list');
  const chapterCount = document.getElementById('sidebar-chapter-count');
  const spinner = document.getElementById('pdf-loading-spinner');
  const errorBox = document.getElementById('pdf-error-container');
  const canvasWrapper = document.getElementById('pdf-canvas-wrapper');

  // STEP 18: RESET ALL PDF & BOOK STATE BEFORE LOADING NEW BOOK
  if (pdfDoc) {
    try { pdfDoc.destroy(); } catch(e) {}
  }
  pdfDoc = null;
  currentBookId = dikshaId;
  currentChapterId = null;
  currentBookChapters = [];
  currentPdfProxyUrl = '';
  currentPdfDownloadUrl = '';
  currentPdfTitle = initialTitle;
  pdfPageNum = 1;
  pdfPageRendering = false;
  pdfPageNumPending = null;

  // Clear canvas
  const canvas = document.getElementById('pdf-render-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  spinner.style.display = 'flex';
  errorBox.style.display = 'none';
  canvasWrapper.style.display = 'none';

  document.getElementById('pdf-page-count').textContent = '...';
  document.getElementById('pdf-page-num').value = 1;
  modalTitle.innerHTML = `<i class="fa-solid fa-book-open"></i> ${escapeHtml(initialTitle)}`;
  downloadBtn.href = '#';

  sidebarList.innerHTML = '<div class="sidebar-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading chapters...</div>';
  chapterCount.textContent = 'Loading...';
  modal.classList.add('active');

  // Fetch Table of Contents (TOC) & Real Chapter Objects for Left Sidebar
  try {
    const res = await fetch(`/api/v1/books/${dikshaId}`);
    const data = await res.json();

    if (data && data.book) {
      const book = data.book;
      currentBookChapters = book.chapters || [];
      currentPdfTitle = book.title || initialTitle;
      currentPdfDownloadUrl = book.downloadUrl || '';

      modalTitle.innerHTML = `<i class="fa-solid fa-book-open"></i> ${escapeHtml(book.title)}`;
      if (downloadBtn && currentPdfDownloadUrl) downloadBtn.href = currentPdfDownloadUrl;
      const errDownloadBtn = document.getElementById('pdf-error-download-btn');
      if (errDownloadBtn && currentPdfDownloadUrl) errDownloadBtn.href = currentPdfDownloadUrl;

      // Render Table of Contents
      if (currentBookChapters.length > 0) {
        chapterCount.textContent = `${currentBookChapters.length} Chapters`;
        sidebarList.innerHTML = currentBookChapters.map((ch, idx) => {
          const levelIndent = (ch.level && ch.level > 1) ? `padding-left: ${Math.min((ch.level - 1) * 12 + 12, 48)}px; font-size: 0.85rem;` : '';
          const levelBadge = (ch.level && ch.level > 1) ? `<span style="font-size:0.68rem; padding: 1px 4px; background:#e0f2fe; color:#0284c7; border-radius:3px; margin-right:4px; font-weight:600;">L${ch.level}</span>` : '';

          return `
            <div class="chapter-item ${idx === 0 ? 'active' : ''}" data-chapter-id="${ch.identifier}" style="${levelIndent}" onclick="handleChapterClick('${ch.identifier}')">
              <div class="chapter-item-title">${levelBadge}${escapeHtml(ch.title)}</div>
              <div class="chapter-item-meta">
                <span>Ch ${ch.chapterNumber}</span>
                <span style="color:#3b82f6;">Read &rarr;</span>
              </div>
            </div>
          `;
        }).join('');
      } else {
        chapterCount.textContent = 'No TOC';
        sidebarList.innerHTML = `
          <div style="padding: 1.5rem 1rem; text-align: center; color: #64748b; font-size: 0.85rem;">
            <i class="fa-solid fa-circle-info fa-2x" style="color:#94a3b8; margin-bottom: 0.5rem;"></i><br>
            The textbook is available, but its table of contents is unavailable.
          </div>
        `;
      }

      // Resolve PDF resource strictly for THIS book instance (prefer complete textbook PDF over single chapter PDF)
      const firstChWithPdf = currentBookChapters.find(c => c.proxyPdfUrl && c.proxyPdfUrl !== 'null');
      const activeProxyUrl = (book.proxyPdfUrl && book.proxyPdfUrl !== 'null' && book.proxyPdfUrl !== 'undefined')
        ? book.proxyPdfUrl
        : (firstChWithPdf && firstChWithPdf.proxyPdfUrl !== 'null' ? firstChWithPdf.proxyPdfUrl : null);

      if ((book.pdfValid || activeProxyUrl) && activeProxyUrl && activeProxyUrl !== 'null' && activeProxyUrl !== 'undefined') {
        currentPdfProxyUrl = activeProxyUrl;
        const initialStartPage = (firstChWithPdf && (firstChWithPdf.pdfStartPage || firstChWithPdf.startPage)) || 1;
        loadPdfDocument(activeProxyUrl, initialStartPage);
      } else {
        // BOOK RESOURCE UNUSABLE: Display specific error message according to backend reason
        spinner.style.display = 'none';
        canvasWrapper.style.display = 'none';
        errorBox.style.display = 'flex';

        let errHeading = 'Textbook Resource Unavailable';
        let errDesc = data.message || 'Reading resource is not available for this textbook.';

        if (data.reason === 'IDENTITY_MISMATCH_ONLY') {
          errHeading = 'Subject or Grade Level Mismatch';
          errDesc = 'The verified reading resources belong to a different subject or grade level than the requested textbook.';
        } else if (data.reason === 'RESOURCE_VALIDATION_FAILED') {
          errHeading = 'Resource Verification Failed';
          errDesc = 'We could not verify the binary integrity of the textbook resource on DIKSHA.';
        } else if (data.reason === 'RESOURCE_NOT_FOUND' || data.reason === 'GENUINELY_ABSENT_ON_DIKSHA') {
          errHeading = 'Textbook Content Not Found';
          errDesc = 'This textbook resource is not currently available on the DIKSHA Sunbird portal repository.';
        }

        errorBox.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation fa-3x" style="color: #f59e0b;"></i>
          <h4 style="margin-top: 1rem; font-weight: 800; color: #0f172a; font-size: 1.1rem;">${escapeHtml(errHeading)}</h4>
          <p style="color: #64748b; font-size: 0.9rem; margin: 0.5rem 0 1.25rem 0; max-width: 480px; line-height: 1.5;">
            ${escapeHtml(errDesc)}
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
            <button onclick="closePdfModal()" class="btn-primary"><i class="fa-solid fa-arrow-left"></i> Back to Textbooks</button>
            <button onclick="reportMissingContent('${escapeHtml(dikshaId)}')" class="btn-primary" style="background: #e2e8f0; color: #334155; border: 1px solid #cbd5e1;">
              <i class="fa-solid fa-flag"></i> Report Missing Content
            </button>
          </div>
        `;
      }
    } else {
      spinner.style.display = 'none';
      canvasWrapper.style.display = 'none';
      errorBox.style.display = 'flex';
      errorBox.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation fa-3x" style="color: #f59e0b;"></i>
        <h4 style="margin-top: 1rem; font-weight: 800; color: #0f172a; font-size: 1.1rem;">Reading Resource Unavailable</h4>
        <p style="color: #64748b; font-size: 0.9rem; margin: 0.5rem 0 1.25rem 0; max-width: 480px; line-height: 1.5;">
          ${escapeHtml(data.message || 'Reading resource is not available for this textbook.')}
        </p>
        <div style="display: flex; gap: 10px;">
          <button onclick="closePdfModal()" class="btn-primary"><i class="fa-solid fa-arrow-left"></i> Back to Textbooks</button>
        </div>
      `;
    }
  } catch (err) {
    spinner.style.display = 'none';
    canvasWrapper.style.display = 'none';
    errorBox.style.display = 'flex';
    errorBox.innerHTML = `
      <i class="fa-solid fa-circle-exclamation fa-3x" style="color: #ef4444;"></i>
      <h4 style="margin-top: 1rem; font-weight: 800; color: #0f172a; font-size: 1.1rem;">Error Loading Textbook</h4>
      <p style="color: #64748b; font-size: 0.9rem; margin: 0.5rem 0 1.25rem 0; max-width: 480px; line-height: 1.5;">
        ${escapeHtml(err.message)}
      </p>
      <div style="display: flex; gap: 10px;">
        <button onclick="closePdfModal()" class="btn-primary"><i class="fa-solid fa-arrow-left"></i> Back to Textbooks</button>
      </div>
    `;
  }
}

// PDF.js Document Loader Engine
function loadPdfDocument(proxyUrl, initialPage = 1) {
  const spinner = document.getElementById('pdf-loading-spinner');
  const errorBox = document.getElementById('pdf-error-container');
  const canvasWrapper = document.getElementById('pdf-canvas-wrapper');

  if (!proxyUrl || proxyUrl === 'null' || proxyUrl === 'undefined') {
    spinner.style.display = 'none';
    canvasWrapper.style.display = 'none';
    errorBox.style.display = 'flex';
    return;
  }

  spinner.style.display = 'flex';
  errorBox.style.display = 'none';
  canvasWrapper.style.display = 'none';

  pdfjsLib.getDocument({
    url: proxyUrl,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true
  }).promise.then(async pdf => {
    pdfDoc = pdf;
    let startPg = parseInt(initialPage, 10) || 1;
    if (startPg > pdfDoc.numPages) startPg = pdfDoc.numPages;
    if (startPg < 1) startPg = 1;

    pdfPageNum = startPg;
    document.getElementById('pdf-page-count').textContent = pdfDoc.numPages;
    document.getElementById('pdf-page-num').value = startPg;
    document.getElementById('pdf-page-num').max = pdfDoc.numPages;

    spinner.style.display = 'none';
    canvasWrapper.style.display = 'block';

    renderPdfPage(pdfPageNum);

    // DUAL TOC FALLBACK: If official DIKSHA TOC is unavailable, extract embedded PDF outline or printed TOC
    if (!currentBookChapters || currentBookChapters.length === 0) {
      try {
        const extractedChapters = await extractPdfTocOutline(pdfDoc);
        if (extractedChapters && extractedChapters.length > 0) {
          currentBookChapters = extractedChapters;
          const sidebarList = document.getElementById('sidebar-chapter-list');
          const chapterCount = document.getElementById('sidebar-chapter-count');

          if (chapterCount) chapterCount.textContent = `${extractedChapters.length} Chapters`;
          if (sidebarList) {
            sidebarList.innerHTML = extractedChapters.map((ch, idx) => {
              const levelIndent = (ch.level && ch.level > 1) ? `padding-left: ${Math.min((ch.level - 1) * 12 + 12, 48)}px; font-size: 0.85rem;` : '';
              const levelBadge = (ch.level && ch.level > 1) ? `<span style="font-size:0.68rem; padding: 1px 4px; background:#e0f2fe; color:#0284c7; border-radius:3px; margin-right:4px; font-weight:600;">L${ch.level}</span>` : '';

              return `
                <div class="chapter-item ${idx === 0 ? 'active' : ''}" data-chapter-id="${ch.identifier}" style="${levelIndent}" onclick="handleChapterClick('${ch.identifier}')">
                  <div class="chapter-item-title">${levelBadge}${escapeHtml(ch.title)}</div>
                  <div class="chapter-item-meta">
                    <span>Ch ${ch.chapterNumber}</span>
                    <span style="color:#3b82f6;">Read &rarr;</span>
                  </div>
                </div>
              `;
            }).join('');
          }
        }
      } catch (e) {
        console.warn('PDF TOC Extraction error:', e);
      }
    }
  }).catch(err => {
    console.error('Error rendering PDF:', err);
    spinner.style.display = 'none';
    canvasWrapper.style.display = 'none';
    errorBox.style.display = 'flex';
  });
}

// PDF TOC Extraction Helpers
async function resolveOutlineItemPage(pdf, item) {
  if (!item || !item.dest) return null;
  try {
    let dest = item.dest;
    if (typeof dest === 'string') {
      dest = await pdf.getDestination(dest);
    }
    if (Array.isArray(dest) && dest.length > 0) {
      const pageRef = dest[0];
      if (typeof pageRef === 'object' && pageRef !== null) {
        const pageIndex = await pdf.getPageIndex(pageRef);
        return pageIndex + 1;
      } else if (typeof pageRef === 'number') {
        return pageRef + 1;
      }
    }
  } catch (e) {}
  return null;
}

async function scanPagesForPrintedToc(pdf) {
  const chapters = [];
  const maxPagesToScan = Math.min(pdf.numPages, 25);
  let inTocSection = false;
  let chNum = 1;

  const tocHeaders = [
    'CONTENTS', 'TABLE OF CONTENTS', 'INDEX', 'CHAPTERS',
    'विषय-सूची', 'विषय सूची', 'अनुक्रमणिका',
    'વિષય સૂચિ', 'અનુક્રમણિકા', 'અનુક્રમ',
    'সূচিপত্র', 'பொருளடக்கம்', 'విషయసూచిక', 'విషయ సూచిక',
    'ವಿಷಯಸೂಚಿ', 'ഉള്ളടക്കം', 'ਵਿਸ਼ਾ-ਸੂਚੀ', 'فہرست'
  ];

  for (let p = 1; p <= maxPagesToScan; p++) {
    try {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const lines = textContent.items.map(i => i.str.trim()).filter(Boolean);
      const pageText = lines.join(' ');
      const upperText = pageText.toUpperCase();

      if (!inTocSection) {
        if (tocHeaders.some(h => pageText.includes(h) || upperText.includes(h))) {
          inTocSection = true;
        }
      }

      if (inTocSection) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          const match = line.match(/^(?:Unit|Chapter|\d+[\.\s\:\-])\s*(\d+|[IVXLCDM]+)?[\.\s\:\-]?\s*([A-Za-z0-9\s\,\-\'\(\)\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F]+)/i);

          if (match) {
            const rawTitle = line.trim();

            if (rawTitle.length > 3 && !rawTitle.toUpperCase().includes('CONTENTS') && !rawTitle.toUpperCase().includes('PAGE NO') && !rawTitle.toUpperCase().includes('SYLLABUS')) {
              let startPg = null;
              const pageMatch = rawTitle.match(/(\d+)\s*[\-\–\—]\s*(\d+)|(\d+)$/);
              if (pageMatch) {
                startPg = parseInt(pageMatch[1] || pageMatch[3], 10);
              }

              const exists = chapters.some(c => c.title.toLowerCase() === rawTitle.toLowerCase());
              if (!exists) {
                chapters.push({
                  chapterNumber: chNum++,
                  identifier: `printed_toc_${chNum}`,
                  title: rawTitle,
                  level: 1,
                  startPage: startPg || p,
                  endPage: null,
                  pdfUrl: currentPdfProxyUrl,
                  proxyPdfUrl: currentPdfProxyUrl
                });
              }
            }
          }
        }
      }
      if (chapters.length >= 20) break;
    } catch (err) {}
  }

  return chapters;
}

async function extractPdfTocOutline(pdf) {
  let extracted = [];

  // 1. Try PDF embedded outline bookmarks
  try {
    const outline = await pdf.getOutline();
    if (outline && Array.isArray(outline) && outline.length > 0) {
      let chIdx = 1;
      for (const item of outline) {
        if (!item || !item.title) continue;
        const pageNum = await resolveOutlineItemPage(pdf, item);
        extracted.push({
          chapterNumber: chIdx++,
          identifier: `pdf_outline_${chIdx}`,
          title: item.title.trim(),
          level: 1,
          startPage: pageNum || 1,
          endPage: null,
          pdfUrl: currentPdfProxyUrl,
          proxyPdfUrl: currentPdfProxyUrl
        });

        if (item.items && Array.isArray(item.items)) {
          for (const subItem of item.items) {
            if (!subItem || !subItem.title) continue;
            const subPage = await resolveOutlineItemPage(pdf, subItem);
            extracted.push({
              chapterNumber: chIdx++,
              identifier: `pdf_outline_${chIdx}`,
              title: subItem.title.trim(),
              level: 2,
              startPage: subPage || pageNum || 1,
              endPage: null,
              pdfUrl: currentPdfProxyUrl,
              proxyPdfUrl: currentPdfProxyUrl
            });
          }
        }
      }
    }
  } catch (err) {}

  // 2. Fallback: Scan printed TOC on pages 1-15
  if (extracted.length === 0) {
    try {
      const scanned = await scanPagesForPrintedToc(pdf);
      if (scanned.length > 0) {
        extracted = scanned;
      }
    } catch (err) {}
  }

  return extracted;
}

// PDF Page Renderer on HTML5 Canvas
function renderPdfPage(num) {
  if (!pdfDoc) return;
  pdfPageRendering = true;

  pdfDoc.getPage(num).then(page => {
    const canvas = document.getElementById('pdf-render-canvas');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: pdfScale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);

    renderTask.promise.then(() => {
      pdfPageRendering = false;
      if (pdfPageNumPending !== null) {
        renderPdfPage(pdfPageNumPending);
        pdfPageNumPending = null;
      }
    });
  });

  document.getElementById('pdf-page-num').value = num;
}

function queueRenderPage(num) {
  if (pdfPageRendering) {
    pdfPageNumPending = num;
  } else {
    renderPdfPage(num);
  }
}

// Page Navigation Controls
function prevPdfPage() {
  if (!pdfDoc || pdfPageNum <= 1) return;
  pdfPageNum--;
  queueRenderPage(pdfPageNum);
}

function nextPdfPage() {
  if (!pdfDoc || pdfPageNum >= pdfDoc.numPages) return;
  pdfPageNum++;
  queueRenderPage(pdfPageNum);
}

function jumpToPdfPage(val) {
  if (!pdfDoc) return;
  let page = parseInt(val, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (page > pdfDoc.numPages) page = pdfDoc.numPages;
  pdfPageNum = page;
  queueRenderPage(pdfPageNum);
}

// Zoom Controls
function zoomPdfIn() {
  if (!pdfDoc) return;
  pdfScale += 0.2;
  document.getElementById('pdf-zoom-val').textContent = `${Math.round(pdfScale * 100)}%`;
  renderPdfPage(pdfPageNum);
}

function zoomPdfOut() {
  if (!pdfDoc || pdfScale <= 0.4) return;
  pdfScale -= 0.2;
  document.getElementById('pdf-zoom-val').textContent = `${Math.round(pdfScale * 100)}%`;
  renderPdfPage(pdfPageNum);
}

function fitPdfWidth() {
  if (!pdfDoc) return;
  const wrapper = document.getElementById('pdf-canvas-wrapper');
  pdfScale = (wrapper.clientWidth - 40) / 600;
  document.getElementById('pdf-zoom-val').textContent = `Fit Width`;
  renderPdfPage(pdfPageNum);
}

function togglePdfFullscreen() {
  const modalContent = document.getElementById('reader-modal-content');
  if (!document.fullscreenElement) {
    modalContent.requestFullscreen().catch(err => console.error(err));
  } else {
    document.exitFullscreen();
  }
}

function retryPdfLoad() {
  loadPdfDocument(currentPdfProxyUrl);
}

// Step 12 & Step 22: Book-specific Chapter Click Handler
function handleChapterClick(chapterId) {
  const chapter = currentBookChapters.find(c => c.identifier === chapterId);
  if (!chapter) return;

  document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.chapter-item[data-chapter-id="${chapterId}"]`);
  if (activeEl) {
    activeEl.classList.add('active');
  }

  currentChapterId = chapterId;
  const targetPage = parseInt(chapter.pdfStartPage || chapter.startPage, 10) || 1;
  const proxyUrl = chapter.proxyPdfUrl;

  // CASE A: If chapter has its own distinct PDF proxy URL, load that chapter PDF
  if (proxyUrl && proxyUrl !== currentPdfProxyUrl && proxyUrl !== 'null') {
    currentPdfProxyUrl = proxyUrl;
    loadPdfDocument(proxyUrl, targetPage);
  } else if (pdfDoc) {
    // CASE B: If entire textbook is in single loaded PDF, jump to startPage
    jumpToPdfPage(targetPage);
  } else if (proxyUrl && proxyUrl !== 'null') {
    loadPdfDocument(proxyUrl, targetPage);
  }
}

// Select a specific chapter in sidebar (backward compatibility)
function selectSidebarChapter(identifier, title, encodedProxyUrl, element, startPage) {
  handleChapterClick(identifier);
}

function closePdfModal() {
  const modal = document.getElementById('pdf-modal');
  pdfDoc = null;
  currentBookId = null;
  currentChapterId = null;
  currentBookChapters = [];
  currentPdfProxyUrl = '';
  modal.classList.remove('active');
}

// Open Notebook Drawer for book
function openNotebookForBook(subject, gradeLevel) {
  document.getElementById('nb-grade').value = gradeLevel.startsWith('Class') ? gradeLevel : `Class ${gradeLevel}`;
  document.getElementById('nb-subject').value = subject || 'Mathematics';
  switchTab('notebooks');
}

// Load Notebook Study Pack Notes
async function loadNotebookNotes() {
  const grade = document.getElementById('nb-grade').value;
  const subject = document.getElementById('nb-subject').value;
  const chapter = document.getElementById('nb-chapter').value;
  const container = document.getElementById('notebook-view-container');

  container.innerHTML = '<div style="text-align:center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br>Generating study notebook notes...</div>';

  try {
    const res = await fetch(`/api/v1/notebooks/chapter?subject=${encodeURIComponent(subject)}&gradeLevel=${encodeURIComponent(grade)}&chapterNumber=${chapter}`);
    const data = await res.json();

    if (data.success && data.chapter) {
      const ch = data.chapter;
      container.innerHTML = `
        <div class="notebook-card">
          <div class="nb-header">
            <span class="nb-subtitle">${data.gradeLevel} &bull; ${data.subject} &bull; Chapter ${ch.chapterNumber}</span>
            <h2 class="nb-title">${ch.title}</h2>
          </div>

          <div class="nb-section-title"><i class="fa-solid fa-align-left" style="color: var(--primary);"></i> Chapter Summary & Overview</div>
          <p style="color: #475569; font-size: 1rem; line-height: 1.6; background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary);">${ch.summary}</p>

          <div class="nb-section-title"><i class="fa-solid fa-square-root-variable" style="color: #059669;"></i> Key Formulas & Equations</div>
          <div>
            ${ch.keyFormulas.map(f => `<div class="formula-pill">${f}</div>`).join('')}
          </div>

          ${ch.keyConcepts ? `
            <div class="nb-section-title"><i class="fa-solid fa-lightbulb" style="color: #d97706;"></i> Important Concepts</div>
            <ul style="padding-left: 1.25rem; color: #334155; line-height: 1.8;">
              ${ch.keyConcepts.map(c => `<li>${c}</li>`).join('')}
            </ul>
          ` : ''}

          <div class="nb-section-title"><i class="fa-solid fa-circle-question" style="color: #7c3aed;"></i> Exam Q&A Revision Points</div>
          <div>
            ${ch.qaNotes.map(qa => `
              <div class="qa-card">
                <div class="qa-question">Q: ${qa.question}</div>
                <div class="qa-answer"><strong>Ans:</strong> ${qa.answer}</div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 2rem; display: flex; gap: 1rem;">
            <button class="btn-success" onclick="openSaveNoteModal('${ch.title}', '${data.subject}')">
              <i class="fa-solid fa-bookmark"></i> Save to My Notes
            </button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div style="color:red;">Error loading notebook: ${err.message}</div>`;
  }
}

// User Personal Notes Management
async function loadSavedNotes() {
  const container = document.getElementById('user-notes-list');
  try {
    const res = await fetch('/api/v1/notes');
    const data = await res.json();

    if (data.success && data.notes.length > 0) {
      container.innerHTML = data.notes.map(n => `
        <div class="book-card" style="padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <h3 style="font-size: 1.1rem; color: #0f172a;">${escapeHtml(n.title)}</h3>
            <button onclick="deleteNote('${n.id}')" style="border:none; background:transparent; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">${n.board} &bull; ${n.gradeLevel} &bull; ${new Date(n.createdAt).toLocaleDateString()}</div>
          <p style="color: #334155; font-size: 0.9rem; white-space: pre-wrap;">${escapeHtml(n.content)}</p>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">No saved personal notes yet. Click "Create New Note" to add one!</div>';
    }
  } catch (err) {
    console.error('Error loading user notes:', err);
  }
}

function openCreateNoteModal() {
  document.getElementById('note-title').value = '';
  document.getElementById('note-content').value = '';
  document.getElementById('note-modal').classList.add('active');
}

function openSaveNoteModal(title, subject) {
  document.getElementById('note-title').value = `Notes for ${title}`;
  document.getElementById('note-content').value = `Revision notes for ${subject}...`;
  document.getElementById('note-modal').classList.add('active');
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.remove('active');
}

async function handleSaveNote(event) {
  event.preventDefault();
  const title = document.getElementById('note-title').value;
  const board = document.getElementById('note-board').value;
  const gradeLevel = document.getElementById('note-class').value;
  const content = document.getElementById('note-content').value;

  try {
    const res = await fetch('/api/v1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, board, gradeLevel, content })
    });
    const data = await res.json();
    if (data.success) {
      closeNoteModal();
      switchTab('my-notes');
    }
  } catch (err) {
    alert('Error saving note: ' + err.message);
  }
}

async function deleteNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  try {
    await fetch(`/api/v1/notes/${id}`, { method: 'DELETE' });
    loadSavedNotes();
  } catch (err) {
    console.error('Error deleting note:', err);
  }
}

// API Explorer Config
const ENDPOINTS = {
  'boards': { method: 'GET', url: '/api/v1/boards', desc: 'Fetch list of all supported Indian State & Central Boards' },
  'board-detail': { method: 'GET', url: '/api/v1/boards/UP', desc: 'Get specific board metadata (e.g., UP Board)' },
  'books': { method: 'GET', url: '/api/v1/books?board=CBSE&class=Class%2010', desc: 'Search DIKSHA portal textbooks by board, class, medium, subject' },
  'book-detail': { method: 'GET', url: '/api/v1/books/do_31310347524809523211409', desc: 'Get book details, chapter TOC & PDF links by DIKSHA ID' },
  'notebook-chapter': { method: 'GET', url: '/api/v1/notebooks/chapter?subject=Mathematics&gradeLevel=Class%2010&chapterNumber=1', desc: 'Get chapter revision study pack (formulas, concepts, flashcards, Q&A)' },
  'get-notes': { method: 'GET', url: '/api/v1/notes', desc: 'Fetch all user saved notes & bookmarks' },
  'post-note': { method: 'POST', url: '/api/v1/notes', desc: 'Save a new user study note', body: { title: 'Chapter 1 Revision', board: 'CBSE', gradeLevel: 'Class 10', content: 'Key formula: HCF * LCM = a * b' } },
  'pdf-proxy': { method: 'GET', url: '/api/v1/pdf/proxy?url=https%3A%2F%2Fobj.diksha.gov.in%2Fntp-content-production%2Fcontent%2Fassets%2Fdo_31308227401590374419928%2Fcontent-outline-m1.1.pdf', desc: 'Stream PDF binary headers directly to bypass CORS in web viewers' }
};

let selectedEpKey = 'books';

function selectEndpoint(key) {
  selectedEpKey = key;
  const ep = ENDPOINTS[key];
  document.querySelectorAll('.api-endpoint-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const methodEl = document.getElementById('tester-method');
  methodEl.textContent = ep.method;
  methodEl.className = `method-badge ${ep.method.toLowerCase()}`;

  document.getElementById('tester-url').value = ep.url;
  document.getElementById('tester-desc').textContent = ep.desc;

  const fullUrl = window.location.origin + ep.url;
  let curlText = `curl -X ${ep.method} "${fullUrl}"`;
  if (ep.body) {
    curlText += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.body)}'`;
  }
  document.getElementById('tester-curl').textContent = curlText;
  document.getElementById('tester-response').textContent = 'Click "Send Request" to test endpoint...';
}

async function executeApiCall() {
  const ep = ENDPOINTS[selectedEpKey];
  const url = document.getElementById('tester-url').value;
  const responseBox = document.getElementById('tester-response');

  responseBox.textContent = 'Executing request...';

  try {
    const opts = { method: ep.method };
    if (ep.body && ep.method === 'POST') {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(ep.body);
    }

    const res = await fetch(url, opts);
    let data;
    const contentType = res.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
      responseBox.textContent = JSON.stringify(data, null, 2);
    } else {
      responseBox.textContent = `HTTP ${res.status} ${res.statusText}\nContent-Type: ${contentType}\nBinary stream payload...`;
    }
  } catch (err) {
    responseBox.textContent = `Error executing API request: ${err.message}`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function reportMissingContent(bookId) {
  const idToLog = bookId || currentBookId || 'unknown';
  alert(`Thank you! Missing content report for Book ID '${idToLog}' (${currentBoard} ${currentClass}) has been submitted for triage.`);
}
