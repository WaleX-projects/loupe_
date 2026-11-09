import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Must use the psycopg driver, for example:
#   postgresql+psycopg://USER:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
DATABASE_URL = "sqlite+aiosqlite:///./sql_app.db"
#settings.database_url

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}  # SQLite only
else:
    # Supabase's pooler on port 6543 runs in transaction mode, which cannot handle
    # prepared statements. Turn them off for psycopg.
    connect_args = {"prepare_threshold": None}

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO") == "1",  # set SQL_ECHO=1 to log every query
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# Dependency to get the database session in FastAPI endpoints
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session