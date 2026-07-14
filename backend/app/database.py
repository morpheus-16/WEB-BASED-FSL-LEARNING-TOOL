"""
Laragon MySQL connection (HeidiSQL defaults).
Host: 127.0.0.1  Port: 3306  User: root  Password: (empty)
"""

import os
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


def init_db():
    """Create database + tables. No demo accounts — register via the app."""
    from . import models  # noqa: F401 — register models on Base

    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    print("[DB] Tables created / verified.")
    print("[DB] No demo users. Create accounts via Register on the login page.")
