"""
===================================================================================
FYP - HMS Backend + Frontend
config.py  -  Central configuration for the Flask HMS application
TP070818 | Ramaneiss Pillai S Gopalan
===================================================================================
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Config:
    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("SECRET_KEY", "hms-melanoma-fyp-secret-key-tp070818")

    # ── Database ──────────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'hms_melanoma.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── File uploads ──────────────────────────────────────────────────────────
    UPLOAD_FOLDER      = str(BASE_DIR / "static" / "uploads")
    REPORTS_FOLDER     = str(BASE_DIR / "static" / "reports")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024   # 16 MB
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff"}

    # ── Session cookie — must be None (not "Lax") for same-origin fetch() ────
    # "Lax" blocks cookies on fetch() POST requests in many browsers,
    # causing the session to be empty on API calls after login.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = None   # <-- KEY FIX: allows fetch() to send cookies
    SESSION_COOKIE_SECURE   = False  # False for HTTP localhost dev

    # ── ML Model paths — UPDATE THESE to your Phase 1 output folder ──────────
    PHASE1_OUTPUTS    = BASE_DIR / "phase1_outputs" 
    MODEL_BASELINE    = str(PHASE1_OUTPUTS / "models" / "Model_A_Standard_Baseline_final.h5") 
    MODEL_ENHANCED_V2 = str(PHASE1_OUTPUTS / "models" / "Model_E_Full_Framework_final.h5")
    LABEL_MAP_PATH    = str(PHASE1_OUTPUTS / "label_map.json")
    RESULTS_JSON_PATH = str(PHASE1_OUTPUTS / "results" / "all_results.json")

    # ── HAM10000 class details ────────────────────────────────────────────────
    CLASS_NAMES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
    CLASS_LABELS = {
        "akiec": "Actinic Keratoses",
        "bcc":   "Basal Cell Carcinoma",
        "bkl":   "Benign Keratosis",
        "df":    "Dermatofibroma",
        "mel":   "Melanoma",
        "nv":    "Melanocytic Nevi",
        "vasc":  "Vascular Lesions",
    }
    CLASS_RISK = {
        "akiec": "moderate",
        "bcc":   "high",
        "bkl":   "low",
        "df":    "low",
        "mel":   "high",
        "nv":    "low",
        "vasc":  "low",
    }


class DevelopmentConfig(Config):
    DEBUG   = True
    TESTING = False


class ProductionConfig(Config):
    DEBUG                 = False
    TESTING               = False
    SESSION_COOKIE_SECURE = True


config = DevelopmentConfig()
