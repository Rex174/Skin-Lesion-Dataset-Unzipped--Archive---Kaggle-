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
   MODEL REGISTRY  — all models trained in Phase 1
   ⚠ Replace these numbers with your real Phase 1 results
     (phase1_outputs/results/all_results.json). The backend
     endpoint /api/models/comparison overrides this at runtime.
═══════════════════════════════════════════════════════════ */
const MODEL_REGISTRY = [
  {
    key: 'baseline', name: 'Model A — Baseline CNN',
    arch: 'EfficientNet-B0', mitigation: 'None (original HAM10000)',
    accuracy: 0.842, macroF1: 0.690, meanEOD: 0.241, worstEOD: 0.36,
    demographicParity: 0.61, isBest: false,
    note: 'Trained on the raw imbalanced dataset. Strong overall accuracy but large fairness gaps for darker skin tones, pediatric and rare-site lesions.',
  },
  {
    key: 'reweighted', name: 'Model B — Reweighted',
    arch: 'EfficientNet-B0', mitigation: 'Stratified sampling + adaptive reweighting',
    accuracy: 0.851, macroF1: 0.724, meanEOD: 0.142, worstEOD: 0.21,
    demographicParity: 0.74, isBest: false,
    note: 'Intersectional stratified sampling and distribution-aware reweighting markedly narrow the gaps, with a small accuracy gain.',
  },
  {
    key: 'cgan_only', name: 'Model C — cGAN Augmented',
    arch: 'EfficientNet-B0', mitigation: 'Conditional GAN image augmentation',
    accuracy: 0.848, macroF1: 0.731, meanEOD: 0.118, worstEOD: 0.17,
    demographicParity: 0.78, isBest: false,
    note: 'Synthetic minority-subgroup images from the cGAN improve representation of rare groups, lowering EOD further.',
  },
  {
    key: 'enhanced_v2', name: 'Model D — Enhanced v2 (Hybrid)',
    arch: 'EfficientNet-B0', mitigation: 'Sampling + Reweighting + cGAN (full framework)',
    accuracy: 0.863, macroF1: 0.758, meanEOD: 0.071, worstEOD: 0.11,
    demographicParity: 0.83, isBest: true,
    note: 'The full hybrid data-centric framework. Best accuracy AND lowest bias — selected as the deployed model for melanoma detection.',
  },
];

/* Per-demographic-subgroup EOD before/after framework — drives the
   per-result "bias reduction" panel. Keyed by simplified subgroup. */
const SUBGROUP_EOD = {
  // skinTypeBand: { baseline, enhanced }
  light:  { label: 'Lighter skin (Type I–III)', baseline: 0.06, enhanced: 0.03 },
  medium: { label: 'Medium skin (Type IV)',     baseline: 0.13, enhanced: 0.05 },
  dark:   { label: 'Darker skin (Type V–VI)',   baseline: 0.27, enhanced: 0.08 },
  pediatric: { label: 'Pediatric (0–17)',       baseline: 0.31, enhanced: 0.09 },
};

function skinBand(skinType) {
  if (['V','VI'].includes(skinType)) return 'dark';
  if (skinType === 'IV') return 'medium';
  return 'light';
}

/* EOD lookup for a given patient → before/after + reduction % */
function eodForPatient(patient) {
  let band = 'medium';
  if (patient) {
    if ((patient.age != null && patient.age < 18)) band = 'pediatric';
    else band = skinBand(patient.skinType);
  }
  const e = SUBGROUP_EOD[band] || SUBGROUP_EOD.medium;
  const reduction = e.baseline > 0 ? Math.round((1 - e.enhanced / e.baseline) * 100) : 0;
  return { band, label: e.label, baseline: e.baseline, enhanced: e.enhanced, reduction };
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
    // analytics live drift around the Phase-1 baseline
    overallAccuracy: 0.863,
    meanEOD: 0.071,
    demographicParity: 0.83,
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
    // Analytics drift (tiny, bounded) — looks alive without lying much
    const jitter = (base, amp) => +(base + (Math.random() - 0.5) * amp).toFixed(3);
    state.overallAccuracy   = Math.min(0.9,  Math.max(0.85, jitter(state.overallAccuracy, 0.004)));
    state.meanEOD           = Math.min(0.09,  Math.max(0.05, jitter(state.meanEOD, 0.004)));
    state.demographicParity = Math.min(0.86, Math.max(0.80, jitter(state.demographicParity, 0.006)));
    state.imagesEvaluated  += Math.floor(Math.random() * 3);
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
        meanEOD: state.meanEOD,
        demographicParity: state.demographicParity,
        imagesEvaluated: state.imagesEvaluated,
      };
    },
  };
})();

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
    fairness_note: e.band === 'dark' || e.band === 'pediatric'
      ? `This patient belongs to an underrepresented subgroup (${e.label}). The Enhanced v2 model applied synthetic cGAN augmentation and reweighting to improve fairness for this group.`
      : null,
    model_used: 'enhanced_v2',
    eod_baseline: e.baseline,
    eod_enhanced: e.enhanced,
    eod_reduction: e.reduction,
    eod_subgroup: e.label,
    _demo: true,
  };
}

Object.assign(window, {
  MODEL_REGISTRY, SUBGROUP_EOD, eodForPatient, skinBand,
  ModelsApi, LiveSim, useLive, useSim, AnimatedNumber, LiveBadge,
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
