"""
===================================================================================
FYP - PHASE 2: HMS Backend
models/db_models.py  -  SQLAlchemy ORM models for all HMS database tables
TP070818 | Ramaneiss Pillai S Gopalan

TABLES:
    User            -> login credentials + role (patient / doctor)
    Patient         -> patient demographic + medical profile
    DoctorProfile   -> doctor specialization details
    MedicalHistory  -> clinical notes entered by doctors
    MelanomaCheck   -> melanoma AI prediction records
    Report          -> generated PDF reports
===================================================================================
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


# ══════════════════════════════════════════════════════════════════════════════
#  USER TABLE  (authentication + role)
# ══════════════════════════════════════════════════════════════════════════════
class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80),  unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role          = db.Column(db.String(10),  nullable=False)   # "patient" | "doctor"
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    is_active     = db.Column(db.Boolean, default=True)

    # Relationships
    patient_profile = db.relationship("Patient",       backref="user", uselist=False)
    doctor_profile  = db.relationship("DoctorProfile", backref="user", uselist=False)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username} [{self.role}]>"


# ══════════════════════════════════════════════════════════════════════════════
#  PATIENT TABLE
# ══════════════════════════════════════════════════════════════════════════════
class Patient(db.Model):
    __tablename__ = "patients"

    id                  = db.Column(db.Integer, primary_key=True)
    user_id             = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    full_name           = db.Column(db.String(120), nullable=False)
    date_of_birth       = db.Column(db.Date,        nullable=False)
    sex                 = db.Column(db.String(10),  nullable=False)   # "male" | "female"
    contact_number      = db.Column(db.String(20))
    address             = db.Column(db.Text)
    email               = db.Column(db.String(120))
    # Clinical / demographic profile shown in the HMS UI (nullable so older
    # databases keep working; populated by the seed and profile edits).
    skin_type           = db.Column(db.String(6))     # Fitzpatrick I–VI
    ita                 = db.Column(db.Integer)        # Individual Typology Angle (°)
    localization        = db.Column(db.String(40))     # primary lesion site
    blood_type          = db.Column(db.String(6))
    allergies           = db.Column(db.String(200))
    known_diagnosis     = db.Column(db.String(20))     # dx code, e.g. "mel"
    clinical_notes      = db.Column(db.Text)
    assigned_doctor_id  = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=True)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    # Computed helper: age group (used in fairness note on predictions)
    @property
    def age(self):
        if self.date_of_birth:
            today = datetime.today().date()
            dob   = self.date_of_birth
            return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return None

    @property
    def age_group(self):
        a = self.age
        if a is None:
            return "Unknown"
        if a < 18:
            return "Pediatric"
        elif a < 40:
            return "YoungAdult"
        elif a < 60:
            return "MiddleAged"
        return "Elderly"

    # Relationships
    melanoma_checks = db.relationship("MelanomaCheck", backref="patient", lazy="dynamic")
    medical_history = db.relationship("MedicalHistory", backref="patient", lazy="dynamic")
    reports         = db.relationship("Report", backref="patient", lazy="dynamic")

    def __repr__(self):
        return f"<Patient {self.full_name}>"


# ══════════════════════════════════════════════════════════════════════════════
#  DOCTOR PROFILE TABLE
# ══════════════════════════════════════════════════════════════════════════════
class DoctorProfile(db.Model):
    __tablename__ = "doctors"

    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    full_name        = db.Column(db.String(120), nullable=False)
    specialization   = db.Column(db.String(100), default="Dermatology")
    license_number   = db.Column(db.String(50),  unique=True, nullable=False)
    contact_number   = db.Column(db.String(20))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    patients         = db.relationship("Patient",       backref="assigned_doctor",
                                        foreign_keys=[Patient.assigned_doctor_id], lazy="dynamic")
    medical_records  = db.relationship("MedicalHistory", backref="created_by_doctor", lazy="dynamic")
    melanoma_checks  = db.relationship("MelanomaCheck",  backref="performed_by_doctor", lazy="dynamic")
    reports          = db.relationship("Report",          backref="generated_by_doctor", lazy="dynamic")

    def __repr__(self):
        return f"<Doctor {self.full_name}>"


# ══════════════════════════════════════════════════════════════════════════════
#  MEDICAL HISTORY TABLE
# ══════════════════════════════════════════════════════════════════════════════
class MedicalHistory(db.Model):
    __tablename__ = "medical_history"

    id              = db.Column(db.Integer, primary_key=True)
    patient_id      = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    doctor_id       = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    visit_date      = db.Column(db.Date,    nullable=False, default=datetime.utcnow().date)
    diagnosis       = db.Column(db.String(200))
    clinical_notes  = db.Column(db.Text)
    follow_up       = db.Column(db.Boolean, default=False)
    follow_up_date  = db.Column(db.Date,    nullable=True)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MedicalHistory patient={self.patient_id} date={self.visit_date}>"


# ══════════════════════════════════════════════════════════════════════════════
#  MELANOMA CHECK TABLE  (AI prediction records)
# ══════════════════════════════════════════════════════════════════════════════
class MelanomaCheck(db.Model):
    __tablename__ = "melanoma_checks"

    id                  = db.Column(db.Integer, primary_key=True)
    patient_id          = db.Column(db.Integer, db.ForeignKey("patients.id"),  nullable=False)
    doctor_id           = db.Column(db.Integer, db.ForeignKey("doctors.id"),   nullable=True)   # null = self-check

    # Image
    image_filename      = db.Column(db.String(200), nullable=False)
    image_path          = db.Column(db.String(500), nullable=False)

    # Prediction results
    model_used          = db.Column(db.String(30),  nullable=False)   # "baseline" | "enhanced_v2"
    predicted_class     = db.Column(db.String(10),  nullable=False)   # e.g. "mel"
    predicted_label     = db.Column(db.String(60),  nullable=False)   # e.g. "Melanoma"
    confidence_score    = db.Column(db.Float,        nullable=False)   # 0.0 - 1.0
    risk_level          = db.Column(db.String(10),   nullable=False)   # "low" | "moderate" | "high"

    # Full probability distribution (JSON string)
    all_probabilities   = db.Column(db.Text)   # JSON: {"mel": 0.82, "nv": 0.11, ...}

    # Fairness note
    fairness_note       = db.Column(db.Text)   # populated if patient is in underrepresented subgroup

    # Context
    performed_by        = db.Column(db.String(10), nullable=False)    # "patient" | "doctor"
    timestamp           = db.Column(db.DateTime, default=datetime.utcnow)
    notes               = db.Column(db.Text)   # optional doctor notes on this check

    def __repr__(self):
        return f"<MelanomaCheck patient={self.patient_id} model={self.model_used} pred={self.predicted_class}>"


# ══════════════════════════════════════════════════════════════════════════════
#  REPORT TABLE
# ══════════════════════════════════════════════════════════════════════════════
class Report(db.Model):
    __tablename__ = "reports"

    id              = db.Column(db.Integer, primary_key=True)
    patient_id      = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    doctor_id       = db.Column(db.Integer, db.ForeignKey("doctors.id"),  nullable=False)
    report_filename = db.Column(db.String(200), nullable=False)
    report_path     = db.Column(db.String(500), nullable=False)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Report patient={self.patient_id} file={self.report_filename}>"


# ══════════════════════════════════════════════════════════════════════════════
#  APPOINTMENT TABLE  (doctor ↔ patient scheduling)
# ══════════════════════════════════════════════════════════════════════════════
class Appointment(db.Model):
    __tablename__ = "appointments"

    id           = db.Column(db.Integer, primary_key=True)
    patient_id   = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id    = db.Column(db.Integer, db.ForeignKey("doctors.id"),  nullable=True)
    date         = db.Column(db.Date,   nullable=False)          # appointment day
    time         = db.Column(db.String(5), nullable=False)       # "HH:MM" 24h
    duration     = db.Column(db.Integer, default=30)             # minutes
    reason       = db.Column(db.String(120))
    status       = db.Column(db.String(12), default="scheduled") # scheduled|completed|cancelled
    booked_by    = db.Column(db.String(10), default="patient")   # patient|doctor
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        pat = Patient.query.get(self.patient_id) if self.patient_id else None
        return {
            "id":          "APT%03d" % self.id,
            "dbId":        self.id,
            "patientId":   self.patient_id,
            "patientName": pat.full_name if pat else "Unknown",
            "date":        self.date.strftime("%Y-%m-%d") if self.date else None,
            "time":        self.time,
            "duration":    self.duration,
            "reason":      self.reason,
            "status":      self.status,
        }

    def __repr__(self):
        return f"<Appointment patient={self.patient_id} {self.date} {self.time} [{self.status}]>"


# ══════════════════════════════════════════════════════════════════════════════
#  MESSAGE TABLE  (two-way doctor ↔ patient messaging)
# ══════════════════════════════════════════════════════════════════════════════
class Message(db.Model):
    __tablename__ = "messages"

    id          = db.Column(db.Integer, primary_key=True)
    # A conversation is identified by the patient it concerns.
    patient_id  = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id   = db.Column(db.Integer, db.ForeignKey("doctors.id"),  nullable=True)
    sender_role = db.Column(db.String(10), nullable=False)   # "patient" | "doctor"
    sender_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    body        = db.Column(db.Text, nullable=False)
    is_read     = db.Column(db.Boolean, default=False)        # read by the OTHER party
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id":   self.id,
            "conversationId": self.patient_id,
            "from": self.sender_role,
            "text": self.body,
            "ts":   int(self.timestamp.timestamp() * 1000) if self.timestamp else None,
            "isRead": self.is_read,
        }

    def __repr__(self):
        return f"<Message patient={self.patient_id} from={self.sender_role}>"
