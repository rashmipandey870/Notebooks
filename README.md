# Class 8-12 Notebook & State Board Textbook Provider API

A REST API backend providing Class 8 to Class 12 digital notebooks, NCERT & State Board textbooks, chapter study packs, key formulas, revision notes, and exam practice Q&A powered by direct integration with the **DIKSHA** portal.

---

## Key Features

1. **All Indian State & Central Boards Supported**:
   - **CBSE / NCERT** (Central Board of Secondary Education)
   - **UP Board** (Uttar Pradesh Madhyamik Shiksha Parishad)
   - **MP Board** (Madhya Pradesh Board of Secondary Education)
   - **Maharashtra Board** (MSBSHSE)
   - **Bihar Board** (BSEB)
   - **Rajasthan Board** (RBSE)
   - **Tamil Nadu State Board** (TNBSE)
   - **Karnataka Board** (KSEAB)
   - **West Bengal Board** (WBBSE)
   - **Gujarat Board** (GSEB)
   - **Kerala State Board** (KBPE)
   - **Andhra Pradesh Board** (BSEAP)
   - **Telangana Board** (BSET)
   - **Punjab Board** (PSEB)

2. **Classes 8 to 12**:
   - Full support for Class 8, Class 9, Class 10, Class 11, and Class 12 across Science, Mathematics, Social Science, Languages, Commerce, and Humanities.

3. **DIKSHA Portal Integration**:
   - Live querying of Sunbird Content Search APIs (`/api/content/v1/search`)
   - Fetching textbook details, Table of Contents (`toc_url`), chapter breakdowns, and media assets.
   - Extracting PDF download & streaming links (`artifactUrl`, `downloadUrl`, `pdfUrl`).

4. **CORS-Safe PDF Proxy Stream**:
   - Embedded `/api/v1/pdf/proxy` endpoint allowing frontends and mobile apps to stream DIKSHA textbook PDFs seamlessly without CORS or frame blocking errors.

5. **Digital Notebook Study Packs**:
   - Chapter Summaries & Overview
   - Key Formulas & Equations
   - Important Concepts & Terminology
   - Practice Questions & Answers

---

## Quick Start & Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm

### Step-by-Step Execution

1. **Open terminal / command prompt** and navigate to the project root directory:
   ```bash
   cd diksha-notebook-api
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Start the API Server**:
   ```bash
   npm start
   ```

4. **Verify API status**:
   Open your browser or run curl:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## API Endpoints Reference

### 1. Boards & Classes

- `GET /api/v1/boards`: Fetch list of all supported Indian state & central boards.
- `GET /api/v1/boards/:code`: Get board metadata by code (e.g. `UP`, `MP`, `MH`, `CBSE`, `BIHAR`, `RJ`, `TN`, `KA`).
- `GET /api/v1/classes`: Supported grade levels (`Class 8` to `Class 12`).
- `GET /api/v1/subjects?class=Class 10`: Subjects available for a given grade level.

### 2. DIKSHA Textbooks Search

- `GET /api/v1/books?board=CBSE&class=Class 10&subject=Mathematics`: Search DIKSHA textbooks.
- `GET /api/v1/books/:id`: Get detailed metadata, chapter breakdown, and PDF links for a book by DIKSHA ID.

### 3. Digital Chapter Notebooks

- `GET /api/v1/notebooks/chapter?subject=Mathematics&gradeLevel=Class 10&chapterNumber=1`: Fetch chapter revision pack (formulas, summary, Q&A).

### 4. PDF Streaming Proxy

- `GET /api/v1/pdf/proxy?url=<diksha_pdf_url>`: Stream PDF binary data directly with CORS headers (`Access-Control-Allow-Origin: *`).

### 5. Personal Notes

- `GET /api/v1/notes`: Fetch all user notes.
- `POST /api/v1/notes`: Save a new note (`{ "title": "...", "content": "..." }`).

---

## Project Structure

```
diksha-notebook-api/
├── data/
│   └── user_notes.json         # Storage for user notes
├── src/
│   ├── config/
│   │   ├── boards.js           # 14 State Boards metadata & DIKSHA filter mapping
│   │   └── subjects.js         # Subjects taxonomy for Class 8-12
│   ├── routes/
│   │   ├── boards.js           # Boards, classes, & subjects API routes
│   │   ├── books.js            # DIKSHA book search & detail routes
│   │   ├── notebooks.js        # Chapter study packs & formulas routes
│   │   ├── userNotes.js        # Personal notes CRUD routes
│   │   └── pdfProxy.js         # CORS-safe PDF proxy streaming route
│   ├── services/
│   │   ├── dikshaService.js    # Sunbird REST API connection & parser
│   │   └── notebookService.js  # Chapter notes generator & note manager
│   └── server.js               # Express application entry point
├── test/
│   └── api.test.js             # Integration tests
├── package.json
└── README.md
```
