# Connect FSL Learn to Laragon MySQL — FROM ZERO

Your HeidiSQL settings:
- Host: 127.0.0.1
- User: root
- Password: (empty)
- Port: 3306

---

## Step 1 — Start Laragon

1. Open **Laragon**
2. Click **Start All** (Apache + MySQL must be green / running)
3. Confirm MySQL is on port **3306**

---

## Step 2 — (Optional) Create DB in HeidiSQL

The app **auto-creates** the database `fsl_learn` and all tables.

If you want to create it yourself:

1. Open HeidiSQL → Open session **Laragon.MySQL**
2. Right-click left panel → Create new → Database
3. Name: `fsl_learn`
4. Collation: `utf8mb4_unicode_ci`
5. OK

---

## Step 3 — Python packages (venv recommended)

Open **Command Prompt** or **PowerShell**:

```bat
cd path\to\fsl-web\backend

python -m venv venv
venv\Scripts\activate

python -m pip install --upgrade pip
pip install -r requirements.txt
```

Important packages for MySQL:
- `SQLAlchemy`
- `PyMySQL`

---

## Step 4 — Run the app

```bat
venv\Scripts\activate
python run.py
```

You should see something like:

```
[DB] Database `fsl_learn` ready.
[DB] Tables created / verified.
[DB] No demo users. Create accounts via Register on the login page.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Open browser: **http://127.0.0.1:8000**

---

## Step 5 — Create your own accounts (no demos)

1. Open http://127.0.0.1:8000 → **Sign In**
2. Switch to **Register**
3. Choose role: **Teacher** or **Student**
4. Fill name, username, password → Register
5. Log in with that account

Accounts are saved in MySQL table `users` (check HeidiSQL).

---

## Step 6 — Verify in HeidiSQL

1. Refresh HeidiSQL
2. Expand `fsl_learn`
3. You should see tables:
   - `users`
   - `classrooms`
   - `classroom_members`
   - `progress`
   - `quiz_results`

---

## Connection string used by the app

```
mysql+pymysql://root:@127.0.0.1:3306/fsl_learn
```

Override with environment variables if needed:

```bat
set DB_HOST=127.0.0.1
set DB_PORT=3306
set DB_USER=root
set DB_PASSWORD=
set DB_NAME=fsl_learn
python run.py
```

---

## Common errors

| Error | Fix |
|-------|-----|
| Can't connect to MySQL | Laragon → Start All (MySQL must run) |
| Access denied for root | Password must be empty (or set DB_PASSWORD) |
| No module named pymysql | `pip install PyMySQL SQLAlchemy` inside venv |
| Port 3306 in use | Another MySQL is running — stop it or change Laragon port |

---

## What is stored in MySQL

- Users (register / login)
- Classrooms + join codes
- Classroom members
- Student progress
- Quiz results

Lessons / quiz questions stay in Python code (pre-defined content).


---

## Remove old demo users (if you already ran an older version)

In HeidiSQL → Query:

```sql
USE fsl_learn;
DELETE FROM quiz_results;
DELETE FROM progress;
DELETE FROM classroom_members;
DELETE FROM classrooms;
DELETE FROM users;
```

Then register fresh accounts from the app.
