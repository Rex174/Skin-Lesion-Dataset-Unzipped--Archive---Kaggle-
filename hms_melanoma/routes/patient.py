"""
===================================================================================
FYP - PHASE 2: HMS Backend
routes/patient.py  -  All patient-role routes
TP070818 | Ramaneiss Pillai S Gopalan

FEATURES:
    P1 - Patient Dashboard
    P2 - View / Update Patient Profile
    P3 - Melanoma Checker (self-check)
    P4 - View Medical History
    P5 - View Melanoma Check History
===================================================================================
"""

import os
import json
from datetime import datetime
from flask import (Blueprint, redirect,
                   request, session, current_app)
from werkzeug.utils import secure_filename

from models.db_models import db, Patient, MedicalHistory, MelanomaCheck
from routes.auth import patient_required, allowed_file
from ml.predict import predict

patient_bp = Blueprint("patient", __name__, url_prefix="/patient")


# ══════════════════════════════════════════════════════════════════════════════
#  P1 — DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@patient_bp.route("/dashboard")
@patient_required
def dashboard():
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    recent_checks   = (MelanomaCheck.query
                       .filter_by(patient_id=patient.id)
                       .order_by(MelanomaCheck.timestamp.desc())
                       .limit(3).all())
    recent_history  = (MedicalHistory.query
                       .filter_by(patient_id=patient.id)
                       .order_by(MedicalHistory.visit_date.desc())
                       .limit(3).all())
    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  P2 — PROFILE
# ══════════════════════════════════════════════════════════════════════════════

@patient_bp.route("/profile", methods=["GET", "POST"])
@patient_required
def profile():
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()

    if request.method == "POST":
        # Patients may only update contact info
        patient.contact_number = request.form.get("contact_number", "").strip()
        patient.address        = request.form.get("address", "").strip()
        db.session.commit()
        return redirect('/hms')

    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  P3 — MELANOMA CHECKER (Self-Check)
# ══════════════════════════════════════════════════════════════════════════════

@patient_bp.route("/melanoma-check", methods=["GET", "POST"])
@patient_required
def melanoma_check():
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    result  = None

    if request.method == "POST":
        if "image" not in request.files:
            return redirect(request.url)

        file = request.files["image"]
        cfg  = current_app.config

        if file.filename == "":
            return redirect(request.url)

        if not allowed_file(file.filename, cfg["ALLOWED_EXTENSIONS"]):
            return redirect(request.url)

        # Save uploaded image
        filename  = secure_filename(
            f"patient_{patient.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        )
        save_path = os.path.join(cfg["UPLOAD_FOLDER"], filename)
        os.makedirs(cfg["UPLOAD_FOLDER"], exist_ok=True)
        file.save(save_path)

        # Patients always use the Enhanced (debiased) model
        result = predict(
            image_path         = save_path,
            model_key          = "enhanced_v2",
            model_path         = cfg["MODEL_ENHANCED_V2"],
            label_map_path     = cfg["LABEL_MAP_PATH"],
            class_labels       = cfg["CLASS_LABELS"],
            class_risk         = cfg["CLASS_RISK"],
            patient_age_group  = patient.age_group,
            patient_sex        = patient.sex,
            patient_localization = request.form.get("localization", "unknown"),
        )

        if result["error"]:
            pass
        else:
            # Save to database
            check = MelanomaCheck(
                patient_id       = patient.id,
                doctor_id        = None,
                image_filename   = filename,
                image_path       = save_path,
                model_used       = "enhanced_v2",
                predicted_class  = result["predicted_class"],
                predicted_label  = result["predicted_label"],
                confidence_score = result["confidence_score"],
                risk_level       = result["risk_level"],
                all_probabilities= json.dumps(result["all_probabilities"]),
                fairness_note    = result.get("fairness_note"),
                performed_by     = "patient",
            )
            db.session.add(check)
            db.session.commit()
            result["check_id"] = check.id

    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  P4 — MEDICAL HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@patient_bp.route("/medical-history")
@patient_required
def medical_history():
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    records = (MedicalHistory.query
               .filter_by(patient_id=patient.id)
               .order_by(MedicalHistory.visit_date.desc())
               .all())
    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  P5 — MELANOMA CHECK HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@patient_bp.route("/check-history")
@patient_required
def check_history():
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    checks  = (MelanomaCheck.query
               .filter_by(patient_id=patient.id)
               .order_by(MelanomaCheck.timestamp.desc())
               .all())
    # Deserialise probability JSON for display
    for c in checks:
        if c.all_probabilities:
            c.probs_dict = json.loads(c.all_probabilities)
        else:
            c.probs_dict = {}
    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  HELPER
# ══════════════════════════════════════════════════════════════════════════════

def _get_localizations():
    return [
        "back", "lower extremity", "trunk", "upper extremity",
        "abdomen", "face", "chest", "foot", "neck", "scalp",
        "hand", "ear", "genital", "acral", "unknown",
    ]
