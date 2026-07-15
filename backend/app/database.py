"""
Laragon MySQL connection (HeidiSQL defaults).
Host: 127.0.0.1  Port: 3306  User: root  Password: (empty)
"""

import os
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool

# --- Laragon defaults (match your HeidiSQL session) ---
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")  # empty on default Laragon
DB_NAME = os.getenv("DB_NAME", "fsl_learn")

# mysql+pymysql://root:@127.0.0.1:3306/fsl_learn
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4",
)

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database_exists():
    """
    Create the fsl_learn database if it does not exist yet.
    Connects without DB name first (works with empty root password).
    """
    root_url = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/?charset=utf8mb4"
    )
    tmp_engine = create_engine(root_url, isolation_level="AUTOCOMMIT")
    try:
        with tmp_engine.connect() as conn:
            conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
        print(f"[DB] Database `{DB_NAME}` ready.")
    finally:
        tmp_engine.dispose()


def seed_demo_data(db):
    """Seed demo accounts and classrooms if database is empty."""
    from .models import User, Classroom, ClassroomMember, Progress
    
    # Check if we already have users
    if db.query(User).count() > 0:
        return
        
    print("[DB] Database is empty. Seeding demo data from JSON files...")
    
    # Paths to JSON files
    base_dir = Path(__file__).resolve().parent.parent
    data_dir = base_dir / "data"
    
    users_path = data_dir / "users.json"
    classrooms_path = data_dir / "classrooms.json"
    progress_path = data_dir / "progress.json"
    
    # 1. Seed Users
    if users_path.exists():
        with open(users_path, "r", encoding="utf-8") as f:
            users_data = json.load(f)
        for u_data in users_data:
            created_at = datetime.fromisoformat(u_data["created_at"]) if u_data.get("created_at") else datetime.utcnow()
            last_login = datetime.fromisoformat(u_data["last_login"]) if u_data.get("last_login") else None
            user = User(
                id=u_data["id"],
                username=u_data["username"],
                password=u_data["password"],
                email=u_data.get("email"),
                full_name=u_data["full_name"],
                role=u_data["role"],
                avatar=u_data.get("avatar"),
                created_at=created_at,
                last_login=last_login
            )
            db.add(user)
        db.commit()
        print(f"[DB] Seeded {len(users_data)} users.")

    # 2. Seed Classrooms and Members
    if classrooms_path.exists():
        with open(classrooms_path, "r", encoding="utf-8") as f:
            classrooms_data = json.load(f)
        for c_data in classrooms_data:
            created_at = datetime.fromisoformat(c_data["created_at"]) if c_data.get("created_at") else datetime.utcnow()
            classroom = Classroom(
                id=c_data["id"],
                name=c_data["name"],
                description=c_data.get("description", ""),
                code=c_data["code"],
                teacher_id=c_data["teacher_id"],
                created_at=created_at
            )
            db.add(classroom)
            
            # Seed members
            student_ids = c_data.get("student_ids", [])
            for s_id in student_ids:
                member = ClassroomMember(
                    classroom_id=c_data["id"],
                    student_id=s_id
                )
                db.add(member)
        db.commit()
        print(f"[DB] Seeded {len(classrooms_data)} classrooms and their student members.")

    # 3. Seed Progress
    if progress_path.exists():
        with open(progress_path, "r", encoding="utf-8") as f:
            progress_data = json.load(f)
        for p_data in progress_data:
            last_activity = datetime.fromisoformat(p_data["last_activity"]) if p_data.get("last_activity") else datetime.utcnow()
            progress = Progress(
                id=p_data["id"],
                user_id=p_data["user_id"],
                classroom_id=p_data["classroom_id"],
                module=p_data.get("module", "alphabet"),
                current_lesson=p_data.get("current_lesson", 1),
                completed_lessons=p_data.get("completed_lessons", []),
                vocabulary_mastered=p_data.get("vocabulary_mastered", []),
                quiz_scores=p_data.get("quiz_scores", {}),
                progress_percent=float(p_data.get("progress_percent", 0.0)),
                last_activity=last_activity
            )
            db.add(progress)
        db.commit()
        print(f"[DB] Seeded {len(progress_data)} progress records.")


def init_db():
    """Create database + tables. Seed demo accounts if empty."""
    from . import models  # noqa: F401 — register models on Base

    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    print("[DB] Tables created / verified.")
    
    db = SessionLocal()
    try:
        seed_demo_data(db)
    except Exception as e:
        print(f"[DB] Seeding failed: {e}")
    finally:
        db.close()
