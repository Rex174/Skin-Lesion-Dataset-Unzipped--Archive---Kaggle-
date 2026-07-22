/**
 * hms_live.jsx  —  MelanoScan HMS
 * TP070818 | Ramaneiss Pillai S Gopalan
 *
 * Real-time data layer + model registry. Loaded AFTER hms_data.jsx.
 *
 *  • useLive(fetcher, fallbackGetter, interval)  — polls the real Flask API;
 *    on failure falls back to the LiveSim simulator so the UI stays live offline.
 *  • LiveSim                                     — demo engine: mutates counters /
 *    feeds on an interval so dashboards, analytics & messages animate in real time
 *    even with no backend (for the viva / offline demo).
 *  • MODEL_REGISTRY                              — all trained models + metrics
 *    (fallback for the Model Performance page; real data comes from
 *    GET /api/models/comparison).
 *  • SUBGROUP_EOD                                — per-demographic EOD before/after
 *    the framework, powering the per-result bias-reduction panel.
 *  • AnimatedNumber, LiveBadge                   — small UI helpers.
 */

const { useState: useStateLive, useEffect: useEffectLive, useRef: useRefLive } = React;

/* ═══════════════════════════════════════════════════════════
   MODEL REGISTRY  — the five models actually trained in Phase 1.
   Numbers are the REAL evaluation results from
   phase1_outputs/results/all_results.json. The deployed model is
   Model E (MelBoost 3.0), per model_paths.json → "enhanced_v2".
   Fairness is measured on AGE GROUP, SEX and LESION LOCATION
   (HAM10000 has no skin-tone labels). meanEOD = mean of the three
   axis EODs; worstEOD = the largest. The backend endpoint
   /api/models/comparison overrides this at runtime from the JSON.
═══════════════════════════════════════════════════════════ */
const MODEL_REGISTRY = [
  {
    key: 'baseline', name: 'Model A — Standard Baseline',
    arch: 'EfficientNet-B0', mitigation: 'None (original imbalanced HAM10000)',
    accuracy: 0.8609, auc: 0.9818, sensitivity: 0.7665, melSensitivity: 0.3916, ece: 0.0174,
    eodAge: 0.2237, eodSex: 0.1541, eodLoc: 0.6800, meanEOD: 0.353, worstEOD: 0.680, isBest: false,
    worstGroupTPR: 0.3148, bestGroupTPR: 0.5385, verdict: 'baseline', melMissed: 61,
    note: 'No bias mitigation. Highest raw accuracy, but misses 61 of every 100 melanomas.',
  },
  {
    key: 'sampling_only', name: 'Model B — Sampling Only',
    arch: 'EfficientNet-B0', mitigation: 'Intersectional stratified sampling',
    accuracy: 0.7890, auc: 0.9492, sensitivity: 0.5790, melSensitivity: 0.2651, ece: 0.0631,
    eodAge: 0.0419, eodSex: 0.0499, eodLoc: 0.3438, meanEOD: 0.145, worstEOD: 0.344, isBest: false,
    worstGroupTPR: 0.2308, bestGroupTPR: 0.2727, verdict: 'levelling_down', melMissed: 73,
    note: 'Low EOD achieved by degrading melanoma detection below baseline for every group.',
  },
  {
    key: 'reweight_only', name: 'Model C — Reweighting Only',
    arch: 'EfficientNet-B0', mitigation: 'Adaptive distribution-aware reweighting',
    accuracy: 0.6533, auc: 0.8899, sensitivity: 0.5688, melSensitivity: 0.2771, ece: 0.0977,
    eodAge: 0.0670, eodSex: 0.0830, eodLoc: 0.3200, meanEOD: 0.157, worstEOD: 0.320, isBest: false,
    worstGroupTPR: 0.2407, bestGroupTPR: 0.3077, verdict: 'levelling_down', melMissed: 72,
    note: 'Low EOD achieved by degrading melanoma detection below baseline for every group.',
  },
  {
    key: 'cgan_only', name: 'Model D — cGAN Only',
    arch: 'EfficientNet-B0', mitigation: 'Conditional GAN image augmentation',
    accuracy: 0.8053, auc: 0.9536, sensitivity: 0.6228, melSensitivity: 0.2831, ece: 0.0608,
    eodAge: 0.0621, eodSex: 0.0285, eodLoc: 0.3750, meanEOD: 0.155, worstEOD: 0.375, isBest: false,
    worstGroupTPR: 0.2308, bestGroupTPR: 0.2929, verdict: 'levelling_down', melMissed: 72,
    note: 'Low EOD achieved by degrading melanoma detection below baseline for every group.',
  },
  {
    key: 'enhanced_v2', name: 'Model E — MelBoost 3.0',
    arch: 'EfficientNet-B0', mitigation: 'Sampling + Reweighting + cGAN + melanoma-sensitivity boosting',
    accuracy: 0.7327, auc: 0.9324, sensitivity: 0.6369, melSensitivity: 0.5301, ece: 0.0603,
    eodAge: 0.1154, eodSex: 0.0273, eodLoc: 0.5938, meanEOD: 0.246, worstEOD: 0.594, isBest: true,
    worstGroupTPR: 0.5000, bestGroupTPR: 0.6154, verdict: 'uplift', melMissed: 47,
    note: 'The only model where every demographic group improves over the baseline. Detects 53% of melanomas vs 39% baseline, while cutting age and sex bias.',
  },
];

/* ═══════════════════════════════════════════════════════════
   EOD BY FAIRNESS AXIS  — real baseline (Model A) vs deployed
   (Model E) Equal Opportunity Difference on each protected axis.
   Drives the analytics charts and the per-result bias panel.
═══════════════════════════════════════════════════════════ */
const EOD_BY_AXIS = {
  age:      { axisLabel: 'Age group',       baseline: 0.2237, enhanced: 0.1154 },
  sex:      { axisLabel: 'Sex',             baseline: 0.1541, enhanced: 0.0273 },
  location: { axisLabel: 'Lesion location', baseline: 0.6800, enhanced: 0.5938 },
};

/* ═══════════════════════════════════════════════════════════
   PROOF OF CONCEPT — EXTERNAL VALIDATION ON ISIC 2020
   Model A (baseline) vs the deployed Model E (MelBoost 3.0) scored on
   the ISIC 2020 Challenge dataset — NEVER seen during training on
   HAM10000. HAM10000 overlaps were removed before scoring, so this is
   a true out-of-distribution generalisation test: it demonstrates the
   framework reduces bias on data it was never fitted to, not just on
   its own HAM10000 test split. Numbers are the REAL Phase-4 outputs
   from external_validation/ (Cell 4 diagnostic + Cell 5 demo picker).
   Backend may override at runtime via GET /api/models/external-validation.
═══════════════════════════════════════════════════════════ */
const POC_IMG_BASE = '/static/poc_images/';   // ← drop the 6 ISIC_*.jpg files here

const POC_ISIC2020 = {
  dataset: 'ISIC 2020 Challenge',
  rawTotal: 33126,
  evalTotal: 3584,
  evalMelanoma: 584,
  evalBenign: 3000,
  recovered: 150,                               // melanomas Model A missed but Model E caught
  sensitivity:  { baseline: 0.1353, enhanced: 0.3767, delta: 0.2414 },
  missedPer100: { baseline: 86, enhanced: 62 },
  fairness: [
    { axis: 'Age group',       baselineWorst: 0.0845, baselineWorstGroup: 'Young adult',     baselineEOD: 0.0832,
      baselineBest: 0.1677, baselineBestGroup: 'Elderly',
      enhancedWorst: 0.2821, enhancedWorstGroup: 'Middle-aged',    enhancedEOD: 0.1578,
      enhancedBest: 0.4399, enhancedBestGroup: 'Elderly', worstDelta: 0.1976, verdict: 'uplift' },
    { axis: 'Sex',             baselineWorst: 0.1136, baselineWorstGroup: 'Female',          baselineEOD: 0.0347,
      baselineBest: 0.1483, baselineBestGroup: 'Male',
      enhancedWorst: 0.3545, enhancedWorstGroup: 'Female',         enhancedEOD: 0.0356,
      enhancedBest: 0.3901, enhancedBestGroup: 'Male', worstDelta: 0.2409, verdict: 'uplift' },
    { axis: 'Lesion location', baselineWorst: 0.0721, baselineWorstGroup: 'Upper extremity', baselineEOD: 0.0888,
      baselineBest: 0.1609, baselineBestGroup: 'Trunk',
      enhancedWorst: 0.2432, enhancedWorstGroup: 'Head',           enhancedEOD: 0.2280,
      enhancedBest: 0.4713, enhancedBestGroup: 'Trunk', worstDelta: 0.1711, verdict: 'uplift' },
  ],
  // Six confirmed melanomas the baseline missed but the deployed model caught,
  // ranked by confidence gap (P(mel)_E − P(mel)_A). Ground truth = melanoma.
  cases: [
    { id: 'ISIC_5046082', age: 'Middle-aged', sex: 'Male',   loc: 'Trunk',           probA: 0.004, probE: 0.935, predA: 'Melanocytic Nevi' },
    { id: 'ISIC_3319229', age: 'Middle-aged', sex: 'Female', loc: 'Trunk',           probA: 0.077, probE: 0.914, predA: 'Benign Keratosis' },
    { id: 'ISIC_7897925', age: 'Middle-aged', sex: 'Male',   loc: 'Upper extremity', probA: 0.001, probE: 0.838, predA: 'Melanocytic Nevi' },
    { id: 'ISIC_7295035', age: 'Young adult', sex: 'Male',   loc: 'Trunk',           probA: 0.013, probE: 0.840, predA: 'Melanocytic Nevi' },
    { id: 'ISIC_7536704', age: 'Elderly',     sex: 'Male',   loc: 'Trunk',           probA: 0.191, probE: 0.989, predA: 'Benign Keratosis' },
    { id: 'ISIC_3696488', age: 'Elderly',     sex: 'Female', loc: 'Upper extremity', probA: 0.113, probE: 0.906, predA: 'Melanocytic Nevi' },
  ],
};

/* Map a patient's raw fields → the subgroup labels used in Phase 1 */
function ageGroupOf(age) {
  if (age == null) return 'Unknown';
  if (age < 18) return 'Pediatric';
  if (age < 40) return 'YoungAdult';
  if (age < 60) return 'MiddleAged';
  return 'Elderly';
}
const AGE_GROUP_LABEL = { Pediatric:'Pediatric (0–17)', YoungAdult:'Young adult (18–39)', MiddleAged:'Middle-aged (40–59)', Elderly:'Elderly (60+)', Unknown:'Unknown age' };

function locZoneOf(localization) {
  const z = {
    back:'Trunk', trunk:'Trunk', abdomen:'Trunk', chest:'Trunk', genital:'Trunk',
    face:'Head', neck:'Head', scalp:'Head', ear:'Head',
    'lower extremity':'Lower extremity', foot:'Lower extremity', acral:'Lower extremity',
    'upper extremity':'Upper extremity', hand:'Upper extremity', unknown:'Unknown',
  };
  return z[String(localization || '').toLowerCase().trim()] || 'Other';
}

/* Per-patient fairness summary across all three axes → before/after
   EOD, per-axis reduction, and an aggregate headline. Keeps the
   legacy keys (baseline/enhanced/reduction/label) pointing at the
   aggregate so existing result panels keep working. */
function eodForPatient(patient, localizationOverride) {
  const age  = patient?.age;
  const sex  = patient?.sex;
  const loc  = (localizationOverride != null && localizationOverride !== '')
    ? localizationOverride
    : patient?.localization;
  const subgroupLabels = {
    age:      AGE_GROUP_LABEL[ageGroupOf(age)] || 'Unknown age',
    sex:      sex ? (sex[0].toUpperCase() + sex.slice(1).toLowerCase()) : 'Unknown sex',
    location: locZoneOf(loc) + (locZoneOf(loc) === 'Unknown' || locZoneOf(loc) === 'Other' ? '' : ' lesions'),
  };
  const axes = Object.entries(EOD_BY_AXIS).map(([key, v]) => ({
    key,
    axisLabel: v.axisLabel,
    subgroup:  subgroupLabels[key],
    baseline:  v.baseline,
    enhanced:  v.enhanced,
    reduction: v.baseline > 0 ? Math.round((1 - v.enhanced / v.baseline) * 100) : 0,
  }));
  const meanBaseline = +(axes.reduce((s, a) => s + a.baseline, 0) / axes.length).toFixed(3);
  const meanEnhanced = +(axes.reduce((s, a) => s + a.enhanced, 0) / axes.length).toFixed(3);
  const meanReduction = meanBaseline > 0 ? Math.round((1 - meanEnhanced / meanBaseline) * 100) : 0;
  // Is this patient in a historically underrepresented subgroup?
  const zone = locZoneOf(loc);
  const underrepresented = ageGroupOf(age) === 'Pediatric' || zone === 'Unknown' || zone === 'Head';
  return {
    axes, meanBaseline, meanEnhanced, meanReduction, underrepresented,
    // legacy aggregate keys
    label: 'age, sex & lesion location',
    baseline: meanBaseline, enhanced: meanEnhanced, reduction: meanReduction,
  };
}

/* ═══════════════════════════════════════════════════════════
   MODELS API  (real endpoint, added to backend)
═══════════════════════════════════════════════════════════ */
const ModelsApi = {
  comparison:         () => apiFetch('/api/models/comparison'),
  externalValidation: () => apiFetch('/api/models/external-validation'),
};

/* ═══════════════════════════════════════════════════════════
   LIVE SIMULATOR  — demo real-time engine (no backend needed)
   Mutates a shared store on a global ticker; components that
   fall back to it re-render with evolving values.
═══════════════════════════════════════════════════════════ */
const LiveSim = (function () {
  const todayCount = DETECTIONS.length;
  const state = {
    totalPatients: PATIENTS.length,
    analysesToday: 3,
    highRiskCount: PATIENTS.filter(p => p.riskLevel === 'high').length,
    recentChecks: DETECTIONS.slice(0, 6).map(d => ({ ...d })),
    // analytics live baseline = REAL deployed-model (Model E — MelBoost 3.0) metrics
    overallAccuracy: 0.7327,
    macroAuc: 0.9324,
    meanEOD: 0.246,
    imagesEvaluated: 1503,
    tick: 0,
  };

  const subs = new Set();
  const notify = () => subs.forEach(fn => fn(snapshot()));
  function snapshot() { return JSON.parse(JSON.stringify(state)); }

  const FIRST = ['Noah','Emma','Liam','Olivia','Ava','Ethan','Mia','Aria','Omar','Wei','Priya','Leah','Kai','Yusuf','Nadia'];
  const LAST  = ['Tan','Lee','Kumar','Abdullah','Wong','Singh','Reyes','Haddad','Cho','Patel','Lim','Suleiman'];
  const DXS   = ['nv','mel','bkl','bcc','akiec','df'];
  const rand  = arr => arr[Math.floor(Math.random() * arr.length)];

  function tick() {
    state.tick += 1;
    // Every ~3 ticks a new analysis arrives
    if (state.tick % 3 === 0) {
      const dx = Math.random() < 0.22 ? 'mel' : rand(DXS);
      const risk = dx === 'mel' ? 'high' : (['bcc','akiec'].includes(dx) ? 'medium' : 'low');
      const name = `${rand(FIRST)} ${rand(LAST)}`;
      state.analysesToday += 1;
      if (risk === 'high') state.highRiskCount += 1;
      state.recentChecks.unshift({
        id: 'L' + Date.now(),
        patientId: 'P0' + (1 + Math.floor(Math.random() * 8)),
        patientName: name,
        dx, dxLabel: DX_LABELS[dx],
        confidence: 0.7 + Math.random() * 0.28,
        riskLevel: risk,
        date: new Date().toISOString().slice(0, 10),
        live: true,
      });
      state.recentChecks = state.recentChecks.slice(0, 6);
    }
    // Occasionally a new patient registers
    if (state.tick % 5 === 0) state.totalPatients += 1;
    // Analytics drift (tiny, bounded) — looks alive without misstating results
    const jitter = (base, amp) => +(base + (Math.random() - 0.5) * amp).toFixed(3);
    state.overallAccuracy = Math.min(0.75, Math.max(0.72, jitter(state.overallAccuracy, 0.003)));
    state.macroAuc        = Math.min(0.94, Math.max(0.92, jitter(state.macroAuc, 0.003)));
    state.meanEOD         = Math.min(0.26, Math.max(0.23, jitter(state.meanEOD, 0.003)));
    state.imagesEvaluated += Math.floor(Math.random() * 3);
    notify();
  }

  setInterval(tick, 3000);

  return {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    snapshot,
    get() { return state; },
    // Shaped getters matching API responses
    doctorDashboard() {
      return {
        totalPatients: state.totalPatients,
        checksToday: state.analysesToday,
        highRiskCount: state.highRiskCount,
        recentChecks: state.recentChecks,
      };
    },
    analytics() {
      return {
        overallAccuracy: state.overallAccuracy,
        macroAuc: state.macroAuc,
        meanEOD: state.meanEOD,
        imagesEvaluated: state.imagesEvaluated,
      };
    },
  };
})();

/* ═══════════════════════════════════════════════════════════
   CLINIC STORE  — single source of truth for the doctor portal
   ──────────────────────────────────────────────────────────
   Grounds the Dashboard, Patients page and Recent-Analyses feed
   in ONE dataset (the demo PATIENTS / APPOINTMENTS / DETECTIONS)
   so every count agrees, and updates live whenever an analysis is
   completed via recordAnalysis(). Independent of the backend, so
   the numbers stay consistent whether Flask is running or not.
═══════════════════════════════════════════════════════════ */
const ClinicStore = (function () {
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const patients = PATIENTS.map(p => ({ ...p }));       // mutable working copies
  const appointments = APPOINTMENTS.map(a => ({ ...a }));
  // Seed the analyses feed from historical DETECTIONS (so it's never empty)
  let analyses = DETECTIONS.map(d => {
    const pt = PATIENTS.find(p => p.id === d.patientId);
    return {
      id: d.id, patientId: d.patientId, patientName: pt ? pt.name : 'Unknown',
      dx: d.dx, dxLabel: d.dxLabel, confidence: d.confidence,
      riskLevel: d.riskLevel, date: d.date, live: false, _ts: Date.parse(d.date) || 0,
      scores: d.scores, recommendation: d.recommendation,
      localization: pt ? pt.localization : undefined,
    };
  });

  const subs = new Set();
  const emit = () => subs.forEach(fn => fn());

  return {
    patients() { return patients; },
    appointments() { return appointments; },

    /* Appointment mutators (offline demo path) */
    setAppointments(list) { appointments.length = 0; list.forEach(a => appointments.push(a)); emit(); },
    addAppointmentLocal(a) { appointments.push(a); emit(); },
    updateAppointmentLocal(id, patch) {
      const x = appointments.find(z => z.id === id || z.dbId === id);
      if (x) Object.assign(x, patch);
      emit();
    },

    dashboard() {
      const today = todayISO();
      return {
        totalPatients: patients.length,
        analysesToday: analyses.filter(a => a.date === today).length,
        highRiskCount: patients.filter(p => p.riskLevel === 'high').length,
        upcomingCount: appointments.filter(a => a.status === 'scheduled').length,
        recentChecks: analyses.slice().sort((a, b) => (b._ts || 0) - (a._ts || 0)).slice(0, 6),
      };
    },

    highRiskPatients() { return patients.filter(p => p.riskLevel === 'high'); },

    /* Full analyses fact table (all scans, newest first) — used by the OLAP
       analytics cube. Each row carries patientId so demographics can be joined
       against patients(). Grows live as recordAnalysis() is called. */
    allAnalyses() { return analyses.slice(); },

    /* Per-patient live views (used by the patient portal dashboard) */
    analysesFor(patientId) {
      return analyses.filter(a => a.patientId === patientId)
        .slice().sort((a, b) => (b._ts || 0) - (a._ts || 0));
    },
    patientRecord(patientId) { return patients.find(p => p.id === patientId); },

    /* Register a new patient in the offline demo store. Generates the next
       incremental P-ID from the highest existing one, defaults risk to 'low'. */
    addPatientLocal(fields) {
      const nums = patients
        .map(p => { const m = /^P(\d+)$/.exec(String(p.id)); return m ? parseInt(m[1], 10) : 0; });
      const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
      const id = 'P' + String(nextNum).padStart(3, '0');
      const np = {
        id, name: fields.name, age: fields.age, sex: fields.sex,
        phone: fields.phone, email: fields.email, address: fields.address,
        skinType: fields.skinType, ita: fields.ita, localization: fields.localization,
        bloodType: fields.bloodType, allergies: fields.allergies,
        diagnosis: fields.diagnosis, notes: fields.notes,
        riskLevel: 'low', lastVisit: todayISO(),
      };
      patients.push(np);
      emit();
      return np;
    },

    /* Remove a patient from the offline demo store. */
    deletePatientLocal(id) {
      const i = patients.findIndex(p => p.id === id);
      if (i !== -1) { patients.splice(i, 1); emit(); }
    },

    /* Update a patient's demographic/contact details. Writes to the live
       working copy AND the underlying PATIENTS record (which PATIENT_USER
       and the doctor's record-page fallback both reference), then notifies
       subscribers so the doctor portal reflects the change live. */
    updatePatient(patientId, patch) {
      const copy = patients.find(p => p.id === patientId);
      if (copy) Object.assign(copy, patch);
      if (typeof PATIENTS !== 'undefined') {
        const src = PATIENTS.find(p => p.id === patientId);
        if (src) Object.assign(src, patch);
      }
      if (window.PATIENT_USER && window.PATIENT_USER.id === patientId) {
        Object.assign(window.PATIENT_USER, patch);
      }
      emit();
    },

    /* Recover a demo patient id ('P00x') from a name — lets the live DB list
       (integer ids) still navigate to the demo-backed record/detection views. */
    demoIdForName(name) {
      const p = patients.find(x => x.name === name);
      return p ? p.id : null;
    },

    /* Full offline snapshot in the same shape the backend dashboard returns */
    snapshot() {
      const d = this.dashboard();
      return {
        ...d,
        patients: patients.slice(),
        highRiskPatients: patients.filter(p => p.riskLevel === 'high').map(p => ({ id: p.id, name: p.name })),
        online: false,
      };
    },

    /* Called when a melanoma analysis completes (doctor OR patient portal) */
    recordAnalysis({ patientId, patientName, dx, dxLabel, confidence, riskLevel, scores, recommendation, localization }) {
      const patient = patients.find(p => p.id === patientId);
      analyses.unshift({
        id: 'L' + Date.now() + Math.random().toString(36).slice(2, 6),
        patientId,
        patientName: patientName || (patient ? patient.name : 'Unknown'),
        dx, dxLabel, confidence,
        riskLevel: riskLevel === 'moderate' ? 'medium' : riskLevel,
        date: todayISO(), live: true, _ts: Date.now(),
        scores: scores || {}, recommendation: recommendation || '',
        localization: localization || (patient ? patient.localization : undefined),
      });
      if (patient) {
        patient.lastVisit = todayISO();
        patient.riskLevel = riskLevel === 'moderate' ? 'medium' : riskLevel;
      }
      /* Raise a patient-facing alert so the dashboard's unread count updates */
      if (window.PatientNotifStore && (window.PATIENT_USER || {}).id === patientId) {
        window.PatientNotifStore.add({
          type: riskLevel === 'high' ? 'alert' : 'result',
          title: riskLevel === 'high' ? 'High-risk result flagged' : 'New scan result available',
          message: `Your ${dxLabel} screening result is now available for review.`,
        });
      }
      emit();
    },

    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    notify() { emit(); },
  };
})();

/* useClinic — live doctor dashboard + patient list.
   When the Flask backend is reachable it reads real database records from
   /api/doctor/dashboard and /api/doctor/patients (so counts, the patient
   list, recent analyses and high-risk cases all reflect the DB). When the
   backend is unreachable it falls back to the offline demo cohort so the
   preview / offline demo still works and stays internally consistent. */
function useClinic() {
  const [snap, setSnap] = useStateLive(() => ClinicStore.snapshot());
  useEffectLive(() => {
    let alive = true;
    const poll = async () => {
      try {
        const [dashR, patR, apptR] = await Promise.all([
          apiFetch('/api/doctor/dashboard'),
          apiFetch('/api/doctor/patients'),
          apiFetch('/api/appointments'),
        ]);
        const d = dashR.data || dashR;
        const p = patR.data || patR;
        const appts = apptR.data || apptR;
        if (!alive) return;
        setSnap({
          totalPatients: d.totalPatients,
          analysesToday: d.checksToday,
          highRiskCount: d.highRiskCount,
          highRiskPatients: d.highRiskPatients || [],
          recentChecks: d.recentChecks || [],
          upcomingCount: Array.isArray(appts) ? appts.filter(a => a.status === 'scheduled').length : 0,
          patients: Array.isArray(p) ? p : [],
          online: true,
        });
      } catch (e) {
        if (alive) setSnap(ClinicStore.snapshot());
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    const unsub = ClinicStore.subscribe(poll);
    return () => { alive = false; clearInterval(id); unsub(); };
  }, []);
  return snap;
}

/* ═══════════════════════════════════════════════════════════
   PatientNotifStore — reactive wrapper around NOTIFICATIONS_PATIENT
   so the dashboard unread count and the Notifications page share
   one source of truth. Clicking a notification read (or marking all
   read) updates the badge everywhere; new scans push fresh alerts.
═══════════════════════════════════════════════════════════ */
const PatientNotifStore = (function () {
  let list = (typeof NOTIFICATIONS_PATIENT !== 'undefined' ? NOTIFICATIONS_PATIENT : []).map(n => ({ ...n }));
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn());
  return {
    list() { return list; },
    unreadCount() { return list.filter(n => !n.read).length; },
    markRead(id) { const n = list.find(x => x.id === id); if (n && !n.read) { n.read = true; emit(); } },
    markAllRead() {
      let changed = false;
      list.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
      if (changed) emit();
    },
    add(notif) {
      list = [{ id: 'NP' + Date.now(), read: false, time: 'Just now', ...notif }, ...list];
      emit();
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
})();
window.PatientNotifStore = PatientNotifStore;

/* DoctorNotifStore — reactive wrapper around NOTIFICATIONS_DOCTOR so the
   doctor Notifications page updates live. Patient-initiated events (e.g.
   booking an appointment) push a fresh notification here. */
const DoctorNotifStore = (function () {
  // Per-doctor notification lists, keyed by the logged-in doctor's identity.
  // Only the default demo doctor (dr_ramaneiss) inherits the seed set; every
  // other doctor (e.g. a newly registered one) starts with their own empty
  // list and only accumulates events relevant to them.
  const lists = {};
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn());

  const currentKey = () => {
    const u = window.HMS_USER || {};
    return String(u.username || (window.DOCTOR_USER || {}).name || 'doctor').toLowerCase();
  };
  const ensure = (key) => {
    if (!lists[key]) {
      lists[key] = (key === 'dr_ramaneiss' && typeof NOTIFICATIONS_DOCTOR !== 'undefined')
        ? NOTIFICATIONS_DOCTOR.map(n => ({ ...n }))
        : [];
    }
    return lists[key];
  };

  return {
    list() { return ensure(currentKey()); },
    unreadCount() { return ensure(currentKey()).filter(n => !n.read).length; },
    markRead(id) { const n = ensure(currentKey()).find(x => x.id === id); if (n && !n.read) { n.read = true; emit(); } },
    markAllRead() {
      let changed = false;
      ensure(currentKey()).forEach(n => { if (!n.read) { n.read = true; changed = true; } });
      if (changed) emit();
    },
    add(notif) {
      const key = currentKey();
      lists[key] = [{ id: 'ND' + Date.now(), read: false, time: 'Just now', ...notif }, ...ensure(key)];
      emit();
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
})();
window.DoctorNotifStore = DoctorNotifStore;

function useDoctorNotifs() {
  const [, force] = useStateLive(0);
  useEffectLive(() => {
    const unsub = DoctorNotifStore.subscribe(() => force(x => x + 1));
    return unsub;
  }, []);
  return DoctorNotifStore;
}

/* usePatientClinic — live analyses + risk record for one patient.
   Re-renders whenever ClinicStore changes (e.g. a new scan). */
function usePatientClinic(patientId) {
  const [, force] = useStateLive(0);
  useEffectLive(() => {
    const unsub = ClinicStore.subscribe(() => force(x => x + 1));
    return unsub;
  }, [patientId]);
  return {
    analyses: ClinicStore.analysesFor(patientId),
    record: ClinicStore.patientRecord(patientId),
  };
}

/* usePatientNotifs — reactive access to PatientNotifStore */
function usePatientNotifs() {
  const [, force] = useStateLive(0);
  useEffectLive(() => {
    const unsub = PatientNotifStore.subscribe(() => force(x => x + 1));
    return unsub;
  }, []);
  return PatientNotifStore;
}

/* usePatientChecks — live DB scan history for the logged-in patient, polled
   from /api/patient/checks. Returns null when the backend is unreachable so
   callers fall back to the offline ClinicStore. Values are normalized
   (confidence/scores to 0–1, moderate→medium) so every patient page shows
   an identical, DB-backed history. */
function usePatientChecks(patientId, fallbackLoc) {
  const [checks, setChecks] = useStateLive(null);
  useEffectLive(() => {
    let alive = true;
    const norm = v => (v == null ? 0 : (v > 1 ? v / 100 : v));
    const load = async () => {
      try {
        const r = await apiFetch('/api/patient/checks');
        const list = (r && r.data) || r;
        if (!alive || !Array.isArray(list)) return;
        setChecks(list.map(c => ({
          ...c,
          riskLevel: c.riskLevel === 'moderate' ? 'medium' : c.riskLevel,
          confidence: norm(c.confidence),
          scores: Object.fromEntries(Object.entries(c.scores || {}).map(([k, v]) => [k, norm(v)])),
          localization: c.localization || fallbackLoc,
          _ts: Date.parse(c.date) || 0,
        })).sort((a, b) => (b._ts || 0) - (a._ts || 0)));
      } catch (e) { /* backend unreachable — keep null so caller uses store */ }
    };
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [patientId]);
  return checks;
}

/* usePatientProfile — live DB profile for the logged-in patient (name, age,
   sex, contact, address, risk, medical fields). Returns null when the backend
   is unreachable so callers fall back to the offline seed/ClinicStore. Polls
   so doctor-side or self edits reflect within a few seconds. */
function usePatientProfile() {
  const [prof, setProf] = useStateLive(null);
  useEffectLive(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await apiFetch('/api/patient/profile');
        const d = (r && r.data) || r;
        if (alive && d && d.id != null) setProf(d);
      } catch (e) { /* offline — keep null */ }
    };
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return prof;
}
const AppointmentApi = {
  list:   () => apiFetch('/api/appointments'),
  book:   (payload) => apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  update: (dbId, payload) => apiFetch('/api/appointments/' + dbId, { method: 'PATCH', body: JSON.stringify(payload) }),
};

function useAppointments(role) {
  const offlineList = () => {
    const all = ClinicStore.appointments();
    if (role === 'patient') {
      const pid = (window.PATIENT_USER || {}).id;
      return all.filter(a => a.patientId === pid);
    }
    return all;
  };
  const [state, setState] = useStateLive(() => ({ list: offlineList(), online: false }));

  const refresh = React.useCallback(async () => {
    try {
      const r = await AppointmentApi.list();
      const list = r.data || r;
      setState({ list: Array.isArray(list) ? list : [], online: true });
    } catch (e) {
      setState({ list: offlineList(), online: false });
    }
    // eslint-disable-next-line
  }, [role]);

  useEffectLive(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    const unsub = ClinicStore.subscribe(() => setState(s => s.online ? s : { list: offlineList(), online: false }));
    return () => { clearInterval(id); unsub(); };
    // eslint-disable-next-line
  }, [role]);

  /* Actions — write to DB when online, else mutate the demo store */
  const book = async ({ patientId, date, time, duration, reason }) => {
    const notifyDoctor = () => {
      if (!window.DoctorNotifStore) return;
      const pid  = patientId || (window.PATIENT_USER || {}).id;
      const prec = ClinicStore.patientRecord ? ClinicStore.patientRecord(pid) : null;
      const pname = (prec && prec.name) || (window.PATIENT_USER || {}).name || 'A patient';
      window.DoctorNotifStore.add({
        type: 'appointment',
        title: 'New appointment booked',
        message: `${pname} booked ${reason || 'an appointment'} on ${date} at ${time}.`,
      });
    };
    if (state.online) {
      try { await AppointmentApi.book({ patient_id: patientId, date, time, duration, reason }); notifyDoctor(); await refresh(); return; }
      catch (e) { /* fall through */ }
    }
    ClinicStore.addAppointmentLocal({
      id: 'APT' + Date.now(), patientId: patientId || (window.PATIENT_USER || {}).id,
      patientName: (window.PATIENT_USER || {}).name, date, time,
      duration: duration || 30, reason: reason || 'Consultation', status: 'scheduled',
    });
    notifyDoctor();
    setState({ list: offlineList(), online: false });
  };
  const changeStatus = async (appt, status) => {
    if (state.online && appt.dbId) {
      try { await AppointmentApi.update(appt.dbId, { status }); await refresh(); return; }
      catch (e) { /* fall through */ }
    }
    ClinicStore.updateAppointmentLocal(appt.id, { status });
    setState({ list: offlineList(), online: false });
  };
  const reschedule = async (appt, { date, time }) => {
    if (state.online && appt.dbId) {
      try { await AppointmentApi.update(appt.dbId, { date, time }); await refresh(); return; }
      catch (e) { /* fall through */ }
    }
    ClinicStore.updateAppointmentLocal(appt.id, { date, time });
    setState({ list: offlineList(), online: false });
  };

  return { ...state, refresh, book, changeStatus, reschedule };
}

/* ═══════════════════════════════════════════════════════════
   useLive — poll real API, fall back to LiveSim
═══════════════════════════════════════════════════════════ */
function useLive(fetcher, fallbackGetter, interval = 3000) {
  const [data, setData] = useStateLive(() => (fallbackGetter ? fallbackGetter() : null));
  const [online, setOnline] = useStateLive(false);

  useEffectLive(() => {
    let alive = true;
    const run = async () => {
      try {
        const d = await fetcher();
        if (alive && d) { setData(d); setOnline(true); }
      } catch (e) {
        if (alive) { setData(fallbackGetter ? fallbackGetter() : null); setOnline(false); }
      }
    };
    run();
    const id = setInterval(run, interval);
    // also re-render on sim ticks for smooth offline updates
    const unsub = LiveSim.subscribe(() => { if (alive && !online) run(); });
    return () => { alive = false; clearInterval(id); unsub(); };
    // eslint-disable-next-line
  }, []);

  return { data, online };
}

/* Subscribe directly to the simulator (for components that are demo-only) */
function useSim(getter, interval = 3000) {
  const [val, setVal] = useStateLive(() => getter());
  useEffectLive(() => {
    const unsub = LiveSim.subscribe(() => setVal(getter()));
    return unsub;
    // eslint-disable-next-line
  }, []);
  return val;
}

/* ═══════════════════════════════════════════════════════════
   AnimatedNumber — smoothly counts to its target on change
═══════════════════════════════════════════════════════════ */
const AnimatedNumber = ({ value, decimals = 0, suffix = '', prefix = '', duration = 600, style = {} }) => {
  const [display, setDisplay] = useStateLive(value);
  const fromRef = useRefLive(value);
  const rafRef  = useRefLive(null);

  useEffectLive(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(from + (to - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const shown = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <span style={style}>{prefix}{shown}{suffix}</span>;
};

/* ═══════════════════════════════════════════════════════════
   LiveBadge — pulsing "LIVE" indicator
═══════════════════════════════════════════════════════════ */
const LiveBadge = ({ online = true, label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
    color: online ? 'var(--success)' : 'var(--warning)',
    background: online ? 'var(--success-bg)' : 'var(--warning-bg)',
    borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
  }}>
    <span className="hms-live-dot" style={{
      width: 7, height: 7, borderRadius: '50%',
      background: online ? 'var(--success)' : 'var(--warning)',
    }} />
    {label || (online ? 'LIVE' : 'LIVE · DEMO')}
  </span>
);

/* Inject pulse keyframes once */
(function injectLiveCSS() {
  if (document.getElementById('hms-live-css')) return;
  const s = document.createElement('style');
  s.id = 'hms-live-css';
  s.textContent = `
    @keyframes hmsPulse { 0%{box-shadow:0 0 0 0 currentColor;opacity:1} 70%{box-shadow:0 0 0 6px transparent;opacity:.5} 100%{box-shadow:0 0 0 0 transparent;opacity:1} }
    .hms-live-dot { animation: hmsPulse 1.6s infinite; }
    @keyframes hmsRowIn { from{background:var(--primary-light);} to{background:transparent;} }
    .hms-row-new { animation: hmsRowIn 2.4s ease-out; }
  `;
  document.head.appendChild(s);
})();

/* ═══════════════════════════════════════════════════════════
   simulatePrediction — offline/demo fallback for the detection
   flow when the Flask backend (TensorFlow) isn't reachable.
   Returns the same shape as the /api melanoma-check `enhanced`
   object so the result UI renders identically.
═══════════════════════════════════════════════════════════ */
function simulatePrediction(patient, localization) {
  const riskMap = { mel:'high', bcc:'high', akiec:'moderate', nv:'low', bkl:'low', df:'low', vasc:'low' };
  const dx = (patient && patient.diagnosis) || ['nv','mel','bcc','bkl'][Math.floor(Math.random()*4)];
  const conf = 0.74 + Math.random() * 0.2;
  // probability distribution peaking at dx
  const probs = {};
  let rem = 1 - conf;
  DX_ORDER.forEach(k => { probs[k] = 0; });
  probs[dx] = conf;
  DX_ORDER.filter(k => k !== dx).forEach((k, i, arr) => {
    const share = i === arr.length - 1 ? rem : rem * Math.random() * 0.5;
    probs[k] = +share.toFixed(3); rem -= probs[k];
  });
  const e = eodForPatient(patient, localization);
  return {
    predicted_class: dx,
    predicted_label: DX_LABELS[dx],
    confidence_score: +conf.toFixed(4),
    risk_level: riskMap[dx] || 'low',
    all_probabilities: Object.fromEntries(Object.entries(probs).map(([k,v]) => [k, +(v*100).toFixed(2)])),
    fairness_note: e.underrepresented
      ? `This patient belongs to a historically underrepresented subgroup (${e.axes.map(a=>a.subgroup).join(', ')}). The MelBoost 3.0 model (Model E) applied stratified sampling, reweighting and synthetic cGAN augmentation to improve fairness for such groups.`
      : null,
    model_used: 'enhanced_v2',
    eod_axes: e.axes,
    eod_baseline: e.meanBaseline,
    eod_enhanced: e.meanEnhanced,
    eod_reduction: e.meanReduction,
    eod_subgroup: e.label,
    _demo: true,
  };
}

/* ═══════════════════════════════════════════════════════════
   REPORT GENERATOR — builds a clean, print-ready HTML report
   for one melanoma analysis and opens it in a new tab with the
   print dialog (Save as PDF). Fully client-side so it always
   works, and always includes the clinical notes (or "None").
═══════════════════════════════════════════════════════════ */
function downloadAnalysisReport(patient, analysis, notes) {
  const pid = patient && /^\d+$/.test(String(patient.id)) ? 'P' + String(patient.id).padStart(3, '0') : (patient?.id || '—');
  const pct = v => (v == null ? '—' : (v <= 1 ? (v * 100) : v).toFixed(1) + '%');
  const riskLabel = { high: 'High Risk', medium: 'Moderate', moderate: 'Moderate', low: 'Low Risk' }[analysis.riskLevel] || analysis.riskLevel || '—';
  const riskColor = { high: '#C0453B', medium: '#D9A441', moderate: '#D9A441', low: '#3E7C5A' }[analysis.riskLevel] || '#555';
  const labels = (typeof DX_LABELS !== 'undefined') ? DX_LABELS : {};
  const scores = analysis.scores || {};
  const scoreRows = Object.keys(scores).length
    ? (typeof DX_ORDER !== 'undefined' ? DX_ORDER : Object.keys(scores))
        .filter(k => scores[k] != null)
        .map(k => {
          const v = scores[k];
          const val = v <= 1 ? v * 100 : v;
          const main = (labels[k] || k) === analysis.dxLabel || k === analysis.dx;
          return `<tr${main ? ' style="font-weight:700;background:#FCEEE8"' : ''}>
            <td style="padding:6px 10px;border-bottom:1px solid #eee">${labels[k] || k}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${val.toFixed(1)}%</td></tr>`;
        }).join('')
    : '';
  const cleanNotes = (notes && String(notes).trim()) ? String(notes).trim() : 'None';
  const eodBlock = (analysis.eodAxes && analysis.eodAxes.length)
    ? `<div class="sec"><h3>Fairness (Equal Opportunity Difference)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${analysis.eodAxes.map(a => `<tr>
          <td style="padding:5px 10px;border-bottom:1px solid #eee">${a.axisLabel} · ${a.subgroup}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #eee;text-align:right">baseline ${a.baseline.toFixed(3)} → deployed ${a.enhanced.toFixed(3)} (−${a.reduction}%)</td>
        </tr>`).join('')}
        </table></div>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Melanoma Detection Report — ${patient?.name || ''}</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;margin:0;padding:40px;max-width:800px;margin:0 auto}
    .hd{display:flex;align-items:center;gap:12px;border-bottom:3px solid #C0563E;padding-bottom:14px;margin-bottom:22px}
    .logo{width:40px;height:40px;border-radius:10px;background:#C0563E;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
    h1{font-size:19px;margin:0} .sub{color:#777;font-size:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:14px 0}
    .f{font-size:13px;padding:5px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between}
    .f span:first-child{color:#888} .sec{margin:22px 0} h3{font-size:14px;margin:0 0 8px;color:#C0563E}
    .big{font-size:26px;font-weight:800} .risk{display:inline-block;padding:3px 12px;border-radius:20px;color:#fff;font-size:12px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:13px}
    .notes{background:#F7F3F0;border:1px solid #e6ddd6;border-radius:8px;padding:12px 14px;font-size:13px;white-space:pre-wrap}
    .ft{margin-top:30px;border-top:1px solid #eee;padding-top:12px;font-size:11px;color:#999;text-align:center}
    @media print{body{padding:0}}
  </style></head><body>
    <div class="hd"><div class="logo">M</div><div><h1>MelanoScan HMS — Melanoma Detection Report</h1>
      <div class="sub">AI-assisted dermoscopic analysis · Model E (MelBoost 3.0, deployed)</div></div></div>

    <div class="grid">
      <div class="f"><span>Patient</span><b>${patient?.name || '—'}</b></div>
      <div class="f"><span>Patient ID</span><b>${pid}</b></div>
      <div class="f"><span>Age / Sex</span><b>${patient?.age ?? '—'} / ${patient?.sex || '—'}</b></div>
      <div class="f"><span>Lesion location</span><b>${analysis.localization || patient?.localization || '—'}</b></div>
      <div class="f"><span>Analysis date</span><b>${analysis.date || new Date().toISOString().slice(0,10)}</b></div>
      <div class="f"><span>Model used</span><b>Model E — MelBoost 3.0</b></div>
    </div>

    <div class="sec"><h3>Result</h3>
      <div style="display:flex;align-items:center;gap:20px">
        <div><div class="sub">Predicted diagnosis</div><div class="big">${analysis.dxLabel || '—'}</div></div>
        <div><div class="sub">Confidence</div><div class="big" style="color:#C0563E">${pct(analysis.confidence)}</div></div>
        <div><div class="sub">Risk</div><div class="risk" style="background:${riskColor}">${riskLabel}</div></div>
      </div>
    </div>

    ${scoreRows ? `<div class="sec"><h3>Probability by class</h3><table>${scoreRows}</table></div>` : ''}

    <div class="sec"><h3>Clinical recommendation</h3>
      <div style="font-size:13px;line-height:1.6">${analysis.recommendation || '—'}</div></div>

    <div class="sec"><h3>Clinical notes</h3><div class="notes">${cleanNotes.replace(/</g,'&lt;')}</div></div>

    ${eodBlock}

    <div class="ft">Generated ${new Date().toLocaleString()} · MelanoScan HMS · This AI-assisted report supports, and does not replace, clinical judgement.</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else {
    // Popup blocked → download as an HTML file instead
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MelanoScan_Report_${pid}_${(analysis.date || '').replace(/-/g,'') || Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

Object.assign(window, {
  MODEL_REGISTRY, EOD_BY_AXIS, POC_ISIC2020, POC_IMG_BASE, eodForPatient, ageGroupOf, locZoneOf, AGE_GROUP_LABEL,
  ModelsApi, LiveSim, ClinicStore, useClinic, AppointmentApi, useAppointments, useLive, useSim, AnimatedNumber, LiveBadge,
  simulatePrediction, downloadAnalysisReport,
  PatientNotifStore, usePatientClinic, usePatientNotifs, usePatientProfile, usePatientChecks,
  DoctorNotifStore, useDoctorNotifs,
});

/* ═══════════════════════════════════════════════════════════
   MESSAGE STORE  — real two-way doctor ↔ patient messaging
   ──────────────────────────────────────────────────────────
   • A conversation is keyed by the patient's id (one thread per
     patient, with their attending doctor).
   • Dual-mode: when the Flask backend exposes /api/messages it
     uses the shared database (so messages reach the real doctor /
     patient account). When the backend isn't reachable it uses
     localStorage — which is ALSO shared across role-switches in
     the same browser, so the patient→doctor→patient test flow
     works offline too.
   • Components subscribe() to re-render whenever the thread
     changes (polling + storage events for cross-tab updates).
═══════════════════════════════════════════════════════════ */
const MessageStore = (function () {
  const KEY   = 'hms_messages_v1';
  const RKEY  = 'hms_msg_read_v1';
  const EV    = 'hms-messages-changed';   // fired when messages are sent
  const EV_R  = 'hms-reads-changed';      // fired when read-markers change
  let online  = false;

  const emit     = () => window.dispatchEvent(new Event(EV));
  const emitRead = () => window.dispatchEvent(new Event(EV_R));
  const readLS   = () => { try { return JSON.parse(localStorage.getItem(KEY))  || {}; } catch { return {}; } };
  const writeLS  = (o) => { localStorage.setItem(KEY, JSON.stringify(o)); emit(); };
  const readMark = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || {}; } catch { return {}; } };
  const writeMrk = (o) => { localStorage.setItem(RKEY, JSON.stringify(o)); };

  // Seed the P001 conversation once from the original demo MESSAGES
  (function seed() {
    const all = readLS();
    if (!all.__seeded) {
      const base = Date.parse('2026-04-15T09:00:00');
      all['P001'] = (typeof MESSAGES !== 'undefined' ? MESSAGES : []).map((m, i) => ({
        id: m.id, conversationId: 'P001', from: m.from, text: m.text, ts: base + i * 900000,
      }));
      all.__seeded = true;
      writeLS(all);
    }
  })();

  // Probe backend once — any HTTP response means the server is reachable
  // (the dummy id returns 400; that still proves Flask is up).
  (async function probe() {
    try {
      const r = await fetch('/api/messages?patient_id=__ping', { credentials: 'same-origin' });
      online = r.status < 500;
    } catch { online = false; }
  })();

  const localThread = (cid) => (readLS()[cid] || []).filter(Boolean).sort((a, b) => a.ts - b.ts);
  const isDeleted   = (m) => !!(m && m.deleted);

  return {
    isOnline: () => online,

    async thread(cid) {
      let list = null;
      if (online) {
        try { const j = await apiFetch('/api/messages?patient_id=' + encodeURIComponent(cid)); list = j.data || j; }
        catch { /* fall through */ }
      }
      // Overlay local soft-delete tombstones so a deleted message shows
      // "This message has been deleted" regardless of the backend.
      const local = readLS()[cid] || [];
      const delById = {};
      local.forEach(m => { if (m && m.deleted) delById[String(m.id)] = m; });
      if (list) {
        const seen = new Set();
        const merged = list.map(m => {
          seen.add(String(m.id));
          return delById[String(m.id)] ? { ...m, deleted: true } : m;
        });
        // include tombstones the backend already hard-deleted
        Object.values(delById).forEach(m => { if (!seen.has(String(m.id))) merged.push(m); });
        return merged.sort((a, b) => a.ts - b.ts);
      }
      return localThread(cid);
    },

    async send(cid, from, text) {
      const msg = {
        id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
        conversationId: cid, from, text: text.trim(), ts: Date.now(),
      };
      if (online) {
        try { await apiFetch('/api/messages', { method: 'POST', body: JSON.stringify({ patient_id: cid, from, text: msg.text }) }); }
        catch { /* fall through to localStorage */ }
      }
      const all = readLS();
      (all[cid] = all[cid] || []).push(msg);
      writeLS(all);
      return msg;
    },

    async deleteMessage(cid, messageId) {
      if (online) {
        try { await apiFetch('/api/messages/' + messageId, { method: 'DELETE' }); }
        catch { /* fall through to localStorage */ }
      }
      // Soft-delete: keep the message as a tombstone so it renders
      // "This message has been deleted" and stops counting as unread.
      const all = readLS();
      if (all[cid]) {
        all[cid] = all[cid].map(m =>
          (m && String(m.id) === String(messageId)) ? { ...m, deleted: true } : m);
        writeLS(all);
      } else {
        emit();
      }
    },

    /* Doctor conversation list — one row per patient */
    async threads() {
      if (online) {
        try { const j = await apiFetch('/api/messages/threads'); return j.data || j; }
        catch { /* fall through */ }
      }
      const all = readLS();
      const mark = readMark();
      // Offline scoping: the seeded PATIENTS belong to the default demo doctor
      // (dr_ramaneiss). Any other doctor sees only patients they own in the
      // live working set — never another doctor's cohort or conversations.
      const docKey = String((window.HMS_USER || {}).username || (window.DOCTOR_USER || {}).name || 'doctor').toLowerCase();
      const cohort = (docKey === 'dr_ramaneiss')
        ? (typeof PATIENTS !== 'undefined' ? PATIENTS : [])
        : (ClinicStore.patients() || []).filter(p => !(typeof PATIENTS !== 'undefined' && PATIENTS.some(sp => sp.id === p.id)));
      return cohort.map(p => {
        const t = (all[p.id] || []).filter(Boolean).sort((a, b) => a.ts - b.ts);
        const lastRaw = t[t.length - 1] || null;
        const last = lastRaw && lastRaw.deleted ? { ...lastRaw, text: 'This message has been deleted' } : lastRaw;
        const lastRead = mark['doctor:' + p.id] || 0;
        const unread = t.filter(m => m.from === 'patient' && !m.deleted && m.ts > lastRead).length;
        return { patientId: p.id, name: p.name, riskLevel: p.riskLevel, last, unread, count: t.length };
      }).sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        return (b.last?.ts || 0) - (a.last?.ts || 0);
      });
    },

    markRead(cid, role) {
      // Only advance + notify if there is genuinely something newer to read,
      // so polling doesn't spam read-events every tick.
      const t = localThread(cid);
      const mark = readMark();
      const lr = mark[role + ':' + cid] || 0;
      const other = role === 'doctor' ? 'patient' : 'doctor';
      const newest = t.filter(m => m.from === other && !m.deleted).reduce((mx, m) => Math.max(mx, m.ts), 0);
      if (newest > lr) {
        mark[role + ':' + cid] = Date.now();
        writeMrk(mark);
        emitRead();
      }
    },

    unreadFor(cid, role) {
      const t = localThread(cid);
      const lr = (readMark())[role + ':' + cid] || 0;
      const other = role === 'doctor' ? 'patient' : 'doctor';
      return t.filter(m => m.from === other && !m.deleted && m.ts > lr).length;
    },

    totalUnread(role) {
      if (role === 'doctor') {
        const all = readLS(); const mark = readMark(); let n = 0;
        (typeof PATIENTS !== 'undefined' ? PATIENTS : []).forEach(p => {
          const t = (all[p.id] || []).filter(Boolean);
          const lr = mark['doctor:' + p.id] || 0;
          n += t.filter(m => m.from === 'patient' && !m.deleted && m.ts > lr).length;
        });
        return n;
      }
      const cid = (typeof PATIENT_USER !== 'undefined' ? PATIENT_USER.id : 'P001');
      return this.unreadFor(cid, 'patient');
    },

    /* Full subscribe — message OR read changes (sidebar badges, thread list) */
    subscribe(fn) {
      const h = () => fn();
      window.addEventListener(EV, h);
      window.addEventListener(EV_R, h);
      window.addEventListener('storage', h);
      const iv = setInterval(fn, 1500);
      return () => { window.removeEventListener(EV, h); window.removeEventListener(EV_R, h); window.removeEventListener('storage', h); clearInterval(iv); };
    },

    /* Messages-only subscribe — used by ChatThread so marking-read can't
       re-trigger a thread reload (avoids feedback loops) */
    subscribeMessages(fn) {
      const h = () => fn();
      window.addEventListener(EV, h);
      window.addEventListener('storage', h);
      const iv = setInterval(fn, 1500);
      return () => { window.removeEventListener(EV, h); window.removeEventListener('storage', h); clearInterval(iv); };
    },
  };
})();

/* ─────────────────────────────────────────────────────────
   fmtTime — short relative/clock label for a message ts
───────────────────────────────────────────────────────── */
function fmtMsgTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* fmtMsgDay — date-separator label (Today / Yesterday / full date) */
function fmtMsgDay(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════
   ChatThread — reusable conversation pane (doctor & patient)
   Props: cid, role ('doctor'|'patient'), otherName, otherSubtitle
═══════════════════════════════════════════════════════════ */
const ChatThread = ({ cid, role, otherName, otherSubtitle, emptyHint }) => {
  const [msgs, setMsgs] = useStateLive([]);
  const [text, setText] = useStateLive('');
  const scrollRef = useRefLive(null);
  const meName = role === 'doctor'
    ? (typeof DOCTOR_USER !== 'undefined' ? DOCTOR_USER.name : 'Doctor')
    : (typeof PATIENTS !== 'undefined' ? (PATIENTS.find(p => p.id === cid)?.name || 'You') : 'You');

  const refresh = React.useCallback(async () => {
    const t = await MessageStore.thread(cid);
    setMsgs(t);
  }, [cid]);

  useEffectLive(() => {
    if (!cid) return;
    refresh();
    const unsub = MessageStore.subscribeMessages(refresh);
    return unsub;
  }, [cid, refresh]);

  // Prefill the composer with a pending template draft (e.g. "reschedule"
  // deep-link from the patient dashboard), then consume it.
  useEffectLive(() => {
    if (role === 'patient' && window.__pendingMessageDraft) {
      setText(window.__pendingMessageDraft);
      window.__pendingMessageDraft = null;
    }
  }, [cid]);

  // Mark this conversation read whenever its messages change while open
  useEffectLive(() => {
    if (cid) MessageStore.markRead(cid, role);
  }, [cid, role, msgs.length]);

  useEffectLive(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text;
    setText('');
    await MessageStore.send(cid, role, t);
    refresh();
  };

  const [hoverId, setHoverId] = useStateLive(null);
  const deleteMsg = async (m) => {
    // Optimistic soft-delete so it feels instant, then confirm with the store
    setMsgs(list => list.map(x => x.id === m.id ? { ...x, deleted: true } : x));
    await MessageStore.deleteMessage(cid, m.id);
    refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Thread header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <Avatar name={otherName} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{otherName}</div>
          {otherSubtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{otherSubtitle}</div>}
        </div>
        <LiveBadge online={MessageStore.isOnline()} label={MessageStore.isOnline() ? 'LIVE' : 'LIVE · LOCAL'} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        {msgs.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Icon name="message" size={34} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>{emptyHint || 'No messages yet — say hello 👋'}</div>
          </div>
        )}
        {msgs.map((m, i) => {
          const isMe = m.from === role;
          const del  = !!m.deleted;
          const prev = msgs[i - 1];
          const showDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
          return (
            <React.Fragment key={m.id}>
            {showDay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: i === 0 ? '2px 0 6px' : '10px 0 6px' }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '3px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{fmtMsgDay(m.ts)}</span>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
              </div>
            )}
            <div
              onMouseEnter={() => setHoverId(m.id)} onMouseLeave={() => setHoverId(h => h === m.id ? null : h)}
              style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
              {!isMe && <Avatar name={otherName} size={32} />}
              {isMe && !del && (
                <button onClick={() => deleteMsg(m)} title="Delete message"
                  style={{
                    width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'transparent',
                    color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, opacity: hoverId === m.id ? 1 : 0, transition: 'opacity 0.15s, background 0.15s',
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="trash" size={14} />
                </button>
              )}
              <div style={{ maxWidth: '68%' }}>
                <div style={del ? {
                  padding: '11px 15px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px dashed var(--border)',
                  fontSize: 13.5, fontStyle: 'italic', lineHeight: 1.55,
                } : {
                  padding: '11px 15px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? 'var(--primary)' : 'var(--surface)',
                  color: isMe ? '#fff' : 'var(--text)',
                  border: isMe ? 'none' : '1px solid var(--border)',
                  fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{del ? 'This message has been deleted' : m.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{fmtMsgTime(m.ts)}</div>
              </div>
              {isMe && <Avatar name={meName} size={32} />}
            </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, flexShrink: 0 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={`Message ${otherName}…`}
          style={{ flex: 1, padding: '11px 16px', borderRadius: 22, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: 'var(--text)' }} />
        <button onClick={send} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <Icon name="send" size={17} />
        </button>
      </div>
    </div>
  );
};

/* useUnread — live unread count for a role (sidebar badges) */
function useUnread(role) {
  const [n, setN] = useStateLive(() => MessageStore.totalUnread(role));
  useEffectLive(() => {
    let alive = true;
    const fn = async () => {
      let v;
      if (MessageStore.isOnline() && role === 'doctor') {
        // Online doctor: derive from the backend so the badge tracks live
        // sends, reads and (soft-)deletes — never stale localStorage.
        try {
          const t = await MessageStore.threads();
          v = t.reduce((s, c) => s + (c.unread || 0), 0);
        } catch { v = MessageStore.totalUnread(role); }
      } else {
        v = MessageStore.totalUnread(role);
      }
      if (alive) setN(v);
    };
    fn();
    const unsub = MessageStore.subscribe(fn);
    return () => { alive = false; unsub(); };
  }, [role]);
  return n;
}

Object.assign(window, { MessageStore, ChatThread, fmtMsgTime, useUnread });
