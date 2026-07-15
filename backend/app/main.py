"""
FSL Learn — Filipino Sign Language Vocabulary Learning Platform
FastAPI backend (no real DB yet — JSON storage). Ready for Laragon later.
"""

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
from pathlib import Path

from .storage import storage
from . import lessons as lesson_data
from .recognizer import predict_letter

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = FastAPI(
    title="FSL Learn API",
    description="Filipino Sign Language Vocabulary Learning Tool — Teacher & Student platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    if (FRONTEND_DIR / "css").exists():
        app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    if (FRONTEND_DIR / "js").exists():
        app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
    if (FRONTEND_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")
    if (FRONTEND_DIR / "pages").exists():
        app.mount("/pages", StaticFiles(directory=str(FRONTEND_DIR / "pages")), name="pages")


# ========== Schemas ==========
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=4)
    email: Optional[str] = None
    full_name: str = Field(..., min_length=2)
    role: str = Field(default="teacher", pattern="^(teacher)$")  # public register = teachers only


class CreateClassroomRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = ""


class UpdateClassroomRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = ""



class JoinClassroomRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=10)


class LessonCompleteRequest(BaseModel):
    classroom_id: int
    lesson_id: int
    vocabulary: Optional[str] = None


class QuizSubmitRequest(BaseModel):
    classroom_id: int
    quiz_id: int
    score: int = Field(..., ge=0, le=100)
    answers: Dict[str, Any] = {}


class RecognizeRequest(BaseModel):
    landmarks: List[float]  # 63 floats from MediaPipe


# ========== Auth helpers (very simple session via token = user_id for demo) ==========
def get_current_user(request: Request) -> Dict:
    """Extract user from Authorization: Bearer <user_id> (demo only)."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = int(auth.split(" ")[1])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = storage.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # never return password
    user.pop("password", None)
    return user


def require_teacher(user: Dict = Depends(get_current_user)) -> Dict:
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only")
    return user


def require_student(user: Dict = Depends(get_current_user)) -> Dict:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")
    return user


# ========== Routes: Auth ==========
@app.post("/api/auth/login")
def login(body: LoginRequest):
    user = storage.get_user_by_username(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    storage.update_last_login(user["id"])
    token = str(user["id"])  # demo token = user id
    safe = {k: v for k, v in user.items() if k != "password"}
    return {"token": token, "user": safe}


@app.post("/api/auth/register")
def register(body: RegisterRequest):
    # System override: only teachers self-register; students are created by teachers
    if body.role != "teacher":
        raise HTTPException(status_code=400, detail="Only teachers can self-register. Students are added by their teacher.")
    if storage.get_user_by_username(body.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    user = storage.create_user(body.model_dump())
    token = str(user["id"])
    safe = {k: v for k, v in user.items() if k != "password"}
    return {"token": token, "user": safe, "message": "Account created successfully"}


@app.get("/api/auth/me")
def me(user: Dict = Depends(get_current_user)):
    return user


# ========== Routes: Lessons (public-ish, any logged in) ==========
@app.get("/api/modules")
def list_modules(user: Dict = Depends(get_current_user)):
    return lesson_data.get_modules()


@app.get("/api/lessons")
def list_lessons(module: Optional[str] = None, user: Dict = Depends(get_current_user)):
    return lesson_data.get_lessons(module)


@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: int, user: Dict = Depends(get_current_user)):
    les = lesson_data.get_lesson(lesson_id)
    if not les:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return les


# ========== Routes: Classrooms ==========
@app.post("/api/classrooms")
def create_classroom(body: CreateClassroomRequest, teacher: Dict = Depends(require_teacher)):
    c = storage.create_classroom(teacher["id"], body.name, body.description or "")
    return c


@app.get("/api/classrooms/mine")
def my_classrooms(user: Dict = Depends(get_current_user)):
    if user["role"] == "teacher":
        return storage.get_teacher_classrooms(user["id"])
    return storage.get_student_classrooms(user["id"])


@app.post("/api/classrooms/join")
def join_classroom(body: JoinClassroomRequest, student: Dict = Depends(require_student)):
    c = storage.join_classroom(student["id"], body.code.strip().upper())
    if not c:
        raise HTTPException(status_code=404, detail="Invalid classroom code")
    # ensure progress exists
    storage.get_or_create_progress(student["id"], c["id"])
    return {"message": f"Successfully joined {c['name']}", "classroom": c}


@app.get("/api/classrooms/{classroom_id}")
def get_classroom(classroom_id: int, user: Dict = Depends(get_current_user)):
    c = storage.get_classroom_by_id(classroom_id)
    if not c:
        raise HTTPException(status_code=404, detail="Classroom not found")
    # auth check rough
    if user["role"] == "teacher" and c["teacher_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your classroom")
    if user["role"] == "student" and user["id"] not in c.get("student_ids", []):
        raise HTTPException(status_code=403, detail="You are not in this classroom")
    return c


@app.put("/api/classrooms/{classroom_id}")
def update_classroom(classroom_id: int, body: UpdateClassroomRequest, teacher: Dict = Depends(require_teacher)):
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Classroom not found")
    updated = storage.update_classroom(classroom_id, body.name, body.description or "")
    if not updated:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return updated


@app.delete("/api/classrooms/{classroom_id}")
def delete_classroom(classroom_id: int, teacher: Dict = Depends(require_teacher)):
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Classroom not found")
    success = storage.delete_classroom(classroom_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete classroom")
    return {"message": "Classroom deleted successfully"}



@app.get("/api/classrooms/{classroom_id}/students")
def classroom_students(classroom_id: int, teacher: Dict = Depends(require_teacher)):
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return storage.get_classroom_students(classroom_id)


# ========== Routes: Progress ==========
@app.get("/api/progress")
def my_progress(classroom_id: Optional[int] = None, user: Dict = Depends(get_current_user)):
    if classroom_id:
        return storage.get_or_create_progress(user["id"], classroom_id)
    # all progress for user
    return [p for p in storage.progress if p["user_id"] == user["id"]]


@app.post("/api/progress/complete-lesson")
def complete_lesson(body: LessonCompleteRequest, user: Dict = Depends(get_current_user)):
    # students primarily, but teachers can too for demo
    prog = storage.mark_lesson_complete(
        user["id"], body.classroom_id, body.lesson_id, body.vocabulary
    )
    return {"message": "Lesson marked complete", "progress": prog}


@app.get("/api/progress/classroom/{classroom_id}")
def classroom_progress(classroom_id: int, teacher: Dict = Depends(require_teacher)):
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    students = storage.get_classroom_students(classroom_id)
    return {
        "classroom": c,
        "students": students,
        "summary": {
            "total_students": len(students),
            "avg_progress": (
                sum(s.get("progress", {}).get("progress_percent", 0) for s in students)
                / len(students)
                if students
                else 0
            ),
        },
    }


# ========== Routes: Quizzes ==========
@app.get("/api/quizzes")
def list_quizzes(module: Optional[str] = None, user: Dict = Depends(get_current_user)):
    return storage.get_quizzes(module)


@app.get("/api/quizzes/{quiz_id}")
def get_quiz(quiz_id: int, user: Dict = Depends(get_current_user)):
    q = storage.get_quiz(quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    # strip correct answers for students? For simplicity return all (demo)
    return q


@app.post("/api/quizzes/submit")
def submit_quiz(body: QuizSubmitRequest, user: Dict = Depends(get_current_user)):
    result = storage.submit_quiz_result(
        user["id"], body.classroom_id, body.quiz_id, body.score, body.answers
    )
    return {"message": "Quiz submitted", "result": result}


@app.get("/api/quizzes/results/me")
def my_results(classroom_id: Optional[int] = None, user: Dict = Depends(get_current_user)):
    return storage.get_student_results(user["id"], classroom_id)


# ========== Live Alphabet Recognition (Teacher broadcast) ==========


class CreateStudentRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=4)
    email: Optional[str] = None


class UpdateStudentRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


@app.post("/api/classrooms/{classroom_id}/students")
def teacher_create_student(classroom_id: int, body: CreateStudentRequest, teacher: Dict = Depends(require_teacher)):
    """Teacher creates a student account and enrolls them in the classroom."""
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if storage.get_user_by_username(body.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    user = storage.create_user({
        "username": body.username,
        "password": body.password,
        "email": body.email,
        "full_name": body.full_name,
        "role": "student",
    })
    storage.join_classroom(user["id"], c["code"])
    safe = {k: v for k, v in user.items() if k != "password"}
    return {
        "user": safe,
        "classroom_id": classroom_id,
        "classroom_code": c["code"],
        "credentials": {"username": body.username, "password": body.password},
        "message": "Student created and enrolled. Share these login credentials with the student.",
    }


@app.put("/api/classrooms/{classroom_id}/students/{student_id}")
def teacher_update_student(
    classroom_id: int,
    student_id: int,
    body: UpdateStudentRequest,
    teacher: Dict = Depends(require_teacher),
):
    """Teacher edits a student's profile (name, email, password)."""
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Classroom not found")
    # Ensure student is in this classroom
    students = storage.get_classroom_students(classroom_id)
    if not any(s["id"] == student_id for s in students):
        raise HTTPException(status_code=404, detail="Student not in this classroom")
    updated = storage.update_user(student_id, body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Student not found")
    updated.pop("password", None)
    return {"user": updated, "message": "Student updated successfully"}


@app.delete("/api/classrooms/{classroom_id}/students/{student_id}")
def teacher_delete_student(
    classroom_id: int,
    student_id: int,
    teacher: Dict = Depends(require_teacher),
):
    """Teacher removes a student from the classroom (and optionally deletes their account)."""
    c = storage.get_classroom_by_id(classroom_id)
    if not c or c["teacher_id"] != teacher["id"]:
        raise HTTPException(status_code=404, detail="Classroom not found")
    students = storage.get_classroom_students(classroom_id)
    if not any(s["id"] == student_id for s in students):
        raise HTTPException(status_code=404, detail="Student not in this classroom")
    # Delete the student account entirely
    success = storage.delete_user(student_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete student")
    return {"message": "Student removed successfully"}


@app.post("/api/recognize")
def recognize_alphabet(body: RecognizeRequest, user: Dict = Depends(get_current_user)):
    """
    Teacher-only live alphabet recognition.
    Send MediaPipe hand landmarks (63 floats). Returns predicted letter + confidence.
    """
    result = predict_letter(body.landmarks)
    return result


# ========== Health & root ==========
@app.get("/api/health")
def health():
    # DB is initialized when storage is imported
    return {
        "status": "ok",
        "app": "FSL Learn",
        "time": datetime.utcnow().isoformat(),
        "users": len(storage.users),
        "classrooms": len(storage.classrooms),
    }


@app.get("/")
async def root():
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return HTMLResponse("<h1>FSL Learn API is running. Frontend not found.</h1>")


@app.get("/{page}.html")
async def html_pages(page: str):
    # allow direct /login.html etc if placed in frontend/
    path = FRONTEND_DIR / f"{page}.html"
    if path.exists():
        return FileResponse(path)
    path2 = FRONTEND_DIR / "pages" / f"{page}.html"
    if path2.exists():
        return FileResponse(path2)
    raise HTTPException(status_code=404, detail="Page not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
