import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load .env from the backend directory explicitly
load_dotenv(dotenv_path=BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "pbi-qa-suite-secret-key-12345")
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/pbi_qa.db")
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    # Supabase Auth (the anon key is public; never use the service-role key here)
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    
    # Uploads & Reports Directories
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "storage" / "uploads"))
    REPORT_FOLDER = os.getenv("REPORT_FOLDER", str(BASE_DIR / "storage" / "reports"))
    
    # Ensure folders exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(REPORT_FOLDER, exist_ok=True)
    
    # Azure AD / Entra ID Configs
    CLIENT_ID = os.getenv("CLIENT_ID", "")
    CLIENT_SECRET = os.getenv("CLIENT_SECRET", "")
    TENANT_ID = os.getenv("TENANT_ID", "")
    
    # If client configurations are missing, default to mock mode for live Power BI service
    MOCK_SERVICE = os.getenv("MOCK_SERVICE", "true").lower() in ("true", "1", "yes") or not (CLIENT_ID and CLIENT_SECRET)
