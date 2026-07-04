/**
 * hms_data.jsx  —  MelanoScan HMS
 * TP070818 | Ramaneiss Pillai S Gopalan
 *
 * Contains:
 *   1. All original mock data (PATIENTS, DETECTIONS, etc.) — used by dashboards
 *   2. API layer (AuthApi, DoctorApi, PatientApi) — used by melanoma checker
 *
 * Strategy: dashboards display rich mock demo data immediately.
 * The melanoma checker pages call the real Flask API for live predictions.
 */

/* ═══════════════════════════════════════════════════════════
   MOCK DATA  (used by all dashboard, patient, doctor views)
═══════════════════════════════════════════════════════════ */

const PATIENTS = [
  { id:'P001', name:'Aisha Rahman',     age:34, sex:'Female', skinType:'IV',  ita:-15, localization:'back',            lastVisit:'2026-04-15', riskLevel:'high',   diagnosis:'mel',   doctorId:'D001', phone:'+60 12-345 6789', email:'aisha.r@email.com',   address:'12 Jalan Ampang, Kuala Lumpur',     bloodType:'A+',  allergies:'Penicillin',   notes:'Patient reports recent growth in lesion size. Referred from GP. Urgent biopsy advised.' },
  { id:'P002', name:'Tom Hendricks',    age:67, sex:'Male',   skinType:'II',  ita: 42, localization:'face',            lastVisit:'2026-04-10', riskLevel:'low',    diagnosis:'nv',    doctorId:'D001', phone:'+60 11-234 5678', email:'tom.h@email.com',     address:'88 Persiaran Utama, Petaling Jaya', bloodType:'O+',  allergies:'None',         notes:'Routine monitoring of multiple benign nevi. Fair skin, high sun exposure history.' },
  { id:'P003', name:'Maya Krishnan',    age:45, sex:'Female', skinType:'V',   ita:-28, localization:'upper extremity', lastVisit:'2026-04-08', riskLevel:'medium', diagnosis:'bcc',   doctorId:'D001', phone:'+60 16-789 0123', email:'maya.k@email.com',    address:'5 Lorong Meru, Shah Alam',          bloodType:'B+',  allergies:'Sulfonamides', notes:'BCC detected on left forearm. Surgical excision scheduled for next month.' },
  { id:'P004', name:"James O'Brien",    age:52, sex:'Male',   skinType:'I',   ita: 58, localization:'scalp',           lastVisit:'2026-04-05', riskLevel:'medium', diagnosis:'akiec', doctorId:'D001', phone:'+60 17-456 7890', email:'james.ob@email.com',  address:'22 Taman Duta, Kuala Lumpur',       bloodType:'AB-', allergies:'Aspirin',      notes:'Actinic keratosis on scalp. Extensive sun damage history. Cryotherapy applied.' },
  { id:'P005', name:'Fatimah Idris',    age:28, sex:'Female', skinType:'VI',  ita:-45, localization:'trunk',           lastVisit:'2026-04-18', riskLevel:'high',   diagnosis:'mel',   doctorId:'D001', phone:'+60 13-567 8901', email:'fatimah.i@email.com', address:'99 Jalan Gombak, Kuala Lumpur',     bloodType:'O-',  allergies:'None',         notes:'Suspicious irregular lesion on trunk. High-risk detection result. Excisional biopsy pending.' },
  { id:'P006', name:'Lin Chen',         age:41, sex:'Male',   skinType:'III', ita: 12, localization:'lower extremity', lastVisit:'2026-03-28', riskLevel:'low',    diagnosis:'bkl',   doctorId:'D001', phone:'+60 14-678 9012', email:'lin.c@email.com',     address:'17 Subang Jaya, Selangor',          bloodType:'A-',  allergies:'Latex',        notes:'Seborrheic keratosis confirmed on lower leg. Patient reassured. Annual monitoring.' },
  { id:'P007', name:'Sarah Pearce',     age:19, sex:'Female', skinType:'II',  ita: 38, localization:'back',            lastVisit:'2026-04-12', riskLevel:'low',    diagnosis:'nv',    doctorId:'D001', phone:'+60 18-789 0123', email:'sarah.p@email.com',   address:'34 Bangsar, Kuala Lumpur',          bloodType:'B-',  allergies:'None',         notes:'Young patient with dysplastic nevus on upper back. Annual dermoscopic follow-up recommended.' },
  { id:'P008', name:'Ahmed Al-Rashid',  age:58, sex:'Male',   skinType:'IV',  ita: -8, localization:'face',            lastVisit:'2026-04-01', riskLevel:'low',    diagnosis:'df',    doctorId:'D001', phone:'+60 19-890 1234', email:'ahmed.ar@email.com',  address:'56 Damansara, Petaling Jaya',       bloodType:'O+',  allergies:'NSAIDs',       notes:'Dermatofibroma on left cheek confirmed via dermoscopy. No treatment required.' },
];

const DETECTIONS = [
  { id:'A001', patientId:'P001', date:'2026-04-15', dx:'mel',   dxLabel:'Melanoma',             confidence:0.87, riskLevel:'high',   recommendation:'Immediate excisional biopsy recommended. Urgent referral to surgical oncology.',         scores:{mel:0.87, nv:0.05, bcc:0.04, akiec:0.02, bkl:0.01, df:0.01, vasc:0.00} },
  { id:'A002', patientId:'P002', date:'2026-04-10', dx:'nv',    dxLabel:'Melanocytic Nevi',     confidence:0.92, riskLevel:'low',    recommendation:'Benign lesion confirmed. Continue routine annual dermoscopic monitoring.',                 scores:{mel:0.02, nv:0.92, bcc:0.02, akiec:0.01, bkl:0.02, df:0.01, vasc:0.00} },
  { id:'A003', patientId:'P003', date:'2026-04-08', dx:'bcc',   dxLabel:'Basal Cell Carcinoma', confidence:0.79, riskLevel:'medium', recommendation:'Surgical excision recommended. Refer to surgical oncology for excision margins.',         scores:{mel:0.08, nv:0.03, bcc:0.79, akiec:0.05, bkl:0.03, df:0.01, vasc:0.01} },
  { id:'A004', patientId:'P004', date:'2026-04-05', dx:'akiec', dxLabel:'Actinic Keratosis',    confidence:0.74, riskLevel:'medium', recommendation:'Topical 5-FU or cryotherapy recommended. Regular 6-month monitoring required.',          scores:{mel:0.10, nv:0.03, bcc:0.07, akiec:0.74, bkl:0.04, df:0.01, vasc:0.01} },
  { id:'A005', patientId:'P005', date:'2026-04-18', dx:'mel',   dxLabel:'Melanoma',             confidence:0.81, riskLevel:'high',   recommendation:'High-risk lesion detected. Urgent excisional biopsy required within 2 weeks.',           scores:{mel:0.81, nv:0.06, bcc:0.05, akiec:0.04, bkl:0.03, df:0.01, vasc:0.00} },
  { id:'A006', patientId:'P006', date:'2026-03-28', dx:'bkl',   dxLabel:'Benign Keratosis',     confidence:0.88, riskLevel:'low',    recommendation:'Benign seborrheic keratosis. No treatment necessary. Reassure patient.',                 scores:{mel:0.01, nv:0.04, bcc:0.02, akiec:0.03, bkl:0.88, df:0.01, vasc:0.01} },
  { id:'A007', patientId:'P007', date:'2026-04-12', dx:'nv',    dxLabel:'Melanocytic Nevi',     confidence:0.90, riskLevel:'low',    recommendation:'Dysplastic nevus. Annual dermoscopic follow-up. Advise sun protection measures.',        scores:{mel:0.04, nv:0.90, bcc:0.01, akiec:0.02, bkl:0.02, df:0.01, vasc:0.00} },
  { id:'A008', patientId:'P008', date:'2026-04-01', dx:'df',    dxLabel:'Dermatofibroma',       confidence:0.83, riskLevel:'low',    recommendation:'Benign dermatofibroma confirmed. No intervention required. Patient reassured.',         scores:{mel:0.02, nv:0.05, bcc:0.03, akiec:0.02, bkl:0.03, df:0.83, vasc:0.02} },
];

const APPOINTMENTS = [
  { id:'APT001', patientId:'P001', patientName:'Aisha Rahman',    date:'2026-04-22', time:'09:00', status:'scheduled', reason:'Biopsy Follow-up',      duration:30 },
  { id:'APT002', patientId:'P005', patientName:'Fatimah Idris',   date:'2026-04-22', time:'10:30', status:'scheduled', reason:'Biopsy Consultation',   duration:45 },
  { id:'APT003', patientId:'P002', patientName:'Tom Hendricks',   date:'2026-04-23', time:'11:00', status:'scheduled', reason:'Routine Monitoring',    duration:20 },
  { id:'APT004', patientId:'P003', patientName:'Maya Krishnan',   date:'2026-04-24', time:'14:00', status:'scheduled', reason:'Pre-surgery Consult',   duration:30 },
  { id:'APT005', patientId:'P004', patientName:"James O'Brien",   date:'2026-04-21', time:'09:30', status:'completed', reason:'Treatment Review',      duration:30 },
  { id:'APT006', patientId:'P007', patientName:'Sarah Pearce',    date:'2026-04-20', time:'15:00', status:'completed', reason:'Annual Check-up',       duration:20 },
  { id:'APT007', patientId:'P006', patientName:'Lin Chen',        date:'2026-04-25', time:'09:00', status:'scheduled', reason:'New Lesion Assessment', duration:30 },
  { id:'APT008', patientId:'P008', patientName:'Ahmed Al-Rashid', date:'2026-04-28', time:'13:00', status:'scheduled', reason:'6-Month Follow-up',     duration:20 },
];

const NOTIFICATIONS_DOCTOR = [
  { id:'ND1', type:'alert',       title:'High-risk result flagged',  message:"Fatimah Idris's analysis returned high-risk melanoma (81% confidence). Immediate action required.", time:'10 min ago', read:false },
  { id:'ND2', type:'appointment', title:'Upcoming appointment',      message:'Aisha Rahman — Biopsy Follow-up at 09:00 tomorrow (Apr 22).',                                       time:'1 hour ago',  read:false },
  { id:'ND3', type:'info',        title:'New patient registered',    message:'Sarah Pearce has been added to your patient list.',                                                  time:'3 hours ago', read:true  },
  { id:'ND4', type:'appointment', title:'Appointment completed',     message:"James O'Brien's appointment marked as completed.",                                                   time:'5 hours ago', read:true  },
  { id:'ND5', type:'alert',       title:'Analysis complete',         message:"Aisha Rahman's melanoma detection analysis is ready for review.",                                    time:'1 day ago',   read:true  },
  { id:'ND6', type:'info',        title:'Analytics report updated',  message:'Monthly fairness metrics report for April 2026 is now available.',                                  time:'2 days ago',  read:true  },
];

const NOTIFICATIONS_PATIENT = [
  { id:'NP1', type:'appointment', title:'Appointment confirmed',       message:'Your appointment with Dr. Ramaneiss is confirmed for April 22 at 09:00.', time:'2 hours ago', read:false },
  { id:'NP2', type:'alert',       title:'Detection results available', message:'Your melanoma screening results from April 15 are now available for review.', time:'1 day ago', read:false },
  { id:'NP3', type:'info',        title:'Reminder: Sun protection',    message:'Your doctor recommends regular use of SPF 50+ sunscreen. Annual check-up is due.', time:'2 days ago', read:true },
];

const MESSAGES = [
  { id:'M1', from:'doctor',  text:"Good morning Aisha, I've reviewed your latest scan results. I'd like to schedule a follow-up biopsy as soon as possible.", time:'09:15 AM', date:'Apr 15' },
  { id:'M2', from:'patient', text:"Good morning Doctor. That sounds worrying — when would the appointment be?",                                                   time:'09:32 AM', date:'Apr 15' },
  { id:'M3', from:'doctor',  text:"I've booked you in for April 22nd at 9am. Please avoid applying any creams to the area beforehand. Let me know if you have questions.", time:'09:45 AM', date:'Apr 15' },
  { id:'M4', from:'patient', text:"Understood, thank you Doctor. I'll be there.",                                                                                 time:'10:02 AM', date:'Apr 15' },
  { id:'M5', from:'doctor',  text:"Great. In the meantime, please monitor the area and contact us immediately if you notice any rapid changes.",                  time:'10:05 AM', date:'Apr 15' },
];

const DX_LABELS = { mel:'Melanoma', nv:'Melanocytic Nevi', bcc:'Basal Cell Carcinoma', akiec:'Actinic Keratosis', bkl:'Benign Keratosis', df:'Dermatofibroma', vasc:'Vascular Lesion' };
const DX_ORDER  = ['mel','nv','bcc','akiec','bkl','df','vasc'];

const DOCTOR_USER  = { id:'D001', name:'Dr. Ramaneiss Pillai', role:'doctor', specialty:'Dermatology', initials:'RP' };
const PATIENT_USER = PATIENTS[0];

const ANALYTICS_DATA = {
  /* Equal Opportunity Difference per protected axis — REAL values:
     baseline = Model A (Standard Baseline), deployed = Model E (Full Framework). */
  eodByAxis: [
    { label:'Age group',       baseline:0.3404, enhanced:0.0299 },
    { label:'Sex',             baseline:0.0840, enhanced:0.0129 },
    { label:'Lesion location', baseline:0.6800, enhanced:0.3467 },
  ],
  /* Melanoma true-positive rate (sensitivity) per subgroup — shows how the
     framework equalises TPR across groups (from fairness.TPR_per_group). */
  melTprByAge: [
    { label:'Young adult', baseline:0.6923, enhanced:0.3077 },
    { label:'Middle-aged', baseline:0.3519, enhanced:0.2778 },
    { label:'Elderly',     baseline:0.4848, enhanced:0.2929 },
  ],
  melTprBySex: [
    { label:'Female', baseline:0.4062, enhanced:0.2812 },
    { label:'Male',   baseline:0.4902, enhanced:0.2941 },
  ],
  melTprByLoc: [
    { label:'Trunk',     baseline:0.4533, enhanced:0.3467 },
    { label:'Upper ext.',baseline:0.5938, enhanced:0.3438 },
    { label:'Lower ext.',baseline:0.4242, enhanced:0.1818 },
    { label:'Head',      baseline:0.3200, enhanced:0.2000 },
  ],
  /* Real HAM10000 class distribution (10,015 dermoscopic images) */
  dxDistribution: [
    { label:'Nevi (nv)',      value:6705, pct:0.6695 },
    { label:'Melanoma (mel)', value:1113, pct:0.1112 },
    { label:'BKL',            value:1099, pct:0.1097 },
    { label:'BCC',            value:514,  pct:0.0513 },
    { label:'AKIEC',          value:327,  pct:0.0327 },
    { label:'VASC',           value:142,  pct:0.0142 },
    { label:'DF',             value:115,  pct:0.0115 },
  ],

  /* ── PATIENT COHORT & ANALYSIS DIVERSITY ──────────────────────────────
     Grounded in real HAM10000 dataset metadata (10,015 dermoscopic images,
     the cohort backing the MelanoScan system). */
  cohort: {
    // Age distribution (HAM10000 age metadata, banded)
    age: [
      { label:'0–19',  value:386  },
      { label:'20–39', value:1793 },
      { label:'40–59', value:4008 },
      { label:'60–79', value:3316 },
      { label:'80+',   value:455  },
    ],
    // Sex distribution (HAM10000 sex metadata)
    sex: [
      { label:'Male',    value:5406, color:'#5B8DB8' },
      { label:'Female',  value:4552, color:'#C77B6A' },
      { label:'Unknown', value:57,   color:'#B8B2AA' },
    ],
    // Anatomical lesion location (HAM10000 localization metadata)
    localization: [
      { label:'Back',            value:2192 },
      { label:'Lower extremity', value:2077 },
      { label:'Trunk',           value:1404 },
      { label:'Upper extremity', value:1118 },
      { label:'Abdomen',         value:1022 },
      { label:'Face',            value:745  },
      { label:'Chest',           value:407  },
      { label:'Foot',            value:319  },
      { label:'Other sites',     value:731  },
    ],
    // Diagnosis confirmation method (HAM10000 dx_type metadata) — ground-truth rigour
    dxType: [
      { label:'Histopathology', value:5340, color:'#3E7C5A' },
      { label:'Follow-up',      value:3704, color:'#8AA85B' },
      { label:'Consensus',      value:902,  color:'#D9A441' },
      { label:'Confocal',       value:69,   color:'#B8B2AA' },
    ],
    // Risk-level outcome mix of analysed lesions (derived from dx distribution:
    // mel+bcc = high, akiec = moderate, remainder = low)
    riskOutcome: [
      { label:'High risk',     value:1627, color:'#C0453B' },
      { label:'Moderate risk', value:327,  color:'#D9A441' },
      { label:'Low risk',      value:8061, color:'#3E7C5A' },
    ],
    // Skin-lesion analyses performed in the HMS, per month (clinical activity)
    analysesTrend: [
      { label:'Jan', value:62  },
      { label:'Feb', value:78  },
      { label:'Mar', value:96  },
      { label:'Apr', value:118 },
      { label:'May', value:141 },
      { label:'Jun', value:167 },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════
   API LAYER  (used by melanoma checker for live predictions)
═══════════════════════════════════════════════════════════ */

async function apiFetch(path, options = {}) {
  const defaults = { credentials: 'same-origin' };
  if (!(options.body instanceof FormData)) {
    defaults.headers = { 'Content-Type': 'application/json' };
  }
  const res  = await fetch(path, { ...defaults, ...options });
  const json = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
  if (!json.ok) throw new Error(json.error || 'Unknown API error');
  return json.data ?? json;
}

const AuthApi = {
  login:  (username, password) => apiFetch('/api/auth/login', { method:'POST', body: JSON.stringify({ username, password }) }),
  logout: ()                   => apiFetch('/api/auth/logout', { method:'POST' }),
  me:     ()                   => apiFetch('/api/auth/me'),
};

const DoctorApi = {
  dashboard:      ()                                            => apiFetch('/api/doctor/dashboard'),
  patients:       (search = '')                                 => apiFetch(`/api/doctor/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  patientDetail:  (id)                                          => apiFetch(`/api/doctor/patients/${id}`),
  addRecord:      (id, record)                                  => apiFetch(`/api/doctor/patients/${id}/add-record`, { method:'POST', body: JSON.stringify(record) }),
  fairnessMetrics: ()                                           => apiFetch('/api/doctor/fairness-metrics'),
  melanomaCheck:  (patientId, imageFile, localization, compare, notes) => {
    const fd = new FormData();
    fd.append('image', imageFile);
    fd.append('localization', localization);
    fd.append('runComparison', compare ? 'true' : 'false');
    fd.append('notes', notes || '');
    return apiFetch(`/api/doctor/patients/${patientId}/melanoma-check`, { method:'POST', body: fd });
  },
  generateReport: (patientId) =>
    fetch(`/api/doctor/generate-report/${patientId}`, { method:'POST', credentials:'same-origin' })
      .then(r => r.ok ? r.blob() : Promise.reject('Report failed'))
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `patient_report_${patientId}.pdf`; a.click();
        URL.revokeObjectURL(url);
      }),
};

const PatientApi = {
  profile:       ()                          => apiFetch('/api/patient/profile'),
  updateProfile: (fields)                    => apiFetch('/api/patient/profile', { method:'PATCH', body: JSON.stringify(fields) }),
  checks:        ()                          => apiFetch('/api/patient/checks'),
  history:       ()                          => apiFetch('/api/patient/history'),
  melanomaCheck: (imageFile, localization)   => {
    const fd = new FormData();
    fd.append('image', imageFile);
    fd.append('localization', localization);
    return apiFetch('/api/patient/melanoma-check', { method:'POST', body: fd });
  },
};

const LOCALIZATIONS = [
  'back','lower extremity','trunk','upper extremity',
  'abdomen','face','chest','foot','neck','scalp',
  'hand','ear','genital','acral','unknown',
];

/* ── Expose everything globally ─────────────────────────────────────────── */
Object.assign(window, {
  // Mock data (used by dashboards)
  PATIENTS, DETECTIONS, APPOINTMENTS,
  NOTIFICATIONS_DOCTOR, NOTIFICATIONS_PATIENT,
  MESSAGES, DX_LABELS, DX_ORDER,
  DOCTOR_USER, PATIENT_USER, ANALYTICS_DATA,
  // API layer (used by melanoma checker)
  AuthApi, DoctorApi, PatientApi,
  LOCALIZATIONS, apiFetch,
});
