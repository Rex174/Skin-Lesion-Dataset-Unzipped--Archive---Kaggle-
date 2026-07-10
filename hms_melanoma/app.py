"""
===================================================================================
FYP - HMS Backend + Frontend
app.py  -  Flask application entry point
TP070818 | Ramaneiss Pillai S Gopalan

HOW TO RUN:
    1. pip install flask flask-sqlalchemy werkzeug reportlab pillow
    2. python app.py --init-db   (first time only — seeds doctor + 8 patients)
    3. python app.py
    4. Open: http://127.0.0.1:5000

NOTE: this seed inserts the 8 MelanoScan patients (Aisha Rahman … Ahmed
Al-Rashid) as real database records, each with a login account and an initial
melanoma-check, so the Dashboard and Patients page read live from the DB.
===================================================================================
"""

import sys
import os
import json
import re
from datetime import date, datetime

from flask import Flask, redirect, send_from_directory
from models.db_models import db, User, Patient, DoctorProfile, MelanomaCheck, Appointment
from config import config


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(config)

    # ── CRITICAL: allow session cookies to be sent with fetch() POST requests ─
    app.config["SESSION_COOKIE_SAMESITE"] = None
    app.config["SESSION_COOKIE_SECURE"]   = False  # False for HTTP localhost

    db.init_app(app)

    from routes.auth    import auth_bp
    from routes.patient import patient_bp
    from routes.doctor  import doctor_bp
    from routes.api     import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(patient_bp)
    app.register_blueprint(doctor_bp)
    app.register_blueprint(api_bp)

    os.makedirs(app.config["UPLOAD_FOLDER"],  exist_ok=True)
    os.makedirs(app.config["REPORTS_FOLDER"], exist_ok=True)

    @app.route("/hms")
    @app.route("/hms/")
    def serve_hms():
        return send_from_directory(app.static_folder, "HMS.html")

    @app.route("/")
    def root():
        return redirect("/hms")

    return app


# ── The 8 MelanoScan patients (mirrors the frontend cohort) ──────────────────
DX_LABELS = {
    "mel": "Melanoma", "nv": "Melanocytic Nevi", "bcc": "Basal Cell Carcinoma",
    "akiec": "Actinic Keratosis", "bkl": "Benign Keratosis",
    "df": "Dermatofibroma", "vasc": "Vascular Lesion",
}

# name, age, sex, skin_type, ita, localization, risk(high/moderate/low), dx,
# phone, email, blood, allergies, last_visit, confidence, notes, address
SEED_PATIENTS = [
    ("Aisha Rahman",   34, "female", "IV",  -15, "back",            "high",     "mel",   "+60 12-345 6789", "aisha.r@email.com",   "A+",  "Penicillin",   "2026-04-15", 0.87, "Recent growth in lesion size. Referred from GP. Urgent biopsy advised.", "12 Jalan Ampang, 50450 Kuala Lumpur"),
    ("Tom Hendricks",  67, "male",   "II",   42, "face",            "low",      "nv",    "+60 11-234 5678", "tom.h@email.com",     "O+",  "None",         "2026-04-10", 0.92, "Routine monitoring of multiple benign nevi. Fair skin, high sun exposure.", "8 Persiaran Gurney, 10250 Penang"),
    ("Maya Krishnan",  45, "female", "V",   -28, "upper extremity", "moderate", "bcc",   "+60 16-789 0123", "maya.k@email.com",    "B+",  "Sulfonamides", "2026-04-08", 0.79, "BCC on left forearm. Surgical excision scheduled next month.", "45 Lorong Ampang, 68000 Ampang, Selangor"),
    ("James O'Brien",  52, "male",   "I",    58, "scalp",           "moderate", "akiec", "+60 17-456 7890", "james.ob@email.com",  "AB-", "Aspirin",      "2026-04-05", 0.74, "Actinic keratosis on scalp. Extensive sun damage. Cryotherapy applied.", "3 Jalan Bukit Bintang, 55100 Kuala Lumpur"),
    ("Fatimah Idris",  28, "female", "VI",  -45, "trunk",           "high",     "mel",   "+60 13-567 8901", "fatimah.i@email.com", "O-",  "None",         "2026-04-18", 0.81, "Suspicious irregular lesion on trunk. High-risk result. Excisional biopsy pending.", "27 Jalan Tun Razak, 50400 Kuala Lumpur"),
    ("Lin Chen",       41, "male",   "III",  12, "lower extremity", "low",      "bkl",   "+60 14-678 9012", "lin.c@email.com",     "A-",  "Latex",        "2026-03-28", 0.88, "Seborrheic keratosis on lower leg. Reassured. Annual monitoring.", "19 Jalan SS2/24, 47300 Petaling Jaya, Selangor"),
    ("Sarah Pearce",   19, "female", "II",   38, "back",            "low",      "nv",    "+60 18-789 0123", "sarah.p@email.com",   "B-",  "None",         "2026-04-12", 0.90, "Dysplastic nevus on upper back. Annual dermoscopic follow-up.", "6 Jalan Damansara, 60000 Kuala Lumpur"),
    ("Ahmed Al-Rashid",58, "male",   "IV",   -8, "face",            "low",      "df",    "+60 19-890 1234", "ahmed.ar@email.com",  "O+",  "NSAIDs",       "2026-04-01", 0.83, "Dermatofibroma on left cheek confirmed. No treatment required.", "56 Damansara Heights, 50490 Kuala Lumpur"),
]


# patient_index, date, time, duration, reason, status
SEED_APPOINTMENTS = [
    (0, "2026-08-22", "09:00", 30, "Biopsy Follow-up",       "scheduled"),
    (4, "2026-08-22", "10:30", 45, "Biopsy Consultation",    "scheduled"),
    (1, "2026-08-23", "11:00", 20, "Routine Monitoring",     "scheduled"),
    (2, "2026-08-24", "14:00", 30, "Pre-surgery Consult",    "scheduled"),
    (3, "2026-04-21", "09:30", 30, "Treatment Review",       "completed"),
    (6, "2026-04-20", "15:00", 20, "Annual Check-up",        "completed"),
    (5, "2026-08-25", "09:00", 30, "New Lesion Assessment",  "scheduled"),
    (7, "2026-08-28", "13:00", 20, "6-Month Follow-up",      "scheduled"),
]


def _username(name: str) -> str:
    """Match the frontend rule: 'Aisha Rahman' -> 'aisha_rahman'."""
    u = name.lower().replace("'", "").replace("\u2019", "").replace(".", "")
    u = re.sub(r"[^a-z0-9]+", "_", u).strip("_")
    return u


def init_db(app):
    with app.app_context():
        db.create_all()
        print("[OK] Database tables created.")

        if User.query.count() > 0:
            print("[INFO] Database already seeded. Skipping.")
            print("       (Delete the .db file and re-run --init-db to reseed.)")
            return

        # ── Doctor ───────────────────────────────────────────────────────────
        doc_user = User(username="dr_ramaneiss", email="dr.ramaneiss@hms.com", role="doctor")
        doc_user.set_password("doctor123")
        db.session.add(doc_user)
        db.session.flush()

        doctor = DoctorProfile(
            user_id=doc_user.id, full_name="Dr. Ramaneiss",
            specialization="Dermatology", license_number="DRM-001-2024",
            contact_number="+60-12-345-6789",
        )
        db.session.add(doctor)
        db.session.flush()

        # ── 8 patients (login + profile + initial melanoma-check) ─────────────
        patient_ids = []
        for (name, age, sex, skin, ita, loc, risk, dx, phone, email,
             blood, allergies, last_visit, conf, notes, address) in SEED_PATIENTS:

            uname = _username(name)
            pu = User(username=uname, email=email, role="patient")
            pu.set_password("patient123")
            db.session.add(pu)
            db.session.flush()

            patient = Patient(
                user_id=pu.id, full_name=name,
                date_of_birth=date(date.today().year - age, 1, 1),
                sex=sex, contact_number=phone, email=email, address=address,
                skin_type=skin, ita=ita, localization=loc,
                blood_type=blood, allergies=allergies,
                known_diagnosis=dx, clinical_notes=notes,
                assigned_doctor_id=doctor.id,
            )
            db.session.add(patient)
            db.session.flush()

            # Seed one melanoma check so risk / last-visit / recent-analyses
            # populate live from the database.
            probs = {k: 0.02 for k in DX_LABELS}
            probs[dx] = round(conf, 4)
            chk = MelanomaCheck(
                patient_id=patient.id, doctor_id=doctor.id,
                image_filename="seed.jpg", image_path="static/uploads/seed.jpg",
                model_used="enhanced_v2", predicted_class=dx,
                predicted_label=DX_LABELS[dx], confidence_score=conf,
                risk_level=risk, all_probabilities=json.dumps(probs),
                fairness_note=None, performed_by="doctor",
                timestamp=datetime.strptime(last_visit, "%Y-%m-%d"),
            )
            db.session.add(chk)
            patient_ids.append(patient.id)

        # ── Appointments ─────────────────────────────────────────────────────
        for (pidx, date_str, time_str, dur, reason, status) in SEED_APPOINTMENTS:
            db.session.add(Appointment(
                patient_id=patient_ids[pidx], doctor_id=doctor.id,
                date=datetime.strptime(date_str, "%Y-%m-%d").date(),
                time=time_str, duration=dur, reason=reason,
                status=status, booked_by="patient",
            ))

        db.session.commit()
        names = ", ".join(_username(p[0]) for p in SEED_PATIENTS)
        print(f"[OK] Seeded doctor (dr_ramaneiss/doctor123) + {len(SEED_PATIENTS)} patients.")
        print(f"     Patient logins (password patient123): {names}")


app = create_app()

if __name__ == "__main__":
    if "--init-db" in sys.argv:
        init_db(app)
    else:
        print("=" * 54)
        print("  MelanoScan HMS  |  TP070818")
        print("  Open: http://127.0.0.1:5000")
        print("  Doctor:  dr_ramaneiss / doctor123")
        print("  Patient: aisha_rahman / patient123  (+ 7 more)")
        print("=" * 54)
        app.run(debug=True, host="0.0.0.0", port=5000)
