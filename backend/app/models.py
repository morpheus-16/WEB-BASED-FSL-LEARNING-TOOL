"""
SQLAlchemy models for FSL Learn (Laragon MySQL).
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Float,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # plain for demo; bcrypt later
    email = Column(String(120), nullable=True)
    full_name = Column(String(120), nullable=False)
    role = Column(String(20), nullable=False)  # teacher | student
    avatar = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    classrooms_owned = relationship("Classroom", back_populates="teacher")
    progress_rows = relationship("Progress", back_populates="user")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "password": self.password,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "avatar": self.avatar,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    code = Column(String(12), unique=True, nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", back_populates="classrooms_owned")
    members = relationship("ClassroomMember", back_populates="classroom", cascade="all, delete-orphan")
    progress_rows = relationship("Progress", back_populates="classroom", cascade="all, delete-orphan")

    def to_dict(self, student_ids=None):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "code": self.code,
            "teacher_id": self.teacher_id,
            "student_ids": student_ids if student_ids is not None else [m.student_id for m in self.members],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ClassroomMember(Base):
    __tablename__ = "classroom_members"
    __table_args__ = (UniqueConstraint("classroom_id", "student_id", name="uq_class_student"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="members")


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("user_id", "classroom_id", name="uq_user_classroom"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    module = Column(String(40), default="alphabet")
    current_lesson = Column(Integer, default=1)
    completed_lessons = Column(JSON, default=list)  # list of lesson ids
    vocabulary_mastered = Column(JSON, default=list)
    quiz_scores = Column(JSON, default=dict)  # {quiz_id: score}
    progress_percent = Column(Float, default=0.0)
    last_activity = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="progress_rows")
    classroom = relationship("Classroom", back_populates="progress_rows")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "classroom_id": self.classroom_id,
            "module": self.module or "alphabet",
            "current_lesson": self.current_lesson or 1,
            "completed_lessons": self.completed_lessons or [],
            "vocabulary_mastered": self.vocabulary_mastered or [],
            "quiz_scores": self.quiz_scores or {},
            "progress_percent": self.progress_percent or 0,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
        }


class QuizResult(Base):
    __tablename__ = "quiz_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(Integer, nullable=False)
    score = Column(Integer, default=0)
    answers = Column(JSON, default=dict)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "classroom_id": self.classroom_id,
            "quiz_id": self.quiz_id,
            "score": self.score,
            "answers": self.answers or {},
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
        }
