"""
===================================================================================
FYP - PHASE 2: HMS Backend
routes/auth.py  -  Login, logout, register + role-guard decorators
TP070818 | Ramaneiss Pillai S Gopalan
===================================================================================
"""

from functools import wraps
from datetime import datetime
from flask import (Blueprint, redirect, request, flash,
                   session, jsonify)

from models.db_models import db, User, Patient, DoctorProfile

auth_bp = Blueprint("auth", __name__)


# ── Helper: detect API request (expects JSON, not HTML redirect) ──────────────
def _is_api(request):
    return request.path.startswith("/api/")


# ══════════════════════════════════════════════════════════════════════════════
#  ROLE-GUARD DECORATORS
# ══════════════════════════════════════════════════════════════════════════════

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if _is_api(request):
                return jsonify({"ok": False, "error": "Not authenticated"}), 401
            return redirect("/hms")
        return f(*args, **kwargs)
    return decorated


def patient_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if _is_api(request):
                return jsonify({"ok": False, "error": "Not authenticated"}), 401
            return redirect("/hms")
        if session.get("role") != "patient":
            if _is_api(request):
                return jsonify({"ok": False, "error": "Patients only"}), 403
            return redirect("/hms")
        return f(*args, **kwargs)
    return decorated


def doctor_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if _is_api(request):
                return jsonify({"ok": False, "error": "Not authenticated"}), 401
            return redirect("/hms")
        if session.get("role") != "doctor":
            if _is_api(request):
                return jsonify({"ok": False, "error": "Doctors only"}), 403
            return redirect("/hms")
        return f(*args, **kwargs)
    return decorated


def allowed_file(filename: str, allowed: set) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@auth_bp.route("/")
def index():
    return redirect("/hms")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect("/hms")

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password) and user.is_active:
            session["user_id"]  = user.id
            session["username"] = user.username
            session["role"]     = user.role
            return redirect("/hms")
        else:
            pass   # invalid credentials — frontend handles messaging

    return redirect("/hms")


@auth_bp.route("/register/patient", methods=["GET", "POST"])
def register_patient():
    if request.method == "POST":
        username  = request.form.get("username", "").strip()
        email     = request.form.get("email", "").strip().lower()
        password  = request.form.get("password", "")
        full_name = request.form.get("full_name", "").strip()
        dob_str   = request.form.get("date_of_birth", "")
        sex       = request.form.get("sex", "").strip().lower()
        contact   = request.form.get("contact_number", "").strip()

        if not all([username, email, password, full_name, dob_str, sex]):
            return redirect("/hms")

        if User.query.filter_by(username=username).first():
            return redirect("/hms")

        if User.query.filter_by(email=email).first():
            return redirect("/hms")

        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        except ValueError:
            return redirect("/hms")

        user = User(username=username, email=email, role="patient")
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        patient = Patient(
            user_id        = user.id,
            full_name      = full_name,
            date_of_birth  = dob,
            sex            = sex,
            contact_number = contact,
        )
        db.session.add(patient)
        db.session.commit()

    return redirect("/hms")


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect("/hms")
