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


@api_bp.route("/auth/register", methods=["POST"])
def register_doctor():
    """Self-service doctor registration. Creates a User(role=doctor) + a
    DoctorProfile, signs the new doctor in (sets the session), and returns the
    user object in the same shape as /api/auth/login."""
    import re as _re
    body = request.get_json(force=True) or {}
    full_name = str(body.get("fullName", "")).strip()
    email     = str(body.get("email", "")).strip()
    password  = str(body.get("password", "")).strip()
    if not full_name:
        return _err("Full name is required", 400)
    if not email:
        return _err("Email address is required", 400)
    if not password:
        return _err("Password is required", 400)

    if User.query.filter_by(email=email).first():
        return _err("An account with this email already exists", 409)

    # Derive a unique username from the name (e.g. "Dr. Sara Lee" -> dr_sara_lee)
    base = _re.sub(r"[^a-z0-9]+", "_",
                   full_name.lower().replace("'", "").replace("\u2019", "").replace(".", "")
                   ).strip("_") or "doctor"
    username = base
    n = 1
    while User.query.filter_by(username=username).first():
        n += 1
        username = f"{base}{n}"

    user = User(username=username, email=email, role="doctor")
    user.set_password(password)
    db.session.add(user)
    db.session.flush()   # get user.id

    doctor = DoctorProfile(
        user_id         = user.id,
        full_name       = full_name,
        specialization  = body.get("specialization") or "General",
        license_number  = body.get("licenseNumber") or f"DRM-{user.id:04d}",
        contact_number  = body.get("contactNumber"),
    )
    db.session.add(doctor)
    db.session.commit()

    # Sign the new doctor in
    session["user_id"] = user.id
    session["role"]    = "doctor"

    return _ok({
        "id": user.id, "username": username, "role": "doctor",
        "full_name": full_name, "specialization": doctor.specialization,
    }, message="Doctor registered")


@api_bp.route("/auth/register-patient", methods=["POST"])
def register_patient_selfservice():
    """Self-service patient registration for INDEPENDENT patients (no assigned
    doctor). Mirrors the doctor's Add-Patient fields, creates User(role=patient)
    + Patient with assigned_doctor_id=None, signs them in, and returns the
    profile. Password follows the name rule (e.g. 'Nadia Hassan' -> nadia.hassan123)."""
    import re as _re
    from datetime import datetime as _dt
    body = request.get_json(force=True) or {}
    name = str(body.get("name", "")).strip()
    if not name:
        return _err("Patient name is required", 400)
    try:
        age = int(body.get("age"))
    except (TypeError, ValueError):
        return _err("A valid age is required", 400)

    today = _dt.today().date()
    try:
        dob = today.replace(year=today.year - age)
    except ValueError:
        dob = today.replace(year=today.year - age, day=28)

    base = _re.sub(r"[^a-z0-9]+", "_",
                   name.lower().replace("'", "").replace("\u2019", "").replace(".", "")
                   ).strip("_") or "patient"
    username = base
    n = 1
    while User.query.filter_by(username=username).first():
        n += 1
        username = f"{base}{n}"

    email = str(body.get("email", "")).strip()
    if not email or User.query.filter_by(email=email).first():
        email = f"{username}@melanoscan.local"

    default_pw = _re.sub(r"[^a-z0-9]+", ".",
                         name.lower().replace("'", "").replace("\u2019", "").replace(".", "")
                         ).strip(".") + "123"

    user = User(username=username, email=email, role="patient")
    user.set_password(body.get("password") or default_pw)
    db.session.add(user)
    db.session.flush()

    patient = Patient(
        user_id           = user.id,
        full_name         = name,
        date_of_birth     = dob,
        sex               = str(body.get("sex", "")).lower() or "female",
        contact_number    = body.get("phone"),
        address           = body.get("address"),
        email             = email,
        skin_type         = body.get("skinType"),
        ita               = (int(body["ita"]) if str(body.get("ita", "")).lstrip("-").isdigit() else None),
        localization      = body.get("localization"),
        blood_type        = body.get("bloodType"),
        allergies         = body.get("allergies"),
        known_diagnosis   = body.get("diagnosis"),
        clinical_notes    = body.get("notes"),
        assigned_doctor_id = None,          # independent — no attending doctor
    )
    db.session.add(patient)
    db.session.commit()

    session["user_id"]  = user.id
    session["username"] = user.username
    session["role"]     = "patient"

    return _ok({
        "id": patient.id, "username": username, "role": "patient",
        "name": patient.full_name, "age": patient.age, "sex": patient.sex,
        "ageGroup": patient.age_group, "independent": True,
        "assignedDoctor": None,
    }, message="Patient registered")


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
#  Baseline = Model A (Standard Baseline); deployed = Model E (MelBoost 3.0).
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
    ("Model_E_melboost_3_0",      "enhanced_v2",   "Model E — MelBoost 3.0",
     "Sampling + Reweighting + cGAN + melanoma-sensitivity boosting", True,
     "The deployed hybrid data-centric framework tuned to maximise melanoma detection (MelBoost 3.0). Melanoma recall rises to 53% — the highest of any debiased model — while sex- and age-based bias stay well below the baseline."),
]

_BASELINE_JSON_KEY = "Model_A_Standard_Baseline"
_DEPLOYED_JSON_KEY = "Model_E_melboost_3_0"


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


BASELINE_KEY = "Model_A_Standard_Baseline"


def _worst_group_and_verdict(results, model_key, axis="age_group"):
    """Worst-group melanoma TPR + levelling-down verdict vs the baseline."""
    def tprs(k):
        d = results.get(k, {}).get("fairness", {}).get(axis, {}).get("TPR_per_group", {})
        return {g: v for g, v in d.items() if v is not None and not (isinstance(v, float) and v != v)}

    base, cand = tprs(BASELINE_KEY), tprs(model_key)
    if not cand or not base:
        return None, "unknown"

    groups    = [g for g in base if g in cand]
    worst_grp = min(groups, key=lambda g: cand[g])
    worst_tpr = cand[worst_grp]

    if model_key == BASELINE_KEY:
        return worst_tpr, "baseline"

    n_worse  = sum(1 for g in groups if cand[g] - base[g] < -0.01)
    n_better = sum(1 for g in groups if cand[g] - base[g] >  0.01)

    if n_worse == len(groups):
        verdict = "levelling_down"
    elif n_better > 0 and worst_tpr >= base[worst_grp]:
        verdict = "uplift"
    else:
        verdict = "mixed"
    return worst_tpr, verdict


def _best_group_tpr(results, model_key, axis="age_group"):
    """Best-group (ceiling) melanoma TPR on the same axis as the worst-group floor."""
    d = results.get(model_key, {}).get("fairness", {}).get(axis, {}).get("TPR_per_group", {})
    vals = [v for v in d.values() if v is not None and not (isinstance(v, float) and v != v)]
    return max(vals) if vals else None


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
        entry = {
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
        }
        worst_tpr, verdict = _worst_group_and_verdict(res, jkey)
        entry["worstGroupTPR"] = round(worst_tpr, 4) if worst_tpr is not None else None
        best_tpr = _best_group_tpr(res, jkey)
        entry["bestGroupTPR"] = round(best_tpr, 4) if best_tpr is not None else None
        entry["verdict"]       = verdict
        entry["melMissed"]     = round((1 - entry["melSensitivity"]) * 100) if entry["melSensitivity"] is not None else None
        out.append(entry)
    return out or _MODEL_REGISTRY_FALLBACK


def _eod_by_axis():
    """Real baseline (A) vs deployed (E) EOD on each protected axis."""
    res = _load_results()
    a = _axis_eods(res.get(_BASELINE_JSON_KEY, {}))
    e = _axis_eods(res.get(_DEPLOYED_JSON_KEY, {}))
    # Fall back to known real values if JSON missing
    a = [v if v is not None else d for v, d in zip(a, (0.2237, 0.1541, 0.6800))]
    e = [v if v is not None else d for v, d in zip(e, (0.1154, 0.0273, 0.5938))]
    return {
        "age":      {"axisLabel": "Age group",       "baseline": a[0], "enhanced": e[0]},
        "sex":      {"axisLabel": "Sex",             "baseline": a[1], "enhanced": e[1]},
        "location": {"axisLabel": "Lesion location", "baseline": a[2], "enhanced": e[2]},
    }


_AGE_GROUP_LABEL = {"Pediatric": "Pediatric (0–17)", "YoungAdult": "Young adult (18–39)",
                    "MiddleAged": "Middle-aged (40–59)", "Elderly": "Elderly (60+)"}


def _age_group_for(age):
    """Bucket a numeric age into the app's age-group key."""
    try:
        a = int(age)
    except (TypeError, ValueError):
        return None
    if a < 18:
        return "Pediatric"
    if a < 40:
        return "YoungAdult"
    if a < 60:
        return "MiddleAged"
    return "Elderly"

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
     "mitigation": "None (original imbalanced HAM10000)", "accuracy": 0.8609, "auc": 0.9818,
     "melSensitivity": 0.3916, "eodAge": 0.2237, "eodSex": 0.1541, "eodLoc": 0.6800,
     "meanEOD": 0.353, "worstEOD": 0.680, "biasReduction": 0, "isBest": False,
     "worstGroupTPR": 0.3148, "bestGroupTPR": 0.5385, "verdict": "baseline", "melMissed": 61,
     "note": "No bias mitigation. Highest raw accuracy, but misses 61 of every 100 melanomas."},
    {"key": "sampling_only", "name": "Model B — Sampling Only", "arch": "EfficientNet-B0",
     "mitigation": "Intersectional stratified sampling", "accuracy": 0.7890, "auc": 0.9492,
     "melSensitivity": 0.2651, "eodAge": 0.0419, "eodSex": 0.0499, "eodLoc": 0.3438,
     "meanEOD": 0.145, "worstEOD": 0.344, "biasReduction": 59, "isBest": False,
     "worstGroupTPR": 0.2308, "bestGroupTPR": 0.2727, "verdict": "levelling_down", "melMissed": 73,
     "note": "Low EOD achieved by degrading melanoma detection below baseline for every group."},
    {"key": "reweight_only", "name": "Model C — Reweighting Only", "arch": "EfficientNet-B0",
     "mitigation": "Adaptive distribution-aware reweighting", "accuracy": 0.6533, "auc": 0.8899,
     "melSensitivity": 0.2771, "eodAge": 0.0670, "eodSex": 0.0830, "eodLoc": 0.3200,
     "meanEOD": 0.157, "worstEOD": 0.320, "biasReduction": 56, "isBest": False,
     "worstGroupTPR": 0.2407, "bestGroupTPR": 0.3077, "verdict": "levelling_down", "melMissed": 72,
     "note": "Low EOD achieved by degrading melanoma detection below baseline for every group."},
    {"key": "cgan_only", "name": "Model D — cGAN Only", "arch": "EfficientNet-B0",
     "mitigation": "Conditional GAN image augmentation", "accuracy": 0.8053, "auc": 0.9536,
     "melSensitivity": 0.2831, "eodAge": 0.0621, "eodSex": 0.0285, "eodLoc": 0.3750,
     "meanEOD": 0.155, "worstEOD": 0.375, "biasReduction": 56, "isBest": False,
     "worstGroupTPR": 0.2308, "bestGroupTPR": 0.2929, "verdict": "levelling_down", "melMissed": 72,
     "note": "Low EOD achieved by degrading melanoma detection below baseline for every group."},
    {"key": "enhanced_v2", "name": "Model E — MelBoost 3.0", "arch": "EfficientNet-B0",
     "mitigation": "Sampling + Reweighting + cGAN + melanoma-sensitivity boosting", "accuracy": 0.7327, "auc": 0.9324,
     "melSensitivity": 0.5301, "eodAge": 0.1154, "eodSex": 0.0273, "eodLoc": 0.5938,
     "meanEOD": 0.246, "worstEOD": 0.594, "biasReduction": 30, "isBest": True,
     "worstGroupTPR": 0.5000, "bestGroupTPR": 0.6154, "verdict": "uplift", "melMissed": 47,
     "note": "The only model where every demographic group improves over the baseline. Detects 53% of melanomas vs 39% baseline, while cutting age and sex bias."},
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
                "independent": pat.assigned_doctor_id is None,
                "patientDbId": pat.id,
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
                localization     = localization,
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
            localization=localization,
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
        localization=localization,
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
    # Scope by the doctor's patients (not doctor_id) so patient self-scans —
    # which are recorded with no doctor_id — are included too, matching the
    # analytics scan feed.
    pat_ids = [p.id for p in doctor.patients]
    base_q  = MelanomaCheck.query.filter(MelanomaCheck.patient_id.in_(pat_ids)) if pat_ids \
              else MelanomaCheck.query.filter(db.false())
    checks_today    = base_q.filter(db.func.date(MelanomaCheck.timestamp) == today).count()
    high_risk_count = base_q.filter_by(risk_level="high").count()
    # Distinct patients currently flagged high-risk (for the pending list)
    high_risk_patients = []
    seen = set()
    for c in base_q.filter_by(risk_level="high")\
              .order_by(MelanomaCheck.timestamp.desc()).all():
        if c.patient_id in seen:
            continue
        seen.add(c.patient_id)
        pat = Patient.query.get(c.patient_id)
        if pat:
            high_risk_patients.append({"id": pat.id, "name": pat.full_name})
    recent_checks   = []
    for c in base_q.order_by(MelanomaCheck.timestamp.desc()).limit(5).all():
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


@api_bp.route("/doctor/patients", methods=["POST"])
@login_required
def doctor_add_patient():
    """Register a new patient (doctor-initiated) and assign to this doctor.
    New patients carry no melanoma checks, so their UI risk starts at 'low';
    subsequent analyses update it. Creates the backing User + Patient rows."""
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    body   = request.get_json(force=True) or {}

    name = str(body.get("name", "")).strip()
    if not name:
        return _err("Patient name is required", 400)

    # Derive date_of_birth from age (preserve today's month/day)
    today = datetime.today().date()
    try:
        age = int(body.get("age"))
    except (TypeError, ValueError):
        return _err("A valid age is required", 400)
    try:
        dob = today.replace(year=today.year - age)
    except ValueError:
        dob = today.replace(year=today.year - age, day=28)

    # Unique username/email for the auth row
    base = "".join(ch for ch in name.lower().replace(" ", ".") if ch.isalnum() or ch == ".")
    username = base or "patient"
    n = 1
    while User.query.filter_by(username=username).first():
        n += 1
        username = f"{base}{n}"
    email = str(body.get("email", "")).strip()
    if not email or User.query.filter_by(email=email).first():
        email = f"{username}@melanoscan.local"

    user = User(username=username, email=email, role="patient")
    # Password derived from the patient's name: dot-separated words + '123'
    # (e.g. 'Ahmed Al-Rashid' -> 'ahmed.al.rashid123'), matching the seed rule.
    import re as _re
    default_pw = _re.sub(r"[^a-z0-9]+", ".",
                         name.lower().replace("'", "").replace("\u2019", "").replace(".", "")
                         ).strip(".") + "123"
    user.set_password(body.get("password") or default_pw)
    db.session.add(user)
    db.session.flush()   # get user.id

    patient = Patient(
        user_id           = user.id,
        full_name         = name,
        date_of_birth     = dob,
        sex               = str(body.get("sex", "")).lower() or "female",
        contact_number    = body.get("phone"),
        address           = body.get("address"),
        email             = email,
        skin_type         = body.get("skinType"),
        ita               = (int(body["ita"]) if str(body.get("ita", "")).lstrip("-").isdigit() else None),
        localization      = body.get("localization"),
        blood_type        = body.get("bloodType"),
        allergies         = body.get("allergies"),
        known_diagnosis   = body.get("diagnosis"),
        clinical_notes    = body.get("notes"),
        assigned_doctor_id = doctor.id,
    )
    db.session.add(patient)
    db.session.commit()

    return _ok({
        "id": patient.id, "name": patient.full_name, "age": patient.age,
        "sex": (patient.sex or "").capitalize(), "ageGroup": patient.age_group,
        "skinType": patient.skin_type or "—", "ita": patient.ita,
        "localization": patient.localization or "—",
        "diagnosis": patient.known_diagnosis or "",
        "bloodType": patient.blood_type, "allergies": patient.allergies,
        "email": patient.email, "phone": patient.contact_number,
        "address": patient.address, "notes": patient.clinical_notes,
        "lastVisit": None, "riskLevel": "low",
    }, message="Patient registered")


@api_bp.route("/doctor/patients/<int:patient_id>", methods=["DELETE"])
@login_required
def doctor_delete_patient(patient_id):
    """Remove a patient (and their dependent rows) from this doctor's roster."""
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor  = DoctorProfile.query.filter_by(user_id=session["user_id"]).first_or_404()
    patient = Patient.query.get_or_404(patient_id)
    if patient.assigned_doctor_id != doctor.id:
        return _err("Forbidden", 403)
    # Clear dependent records first (no cascade defined on the relationships)
    MelanomaCheck.query.filter_by(patient_id=patient.id).delete()
    MedicalHistory.query.filter_by(patient_id=patient.id).delete()
    Report.query.filter_by(patient_id=patient.id).delete()
    Appointment.query.filter_by(patient_id=patient.id).delete()
    Message.query.filter_by(patient_id=patient.id).delete()
    user = User.query.get(patient.user_id)
    db.session.delete(patient)
    if user:
        db.session.delete(user)
    db.session.commit()
    return _ok({"id": patient_id}, message="Patient deleted")


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
    # Risk derived from the latest melanoma check (same rule the doctor sees)
    latest  = MelanomaCheck.query.filter_by(patient_id=patient.id)\
                .order_by(MelanomaCheck.timestamp.desc()).first()
    risk = (latest.risk_level if latest else None) or "low"
    if risk == "moderate":
        risk = "medium"
    return _ok({
        "id": patient.id, "name": patient.full_name,
        "dob": str(patient.date_of_birth), "age": patient.age,
        "ageGroup": patient.age_group, "sex": patient.sex,
        "contact": patient.contact_number, "address": patient.address,
        "email": getattr(patient, "email", None),
        "riskLevel": risk,
        "skinType": getattr(patient, "skin_type", None),
        "ita": getattr(patient, "ita", None),
        "bloodType": getattr(patient, "blood_type", None),
        "allergies": getattr(patient, "allergies", None),
        "localization": getattr(patient, "localization", None),
        "diagnosis": getattr(patient, "known_diagnosis", None),
        "assignedDoctor": doc.full_name if doc else None,
    })


@api_bp.route("/patient/profile", methods=["PATCH"])
@login_required
def patient_update_profile():
    if session.get("role") != "patient":
        return _err("Forbidden", 403)
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()
    body    = request.get_json(force=True) or {}
    if "name" in body and str(body["name"]).strip():
        patient.full_name = str(body["name"]).strip()
    if "age" in body and body["age"] not in (None, ""):
        try:
            new_age = int(body["age"])
            today   = datetime.today().date()
            dob     = patient.date_of_birth
            # Preserve month/day; shift birth year so the computed age matches.
            if dob is None:
                dob = today
            has_had_bday = (today.month, today.day) >= (dob.month, dob.day)
            birth_year = today.year - new_age - (0 if has_had_bday else 1)
            try:
                patient.date_of_birth = dob.replace(year=birth_year)
            except ValueError:
                # Feb 29 → non-leap year: fall back to Feb 28
                patient.date_of_birth = dob.replace(year=birth_year, day=28)
        except (TypeError, ValueError):
            pass
    if "sex" in body and body["sex"]:
        patient.sex = str(body["sex"]).lower()
    if "contact" in body:
        patient.contact_number = body["contact"]
    if hasattr(patient, "email") and "email" in body:
        patient.email = body["email"]
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
    _RECO = {
        "mel": "Immediate excisional biopsy recommended. Urgent referral to surgical oncology.",
        "bcc": "Surgical excision recommended. Consult with your dermatologist.",
        "akiec": "Topical treatment or cryotherapy may be required. Book a follow-up.",
        "nv": "Benign lesion detected. Continue annual dermoscopic monitoring.",
        "bkl": "Benign keratosis detected. No immediate treatment required.",
        "df": "Benign lesion confirmed. No intervention required.",
        "vasc": "Vascular lesion noted. Dermatologist review recommended.",
    }
    for c in MelanomaCheck.query.filter_by(patient_id=patient.id)\
              .order_by(MelanomaCheck.timestamp.desc()).all():
        probs = json.loads(c.all_probabilities) if c.all_probabilities else {}
        checks.append({
            "id": c.id, "date": c.timestamp.strftime("%Y-%m-%d"),
            "dx": c.predicted_class, "dxLabel": c.predicted_label,
            "confidence": c.confidence_score,
            "riskLevel": "medium" if c.risk_level == "moderate" else c.risk_level,
            "scores": probs, "fairnessNote": c.fairness_note,
            "localization": getattr(c, "localization", None),
            "recommendation": _RECO.get(c.predicted_class, "Consult your dermatologist."),
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
    phase1_outputs/results/all_results.json. Model E (MelBoost 3.0) is
    flagged isBest. Falls back to real baked-in numbers if the JSON is absent."""
    return _ok(_build_model_comparison())


# External-validation Proof-of-Concept results (ISIC 2020). Served to the POC
# panel on the Model Performance page. Reads the real Phase-4 output if present
# (external_validation/poc_isic2020.json), else returns the baked-in real numbers.
_POC_ISIC2020 = {
    "dataset": "ISIC 2020 Challenge",
    "rawTotal": 33126, "evalTotal": 3584, "evalMelanoma": 584, "evalBenign": 3000,
    "recovered": 150,
    "sensitivity":  {"baseline": 0.1353, "enhanced": 0.3767, "delta": 0.2414},
    "missedPer100": {"baseline": 86, "enhanced": 62},
    "fairness": [
        {"axis": "Age group",       "baselineWorst": 0.0845, "baselineWorstGroup": "Young adult",     "baselineEOD": 0.0832,
         "baselineBest": 0.1677, "baselineBestGroup": "Elderly",
         "enhancedWorst": 0.2821, "enhancedWorstGroup": "Middle-aged",    "enhancedEOD": 0.1578,
         "enhancedBest": 0.4399, "enhancedBestGroup": "Elderly", "worstDelta": 0.1976, "verdict": "uplift"},
        {"axis": "Sex",             "baselineWorst": 0.1136, "baselineWorstGroup": "Female",          "baselineEOD": 0.0347,
         "baselineBest": 0.1483, "baselineBestGroup": "Male",
         "enhancedWorst": 0.3545, "enhancedWorstGroup": "Female",         "enhancedEOD": 0.0356,
         "enhancedBest": 0.3901, "enhancedBestGroup": "Male", "worstDelta": 0.2409, "verdict": "uplift"},
        {"axis": "Lesion location", "baselineWorst": 0.0721, "baselineWorstGroup": "Upper extremity", "baselineEOD": 0.0888,
         "baselineBest": 0.1609, "baselineBestGroup": "Trunk",
         "enhancedWorst": 0.2432, "enhancedWorstGroup": "Head",           "enhancedEOD": 0.2280,
         "enhancedBest": 0.4713, "enhancedBestGroup": "Trunk", "worstDelta": 0.1711, "verdict": "uplift"},
    ],
    "cases": [
        {"id": "ISIC_5046082", "age": "Middle-aged", "sex": "Male",   "loc": "Trunk",           "probA": 0.004, "probE": 0.935, "predA": "Melanocytic Nevi"},
        {"id": "ISIC_3319229", "age": "Middle-aged", "sex": "Female", "loc": "Trunk",           "probA": 0.077, "probE": 0.914, "predA": "Benign Keratosis"},
        {"id": "ISIC_7897925", "age": "Middle-aged", "sex": "Male",   "loc": "Upper extremity", "probA": 0.001, "probE": 0.838, "predA": "Melanocytic Nevi"},
        {"id": "ISIC_7295035", "age": "Young adult", "sex": "Male",   "loc": "Trunk",           "probA": 0.013, "probE": 0.840, "predA": "Melanocytic Nevi"},
        {"id": "ISIC_7536704", "age": "Elderly",     "sex": "Male",   "loc": "Trunk",           "probA": 0.191, "probE": 0.989, "predA": "Benign Keratosis"},
        {"id": "ISIC_3696488", "age": "Elderly",     "sex": "Female", "loc": "Upper extremity", "probA": 0.113, "probE": 0.906, "predA": "Melanocytic Nevi"},
    ],
}


@api_bp.route("/models/external-validation")
@login_required
def models_external_validation():
    """Proof-of-Concept external validation on the ISIC 2020 dataset — evidence
    the framework generalises beyond its HAM10000 training split. Reads the real
    Phase-4 JSON if present, else returns the baked-in real numbers."""
    results_path = current_app.config.get("RESULTS_JSON_PATH", "")
    base_dir = os.path.dirname(os.path.dirname(results_path)) if results_path else "."
    for rel in ("external_validation/poc_isic2020.json",
                "results/poc_isic2020.json",
                "poc_isic2020.json"):
        path = os.path.join(base_dir, rel)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return _ok(json.load(f))
            except Exception:
                break
    return _ok(_POC_ISIC2020)


# ══════════════════════════════════════════════════════════════════════════════
#  LIVE ANALYTICS KPIs  (polled by the Analytics dashboard for real-time updates)
# ══════════════════════════════════════════════════════════════════════════════

@api_bp.route("/doctor/analytics-live")
@login_required
def doctor_analytics_live():
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first()
    patients = list(doctor.patients) if doctor else []
    patient_ids = [p.id for p in patients]

    # Total melanoma checks performed across this doctor's patients
    checks = (MelanomaCheck.query.filter(MelanomaCheck.patient_id.in_(patient_ids)).all()
              if patient_ids else [])
    total_checks = len(checks)

    # Deployed-model (Model E) metrics from the real Phase-1 results
    res  = _load_results()
    dep  = res.get(_DEPLOYED_JSON_KEY, {})
    sm   = dep.get("standard_metrics", {})
    acc  = sm.get("accuracy", 0.7327)
    auc  = sm.get("auc_macro", 0.9324)
    age, sex, loc = _axis_eods(dep)
    axis_vals = [v for v in (age, sex, loc) if v is not None]
    mean_eod = round(sum(axis_vals) / len(axis_vals), 3) if axis_vals else 0.246

    # ── Class distribution of ANALYSES performed (grows as scans are done) ──
    DX_KEYS  = ["nv", "mel", "bkl", "bcc", "akiec", "vasc", "df"]
    DX_LABEL = {"nv": "Nevi (nv)", "mel": "Melanoma (mel)", "bkl": "BKL", "bcc": "BCC",
                "akiec": "AKIEC", "vasc": "VASC", "df": "DF"}
    dx_counts = {k: 0 for k in DX_KEYS}
    # ── Lesion-location distribution of ANALYSES ──
    loc_counts = {}
    # ── Analyses per month ──
    month_counts = {}
    # Map patient_id → localization (lives on Patient, not MelanomaCheck)
    ploc = {p.id: (p.localization or "Unknown") for p in patients}
    for c in checks:
        if c.predicted_class in dx_counts:
            dx_counts[c.predicted_class] += 1
        lz = (getattr(c, "localization", None) or ploc.get(c.patient_id) or "Unknown").strip().title()
        loc_counts[lz] = loc_counts.get(lz, 0) + 1
        if c.timestamp:
            mk = c.timestamp.strftime("%Y-%m")
            month_counts[mk] = month_counts.get(mk, 0) + 1

    dx_distribution = [
        {"label": DX_LABEL[k], "value": dx_counts[k],
         "pct": (dx_counts[k] / total_checks) if total_checks else 0}
        for k in DX_KEYS
    ]
    location_distribution = [
        {"label": k, "value": v}
        for k, v in sorted(loc_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # Analyses-per-month as an ordered series (last 6 months present, chronological)
    MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    analyses_trend = [
        {"label": MON[int(mk.split("-")[1]) - 1], "value": month_counts[mk]}
        for mk in sorted(month_counts.keys())
    ]

    # ── Patient cohort: age distribution, sex, risk outcome ──
    age_bands = [("0–19", 0, 19), ("20–39", 20, 39), ("40–59", 40, 59),
                 ("60–79", 60, 79), ("80+", 80, 200)]
    age_dist = {b[0]: 0 for b in age_bands}
    sex_counts = {"Male": 0, "Female": 0, "Unknown": 0}
    for p in patients:
        a = p.age
        if a is not None:
            for label, lo, hi in age_bands:
                if lo <= a <= hi:
                    age_dist[label] += 1
                    break
        s = (p.sex or "").strip().lower()
        if s == "male":
            sex_counts["Male"] += 1
        elif s == "female":
            sex_counts["Female"] += 1
        else:
            sex_counts["Unknown"] += 1

    # Risk outcome = latest check's risk per patient (falls back to none)
    risk_counts = {"high": 0, "moderate": 0, "low": 0}
    for p in patients:
        latest = (MelanomaCheck.query.filter_by(patient_id=p.id)
                  .order_by(MelanomaCheck.timestamp.desc()).first())
        if latest and latest.risk_level in risk_counts:
            risk_counts[latest.risk_level] += 1

    age_distribution = [{"label": b[0], "value": age_dist[b[0]]} for b in age_bands]
    sex_distribution = [
        {"label": "Male",    "value": sex_counts["Male"],    "color": "#5B8DB8"},
        {"label": "Female",  "value": sex_counts["Female"],  "color": "#C77B6A"},
        {"label": "Unknown", "value": sex_counts["Unknown"], "color": "#B8B2AA"},
    ]
    risk_outcome = [
        {"label": "High risk",     "value": risk_counts["high"],     "color": "#C0453B"},
        {"label": "Moderate risk", "value": risk_counts["moderate"], "color": "#D9A441"},
        {"label": "Low risk",      "value": risk_counts["low"],      "color": "#3E7C5A"},
    ]

    return _ok({
        "overallAccuracy": acc,
        "macroAuc":        auc,
        "meanEOD":         mean_eod,
        "imagesEvaluated": total_checks,
        "totalPatients":   len(patients),
        "dxDistribution":       dx_distribution,
        "locationDistribution": location_distribution,
        "analysesTrend":        analyses_trend,
        "ageDistribution":      age_distribution,
        "sexDistribution":      sex_distribution,
        "riskOutcome":          risk_outcome,
    })


@api_bp.route("/doctor/analytics-facts")
@login_required
def doctor_analytics_facts():
    """Record-level scan FACTS for the OLAP analytics cube — one row per
    MelanomaCheck across this doctor's patients, with patient demographics
    joined in. Purely real recorded scans from the database."""
    if session.get("role") != "doctor":
        return _err("Forbidden", 403)
    doctor = DoctorProfile.query.filter_by(user_id=session["user_id"]).first()
    patients = {p.id: p for p in (doctor.patients if doctor else [])}
    if not patients:
        return _ok({"facts": []})

    MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    RISK = {"high": "High", "moderate": "Moderate", "low": "Low"}
    facts = []
    for c in (MelanomaCheck.query.filter(MelanomaCheck.patient_id.in_(list(patients.keys())))
              .order_by(MelanomaCheck.timestamp.desc()).all()):
        p = patients.get(c.patient_id)
        if not p:
            continue
        ts = c.timestamp
        loc_raw = getattr(c, "localization", None) or (p.localization or "unknown")
        location = str(loc_raw).strip().title() or "Unknown"
        facts.append({
            "id": c.id, "patientId": c.patient_id, "patientName": p.full_name,
            "date": ts.strftime("%Y-%m-%d") if ts else "",
            "ts": int(ts.timestamp() * 1000) if ts else 0,
            "month": ts.strftime("%Y-%m") if ts else "",
            "monthLabel": (MON[ts.month - 1] + " " + str(ts.year)[2:]) if ts else "",
            "ageGroup": _AGE_GROUP_LABEL.get(p.age_group, "Unknown age"),
            "sex": (p.sex or "").capitalize() or "Unknown",
            "location": location,
            "dx": c.predicted_label or c.predicted_class,
            "dxCode": c.predicted_class,
            "risk": RISK.get(c.risk_level, "Low"),
            "confidence": c.confidence_score or 0,
            "live": False,
        })
    return _ok({"facts": facts})


@api_bp.route("/patient/analytics-facts")
@login_required
def patient_analytics_facts():
    """Record-level scan FACTS for the patient's own OLAP dashboard — one row
    per MelanomaCheck belonging to the logged-in patient. Real recorded scans."""
    if session.get("role") != "patient":
        return _err("Forbidden", 403)
    patient = Patient.query.filter_by(user_id=session["user_id"]).first_or_404()

    MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    RISK = {"high": "High", "moderate": "Moderate", "low": "Low"}
    facts = []
    for c in (MelanomaCheck.query.filter_by(patient_id=patient.id)
              .order_by(MelanomaCheck.timestamp.desc()).all()):
        ts = c.timestamp
        loc_raw = getattr(c, "localization", None) or (patient.localization or "unknown")
        location = str(loc_raw).strip().title() or "Unknown"
        facts.append({
            "id": c.id, "patientId": patient.id, "patientName": patient.full_name,
            "date": ts.strftime("%Y-%m-%d") if ts else "",
            "ts": int(ts.timestamp() * 1000) if ts else 0,
            "month": ts.strftime("%Y-%m") if ts else "",
            "monthLabel": (MON[ts.month - 1] + " " + str(ts.year)[2:]) if ts else "",
            "ageGroup": _AGE_GROUP_LABEL.get(patient.age_group, "Unknown age"),
            "sex": (patient.sex or "").capitalize() or "Unknown",
            "location": location,
            "dx": c.predicted_label or c.predicted_class,
            "dxCode": c.predicted_class,
            "risk": RISK.get(c.risk_level, "Low"),
            "confidence": c.confidence_score or 0,
            "live": False,
        })
    return _ok({"facts": facts})


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
    """Soft-delete a message (permanent tombstone). Only the sender may delete
    their own message; the row is kept so it renders 'This message has been
    deleted' and stops counting as unread."""
    msg = Message.query.get_or_404(message_id)
    if msg.sender_role != session.get("role") or msg.sender_id != session.get("user_id"):
        return _err("You can only delete your own messages", 403)
    msg.is_deleted = True
    msg.is_read    = True   # a deleted message must never linger as "unread"
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
        unread = sum(1 for m in msgs if m.sender_role == "patient" and not m.is_read and not m.is_deleted)
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
