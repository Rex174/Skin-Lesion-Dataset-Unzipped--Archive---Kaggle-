"""
===================================================================================
FYP - PHASE 2: HMS Backend
routes/doctor.py  -  All doctor-role routes
TP070818 | Ramaneiss Pillai S Gopalan

FEATURES:
    D1 - Doctor Dashboard
    D2 - Patient Management (list + view)
    D3 - Update Patient Record (add medical history)
    D4 - Melanoma Checker for Patients (baseline vs enhanced comparison)
    D5 - Generate PDF Patient Report
    D6 - Fairness Metrics Dashboard
===================================================================================
"""

import os
import json
from datetime import datetime
from flask import (Blueprint, redirect,
                   request, session, current_app, send_file)
from werkzeug.utils import secure_filename

from models.db_models import db, Patient, DoctorProfile, MedicalHistory, MelanomaCheck, Report
from routes.auth import doctor_required, allowed_file
from ml.predict import predict

doctor_bp = Blueprint("doctor", __name__, url_prefix="/doctor")


# ══════════════════════════════════════════════════════════════════════════════
#  D1 — DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@doctor_bp.route("/dashboard")
@doctor_required
def dashboard():
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()

    total_patients  = doctor.patients.count()
    today           = datetime.utcnow().date()
    checks_today    = (MelanomaCheck.query
                       .filter_by(doctor_id=doctor.id)
                       .filter(db.func.date(MelanomaCheck.timestamp) == today)
                       .count())
    high_risk_cases = (MelanomaCheck.query
                       .filter_by(doctor_id=doctor.id, risk_level="high")
                       .order_by(MelanomaCheck.timestamp.desc())
                       .limit(5).all())
    recent_activity = (MelanomaCheck.query
                       .filter_by(doctor_id=doctor.id)
                       .order_by(MelanomaCheck.timestamp.desc())
                       .limit(5).all())

    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  D2 — PATIENT MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@doctor_bp.route("/patients")
@doctor_required
def patient_list():
    doctor   = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    search   = request.args.get("search", "").strip()
    query    = doctor.patients

    if search:
        query = query.filter(Patient.full_name.ilike(f"%{search}%"))

    patients = query.order_by(Patient.full_name).all()
    return redirect('/hms')


@doctor_bp.route("/patients/<int:patient_id>")
@doctor_required
def patient_detail(patient_id):
    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)

    # Security: only the assigned doctor can view
    if patient.assigned_doctor_id != doctor.id:
        return redirect('/hms')

    history = (MedicalHistory.query
               .filter_by(patient_id=patient.id)
               .order_by(MedicalHistory.visit_date.desc()).all())
    checks  = (MelanomaCheck.query
               .filter_by(patient_id=patient.id)
               .order_by(MelanomaCheck.timestamp.desc()).all())
    reports = (Report.query
               .filter_by(patient_id=patient.id)
               .order_by(Report.created_at.desc()).all())

    for c in checks:
        c.probs_dict = json.loads(c.all_probabilities) if c.all_probabilities else {}

    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  D3 — UPDATE PATIENT RECORD
# ══════════════════════════════════════════════════════════════════════════════

@doctor_bp.route("/patients/<int:patient_id>/add-record", methods=["GET", "POST"])
@doctor_required
def add_medical_record(patient_id):
    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)

    if patient.assigned_doctor_id != doctor.id:
        return redirect('/hms')

    if request.method == "POST":
        visit_date_str  = request.form.get("visit_date", "")
        diagnosis       = request.form.get("diagnosis", "").strip()
        clinical_notes  = request.form.get("clinical_notes", "").strip()
        follow_up       = request.form.get("follow_up") == "on"
        follow_up_date  = None

        try:
            visit_date = datetime.strptime(visit_date_str, "%Y-%m-%d").date()
        except ValueError:
            return redirect(request.url)

        if follow_up and request.form.get("follow_up_date"):
            try:
                follow_up_date = datetime.strptime(
                    request.form.get("follow_up_date"), "%Y-%m-%d").date()
            except ValueError:
                follow_up_date = None

        record = MedicalHistory(
            patient_id     = patient.id,
            doctor_id      = doctor.id,
            visit_date     = visit_date,
            diagnosis      = diagnosis,
            clinical_notes = clinical_notes,
            follow_up      = follow_up,
            follow_up_date = follow_up_date,
        )
        db.session.add(record)
        db.session.commit()
        return redirect('/hms')

    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  D4 — MELANOMA CHECKER FOR PATIENTS (Baseline vs Enhanced comparison)
# ══════════════════════════════════════════════════════════════════════════════

@doctor_bp.route("/patients/<int:patient_id>/melanoma-check", methods=["GET", "POST"])
@doctor_required
def melanoma_check(patient_id):
    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)

    if patient.assigned_doctor_id != doctor.id:
        return redirect('/hms')

    result_baseline = None
    result_enhanced = None

    if request.method == "POST":
        if "image" not in request.files:
            return redirect(request.url)

        file = request.files["image"]
        cfg  = current_app.config

        if file.filename == "" or not allowed_file(file.filename, cfg["ALLOWED_EXTENSIONS"]):
            flash("Please upload a valid image file (JPG, PNG, BMP).", "danger")
            return redirect(request.url)

        localization = request.form.get("localization", "unknown")
        run_comparison = request.form.get("run_comparison") == "on"

        # Save image
        filename  = secure_filename(
            f"doc_{doctor.id}_pat_{patient.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        )
        save_path = os.path.join(cfg["UPLOAD_FOLDER"], filename)
        os.makedirs(cfg["UPLOAD_FOLDER"], exist_ok=True)
        file.save(save_path)

        predict_kwargs = dict(
            image_path          = save_path,
            label_map_path      = cfg["LABEL_MAP_PATH"],
            class_labels        = cfg["CLASS_LABELS"],
            class_risk          = cfg["CLASS_RISK"],
            patient_age_group   = patient.age_group,
            patient_sex         = patient.sex,
            patient_localization= localization,
        )

        # Always run Enhanced (debiased) model
        result_enhanced = predict(
            model_key  = "enhanced_v2",
            model_path = cfg["MODEL_ENHANCED_V2"],
            **predict_kwargs
        )

        # Optionally run Baseline for side-by-side comparison (KEY FYP DEMO FEATURE)
        if run_comparison:
            result_baseline = predict(
                model_key  = "baseline",
                model_path = cfg["MODEL_BASELINE"],
                **predict_kwargs
            )

        # Save the Enhanced result to DB
        if not result_enhanced.get("error"):
            check = MelanomaCheck(
                patient_id       = patient.id,
                doctor_id        = doctor.id,
                image_filename   = filename,
                image_path       = save_path,
                model_used       = "enhanced_v2",
                predicted_class  = result_enhanced["predicted_class"],
                predicted_label  = result_enhanced["predicted_label"],
                confidence_score = result_enhanced["confidence_score"],
                risk_level       = result_enhanced["risk_level"],
                all_probabilities= json.dumps(result_enhanced["all_probabilities"]),
                fairness_note    = result_enhanced.get("fairness_note"),
                performed_by     = "doctor",
                notes            = request.form.get("notes", ""),
            )
            db.session.add(check)
            db.session.commit()

    return redirect('/hms')


# ══════════════════════════════════════════════════════════════════════════════
#  D5 — GENERATE PATIENT REPORT (PDF)
# ══════════════════════════════════════════════════════════════════════════════

@doctor_bp.route("/patients/<int:patient_id>/generate-report")
@doctor_required
def generate_report(patient_id):
    from ml.report_generator import generate_patient_pdf

    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)

    if patient.assigned_doctor_id != doctor.id:
        return redirect('/hms')

    history = MedicalHistory.query.filter_by(patient_id=patient.id).order_by(
        MedicalHistory.visit_date.desc()).all()
    checks  = MelanomaCheck.query.filter_by(patient_id=patient.id).order_by(
        MelanomaCheck.timestamp.desc()).all()

    cfg           = current_app.config
    reports_dir   = cfg["REPORTS_FOLDER"]
    os.makedirs(reports_dir, exist_ok=True)

    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename      = f"report_patient{patient.id}_{timestamp_str}.pdf"
    report_path   = os.path.join(reports_dir, filename)

    try:
        generate_patient_pdf(
            patient=patient, doctor=doctor,
            history=history, checks=checks,
            output_path=report_path,
            class_labels=cfg["CLASS_LABELS"],
        )
    except Exception as e:
        return redirect('/hms')

    # Save report record
    report = Report(
        patient_id      = patient.id,
        doctor_id       = doctor.id,
        report_filename = filename,
        report_path     = report_path,
    )
    db.session.add(report)
    db.session.commit()
    return send_file(report_path, as_attachment=True, download_name=filename)


# ══════════════════════════════════════════════════════════════════════════════
#  D6 — FAIRNESS METRICS DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@doctor_bp.route("/fairness-dashboard")
@doctor_required
def fairness_dashboard():
    cfg = current_app.config

    # Load pre-computed Phase 1 evaluation results
    results = {}
    try:
        with open(cfg["RESULTS_JSON_PATH"], "r") as f:
            results = json.load(f)
    except Exception:
        flash(
            "Fairness metrics file not found. "
            "Please complete Phase 1 (CNN training & evaluation) first.",
            "warning"
        )

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
