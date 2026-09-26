// Configure PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let currentBoard = 'CBSE';
let currentClass = 'Class 10';
let currentSubject = '';
let currentMedium = '';
let currentSearch = '';
let boardsList = [];

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
  await fetchBoards();
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
            <button class="btn-card primary" onclick="openBookModal('${escapeHtml(book.title)}', '${book.dikshaId}', '${encodeURIComponent(proxyPdfUrl)}', '${encodeURIComponent(downloadUrl)}')">
              <i class="fa-solid fa-book-open"></i> Open Book
            </button>
            <a href="${downloadUrl}" download target="_blank" class="btn-card download">
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
async function openBookModal(title, dikshaId, encodedProxyPdfUrl, encodedDownloadUrl) {
  const modal = document.getElementById('pdf-modal');
  const modalTitle = document.getElementById('pdf-modal-title');
  const downloadBtn = document.getElementById('pdf-download-btn');
  const sidebarList = document.getElementById('sidebar-chapter-list');
  const chapterCount = document.getElementById('sidebar-chapter-count');
  const spinner = document.getElementById('pdf-loading-spinner');
  const errorBox = document.getElementById('pdf-error-container');
  const canvasWrapper = document.getElementById('pdf-canvas-wrapper');

  // STEP 5: RESET ALL PDF & BOOK STATE BEFORE LOADING NEW BOOK
  pdfDoc = null;
  currentBookId = dikshaId;
  currentChapterId = null;
  currentBookChapters = [];
  currentPdfProxyUrl = '';
  currentPdfDownloadUrl = decodeURIComponent(encodedDownloadUrl);
  currentPdfTitle = title;
  pdfPageNum = 1;

  spinner.style.display = 'flex';
  errorBox.style.display = 'none';
  canvasWrapper.style.display = 'none';

  document.getElementById('pdf-page-count').textContent = '...';
  document.getElementById('pdf-page-num').value = 1;
  modalTitle.innerHTML = `<i class="fa-solid fa-book-open"></i> ${escapeHtml(title)}`;
  downloadBtn.href = currentPdfDownloadUrl;
  document.getElementById('pdf-error-download-btn').href = currentPdfDownloadUrl;

  sidebarList.innerHTML = '<div class="sidebar-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading chapters...</div>';
  chapterCount.textContent = 'Loading...';
  modal.classList.add('active');

  // Fetch Table of Contents (TOC) & Real Chapter Objects for Left Sidebar
  try {
    const res = await fetch(`/api/v1/books/${dikshaId}`);
    const data = await res.json();

    if (data.success && data.book) {
      const book = data.book;
      currentBookChapters = book.chapters || [];

      // Render Table of Contents
      if (currentBookChapters.length > 0) {
        chapterCount.textContent = `${currentBookChapters.length} Chapters`;
        sidebarList.innerHTML = currentBookChapters.map((ch, idx) => `
          <div class="chapter-item ${idx === 0 ? 'active' : ''}" data-chapter-id="${ch.identifier}" onclick="handleChapterClick('${ch.identifier}')">
            <div class="chapter-item-title">${escapeHtml(ch.title)}</div>
            <div class="chapter-item-meta">
              <span>Chapter ${ch.chapterNumber}</span>
              <span style="color:#3b82f6;">Read &rarr;</span>
            </div>
          </div>
        `).join('');
      } else {
        chapterCount.textContent = 'No TOC';
        sidebarList.innerHTML = `
          <div style="padding: 1.5rem 1rem; text-align: center; color: #64748b; font-size: 0.85rem;">
            <i class="fa-solid fa-circle-info fa-2x" style="color:#94a3b8; margin-bottom: 0.5rem;"></i><br>
            Table of Contents unavailable for this book
          </div>
        `;
      }

      // STEP 15 & 29: Resolve PDF resource strictly for THIS book instance
      const firstChWithPdf = currentBookChapters.find(c => c.proxyPdfUrl && c.proxyPdfUrl !== 'null');
      const activeProxyUrl = (firstChWithPdf && firstChWithPdf.proxyPdfUrl) || (book.proxyPdfUrl !== 'null' ? book.proxyPdfUrl : null);

      if (activeProxyUrl && activeProxyUrl !== 'null' && activeProxyUrl !== 'undefined') {
        currentPdfProxyUrl = activeProxyUrl;
        loadPdfDocument(activeProxyUrl, (firstChWithPdf && firstChWithPdf.startPage) || 1);
      } else {
        // BOOK RESOURCE MISMATCH / MISSING PDF: Show clear error state
        spinner.style.display = 'none';
        canvasWrapper.style.display = 'none';
        errorBox.style.display = 'flex';
        errorBox.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation fa-3x" style="color: #f59e0b;"></i>
          <h4 style="margin-top: 1rem; font-weight: 800; color: #0f172a; font-size: 1.1rem;">Textbook PDF Resource Unavailable</h4>
          <p style="color: #64748b; font-size: 0.9rem; margin: 0.5rem 0 1.25rem 0; max-width: 480px; line-height: 1.5;">
            The PDF file for "<strong>${escapeHtml(book.title)}</strong>" (${escapeHtml(book.board)}) is currently unavailable on the DIKSHA portal.
          </p>
          <div style="display: flex; gap: 10px;">
            <button onclick="closePdfModal()" class="btn-primary"><i class="fa-solid fa-arrow-left"></i> Back to Textbooks</button>
          </div>
        `;
      }
    }
  } catch (err) {
    spinner.style.display = 'none';
    canvasWrapper.style.display = 'none';
    errorBox.style.display = 'flex';
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
  }).promise.then(pdf => {
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
  }).catch(err => {
    console.error('Error rendering PDF:', err);
    spinner.style.display = 'none';
    canvasWrapper.style.display = 'none';
    errorBox.style.display = 'flex';
  });
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
  const targetPage = parseInt(chapter.startPage, 10) || 1;
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
