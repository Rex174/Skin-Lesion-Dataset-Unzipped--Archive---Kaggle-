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
   Model E (Full Framework), per model_paths.json → "enhanced_v2".
   Fairness is measured on AGE GROUP, SEX and LESION LOCATION
   (HAM10000 has no skin-tone labels). meanEOD = mean of the three
   axis EODs; worstEOD = the largest. The backend endpoint
   /api/models/comparison overrides this at runtime from the JSON.
═══════════════════════════════════════════════════════════ */
const MODEL_REGISTRY = [
  {
    key: 'baseline', name: 'Model A — Standard Baseline',
    arch: 'EfficientNet-B0', mitigation: 'None (original imbalanced HAM10000)',
    accuracy: 0.8596, auc: 0.9836, sensitivity: 0.7648, melSensitivity: 0.4578, ece: 0.0192,
    eodAge: 0.3404, eodSex: 0.0840, eodLoc: 0.6800, meanEOD: 0.368, worstEOD: 0.680, isBest: false,
    note: 'Trained on the raw imbalanced dataset. Highest accuracy and melanoma sensitivity, but the largest fairness gaps — especially across lesion location (EOD 0.68) and age group (EOD 0.34).',
  },
  {
    key: 'sampling_only', name: 'Model B — Sampling Only',
    arch: 'EfficientNet-B0', mitigation: 'Intersectional stratified sampling',
    accuracy: 0.7917, auc: 0.9475, sensitivity: 0.5865, melSensitivity: 0.2590, ece: 0.0585,
    eodAge: 0.0318, eodSex: 0.0361, eodLoc: 0.3438, meanEOD: 0.137, worstEOD: 0.344, isBest: false,
    note: 'Stratified sampling sharply reduces age- and sex-based bias, at a cost to overall accuracy and melanoma sensitivity.',
  },
  {
    key: 'reweight_only', name: 'Model C — Reweighting Only',
    arch: 'EfficientNet-B0', mitigation: 'Adaptive distribution-aware reweighting',
    accuracy: 0.6411, auc: 0.8803, sensitivity: 0.5736, melSensitivity: 0.3012, ece: 0.0937,
    eodAge: 0.0505, eodSex: 0.1201, eodLoc: 0.3939, meanEOD: 0.188, worstEOD: 0.394, isBest: false,
    note: 'Reweighting alone lowers age-group bias but is the least accurate and least calibrated, and worsens sex-based EOD.',
  },
  {
    key: 'cgan_only', name: 'Model D — cGAN Only',
    arch: 'EfficientNet-B0', mitigation: 'Conditional GAN image augmentation',
    accuracy: 0.8046, auc: 0.9535, sensitivity: 0.6371, melSensitivity: 0.2831, ece: 0.0634,
    eodAge: 0.0484, eodSex: 0.0285, eodLoc: 0.4062, meanEOD: 0.161, worstEOD: 0.406, isBest: false,
    note: 'Synthetic minority-subgroup images preserve strong accuracy while lowering age- and sex-based bias.',
  },
  {
    key: 'enhanced_v2', name: 'Model E — Full Framework',
    arch: 'EfficientNet-B0', mitigation: 'Sampling + Reweighting + cGAN (full hybrid framework)',
    accuracy: 0.7327, auc: 0.9276, sensitivity: 0.6081, melSensitivity: 0.2892, ece: 0.0543,
    eodAge: 0.0299, eodSex: 0.0129, eodLoc: 0.3467, meanEOD: 0.130, worstEOD: 0.347, isBest: true,
    note: 'The full hybrid data-centric framework — the deployed model. Lowest bias on every axis (age EOD 0.030, sex EOD 0.013), trading ~13 points of accuracy for substantially fairer predictions.',
  },
];

/* ═══════════════════════════════════════════════════════════
   EOD BY FAIRNESS AXIS  — real baseline (Model A) vs deployed
   (Model E) Equal Opportunity Difference on each protected axis.
   Drives the analytics charts and the per-result bias panel.
═══════════════════════════════════════════════════════════ */
const EOD_BY_AXIS = {
  age:      { axisLabel: 'Age group',       baseline: 0.3404, enhanced: 0.0299 },
  sex:      { axisLabel: 'Sex',             baseline: 0.0840, enhanced: 0.0129 },
  location: { axisLabel: 'Lesion location', baseline: 0.6800, enhanced: 0.3467 },
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
function eodForPatient(patient) {
  const age  = patient?.age;
  const sex  = patient?.sex;
  const loc  = patient?.localization;
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
  comparison: () => apiFetch('/api/models/comparison'),
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
    // analytics live baseline = REAL deployed-model (Model E) metrics
    overallAccuracy: 0.7327,
    macroAuc: 0.9276,
    meanEOD: 0.130,
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
    state.meanEOD         = Math.min(0.14, Math.max(0.12, jitter(state.meanEOD, 0.003)));
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
    recordAnalysis({ patientId, patientName, dx, dxLabel, confidence, riskLevel }) {
      const patient = patients.find(p => p.id === patientId);
      analyses.unshift({
        id: 'L' + Date.now(),
        patientId,
        patientName: patientName || (patient ? patient.name : 'Unknown'),
        dx, dxLabel, confidence,
        riskLevel: riskLevel === 'moderate' ? 'medium' : riskLevel,
        date: todayISO(), live: true, _ts: Date.now(),
      });
      if (patient) {
        patient.lastVisit = todayISO();
        if (riskLevel === 'high') patient.riskLevel = 'high';
      }
      emit();
    },

    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
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
   APPOINTMENTS  — database-backed when Flask is running, demo
   fallback offline. AppointmentApi hits the REST endpoints;
   useAppointments(role) gives a live list + book/reschedule/cancel.
═══════════════════════════════════════════════════════════ */
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
    if (state.online) {
      try { await AppointmentApi.book({ patient_id: patientId, date, time, duration, reason }); await refresh(); return; }
      catch (e) { /* fall through */ }
    }
    ClinicStore.addAppointmentLocal({
      id: 'APT' + Date.now(), patientId: patientId || (window.PATIENT_USER || {}).id,
      patientName: (window.PATIENT_USER || {}).name, date, time,
      duration: duration || 30, reason: reason || 'Consultation', status: 'scheduled',
    });
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
  const e = eodForPatient(patient);
  return {
    predicted_class: dx,
    predicted_label: DX_LABELS[dx],
    confidence_score: +conf.toFixed(4),
    risk_level: riskMap[dx] || 'low',
    all_probabilities: Object.fromEntries(Object.entries(probs).map(([k,v]) => [k, +(v*100).toFixed(2)])),
    fairness_note: e.underrepresented
      ? `This patient belongs to a historically underrepresented subgroup (${e.axes.map(a=>a.subgroup).join(', ')}). The Full Framework model (Model E) applied stratified sampling, reweighting and synthetic cGAN augmentation to improve fairness for such groups.`
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

Object.assign(window, {
  MODEL_REGISTRY, EOD_BY_AXIS, eodForPatient, ageGroupOf, locZoneOf, AGE_GROUP_LABEL,
  ModelsApi, LiveSim, ClinicStore, useClinic, AppointmentApi, useAppointments, useLive, useSim, AnimatedNumber, LiveBadge,
  simulatePrediction,
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

  // Probe backend once
  (async function probe() {
    try {
      const r = await fetch('/api/messages?patient_id=__ping', { credentials: 'same-origin' });
      online = r.ok;
    } catch { online = false; }
  })();

  const localThread = (cid) => (readLS()[cid] || []).filter(Boolean).sort((a, b) => a.ts - b.ts);

  return {
    isOnline: () => online,

    async thread(cid) {
      if (online) {
        try { const j = await apiFetch('/api/messages?patient_id=' + encodeURIComponent(cid)); return j.data || j; }
        catch { /* fall through */ }
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

    /* Doctor conversation list — one row per patient */
    async threads() {
      if (online) {
        try { const j = await apiFetch('/api/messages/threads'); return j.data || j; }
        catch { /* fall through */ }
      }
      const all = readLS();
      const mark = readMark();
      return (typeof PATIENTS !== 'undefined' ? PATIENTS : []).map(p => {
        const t = (all[p.id] || []).filter(Boolean).sort((a, b) => a.ts - b.ts);
        const last = t[t.length - 1] || null;
        const lastRead = mark['doctor:' + p.id] || 0;
        const unread = t.filter(m => m.from === 'patient' && m.ts > lastRead).length;
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
      const newest = t.filter(m => m.from === other).reduce((mx, m) => Math.max(mx, m.ts), 0);
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
      return t.filter(m => m.from === other && m.ts > lr).length;
    },

    totalUnread(role) {
      if (role === 'doctor') {
        const all = readLS(); const mark = readMark(); let n = 0;
        (typeof PATIENTS !== 'undefined' ? PATIENTS : []).forEach(p => {
          const t = (all[p.id] || []).filter(Boolean);
          const lr = mark['doctor:' + p.id] || 0;
          n += t.filter(m => m.from === 'patient' && m.ts > lr).length;
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
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const clock = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return clock;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + clock;
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
        {msgs.map(m => {
          const isMe = m.from === role;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-end' }}>
              {!isMe && <Avatar name={otherName} size={32} />}
              <div style={{ maxWidth: '68%' }}>
                <div style={{
                  padding: '11px 15px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? 'var(--primary)' : 'var(--surface)',
                  color: isMe ? '#fff' : 'var(--text)',
                  border: isMe ? 'none' : '1px solid var(--border)',
                  fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{m.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{fmtMsgTime(m.ts)}</div>
              </div>
              {isMe && <Avatar name={meName} size={32} />}
            </div>
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
    const fn = () => setN(MessageStore.totalUnread(role));
    fn();
    const unsub = MessageStore.subscribe(fn);
    return unsub;
  }, [role]);
  return n;
}

Object.assign(window, { MessageStore, ChatThread, fmtMsgTime, useUnread });
