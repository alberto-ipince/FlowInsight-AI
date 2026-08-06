import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(
    os.path.join(os.path.dirname(__file__), "..", "..", ".env")
)

POSTGRES_DB = os.getenv("POSTGRES_DB", "flowinsight_db")
POSTGRES_USER = os.getenv("POSTGRES_USER", "flowinsight")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "flowinsight")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

DATABASE_URL = (
    f"postgresql+psycopg://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass