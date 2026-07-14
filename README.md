# FSL Learn — Filipino Sign Language Vocabulary Learning Tool

> **Updated UI**: Clean DynED-inspired light educational theme (soft blues, white cards, easy on the eyes).
>
> **Changes**
> - Quizzes are **students only**
> - Alphabet practice removed from students → use the **Alphabet Mastery Quiz** instead
> - Teachers get **Live Alphabet Recognition** (camera + MediaPipe + your RF model) for classroom demo/broadcast

---

Web-based educational platform for **teachers** and **students** focused on FSL vocabulary.

## Features

### Teachers
- Create classrooms and get a **join code**
- View all students in each classroom
- Track progress (lessons completed, vocabulary mastered, quiz scores)
- Browse the full learning content (Alphabet → Basic → Intermediate)
- Pre-built quizzes per level

### Students
- Join classroom with a code
- **Learning Panel**: watch sign demos (placeholders), read tips, mark lessons complete
- Build personal **vocabulary** list
- Take quizzes (multiple choice) and see scores
- Personal progress dashboard
- Alphabet practice mode (foundation for future camera recognition)

### Tech (current)
- **Backend**: Python 3 + FastAPI
- **Storage**: JSON files (no database yet — ready for Laragon MySQL/PostgreSQL later)
- **Frontend**: Pure HTML + modern CSS (glassmorphism + 3D card effects) + vanilla JS
- Separate UIs for Teacher and Student

> Recognition of full signs was set aside; **alphabet recognition** remains the planned starting point for ML integration (MediaPipe + existing Random Forest models).

---

## Quick Start

### 1. Install backend dependencies

```bash
cd backend
python -m venv venv

# Windows (Laragon / PowerShell)
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Run the server

```bash
python run.py
```

Open: **http://127.0.0.1:8000**

API docs: **http://127.0.0.1:8000/api/docs**

### Demo accounts

| Role    | Username  | Password    |
|---------|-----------|-------------|
| Teacher | teacher1  | teacher123  |
| Student | student1  | student123  |
| Student | student2  | student123  |

A sample classroom **Grade 3 - Hope** already exists with both students enrolled.

---

## Project Structure

```
fsl-web/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes
│   │   ├── storage.py       # JSON storage (users, classrooms, progress, quizzes)
│   │   ├── lessons.py       # Static FSL vocabulary content
│   │   └── data/            # Generated JSON files
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── index.html           # Landing
│   ├── login.html           # Auth (login + register)
│   ├── teacher.html         # Teacher dashboard
│   ├── student.html         # Student learning UI
│   ├── css/styles.css       # Modern 3D glass UI
│   └── js/app.js            # Shared API client + helpers
└── README.md
```

---

## Next Steps (recommended order)

1. **Real videos** — replace placeholders with FSL demonstration videos (local or YouTube embeds).
2. **Laragon database** — migrate `storage.py` to SQLAlchemy + MySQL/PostgreSQL.
3. **Alphabet recognition** — add MediaPipe Hands in the browser (or stream frames to the existing Random Forest models).
4. **React + Vite frontend** (optional upgrade) while keeping the same FastAPI backend.
5. **Teacher-created quizzes / custom lessons**.
6. **Password hashing** (bcrypt) and proper JWT sessions.

---

## Design notes

- Dark theme with glassmorphism cards and subtle 3D tilt on hover.
- Philippine-inspired accent colors (warm red, teal, gold).
- Role-based navigation and completely different teacher vs student experiences.
- Classroom join-by-code workflow (no need for teacher to pre-add every student).

Made for Filipino classrooms. 🇵🇭 🤟
