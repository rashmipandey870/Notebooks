let currentBoard = 'CBSE';
let currentClass = 'Class 10';
let currentSubject = '';
let currentMedium = '';
let currentSearch = '';
let boardsList = [];

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

// Load Books from Backend / DIKSHA API
async function loadBooks() {
  const grid = document.getElementById('books-grid');
  const countEl = document.getElementById('results-count');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Fetching books from DIKSHA portal...</div>';

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
      countEl.innerHTML = `Found <strong>${data.total}</strong> DIKSHA textbooks & learning materials for <strong>${currentBoard}</strong> (${currentClass})`;
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
    const viewUrl = book.viewUrl || book.dikshaPlayerUrl;
    const downloadUrl = book.downloadUrl || book.dikshaPlayerUrl;
    const dikshaPlayerUrl = book.dikshaPlayerUrl;

    return `
      <div class="book-card">
        <div class="book-cover-area">
          <span class="book-board-tag">${book.board || currentBoard}</span>
          <div class="book-cover-title">${escapeHtml(book.title)}</div>
        </div>
        <div class="book-card-body">
          <div class="book-meta-tags">
            <span class="tag">${book.gradeLevel.join(', ') || currentClass}</span>
            <span class="tag">${book.subject.join(', ') || 'General'}</span>
            <span class="tag" style="background: #fef3c7; color: #d97706;">${book.medium.join(', ') || 'English'}</span>
          </div>
          <div class="book-desc">${escapeHtml(book.description)}</div>
          <div class="book-actions">
            <button class="btn-card primary" onclick="openBookModal('${escapeHtml(book.title)}', '${book.dikshaId}', '${encodeURIComponent(viewUrl)}', '${encodeURIComponent(downloadUrl)}', '${encodeURIComponent(dikshaPlayerUrl)}')">
              <i class="fa-solid fa-book-reader"></i> Open Book
            </button>
            <a href="${downloadUrl}" download target="_blank" class="btn-card download">
              <i class="fa-solid fa-download"></i> Download
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Open Full DIKSHA-Style Book Reader Modal
async function openBookModal(title, dikshaId, viewUrl, downloadUrl, dikshaPlayerUrl) {
  const modal = document.getElementById('pdf-modal');
  const modalTitle = document.getElementById('pdf-modal-title');
  const iframe = document.getElementById('pdf-iframe');
  const downloadBtn = document.getElementById('pdf-download-btn');
  const externalBtn = document.getElementById('pdf-external-btn');
  const sidebarList = document.getElementById('sidebar-chapter-list');
  const chapterCount = document.getElementById('sidebar-chapter-count');

  const decodedViewUrl = decodeURIComponent(viewUrl);
  const decodedDownloadUrl = decodeURIComponent(downloadUrl);
  const decodedPlayerUrl = decodeURIComponent(dikshaPlayerUrl);

  modalTitle.innerHTML = `<i class="fa-solid fa-book-open"></i> ${title}`;
  iframe.src = decodedViewUrl;
  downloadBtn.href = decodedDownloadUrl;
  externalBtn.href = decodedPlayerUrl;

  sidebarList.innerHTML = '<div class="sidebar-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading e-Textbook chapters...</div>';
  chapterCount.textContent = 'Fetching...';
  modal.classList.add('active');

  // Fetch Table of Contents (TOC) for right sidebar
  try {
    const res = await fetch(`/api/v1/books/${dikshaId}`);
    const data = await res.json();

    if (data.success && data.book && data.book.chapters && data.book.chapters.length > 0) {
      const chapters = data.book.chapters;
      chapterCount.textContent = `${chapters.length} Chapters`;

      sidebarList.innerHTML = chapters.map((ch, idx) => `
        <div class="chapter-item ${idx === 0 ? 'active' : ''}" onclick="selectSidebarChapter('${ch.identifier}', '${encodeURIComponent(ch.title)}', this)">
          <div class="chapter-item-title">${idx + 1}. ${escapeHtml(ch.title)}</div>
          <div class="chapter-item-meta">
            <span>${ch.subTopics ? ch.subTopics.length : 0} Sections</span>
            <span style="color:#3b82f6;">Read Chapter &rarr;</span>
          </div>
        </div>
      `).join('');
    } else {
      chapterCount.textContent = 'Digital Textbook';
      sidebarList.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: #64748b; font-size: 0.85rem;">
          <i class="fa-solid fa-circle-check fa-2x" style="color:#10b981; margin-bottom: 0.5rem;"></i><br>
          Full Digital Textbook Package Loaded
        </div>
      `;
    }
  } catch (err) {
    chapterCount.textContent = 'Digital Content';
    sidebarList.innerHTML = '<div style="padding: 1rem; color: #64748b; font-size: 0.8rem;">Chapter index loaded in main viewer.</div>';
  }
}

// Select a specific chapter in sidebar
function selectSidebarChapter(identifier, title, element) {
  document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  const iframe = document.getElementById('pdf-iframe');
  iframe.src = `https://diksha.gov.in/resources/play/content/${identifier}`;
}

function closePdfModal() {
  const modal = document.getElementById('pdf-modal');
  const iframe = document.getElementById('pdf-iframe');
  iframe.src = 'about:blank';
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
