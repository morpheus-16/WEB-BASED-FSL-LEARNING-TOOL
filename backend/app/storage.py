"""
Storage layer — Laragon MySQL (SQLAlchemy).
Same public API as the old JSON version so main.py / frontend stay unchanged.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .database import SessionLocal, init_db
from .models import User, Classroom, ClassroomMember, Progress, QuizResult


def _session() -> Session:
    return SessionLocal()


class Storage:
    """MySQL-backed storage matching the previous JSON Storage interface."""

    def __init__(self):
        try:
            init_db()
        except Exception as e:
            print(f"[DB] init warning: {e}")
            print("[DB] Make sure Laragon MySQL is RUNNING (Start All).")
        self._quizzes = self._seed_quizzes()

    def _generate_code(self, length: int = 6) -> str:
        alphabet = string.ascii_uppercase + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(length))

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        db = _session()
        try:
            u = db.query(User).filter(User.username == username).first()
            return u.to_dict() if u else None
        finally:
            db.close()

    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        db = _session()
        try:
            u = db.query(User).filter(User.id == user_id).first()
            return u.to_dict() if u else None
        finally:
            db.close()

    def create_user(self, data: Dict) -> Dict:
        db = _session()
        try:
            avatar = "".join(p[0] for p in data["full_name"].split()[:2]).upper() or "U"
            u = User(
                username=data["username"],
                password=data["password"],
                email=data.get("email"),
                full_name=data["full_name"],
                role=data["role"],
                avatar=avatar,
                created_at=datetime.utcnow(),
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            return u.to_dict()
        finally:
            db.close()

    def update_last_login(self, user_id: int):
        db = _session()
        try:
            u = db.query(User).filter(User.id == user_id).first()
            if u:
                u.last_login = datetime.utcnow()
                db.commit()
        finally:
            db.close()

    def update_user(self, user_id: int, data: Dict) -> Optional[Dict]:
        db = _session()
        try:
            u = db.query(User).filter(User.id == user_id).first()
            if not u:
                return None
            if "full_name" in data and data["full_name"]:
                u.full_name = data["full_name"]
                u.avatar = "".join(p[0] for p in data["full_name"].split()[:2]).upper() or "U"
            if "email" in data:
                u.email = data["email"]
            if "password" in data and data["password"]:
                u.password = data["password"]
            db.commit()
            db.refresh(u)
            return u.to_dict()
        finally:
            db.close()

    def remove_student_from_classroom(self, student_id: int, classroom_id: int) -> bool:
        db = _session()
        try:
            m = (
                db.query(ClassroomMember)
                .filter(
                    ClassroomMember.student_id == student_id,
                    ClassroomMember.classroom_id == classroom_id,
                )
                .first()
            )
            if m:
                db.delete(m)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def delete_user(self, user_id: int) -> bool:
        db = _session()
        try:
            u = db.query(User).filter(User.id == user_id).first()
            if not u:
                return False
            # Remove all classroom memberships
            db.query(ClassroomMember).filter(ClassroomMember.student_id == user_id).delete()
            # Remove progress records
            db.query(Progress).filter(Progress.user_id == user_id).delete()
            # Remove quiz results
            db.query(QuizResult).filter(QuizResult.user_id == user_id).delete()
            db.delete(u)
            db.commit()
            return True
        finally:
            db.close()

    def create_classroom(self, teacher_id: int, name: str, description: str = "") -> Dict:
        db = _session()
        try:
            code = self._generate_code()
            while db.query(Classroom).filter(Classroom.code == code).first():
                code = self._generate_code()
            c = Classroom(
                name=name,
                description=description or "",
                code=code,
                teacher_id=teacher_id,
                created_at=datetime.utcnow(),
            )
            db.add(c)
            db.commit()
            db.refresh(c)
            return c.to_dict(student_ids=[])
        finally:
            db.close()

    def update_classroom(self, classroom_id: int, name: str, description: str) -> Optional[Dict]:
        db = _session()
        try:
            c = db.query(Classroom).filter(Classroom.id == classroom_id).first()
            if c:
                c.name = name
                c.description = description or ""
                db.commit()
                db.refresh(c)
                return c.to_dict()
            return None
        finally:
            db.close()

    def delete_classroom(self, classroom_id: int) -> bool:
        db = _session()
        try:
            c = db.query(Classroom).filter(Classroom.id == classroom_id).first()
            if c:
                db.delete(c)
                db.commit()
                return True
            return False
        finally:
            db.close()


    def get_classroom_by_code(self, code: str) -> Optional[Dict]:
        db = _session()
        try:
            c = db.query(Classroom).filter(Classroom.code == code.upper()).first()
            if not c:
                c = db.query(Classroom).filter(Classroom.code == code).first()
            return c.to_dict() if c else None
        finally:
            db.close()

    def get_classroom_by_id(self, cid: int) -> Optional[Dict]:
        db = _session()
        try:
            c = db.query(Classroom).filter(Classroom.id == cid).first()
            return c.to_dict() if c else None
        finally:
            db.close()

    def get_teacher_classrooms(self, teacher_id: int) -> List[Dict]:
        db = _session()
        try:
            rows = db.query(Classroom).filter(Classroom.teacher_id == teacher_id).all()
            out = []
            for c in rows:
                d = c.to_dict()
                teacher = db.query(User).filter(User.id == c.teacher_id).first()
                d["teacher_name"] = teacher.full_name if teacher else "Teacher"
                out.append(d)
            return out
        finally:
            db.close()

    def get_student_classrooms(self, student_id: int) -> List[Dict]:
        db = _session()
        try:
            member_rows = (
                db.query(Classroom)
                .join(ClassroomMember, ClassroomMember.classroom_id == Classroom.id)
                .filter(ClassroomMember.student_id == student_id)
                .all()
            )
            out = []
            for c in member_rows:
                d = c.to_dict()
                teacher = db.query(User).filter(User.id == c.teacher_id).first()
                d["teacher_name"] = teacher.full_name if teacher else "Teacher"
                d["teacher_username"] = teacher.username if teacher else ""
                out.append(d)
            return out
        finally:
            db.close()

    def join_classroom(self, student_id: int, code: str) -> Optional[Dict]:
        db = _session()
        try:
            c = db.query(Classroom).filter(Classroom.code == code.upper()).first()
            if not c:
                c = db.query(Classroom).filter(Classroom.code == code).first()
            if not c:
                return None
            exists = (
                db.query(ClassroomMember)
                .filter(
                    ClassroomMember.classroom_id == c.id,
                    ClassroomMember.student_id == student_id,
                )
                .first()
            )
            if not exists:
                db.add(
                    ClassroomMember(
                        classroom_id=c.id,
                        student_id=student_id,
                        joined_at=datetime.utcnow(),
                    )
                )
                db.commit()
            self.get_or_create_progress(student_id, c.id)
            db.refresh(c)
            return c.to_dict()
        finally:
            db.close()

    def get_classroom_students(self, classroom_id: int) -> List[Dict]:
        db = _session()
        try:
            members = (
                db.query(ClassroomMember)
                .filter(ClassroomMember.classroom_id == classroom_id)
                .all()
            )
            out = []
            for m in members:
                u = db.query(User).filter(User.id == m.student_id).first()
                if not u:
                    continue
                d = u.to_dict()
                d.pop("password", None)
                prog = (
                    db.query(Progress)
                    .filter(
                        Progress.user_id == m.student_id,
                        Progress.classroom_id == classroom_id,
                    )
                    .first()
                )
                d["progress"] = prog.to_dict() if prog else None
                out.append(d)
            return out
        finally:
            db.close()

    def get_user_progress(
        self, user_id: int, classroom_id: Optional[int] = None
    ) -> Optional[Dict]:
        db = _session()
        try:
            q = db.query(Progress).filter(Progress.user_id == user_id)
            if classroom_id is not None:
                q = q.filter(Progress.classroom_id == classroom_id)
                row = q.first()
                return row.to_dict() if row else None
            rows = q.all()
            if not rows:
                return None
            if len(rows) == 1:
                return rows[0].to_dict()
            return [r.to_dict() for r in rows]
        finally:
            db.close()

    def get_or_create_progress(self, user_id: int, classroom_id: int) -> Dict:
        db = _session()
        try:
            row = (
                db.query(Progress)
                .filter(
                    Progress.user_id == user_id,
                    Progress.classroom_id == classroom_id,
                )
                .first()
            )
            if row:
                return row.to_dict()
            row = Progress(
                user_id=user_id,
                classroom_id=classroom_id,
                module="alphabet",
                current_lesson=1,
                completed_lessons=[],
                vocabulary_mastered=[],
                quiz_scores={},
                progress_percent=0.0,
                last_activity=datetime.utcnow(),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row.to_dict()
        finally:
            db.close()

    def update_progress(self, user_id: int, classroom_id: int, updates: Dict) -> Dict:
        db = _session()
        try:
            row = (
                db.query(Progress)
                .filter(
                    Progress.user_id == user_id,
                    Progress.classroom_id == classroom_id,
                )
                .first()
            )
            if not row:
                db.close()
                return self.get_or_create_progress(user_id, classroom_id)
            for k, v in updates.items():
                if hasattr(row, k):
                    setattr(row, k, v)
            row.last_activity = datetime.utcnow()
            db.commit()
            db.refresh(row)
            return row.to_dict()
        finally:
            db.close()

    def mark_lesson_complete(
        self, user_id: int, classroom_id: int, lesson_id: int, vocab: str = None
    ) -> Dict:
        p = self.get_or_create_progress(user_id, classroom_id)
        completed = list(p.get("completed_lessons") or [])
        if lesson_id not in completed:
            completed.append(lesson_id)
        vocab_list = list(p.get("vocabulary_mastered") or [])
        if vocab and vocab not in vocab_list:
            vocab_list.append(vocab)
        percent = min(100, round(len(completed) / 30 * 100, 1))
        return self.update_progress(
            user_id,
            classroom_id,
            {
                "completed_lessons": completed,
                "vocabulary_mastered": vocab_list,
                "current_lesson": lesson_id + 1,
                "progress_percent": percent,
            },
        )

    def _seed_quizzes(self) -> List[Dict]:
        return [
            {
                "id": 1,
                "title": "Alphabet Mastery Quiz",
                "module": "alphabet",
                "description": "Test your knowledge of FSL alphabet signs A–Z",
                "passing_score": 70,
                "questions": [
                    {"id": "q1", "type": "multiple_choice", "question": "What letter is signed with a closed fist and thumb pointing up?", "options": ["A", "B", "C", "D"], "correct": "A", "sign_hint": "A"},
                    {"id": "q2", "type": "multiple_choice", "question": "Which letter uses the index and middle fingers extended like a V?", "options": ["U", "V", "W", "Y"], "correct": "V", "sign_hint": "V"},
                    {"id": "q3", "type": "multiple_choice", "question": "The letter I is signed by:", "options": ["Pointing pinky finger up", "Fist with thumb out", "Open palm", "Index finger pointing"], "correct": "Pointing pinky finger up", "sign_hint": "I"},
                    {"id": "q4", "type": "multiple_choice", "question": "How do you sign the letter Y?", "options": ["Thumb and pinky extended", "All fingers open", "Fist only", "Index and pinky"], "correct": "Thumb and pinky extended", "sign_hint": "Y"},
                    {"id": "q5", "type": "multiple_choice", "question": "Letter C looks like:", "options": ["A curved hand like the letter C", "A flat palm", "A pointing finger", "Two fingers crossed"], "correct": "A curved hand like the letter C", "sign_hint": "C"},
                ],
            },
            {
                "id": 2,
                "title": "Basic Vocabulary Quiz",
                "module": "basic",
                "description": "Common greetings and daily vocabulary",
                "passing_score": 70,
                "questions": [
                    {"id": "q1", "type": "multiple_choice", "question": "How do you sign Hello / Kamusta in FSL?", "options": ["Wave hand", "Point to self", "Clap", "Thumbs down"], "correct": "Wave hand"},
                    {"id": "q2", "type": "multiple_choice", "question": "The sign for Thank you typically involves:", "options": ["Hand from chin outward", "Stomping foot", "Crossing arms", "Pointing up"], "correct": "Hand from chin outward"},
                    {"id": "q3", "type": "multiple_choice", "question": "Family term for mother is often signed near the:", "options": ["Chin / cheek", "Foot", "Elbow", "Knee"], "correct": "Chin / cheek"},
                ],
            },
            {
                "id": 3,
                "title": "Intermediate Phrases Quiz",
                "module": "intermediate",
                "description": "Short conversations and classroom phrases",
                "passing_score": 70,
                "questions": [
                    {"id": "q1", "type": "multiple_choice", "question": "A useful classroom phrase is:", "options": ["I don't understand", "Buy milk", "Drive car", "Cook rice"], "correct": "I don't understand"},
                    {"id": "q2", "type": "multiple_choice", "question": "To ask for help you might sign:", "options": ["Help please", "Goodbye only", "Sleep now", "Run fast"], "correct": "Help please"},
                ],
            },
        ]

    def get_quizzes(self, module: Optional[str] = None) -> List[Dict]:
        if module:
            return [q for q in self._quizzes if q["module"] == module]
        return list(self._quizzes)

    def get_quiz(self, quiz_id: int) -> Optional[Dict]:
        for q in self._quizzes:
            if q["id"] == quiz_id:
                return q
        return None

    def submit_quiz_result(
        self, user_id: int, classroom_id: int, quiz_id: int, score: int, answers: Dict
    ) -> Dict:
        db = _session()
        try:
            row = QuizResult(
                user_id=user_id,
                classroom_id=classroom_id,
                quiz_id=quiz_id,
                score=score,
                answers=answers or {},
                submitted_at=datetime.utcnow(),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            p = (
                db.query(Progress)
                .filter(
                    Progress.user_id == user_id,
                    Progress.classroom_id == classroom_id,
                )
                .first()
            )
            if p:
                scores = dict(p.quiz_scores or {})
                scores[str(quiz_id)] = score
                p.quiz_scores = scores
                p.last_activity = datetime.utcnow()
                db.commit()
            return row.to_dict()
        finally:
            db.close()

    def get_student_results(
        self, user_id: int, classroom_id: Optional[int] = None
    ) -> List[Dict]:
        db = _session()
        try:
            q = db.query(QuizResult).filter(QuizResult.user_id == user_id)
            if classroom_id is not None:
                q = q.filter(QuizResult.classroom_id == classroom_id)
            return [r.to_dict() for r in q.order_by(QuizResult.submitted_at.desc()).all()]
        finally:
            db.close()


storage = Storage()
