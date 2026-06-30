"""
===================================================================================
FYP - HMS Backend + Frontend
app.py  -  Flask application entry point
TP070818 | Ramaneiss Pillai S Gopalan

HOW TO RUN:
    1. pip install flask flask-sqlalchemy werkzeug reportlab pillow
    2. python app.py --init-db   (first time only)
    3. python app.py
    4. Open: http://127.0.0.1:5000
===================================================================================
"""

import sys
import os
from datetime import date

from flask import Flask, redirect, send_from_directory
from models.db_models import db, User, Patient, DoctorProfile
from config import config


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(config)

    # ── CRITICAL: allow session cookies to be sent with fetch() POST requests ─
    # Without this, every API call after login arrives with an empty session,
    # causing @login_required to return 401 and the frontend to show "Failed to fetch"
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


def init_db(app):
    with app.app_context():
        db.create_all()
        print("[OK] Database tables created.")

        if User.query.count() > 0:
            print("[INFO] Already seeded. Skipping.")
            return

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

        pat_user = User(username="john_doe", email="john.doe@email.com", role="patient")
        pat_user.set_password("patient123")
        db.session.add(pat_user)
        db.session.flush()

        patient = Patient(
            user_id=pat_user.id, full_name="John Doe",
            date_of_birth=date(1985, 6, 15), sex="male",
            contact_number="+60-11-999-8888", assigned_doctor_id=doctor.id,
        )
        db.session.add(patient)
        db.session.flush()

        pat2_user = User(username="jane_smith", email="jane.smith@email.com", role="patient")
        pat2_user.set_password("patient123")
        db.session.add(pat2_user)
        db.session.flush()

        patient2 = Patient(
            user_id=pat2_user.id, full_name="Jane Smith",
            date_of_birth=date(1972, 3, 22), sex="female",
            contact_number="+60-11-777-5555", assigned_doctor_id=doctor.id,
        )
        db.session.add(patient2)
        db.session.commit()

        print("[OK] Seeded: dr_ramaneiss/doctor123 | john_doe/patient123 | jane_smith/patient123")


app = create_app()

if __name__ == "__main__":
    if "--init-db" in sys.argv:
        init_db(app)
    else:
        print("=" * 50)
        print("  MelanoScan HMS  |  TP070818")
        print("  Open: http://127.0.0.1:5000")
        print("  Doctor:  dr_ramaneiss / doctor123")
        print("  Patient: john_doe     / patient123")
        print("=" * 50)
        app.run(debug=True, host="0.0.0.0", port=5000)
