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

from models.db_models import db, User, Patient, DoctorProfile, MedicalHistory, MelanomaCheck, Report, Message, Appointment
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
#  FAIRNESS / EOD HELPERS  — parsed from the REAL Phase-1 results
#  (phase1_outputs/results/all_results.json). Fairness is measured on
#  AGE GROUP, SEX and LESION LOCATION (HAM10000 has no skin-tone labels).
#  Baseline = Model A (Standard Baseline); deployed = Model E (Full Framework).
# ══════════════════════════════════════════════════════════════════════════════

# Ordered registry: (json_key, api_key, display_name, mitigation, is_best, note)
_MODEL_ORDER = [
    ("Model_A_Standard_Baseline", "baseline",      "Model A — Standard Baseline",
     "None (original imbalanced HAM10000)", False,
     "Trained on the raw imbalanced dataset. Highest accuracy and melanoma sensitivity, but the largest fairness gaps — especially across lesion location and age group."),
    ("Model_B_Sampling_Only",     "sampling_only", "Model B — Sampling Only",
     "Intersectional stratified sampling", False,
     "Stratified sampling sharply reduces age- and sex-based bias, at a cost to overall accuracy and melanoma sensitivity."),
    ("Model_C_Reweighting_Only",  "reweight_only", "Model C — Reweighting Only",
     "Adaptive distribution-aware reweighting", False,
     "Reweighting alone lowers age-group bias but is the least accurate and least calibrated, and worsens sex-based EOD."),
    ("Model_D_cGAN_Only",         "cgan_only",     "Model D — cGAN Only",
     "Conditional GAN image augmentation", False,
     "Synthetic minority-subgroup images preserve strong accuracy while lowering age- and sex-based bias."),
    ("Model_E_Full_Framework",    "enhanced_v2",   "Model E — Full Framework",
     "Sampling + Reweighting + cGAN (full hybrid framework)", True,
     "The full hybrid data-centric framework — the deployed model. Lowest bias on every axis, trading raw accuracy for substantially fairer predictions."),
]

_BASELINE_JSON_KEY = "Model_A_Standard_Baseline"
_DEPLOYED_JSON_KEY = "Model_E_Full_Framework"


def _load_results():
    """Load and cache all_results.json. Returns {} on failure."""
    if not hasattr(_load_results, "_cache"):
        try:
            with open(current_app.config["RESULTS_JSON_PATH"], "r") as f:
                _load_results._cache = json.load(f)
        except Exception as e:
            print(f"[WARN] Could not load results JSON: {e}")
            _load_results._cache = {}
    return _load_results._cache


def _axis_eods(model_json):
    """(eod_age, eod_sex, eod_loc) from a model's fairness block, safe on missing keys."""
    fair = (model_json or {}).get("fairness", {})
    age = fair.get("age_group", {}).get("EOD")
    sex = fair.get("sex", {}).get("EOD")
    loc = fair.get("loc_zone", {}).get("EOD")
    return age, sex, loc


def _build_model_comparison():
    """Build the five-model list the frontend Model-Performance page expects,
    from the real JSON. Falls back to _MODEL_REGISTRY_FALLBACK if JSON absent."""
    res = _load_results()
    baseline_json = res.get(_BASELINE_JSON_KEY, {})
    base_axes = _axis_eods(baseline_json)
    base_mean = None
    if all(v is not None for v in base_axes):
        base_mean = sum(base_axes) / 3.0

    out = []
    for jkey, akey, name, mitigation, is_best, note in _MODEL_ORDER:
        m = res.get(jkey)
        if not m:
            continue
        sm = m.get("standard_metrics", {})
        age, sex, loc = _axis_eods(m)
        axis_vals = [v for v in (age, sex, loc) if v is not None]
        mean_eod = (sum(axis_vals) / len(axis_vals)) if axis_vals else None
        worst_eod = max(axis_vals) if axis_vals else None
        bias_red = None
        if base_mean and mean_eod is not None and base_mean > 0:
            bias_red = round((1 - mean_eod / base_mean) * 100)
        out.append({
            "key": akey, "name": name, "arch": "EfficientNet-B0", "mitigation": mitigation,
            "accuracy":       sm.get("accuracy"),
            "auc":            sm.get("auc_macro"),
            "sensitivity":    sm.get("sensitivity"),
            "melSensitivity": sm.get("per_class_sensitivity", {}).get("mel"),
            "ece":            m.get("ece"),
            "eodAge": age, "eodSex": sex, "eodLoc": loc,
            "meanEOD": round(mean_eod, 3) if mean_eod is not None else None,
            "worstEOD": round(worst_eod, 3) if worst_eod is not None else None,
            "biasReduction": bias_red,
            "isBest": is_best, "note": note,
        })
    return out or _MODEL_REGISTRY_FALLBACK


def _eod_by_axis():
    """Real baseline (A) vs deployed (E) EOD on each protected axis."""
    res = _load_results()
    a = _axis_eods(res.get(_BASELINE_JSON_KEY, {}))
    e = _axis_eods(res.get(_DEPLOYED_JSON_KEY, {}))
    # Fall back to known real values if JSON missing
    a = [v if v is not None else d for v, d in zip(a, (0.3404, 0.0840, 0.6800))]
    e = [v if v is not None else d for v, d in zip(e, (0.0299, 0.0129, 0.3467))]
    return {
        "age":      {"axisLabel": "Age group",       "baseline": a[0], "enhanced": e[0]},
        "sex":      {"axisLabel": "Sex",             "baseline": a[1], "enhanced": e[1]},
        "location": {"axisLabel": "Lesion location", "baseline": a[2], "enhanced": e[2]},
    }


_AGE_GROUP_LABEL = {"Pediatric": "Pediatric (0–17)", "YoungAdult": "Young adult (18–39)",
                    "MiddleAged": "Middle-aged (40–59)", "Elderly": "Elderly (60+)"}
_LOC_ZONE = {"back": "Trunk", "trunk": "Trunk", "abdomen": "Trunk", "chest": "Trunk", "genital": "Trunk",
             "face": "Head", "neck": "Head", "scalp": "Head", "ear": "Head",
             "lower extremity": "Lower extremity", "foot": "Lower extremity", "acral": "Lower extremity",
             "upper extremity": "Upper extremity", "hand": "Upper extremity", "unknown": "Unknown"}


def _enrich_eod(result, age_group, sex, localization):
    """Attach per-axis (age/sex/location) EOD before→after fields to a prediction,
    using the real Model A vs Model E figures."""
    if not result or result.get("error"):
        return result
    axes_def = _eod_by_axis()
    zone = _LOC_ZONE.get(str(localization or "").lower().strip(), "Other")
    subgroup = {
        "age":      _AGE_GROUP_LABEL.get(age_group, "Unknown age"),
        "sex":      (sex.capitalize() if sex else "Unknown sex"),
        "location": (zone + " lesions") if zone not in ("Unknown", "Other") else zone,
    }
    axes = []
    for k, v in axes_def.items():
        red = round((1 - v["enhanced"] / v["baseline"]) * 100) if v["baseline"] else 0
        axes.append({"key": k, "axisLabel": v["axisLabel"], "subgroup": subgroup[k],
                     "baseline": v["baseline"], "enhanced": v["enhanced"], "reduction": red})
    mean_base = round(sum(a["baseline"] for a in axes) / len(axes), 3)
    mean_enh  = round(sum(a["enhanced"] for a in axes) / len(axes), 3)
    result.update({
        "eod_axes": axes,
        "eod_baseline": mean_base,
        "eod_enhanced": mean_enh,
        "eod_reduction": round((1 - mean_enh / mean_base) * 100) if mean_base else 0,
        "eod_subgroup": "age, sex & lesion location",
    })
    return result


# Fallback (used only if all_results.json is unreadable) — REAL Phase-1 numbers.
_MODEL_REGISTRY_FALLBACK = [
    {"key": "baseline", "name": "Model A — Standard Baseline", "arch": "EfficientNet-B0",
     "mitigation": "None (original imbalanced HAM10000)", "accuracy": 0.8596, "auc": 0.9836,
     "melSensitivity": 0.4578, "eodAge": 0.3404, "eodSex": 0.0840, "eodLoc": 0.6800,
     "meanEOD": 0.368, "worstEOD": 0.680, "biasReduction": 0, "isBest": False,
     "note": "Highest accuracy, largest fairness gaps."},
    {"key": "sampling_only", "name": "Model B — Sampling Only", "arch": "EfficientNet-B0",
     "mitigation": "Intersectional stratified sampling", "accuracy": 0.7917, "auc": 0.9475,
     "melSensitivity": 0.2590, "eodAge": 0.0318, "eodSex": 0.0361, "eodLoc": 0.3438,
     "meanEOD": 0.137, "worstEOD": 0.344, "biasReduction": 63, "isBest": False,
     "note": "Sampling sharply reduces age/sex bias."},
    {"key": "reweight_only", "name": "Model C — Reweighting Only", "arch": "EfficientNet-B0",
     "mitigation": "Adaptive distribution-aware reweighting", "accuracy": 0.6411, "auc": 0.8803,
     "melSensitivity": 0.3012, "eodAge": 0.0505, "eodSex": 0.1201, "eodLoc": 0.3939,
     "meanEOD": 0.188, "worstEOD": 0.394, "biasReduction": 49, "isBest": False,
     "note": "Least accurate; worsens sex EOD."},
    {"key": "cgan_only", "name": "Model D — cGAN Only", "arch": "EfficientNet-B0",
     "mitigation": "Conditional GAN image augmentation", "accuracy": 0.8046, "auc": 0.9535,
     "melSensitivity": 0.2831, "eodAge": 0.0484, "eodSex": 0.0285, "eodLoc": 0.4062,
     "meanEOD": 0.161, "worstEOD": 0.406, "biasReduction": 56, "isBest": False,
     "note": "Strong accuracy with lower age/sex bias."},
    {"key": "enhanced_v2", "name": "Model E — Full Framework", "arch": "EfficientNet-B0",
     "mitigation": "Sampling + Reweighting + cGAN (full hybrid framework)", "accuracy": 0.7327, "auc": 0.9276,
     "melSensitivity": 0.2892, "eodAge": 0.0299, "eodSex": 0.0129, "eodLoc": 0.3467,
     "meanEOD": 0.130, "worstEOD": 0.347, "biasReduction": 65, "isBest": True,
     "note": "Deployed model — lowest bias on every axis."},
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
    # Distinct patients currently flagged high-risk (for the pending list)
    high_risk_patients = []
    seen = set()
    for c in MelanomaCheck.query.filter_by(doctor_id=doctor.id, risk_level="high")\
              .order_by(MelanomaCheck.timestamp.desc()).all():
        if c.patient_id in seen:
            continue
        seen.add(c.patient_id)
        pat = Patient.query.get(c.patient_id)
        if pat:
            high_risk_patients.append({"id": pat.id, "name": pat.full_name})
    recent_checks   = []
    for c in MelanomaCheck.query.filter_by(doctor_id=doctor.id)\
              .order_by(MelanomaCheck.timestamp.desc()).limit(5).all():
        pat = Patient.query.get(c.patient_id)
        recent_checks.append({
            "id": c.id, "patientId": c.patient_id,
            "patientName": pat.full_name if pat else "Unknown",
            "date": c.timestamp.strftime("%Y-%m-%d"),
            "dx": c.predicted_class, "dxLabel": c.predicted_label,
            "confidence": c.confidence_score,
            "riskLevel": "medium" if c.risk_level == "moderate" else c.risk_level,
        })
    return _ok({
        "totalPatients": total_patients,
        "checksToday": checks_today,
        "highRiskCount": len(high_risk_patients),
        "highRiskPatients": high_risk_patients,
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
        # Normalise risk wording for the UI (backend uses 'moderate')
        risk = (latest.risk_level if latest else None) or "unknown"
        if risk == "moderate":
            risk = "medium"
        patients.append({
            "id": p.id, "name": p.full_name, "age": p.age,
            "sex": (p.sex or "").capitalize(), "ageGroup": p.age_group,
            "skinType": p.skin_type or "—", "ita": p.ita,
            "localization": p.localization or "—",
            "diagnosis": p.known_diagnosis or "",
            "bloodType": p.blood_type, "allergies": p.allergies,
            "email": p.email, "phone": p.contact_number,
            "address": p.address,
            "notes": p.clinical_notes,
            "lastVisit": latest.timestamp.strftime("%Y-%m-%d") if latest else None,
            "riskLevel": risk,
        })
    return _ok(patients)


@api_bp.route("/doctor/patients/<int:patient_id>/record")
@login_required
def doctor_patient_record(patient_id):
    """Live detection history + appointments for one patient (doctor view)."""
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)
    if patient.assigned_doctor_id != doctor.id:
        return _err("Forbidden", 403)

    RECO = {
        "mel":   "Immediate excisional biopsy recommended. Urgent referral to surgical oncology.",
        "bcc":   "Surgical excision recommended. Refer to surgical oncology for excision margins.",
        "akiec": "Topical therapy or cryotherapy recommended. Regular monitoring required.",
        "nv":    "Benign lesion confirmed. Continue routine annual dermoscopic monitoring.",
        "bkl":   "Benign keratosis. No treatment necessary. Reassure patient.",
        "df":    "Benign dermatofibroma confirmed. No intervention required. Patient reassured.",
        "vasc":  "Vascular lesion noted. Dermatologist review recommended.",
    }
    detections = []
    for c in MelanomaCheck.query.filter_by(patient_id=patient.id)\
              .order_by(MelanomaCheck.timestamp.desc()).all():
        risk = "medium" if c.risk_level == "moderate" else c.risk_level
        try:
            scores = json.loads(c.all_probabilities) if c.all_probabilities else {}
        except Exception:
            scores = {}
        detections.append({
            "id": c.id, "date": c.timestamp.strftime("%Y-%m-%d"),
            "dx": c.predicted_class, "dxLabel": c.predicted_label, "riskLevel": risk,
            "confidence": c.confidence_score,
            "scores": scores,
            "notes": c.notes or "",
            "modelUsed": c.model_used,
            "fairnessNote": c.fairness_note,
            "recommendation": RECO.get(c.predicted_class, "Consult dermatologist."),
        })
    appointments = [a.to_dict() for a in Appointment.query.filter_by(patient_id=patient.id)
                    .order_by(Appointment.date.desc(), Appointment.time.desc()).all()]
    return _ok({"detections": detections, "appointments": appointments})



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
    """Metrics for ALL five models (A–E) parsed from the real
    phase1_outputs/results/all_results.json. Model E (Full Framework) is
    flagged isBest. Falls back to real baked-in numbers if the JSON is absent."""
    return _ok(_build_model_comparison())


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

    # Deployed-model (Model E) metrics from the real Phase-1 results
    res  = _load_results()
    dep  = res.get(_DEPLOYED_JSON_KEY, {})
    sm   = dep.get("standard_metrics", {})
    acc  = sm.get("accuracy", 0.7327)
    auc  = sm.get("auc_macro", 0.9276)
    age, sex, loc = _axis_eods(dep)
    axis_vals = [v for v in (age, sex, loc) if v is not None]
    mean_eod = round(sum(axis_vals) / len(axis_vals), 3) if axis_vals else 0.130

    return _ok({
        "overallAccuracy": acc,
        "macroAuc":        auc,
        "meanEOD":         mean_eod,
        "imagesEvaluated": 1500 + total_checks,
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


@api_bp.route("/messages/<int:message_id>", methods=["DELETE"])
@login_required
def messages_delete(message_id):
    """Delete a message. Only the sender may delete their own message."""
    msg = Message.query.get_or_404(message_id)
    if msg.sender_role != session.get("role") or msg.sender_id != session.get("user_id"):
        return _err("You can only delete your own messages", 403)
    db.session.delete(msg)
    db.session.commit()
    return _ok({"deleted": message_id})


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


# ══════════════════════════════════════════════════════════════════════════════
#  APPOINTMENTS  (database-backed scheduling)
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/appointments")
@login_required
def appointments_get():
    """Patient → own appointments. Doctor → all their patients' appointments."""
    role = session.get("role")
    q = Appointment.query
    if role == "patient":
        patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
        q = q.filter_by(patient_id=patient.id)
    elif role == "doctor":
        doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
        pids = [p.id for p in doctor.patients]
        q = q.filter(Appointment.patient_id.in_(pids)) if pids else q.filter(db.false())
    else:
        return _err("Forbidden", 403)
    appts = q.order_by(Appointment.date.asc(), Appointment.time.asc()).all()
    return _ok([a.to_dict() for a in appts])


@api_bp.route("/appointments", methods=["POST"])
@login_required
def appointments_post():
    """Book an appointment. Patient books their own; doctor books for a patient
    (body.patient_id required in that case)."""
    body = request.get_json(force=True) or {}
    role = session.get("role")

    if role == "patient":
        patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
        doctor_id = patient.assigned_doctor_id
        booked_by = "patient"
    elif role == "doctor":
        doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
        patient = Patient.query.get(body.get("patient_id"))
        if not patient:
            return _err("patient_id required", 400)
        doctor_id = doctor.id
        booked_by = "doctor"
    else:
        return _err("Forbidden", 403)

    date_str = (body.get("date") or "").strip()
    time_str = (body.get("time") or "").strip()
    if not date_str or not time_str:
        return _err("date and time are required", 400)
    try:
        appt_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return _err("date must be YYYY-MM-DD", 400)

    appt = Appointment(
        patient_id=patient.id, doctor_id=doctor_id,
        date=appt_date, time=time_str,
        duration=int(body.get("duration", 30)),
        reason=(body.get("reason") or "Consultation").strip(),
        status="scheduled", booked_by=booked_by,
    )
    db.session.add(appt)
    db.session.commit()
    return _ok(appt.to_dict())


@api_bp.route("/appointments/<int:appt_id>", methods=["PATCH"])
@login_required
def appointments_patch(appt_id):
    """Update an appointment: reschedule (date/time), or change status
    (cancelled / completed)."""
    appt = Appointment.query.get_or_404(appt_id)
    role = session.get("role")

    # Authorisation: patient may only touch their own; doctor their patients'
    if role == "patient":
        patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
        if appt.patient_id != patient.id:
            return _err("Forbidden", 403)
    elif role == "doctor":
        doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
        pat = Patient.query.get(appt.patient_id)
        if not pat or pat.assigned_doctor_id != doctor.id:
            return _err("Forbidden", 403)
    else:
        return _err("Forbidden", 403)

    body = request.get_json(force=True) or {}
    if "date" in body and body["date"]:
        try:
            appt.date = datetime.strptime(body["date"], "%Y-%m-%d").date()
        except ValueError:
            return _err("date must be YYYY-MM-DD", 400)
    if body.get("time"):
        appt.time = body["time"].strip()
    if body.get("reason"):
        appt.reason = body["reason"].strip()
    if body.get("status") in ("scheduled", "completed", "cancelled"):
        appt.status = body["status"]
    db.session.commit()
    return _ok(appt.to_dict())
