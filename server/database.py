import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load .env file automatically
load_dotenv()

DB_USER = os.getenv("Maria_DB_User", "root").strip("'\"")
DB_PASSWORD = os.getenv("Maria_DB_Pass", "root").strip("'\"")
DB_HOST = os.getenv("MARIADB_HOST", "127.0.0.1")
DB_PORT = os.getenv("MARIADB_PORT", "3306")
DB_NAME = os.getenv("MARIADB_DB", "smartoutlet")

SQLALCHEMY_DATABASE_URL = f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Auto-create the database if it doesn't exist
import mysql.connector
try:
    conn = mysql.connector.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=int(DB_PORT)
    )
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Warning: Could not automatically create database '{DB_NAME}': {e}")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
