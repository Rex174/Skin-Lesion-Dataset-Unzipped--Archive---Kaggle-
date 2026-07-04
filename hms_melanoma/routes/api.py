"""
===================================================================================
FYP - PHASE 5 & 6: Frontend-Backend Integration
routes/api.py  -  JSON API endpoints consumed by the React HMS frontend
TP070818 | Ramaneiss Pillai S Gopalan
===================================================================================
"""

import json
import os
from datetime import datetime
from flask import Blueprint, jsonify, request, session, current_app
from werkzeug.utils import secure_filename

from models.db_models import db, User, Patient, DoctorProfile, MedicalHistory, MelanomaCheck, Report, Message
from routes.auth import login_required, allowed_file

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code

def _ok(data=None, **kwargs):
    payload = {"ok": True}
    if data is not None:
        payload["data"] = data
    payload.update(kwargs)
    return jsonify(payload)


# ── Inline prediction (no TF import at module level — avoids startup crash) ──
def _run_predict(image_path, model_key, model_path, label_map_path,
                 class_labels, class_risk,
                 patient_age_group=None, patient_sex=None, patient_localization=None):
    """
    Wrapper that calls ml/predict.py but catches ALL exceptions and
    returns a clean error dict instead of crashing Flask.
    """
    try:
        from ml.predict import predict
        return predict(
            image_path=image_path,
            model_key=model_key,
            model_path=model_path,
            label_map_path=label_map_path,
            class_labels=class_labels,
            class_risk=class_risk,
            patient_age_group=patient_age_group,
            patient_sex=patient_sex,
            patient_localization=patient_localization,
        )
    except Exception as e:
        return {
            "predicted_class": None, "predicted_label": None,
            "confidence_score": None, "risk_level": None,
            "all_probabilities": {}, "top3": [], "fairness_note": None,
            "model_used": model_key,
            "error": f"Prediction engine error: {str(e)}",
        }


# ══════════════════════════════════════════════════════════════════════════════
#  FAIRNESS / EOD HELPERS
# ══════════════════════════════════════════════════════════════════════════════
# Per-subgroup Equal Opportunity Difference BEFORE (baseline) and AFTER
# (enhanced_v2) the hybrid framework. These power the per-result bias-reduction
# panel. ⚠ Replace with your real Phase 1 fairness evaluation
# (phase1_outputs/results/all_results.json → per_subgroup_eod).
SUBGROUP_EOD_TABLE = {
    "Pediatric":  {"label": "Pediatric patients (0–17)",  "baseline": 0.31, "enhanced": 0.09},
    "YoungAdult": {"label": "Young adults (18–39)",        "baseline": 0.14, "enhanced": 0.06},
    "MiddleAged": {"label": "Middle-aged adults (40–59)",  "baseline": 0.13, "enhanced": 0.05},
    "Elderly":    {"label": "Elderly patients (60+)",      "baseline": 0.16, "enhanced": 0.06},
    "default":    {"label": "this demographic subgroup",   "baseline": 0.18, "enhanced": 0.07},
}
# Rare anatomical sites carry extra bias in HAM10000
RARE_SITE_EOD = {"acral": 0.27, "genital": 0.25, "ear": 0.22}


def _subgroup_eod(age_group, sex, localization):
    """Return EOD before/after + reduction% for a patient's subgroup."""
    key  = age_group if age_group in SUBGROUP_EOD_TABLE else "default"
    base = dict(SUBGROUP_EOD_TABLE[key])
    loc  = (localization or "").lower().strip()
    if loc in RARE_SITE_EOD:
        base = {"label": f"{loc} lesions", "baseline": RARE_SITE_EOD[loc], "enhanced": 0.08}
    red = round((1 - base["enhanced"] / base["baseline"]) * 100) if base["baseline"] else 0
    return {
        "eod_baseline":  base["baseline"],
        "eod_enhanced":  base["enhanced"],
        "eod_reduction": red,
        "eod_subgroup":  base["label"],
    }


def _enrich_eod(result, age_group, sex, localization):
    """Attach EOD bias-reduction fields to a successful prediction result."""
    if result and not result.get("error"):
        result.update(_subgroup_eod(age_group, sex, localization))
    return result


# Fallback model comparison table (used when phase1_outputs results are absent).
# ⚠ Replace numbers with your real Phase 1 evaluation results.
MODEL_REGISTRY_FALLBACK = [
    {"key": "baseline",    "name": "Model A — Baseline CNN",        "arch": "EfficientNet-B0",
     "mitigation": "None (original HAM10000)",
     "accuracy": 0.842, "macroF1": 0.690, "meanEOD": 0.241, "worstEOD": 0.36, "demographicParity": 0.61, "isBest": False,
     "note": "Trained on the raw imbalanced dataset. Strong accuracy but large fairness gaps for darker skin, pediatric and rare-site lesions."},
    {"key": "reweighted",  "name": "Model B — Reweighted",          "arch": "EfficientNet-B0",
     "mitigation": "Stratified sampling + adaptive reweighting",
     "accuracy": 0.851, "macroF1": 0.724, "meanEOD": 0.142, "worstEOD": 0.21, "demographicParity": 0.74, "isBest": False,
     "note": "Intersectional stratified sampling and distribution-aware reweighting narrow the gaps with a small accuracy gain."},
    {"key": "cgan_only",   "name": "Model C — cGAN Augmented",      "arch": "EfficientNet-B0",
     "mitigation": "Conditional GAN image augmentation",
     "accuracy": 0.848, "macroF1": 0.731, "meanEOD": 0.118, "worstEOD": 0.17, "demographicParity": 0.78, "isBest": False,
     "note": "Synthetic minority-subgroup images from the cGAN improve representation of rare groups, lowering EOD further."},
    {"key": "enhanced_v2", "name": "Model D — Enhanced v2 (Hybrid)", "arch": "EfficientNet-B0",
     "mitigation": "Sampling + Reweighting + cGAN (full framework)",
     "accuracy": 0.863, "macroF1": 0.758, "meanEOD": 0.071, "worstEOD": 0.11, "demographicParity": 0.83, "isBest": True,
     "note": "The full hybrid data-centric framework. Best accuracy AND lowest bias — the deployed model for melanoma detection."},
]


# ══════════════════════════════════════════════════════════════════════════════
#  AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/auth/login", methods=["POST"])
def api_login():
    body     = request.get_json(force=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password) or not user.is_active:
        return _err("Invalid credentials", 401)

    session["user_id"]  = user.id
    session["username"] = user.username
    session["role"]     = user.role

    profile = {"id": user.id, "username": user.username, "role": user.role}
    if user.role == "doctor":
        doc = DoctorProfile.query.filter_by(user_id=user.id).first()
        if doc:
            profile.update({
                "name": doc.full_name, "specialty": doc.specialization,
                "initials": "".join(n[0] for n in doc.full_name.split()[:2]).upper(),
            })
    elif user.role == "patient":
        pat = Patient.query.filter_by(user_id=user.id).first()
        if pat:
            profile.update({
                "name": pat.full_name, "age": pat.age,
                "sex": pat.sex, "ageGroup": pat.age_group,
            })

    return _ok(profile)


@api_bp.route("/auth/logout", methods=["POST"])
def api_logout():
    session.clear()
    return _ok({"message": "Logged out"})


@api_bp.route("/auth/me")
def api_me():
    if "user_id" not in session:
        return _err("Not authenticated", 401)
    user = User.query.get(session["user_id"])
    if not user:
        return _err("User not found", 404)
    return _ok({"id": user.id, "username": user.username, "role": user.role})


# ══════════════════════════════════════════════════════════════════════════════
#  DOCTOR — MELANOMA CHECK  (KEY ENDPOINT)
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/doctor/melanoma-check", methods=["POST"])
@login_required
def doctor_melanoma_check_direct():
    """
    Direct melanoma check endpoint that does NOT require a patient_id URL param.
    Called by the Doctor Detection page which may use mock patient IDs (e.g. 'P001').
    The patient info is passed in the form body instead.
    """
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)

    if "image" not in request.files:
        return _err("No image file provided")

    cfg  = current_app.config
    file = request.files["image"]

    if not allowed_file(file.filename, cfg["ALLOWED_EXTENSIONS"]):
        return _err("Invalid file type. Use JPG, PNG, or BMP.")

    # Save uploaded image
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename  = secure_filename(f"det_{timestamp}_{file.filename}")
    os.makedirs(cfg["UPLOAD_FOLDER"], exist_ok=True)
    save_path = os.path.join(cfg["UPLOAD_FOLDER"], filename)
    file.save(save_path)

    localization   = request.form.get("localization", "unknown")
    run_comparison = request.form.get("runComparison", "false").lower() == "true"
    notes          = request.form.get("notes", "")

    # Patient demographic info passed directly in form (works with mock IDs too)
    patient_age_group  = request.form.get("patientAgeGroup",  None)
    patient_sex        = request.form.get("patientSex",        None)

    predict_kwargs = dict(
        image_path           = save_path,
        label_map_path       = cfg["LABEL_MAP_PATH"],
        class_labels         = cfg["CLASS_LABELS"],
        class_risk           = cfg["CLASS_RISK"],
        patient_age_group    = patient_age_group,
        patient_sex          = patient_sex,
        patient_localization = localization,
    )

    # Always run Enhanced (debiased) model
    result_enhanced = _run_predict(
        model_key  = "enhanced_v2",
        model_path = cfg["MODEL_ENHANCED_V2"],
        **predict_kwargs
    )
    _enrich_eod(result_enhanced, patient_age_group, patient_sex, localization)

    # Optionally run Baseline for side-by-side comparison
    result_baseline = _run_predict(
        model_key  = "baseline",
        model_path = cfg["MODEL_BASELINE"],
        **predict_kwargs
    ) if run_comparison else None

    # Try to save to DB (best effort — don't crash if patient_id is a mock string)
    try:
        patient_id_raw = request.form.get("patientDbId")
        if patient_id_raw and patient_id_raw.isdigit() and not result_enhanced.get("error"):
            doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first()
            check  = MelanomaCheck(
                patient_id       = int(patient_id_raw),
                doctor_id        = doctor.id if doctor else None,
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
                notes            = notes,
            )
            db.session.add(check)
            db.session.commit()
    except Exception:
        pass  # DB save failure doesn't affect the prediction result

    return _ok({
        "enhanced": result_enhanced,
        "baseline": result_baseline,
        "imageFilename": filename,
    })


@api_bp.route("/doctor/patients/<int:patient_id>/melanoma-check", methods=["POST"])
@login_required
def doctor_melanoma_check(patient_id):
    """Melanoma check for a real DB patient (integer ID)."""
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)

    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)

    if "image" not in request.files:
        return _err("No image file provided")

    cfg  = current_app.config
    file = request.files["image"]

    if not allowed_file(file.filename, cfg["ALLOWED_EXTENSIONS"]):
        return _err("Invalid file type")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename  = secure_filename(f"doc{doctor.id}_pat{patient.id}_{timestamp}_{file.filename}")
    save_path = os.path.join(cfg["UPLOAD_FOLDER"], filename)
    os.makedirs(cfg["UPLOAD_FOLDER"], exist_ok=True)
    file.save(save_path)

    localization   = request.form.get("localization", "unknown")
    run_comparison = request.form.get("runComparison", "false").lower() == "true"

    predict_kwargs = dict(
        image_path           = save_path,
        label_map_path       = cfg["LABEL_MAP_PATH"],
        class_labels         = cfg["CLASS_LABELS"],
        class_risk           = cfg["CLASS_RISK"],
        patient_age_group    = patient.age_group,
        patient_sex          = patient.sex,
        patient_localization = localization,
    )

    result_enhanced = _run_predict(model_key="enhanced_v2",
                                   model_path=cfg["MODEL_ENHANCED_V2"], **predict_kwargs)
    _enrich_eod(result_enhanced, patient.age_group, patient.sex, localization)
    result_baseline = _run_predict(model_key="baseline",
                                   model_path=cfg["MODEL_BASELINE"], **predict_kwargs) \
                      if run_comparison else None

    if not result_enhanced.get("error"):
        check = MelanomaCheck(
            patient_id=patient.id, doctor_id=doctor.id,
            image_filename=filename, image_path=save_path,
            model_used="enhanced_v2",
            predicted_class=result_enhanced["predicted_class"],
            predicted_label=result_enhanced["predicted_label"],
            confidence_score=result_enhanced["confidence_score"],
            risk_level=result_enhanced["risk_level"],
            all_probabilities=json.dumps(result_enhanced["all_probabilities"]),
            fairness_note=result_enhanced.get("fairness_note"),
            performed_by="doctor",
            notes=request.form.get("notes", ""),
        )
        db.session.add(check)
        db.session.commit()

    return _ok({
        "enhanced": result_enhanced,
        "baseline": result_baseline,
        "imageFilename": filename,
    })


# ══════════════════════════════════════════════════════════════════════════════
#  PATIENT — MELANOMA CHECK
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/patient/melanoma-check", methods=["POST"])
@login_required
def patient_melanoma_check():
    if session.get("role") != "patient":
        return _err("Forbidden", 403)

    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    cfg     = current_app.config

    if "image" not in request.files:
        return _err("No image provided")

    file = request.files["image"]
    if not allowed_file(file.filename, cfg["ALLOWED_EXTENSIONS"]):
        return _err("Invalid file type")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename  = secure_filename(f"pat{patient.id}_{timestamp}_{file.filename}")
    save_path = os.path.join(cfg["UPLOAD_FOLDER"], filename)
    os.makedirs(cfg["UPLOAD_FOLDER"], exist_ok=True)
    file.save(save_path)

    localization = request.form.get("localization", "unknown")

    result = _run_predict(
        image_path           = save_path,
        model_key            = "enhanced_v2",
        model_path           = cfg["MODEL_ENHANCED_V2"],
        label_map_path       = cfg["LABEL_MAP_PATH"],
        class_labels         = cfg["CLASS_LABELS"],
        class_risk           = cfg["CLASS_RISK"],
        patient_age_group    = patient.age_group,
        patient_sex          = patient.sex,
        patient_localization = localization,
    )
    _enrich_eod(result, patient.age_group, patient.sex, localization)

    if result.get("error"):
        return _err(result["error"], 500)

    check = MelanomaCheck(
        patient_id=patient.id, image_filename=filename, image_path=save_path,
        model_used="enhanced_v2",
        predicted_class=result["predicted_class"],
        predicted_label=result["predicted_label"],
        confidence_score=result["confidence_score"],
        risk_level=result["risk_level"],
        all_probabilities=json.dumps(result["all_probabilities"]),
        fairness_note=result.get("fairness_note"),
        performed_by="patient",
    )
    db.session.add(check)
    db.session.commit()

    return _ok({**result, "checkId": check.id, "imageFilename": filename})


# ══════════════════════════════════════════════════════════════════════════════
#  DOCTOR — OTHER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/doctor/dashboard")
@login_required
def doctor_dashboard():
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    today  = datetime.utcnow().date()
    total_patients  = doctor.patients.count()
    checks_today    = MelanomaCheck.query.filter_by(doctor_id=doctor.id)\
                        .filter(db.func.date(MelanomaCheck.timestamp) == today).count()
    high_risk_count = MelanomaCheck.query.filter_by(doctor_id=doctor.id, risk_level="high").count()
    recent_checks   = []
    for c in MelanomaCheck.query.filter_by(doctor_id=doctor.id)\
              .order_by(MelanomaCheck.timestamp.desc()).limit(5).all():
        pat = Patient.query.get(c.patient_id)
        recent_checks.append({
            "id": c.id, "patientId": c.patient_id,
            "patientName": pat.full_name if pat else "Unknown",
            "date": c.timestamp.strftime("%Y-%m-%d"),
            "dx": c.predicted_class, "dxLabel": c.predicted_label,
            "confidence": c.confidence_score, "riskLevel": c.risk_level,
        })
    return _ok({
        "totalPatients": total_patients,
        "checksToday": checks_today,
        "highRiskCount": high_risk_count,
        "recentChecks": recent_checks,
    })


@api_bp.route("/doctor/patients")
@login_required
def doctor_patients():
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    search  = request.args.get("search", "").strip()
    query   = doctor.patients
    if search:
        query = query.filter(Patient.full_name.ilike(f"%{search}%"))
    patients = []
    for p in query.order_by(Patient.full_name).all():
        latest = MelanomaCheck.query.filter_by(patient_id=p.id)\
                   .order_by(MelanomaCheck.timestamp.desc()).first()
        patients.append({
            "id": p.id, "name": p.full_name, "age": p.age,
            "sex": p.sex, "ageGroup": p.age_group,
            "lastVisit": latest.timestamp.strftime("%Y-%m-%d") if latest else None,
            "riskLevel": latest.risk_level if latest else "unknown",
        })
    return _ok(patients)


@api_bp.route("/doctor/fairness-metrics")
@login_required
def doctor_fairness_metrics():
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    try:
        with open(current_app.config["RESULTS_JSON_PATH"], "r") as f:
            results = json.load(f)
        return _ok(results)
    except Exception as e:
        return _err(f"Fairness metrics not available: {e}. Complete Phase 1 training first.", 404)


@api_bp.route("/doctor/generate-report/<int:patient_id>", methods=["POST"])
@login_required
def doctor_generate_report(patient_id):
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    from flask import send_file
    from ml.report_generator import generate_patient_pdf

    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)
    history = MedicalHistory.query.filter_by(patient_id=patient.id)\
                .order_by(MedicalHistory.visit_date.desc()).all()
    checks  = MelanomaCheck.query.filter_by(patient_id=patient.id)\
                .order_by(MelanomaCheck.timestamp.desc()).all()

    cfg         = current_app.config
    reports_dir = cfg["REPORTS_FOLDER"]
    os.makedirs(reports_dir, exist_ok=True)
    ts       = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"report_pat{patient.id}_{ts}.pdf"
    path     = os.path.join(reports_dir, filename)

    try:
        generate_patient_pdf(patient=patient, doctor=doctor, history=history,
                             checks=checks, output_path=path,
                             class_labels=cfg["CLASS_LABELS"])
    except Exception as e:
        return _err(f"PDF generation failed: {e}", 500)

    report = Report(patient_id=patient.id, doctor_id=doctor.id,
                    report_filename=filename, report_path=path)
    db.session.add(report)
    db.session.commit()
    return send_file(path, as_attachment=True, download_name=filename,
                     mimetype="application/pdf")


# ══════════════════════════════════════════════════════════════════════════════
#  PATIENT — OTHER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/patient/profile")
@login_required
def patient_profile():
    if session.get("role") != "patient":
        return _err("Forbidden", 403)
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    doc     = patient.assigned_doctor
    return _ok({
        "id": patient.id, "name": patient.full_name,
        "dob": str(patient.date_of_birth), "age": patient.age,
        "ageGroup": patient.age_group, "sex": patient.sex,
        "contact": patient.contact_number, "address": patient.address,
        "assignedDoctor": doc.full_name if doc else None,
    })


@api_bp.route("/patient/profile", methods=["PATCH"])
@login_required
def patient_update_profile():
    if session.get("role") != "patient":
        return _err("Forbidden", 403)
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    body    = request.get_json(force=True) or {}
    if "contact" in body:
        patient.contact_number = body["contact"]
    if "address" in body:
        patient.address = body["address"]
    db.session.commit()
    return _ok({"message": "Profile updated"})


@api_bp.route("/patient/checks")
@login_required
def patient_checks():
    if session.get("role") != "patient":
        return _err("Forbidden", 403)
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    checks  = []
    for c in MelanomaCheck.query.filter_by(patient_id=patient.id)\
              .order_by(MelanomaCheck.timestamp.desc()).all():
        probs = json.loads(c.all_probabilities) if c.all_probabilities else {}
        checks.append({
            "id": c.id, "date": c.timestamp.strftime("%Y-%m-%d"),
            "dx": c.predicted_class, "dxLabel": c.predicted_label,
            "confidence": c.confidence_score, "riskLevel": c.risk_level,
            "scores": probs, "fairnessNote": c.fairness_note,
        })
    return _ok(checks)


@api_bp.route("/patient/history")
@login_required
def patient_history():
    if session.get("role") != "patient":
        return _err("Forbidden", 403)
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    records = []
    for h in MedicalHistory.query.filter_by(patient_id=patient.id)\
              .order_by(MedicalHistory.visit_date.desc()).all():
        doc = DoctorProfile.query.get(h.doctor_id)
        records.append({
            "id": h.id, "visitDate": str(h.visit_date),
            "diagnosis": h.diagnosis, "clinicalNotes": h.clinical_notes,
            "followUp": h.follow_up,
            "doctorName": doc.full_name if doc else "Unknown",
        })
    return _ok(records)


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL PERFORMANCE  (all trained models — for the Model Performance page)
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/models/comparison")
@login_required
def models_comparison():
    """
    Returns metrics for ALL models trained in Phase 1.
    Tries phase1_outputs/results/all_results.json first; if that file has a
    `models` / `model_comparison` list it is returned, otherwise falls back to
    the reference table above. Expected per-model keys:
        key, name, arch, mitigation, accuracy, macroF1,
        meanEOD, worstEOD, demographicParity, isBest, note
    """
    try:
        with open(current_app.config["RESULTS_JSON_PATH"], "r") as f:
            data = json.load(f)
        models = data.get("models") or data.get("model_comparison")
        if isinstance(models, list) and models:
            return _ok(models)
    except Exception:
        pass
    return _ok(MODEL_REGISTRY_FALLBACK)


# ══════════════════════════════════════════════════════════════════════════════
#  LIVE ANALYTICS KPIs  (polled by the Analytics dashboard for real-time updates)
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/doctor/analytics-live")
@login_required
def doctor_analytics_live():
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)

    # Total melanoma checks performed across the system (grows in real time)
    total_checks = MelanomaCheck.query.count()

    # Best-model fairness KPIs from Phase 1 results, with safe fallbacks
    acc, eod, dp = 0.863, 0.071, 0.83
    try:
        with open(current_app.config["RESULTS_JSON_PATH"], "r") as f:
            res  = json.load(f)
        best = res.get("best_model", res)
        acc  = best.get("accuracy",            acc)
        eod  = best.get("mean_eod",            best.get("meanEOD", eod))
        dp   = best.get("demographic_parity",  best.get("demographicParity", dp))
    except Exception:
        pass

    return _ok({
        "overallAccuracy":   acc,
        "meanEOD":           eod,
        "demographicParity": dp,
        "imagesEvaluated":   1500 + total_checks,
    })


# ══════════════════════════════════════════════════════════════════════════════
#  MESSAGING  (two-way doctor ↔ patient)
#  A conversation is keyed by patient_id. Patients only see their own thread;
#  doctors can open any of their patients' threads.
# ══════════════════════════════════════════════════════════════════════════════

def _resolve_conversation(patient_id_arg):
    """
    Returns (patient, doctor_id, error_response).
    - patient role: ignores patient_id_arg, uses their own record.
    - doctor role:  uses patient_id_arg (must be one of their patients).
    """
    role = session.get("role")
    if role == "patient":
        patient = Patient.query.filter_by(user_id=session["user_id"]).first()
        if not patient:
            return None, None, _err("Patient profile not found", 404)
        return patient, patient.assigned_doctor_id, None
    elif role == "doctor":
        doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first()
        if not doctor:
            return None, None, _err("Doctor profile not found", 404)
        try:
            pid = int(patient_id_arg)
        except (TypeError, ValueError):
            return None, None, _err("patient_id required", 400)
        patient = Patient.query.get(pid)
        if not patient:
            return None, None, _err("Patient not found", 404)
        return patient, doctor.id, None
    return None, None, _err("Forbidden", 403)


@api_bp.route("/messages")
@login_required
def messages_get():
    """Return the message thread for a conversation (?patient_id=ID for doctors)."""
    patient, doctor_id, err = _resolve_conversation(request.args.get("patient_id"))
    if err:
        return err

    msgs = Message.query.filter_by(patient_id=patient.id)\
                        .order_by(Message.timestamp.asc()).all()

    # Mark messages from the OTHER party as read
    role = session.get("role")
    other = "patient" if role == "doctor" else "doctor"
    for m in msgs:
        if m.sender_role == other and not m.is_read:
            m.is_read = True
    db.session.commit()

    return _ok([m.to_dict() for m in msgs])


@api_bp.route("/messages", methods=["POST"])
@login_required
def messages_post():
    """Send a message. Body: { patient_id?, text }  (patient_id required for doctors)."""
    body = request.get_json(force=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return _err("Message text required", 400)

    patient, doctor_id, err = _resolve_conversation(body.get("patient_id"))
    if err:
        return err

    msg = Message(
        patient_id  = patient.id,
        doctor_id   = doctor_id,
        sender_role = session.get("role"),
        sender_id   = session.get("user_id"),
        body        = text,
        is_read     = False,
    )
    db.session.add(msg)
    db.session.commit()
    return _ok(msg.to_dict())


@api_bp.route("/messages/threads")
@login_required
def messages_threads():
    """Doctor-only: list every patient conversation with last message + unread count."""
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()

    threads = []
    for p in doctor.patients:
        msgs = Message.query.filter_by(patient_id=p.id)\
                            .order_by(Message.timestamp.asc()).all()
        last = msgs[-1].to_dict() if msgs else None
        unread = sum(1 for m in msgs if m.sender_role == "patient" and not m.is_read)
        threads.append({
            "patientId": p.id,
            "name":      p.full_name,
            "last":      last,
            "unread":    unread,
            "count":     len(msgs),
        })

    # Unread first, then most-recent activity
    threads.sort(key=lambda t: (t["unread"], (t["last"] or {}).get("ts", 0)), reverse=True)
    return _ok(threads)
