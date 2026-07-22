/**
 * hms_olap.jsx — MelanoScan HMS · Doctor Portal
 * TP070818 | Ramaneiss Pillai S Gopalan
 *
 * Interactive OLAP analytics dashboard. Replaces the static DoctorAnalytics.
 * Builds a scan-level FACT CUBE (analyses × patient demographics) and supports:
 *   • Slice / dice / cross-filter across Age, Sex, Location, Diagnosis, Risk, Month
 *   • Cross-highlighting (hover a category → its contribution lights up everywhere)
 *   • Drill-down (progressive dimension nesting) + drill-through (record-level table + CSV)
 *   • Customizable KPI cards (pick measure per card, persisted)
 *   • Real-time data feed (live incoming scans grow the cube)
 *   • Time-range historic filtering + monthly trend
 *   • Rich tooltips / hover effects on every mark
 *
 * Loaded AFTER hms_doctor.jsx so window.DoctorAnalytics resolves to this OLAP version.
 * Depends on globals: Card, Icon, Badge, Btn, Divider, TopBar, PageContent, LiveBadge,
 *   AnimatedNumber, GroupedBarChart, useLive, LiveSim, ClinicStore, ANALYTICS_DATA,
 *   DX_LABELS, DX_ORDER, ageGroupOf, locZoneOf, AGE_GROUP_LABEL.
 */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ═══════════════════════ CUBE MODEL ═══════════════════════ */

const OLAP_DIMS = {
  age:      { label: 'Age Group',       short: 'Age',      get: r => r.ageGroup, icon: 'user'     },
  sex:      { label: 'Sex',             short: 'Sex',      get: r => r.sex,      icon: 'users'    },
  location: { label: 'Lesion Location', short: 'Location', get: r => r.location, icon: 'mapPin'   },
  dx:       { label: 'Diagnosis',       short: 'Diagnosis',get: r => DX_CANON[r.dxCode] || r.dx, icon: 'activity' },
  risk:     { label: 'Risk Level',      short: 'Risk',     get: r => r.risk,     icon: 'shield'   },
  month:    { label: 'Month',           short: 'Month',    get: r => r.monthLabel, icon: 'calendar' },
};

const DIM_ORDER = {
  age:      ['Pediatric (0–17)', 'Young adult (18–39)', 'Middle-aged (40–59)', 'Elderly (60+)', 'Unknown age'],
  sex:      ['Female', 'Male', 'Unknown'],
  location: ['Back', 'Trunk', 'Abdomen', 'Chest', 'Upper Extremity', 'Hand', 'Lower Extremity', 'Foot', 'Acral', 'Face', 'Scalp', 'Neck', 'Ear', 'Genital', 'Unknown'],
  dx:       ['Melanoma', 'Melanocytic Nevi', 'Basal Cell Carcinoma', 'Actinic Keratosis', 'Benign Keratosis', 'Dermatofibroma', 'Vascular Lesion'],
  risk:     ['High', 'Moderate', 'Low'],
  month:    null, // chronological, derived
};

const RISK_COLOR = { High: 'var(--danger)', Moderate: 'var(--warning)', Low: 'var(--success)' };
const SEX_COLOR  = { Female: '#C77B6A', Male: '#5B8DB8', Unknown: 'var(--text-light)' };
const DX_PALETTE = ['var(--danger)', 'var(--secondary)', 'var(--accent)', 'var(--info)', 'var(--success)', '#8E6AB0', '#D9822B', '#C77B6A', '#5B8DB8', '#B0913F'];
const _dxColorMap = {};
let _dxColorNext = 0;
function dxColor(label) {
  if (!(label in _dxColorMap)) { _dxColorMap[label] = DX_PALETTE[_dxColorNext % DX_PALETTE.length]; _dxColorNext++; }
  return _dxColorMap[label];
}
/* Canonical diagnosis label per class code — the DB stores two spellings for
   akiec/vasc (app.py seed labels vs config.CLASS_LABELS), so group by code. */
const DX_CANON = { akiec: 'Actinic Keratosis', bcc: 'Basal Cell Carcinoma', bkl: 'Benign Keratosis', df: 'Dermatofibroma', mel: 'Melanoma', nv: 'Melanocytic Nevi', vasc: 'Vascular Lesion' };

function colorFor(dim, key) {
  if (dim === 'risk') return RISK_COLOR[key] || 'var(--text-muted)';
  if (dim === 'sex')  return SEX_COLOR[key] || 'var(--text-light)';
  if (dim === 'dx')   return dxColor(key);
  if (dim === 'age')  return 'var(--info)';
  if (dim === 'location') return 'var(--primary)';
  return 'var(--secondary)';
}

const OLAP_MEASURES = {
  scans:    { label: 'Total Scans',     kind: 'cohort', icon: 'layers',     variant: 'info',    fmt: v => Math.round(v).toLocaleString(),
              agg: rows => rows.length, desc: 'Analyses in current view' },
  patients: { label: 'Unique Patients', kind: 'cohort', icon: 'users',      variant: 'secondary', fmt: v => Math.round(v).toLocaleString(),
              agg: rows => new Set(rows.map(r => r.patientId)).size, desc: 'Distinct patients scanned' },
  melanoma: { label: 'Melanoma Cases',  kind: 'cohort', icon: 'activity',   variant: 'danger',  fmt: v => Math.round(v).toLocaleString(),
              agg: rows => rows.filter(r => r.dxCode === 'mel').length, desc: 'Positive melanoma detections' },
  highRisk: { label: 'High-Risk',       kind: 'cohort', icon: 'shield',     variant: 'danger',  fmt: v => Math.round(v).toLocaleString(),
              agg: rows => rows.filter(r => r.risk === 'High').length, desc: 'High-risk outcomes' },
  melRate:  { label: 'Melanoma Rate',   kind: 'cohort', icon: 'trendingUp', variant: 'warning', fmt: v => (v * 100).toFixed(1) + '%',
              agg: rows => rows.length ? rows.filter(r => r.dxCode === 'mel').length / rows.length : 0, desc: 'Share of scans that are melanoma' },
  avgConf:  { label: 'Avg Confidence',  kind: 'cohort', icon: 'checkCircle', variant: 'success', fmt: v => (v * 100).toFixed(1) + '%',
              agg: rows => rows.length ? rows.reduce((s, r) => s + (r.confidence || 0), 0) / rows.length : 0, desc: 'Mean model confidence' },
  accuracy: { label: 'Model Accuracy',  kind: 'model',  icon: 'shield',     variant: 'info',    fmt: v => (v * 100).toFixed(1) + '%',
              modelKey: 'overallAccuracy', fallback: 0.7327, desc: 'Deployed model (E) — static' },
  auc:      { label: 'Macro AUC',       kind: 'model',  icon: 'activity',   variant: 'success', fmt: v => v.toFixed(3),
              modelKey: 'macroAuc', fallback: 0.9324, desc: 'Discrimination — static' },
  meanEOD:  { label: 'Mean EOD',        kind: 'model',  icon: 'trendingUp', variant: 'success', fmt: v => v.toFixed(3),
              modelKey: 'meanEOD', fallback: 0.246, desc: 'Fairness gap (age·sex·loc) — static' },
};

/* passes(row, filters, exceptDim) — true if the row satisfies every active
   filter, optionally skipping one dimension (cross-filter semantics). */
function passes(row, filters, exceptDim) {
  for (const d in filters) {
    if (d === exceptDim) continue;
    const sel = filters[d];
    if (!sel || !sel.length) continue;
    if (!sel.includes(OLAP_DIMS[d].get(row))) return false;
  }
  return true;
}

/* Category breakdown for one dimension with optional cross-highlight overlay. */
function catData(rows, dim, allCats, hover) {
  const totals = {}, highs = {};
  const H = hover && hover.dim !== dim;
  for (const r of rows) {
    const k = OLAP_DIMS[dim].get(r);
    totals[k] = (totals[k] || 0) + 1;
    if (H && OLAP_DIMS[hover.dim].get(r) === hover.key) highs[k] = (highs[k] || 0) + 1;
  }
  return allCats.map(k => ({ key: k, total: totals[k] || 0, highlight: H ? (highs[k] || 0) : (totals[k] || 0) }));
}

/* ═══════════════════════ REAL SCAN FACTS ═══════════════════════
   The cube is built PURELY from real recorded scans — the melanoma_checks
   table (via /api/doctor/analytics-facts) when the Flask backend is reachable,
   otherwise the offline ClinicStore (real seeded detections + scans recorded
   this session). No synthetic/demo activity is injected. */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const titleCase = s => String(s || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';

/* Join offline ClinicStore analyses with patient demographics → fact rows
   (same shape the /analytics-facts endpoint returns). */
function realFacts(analyses, patients) {
  const pmap = {};
  patients.forEach(p => { pmap[p.id] = p; });
  return analyses.map(a => {
    const p = pmap[a.patientId] || {};
    const dt = new Date(a._ts || Date.parse(a.date) || Date.now());
    const risk = a.riskLevel === 'high' ? 'High' : (a.riskLevel === 'medium' || a.riskLevel === 'moderate') ? 'Moderate' : 'Low';
    return {
      id: a.id, patientId: a.patientId, patientName: a.patientName || (p.name || 'Unknown'),
      date: a.date, ts: dt.getTime(), month: (a.date || '').slice(0, 7),
      monthLabel: MONTH_NAMES[dt.getMonth()] + ' ' + String(dt.getFullYear()).slice(2),
      ageGroup: AGE_GROUP_LABEL[ageGroupOf(p.age)] || 'Unknown age',
      sex: p.sex || 'Unknown',
      location: titleCase(a.localization || p.localization),
      dx: DX_CANON[a.dx] || a.dxLabel || DX_LABELS[a.dx] || a.dx || 'Unknown',
      dxCode: a.dx,
      risk, confidence: a.confidence || 0, live: !!a.live,
    };
  });
}

/* ═══════════════════════ TOOLTIP ═══════════════════════ */
function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div style={{
      position: 'fixed', left: tip.x + 14, top: tip.y + 14, zIndex: 9999, pointerEvents: 'none',
      background: 'var(--text)', color: '#fff', padding: '8px 11px', borderRadius: 8, fontSize: 12,
      boxShadow: 'var(--shadow-md)', maxWidth: 240, lineHeight: 1.5,
    }}>
      {tip.title && <div style={{ fontWeight: 800, marginBottom: 3 }}>{tip.title}</div>}
      {tip.lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, opacity: l.dim ? 0.7 : 1 }}>
          <span>{l.k}</span><span style={{ fontWeight: 700 }}>{l.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ INTERACTIVE CHARTS ═══════════════════════ */

/* CategoryChart — vertical or horizontal bars with cross-filter click,
   cross-highlight overlay, selection state, and tooltips. */
function CategoryChart({ dim, data, orientation = 'v', height = 200, filters, onToggle, onHover, setTip, total }) {
  const sel = filters[dim] || [];
  const hasSel = sel.length > 0;
  const max = Math.max(1, ...data.map(d => d.total));
  const grand = total || data.reduce((s, d) => s + d.total, 0) || 1;

  const enter = (e, d) => {
    onHover({ dim, key: d.key });
    const pct = ((d.total / grand) * 100).toFixed(1);
    const lines = [{ k: OLAP_MEASURES.scans.label, v: d.total.toLocaleString() }, { k: '% of view', v: pct + '%' }];
    if (d.highlight !== d.total) lines.push({ k: 'Highlighted', v: d.highlight.toLocaleString(), dim: true });
    setTip({ x: e.clientX, y: e.clientY, title: `${OLAP_DIMS[dim].short}: ${d.key}`, lines });
  };
  const move = (e) => setTip(t => t && ({ ...t, x: e.clientX, y: e.clientY }));
  const leave = () => { onHover(null); setTip(null); };

  if (orientation === 'h') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.map(d => {
          const active = !hasSel || sel.includes(d.key);
          const c = colorFor(dim, d.key);
          return (
            <div key={d.key} onClick={() => onToggle(dim, d.key)} onMouseEnter={e => enter(e, d)} onMouseMove={move} onMouseLeave={leave}
              style={{ cursor: 'pointer', opacity: active ? 1 : 0.4, transition: 'opacity .15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                <span style={{ color: 'var(--text)', fontWeight: sel.includes(d.key) ? 700 : 500 }}>{d.key}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{d.total.toLocaleString()}</span>
              </div>
              <div style={{ height: 12, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${(d.total / max) * 100}%`, background: c, opacity: 0.28, borderRadius: 4, transition: 'width .5s' }} />
                <div style={{ position: 'absolute', inset: 0, width: `${(d.highlight / max) * 100}%`, background: c, borderRadius: 4, transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, paddingTop: 18 }}>
      {data.map(d => {
        const active = !hasSel || sel.includes(d.key);
        const c = colorFor(dim, d.key);
        const h = (d.total / max) * (height - 34);
        const hh = (d.highlight / max) * (height - 34);
        return (
          <div key={d.key} onClick={() => onToggle(dim, d.key)} onMouseEnter={e => enter(e, d)} onMouseMove={move} onMouseLeave={leave}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer', height: '100%', opacity: active ? 1 : 0.4, transition: 'opacity .15s' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{d.total.toLocaleString()}</div>
            <div style={{ width: '78%', maxWidth: 54, height: Math.max(2, h), background: 'var(--surface-2)', borderRadius: '5px 5px 0 0', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%', background: c, opacity: 0.28 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${d.total ? (d.highlight / d.total) * 100 : 0}%`, background: c, borderRadius: sel.includes(d.key) ? '5px 5px 0 0' : 0, boxShadow: sel.includes(d.key) ? `inset 0 0 0 2px var(--text)` : 'none' }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center', lineHeight: 1.25, minHeight: 30, whiteSpace: 'normal' }}>{d.key}</div>
          </div>
        );
      })}
    </div>
  );
}

/* DonutSlice chart with cross-filter + highlight. */
function OlapDonut({ dim, data, filters, onToggle, onHover, setTip, size = 156, thickness = 26 }) {
  const sel = filters[dim] || [];
  const hasSel = sel.length > 0;
  const total = data.reduce((s, d) => s + d.total, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  const segs = data.filter(d => d.total > 0).map(d => {
    const frac = d.total / total; const seg = { ...d, frac, dash: frac * c, offset: off, color: colorFor(dim, d.key) };
    off += frac * c; return seg;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {segs.map(s => {
          const active = !hasSel || sel.includes(s.key);
          return (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sel.includes(s.key) ? thickness + 5 : thickness}
              strokeDasharray={`${s.dash} ${c - s.dash}`} strokeDashoffset={-s.offset}
              style={{ opacity: active ? 1 : 0.35, cursor: 'pointer', transition: 'opacity .15s, stroke-width .15s' }}
              onClick={() => onToggle(dim, s.key)}
              onMouseEnter={e => { onHover({ dim, key: s.key }); setTip({ x: e.clientX, y: e.clientY, title: `${OLAP_DIMS[dim].short}: ${s.key}`, lines: [{ k: 'Scans', v: s.total.toLocaleString() }, { k: 'Share', v: (s.frac * 100).toFixed(1) + '%' }] }); }}
              onMouseMove={e => setTip(t => t && ({ ...t, x: e.clientX, y: e.clientY }))}
              onMouseLeave={() => { onHover(null); setTip(null); }} />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 130 }}>
        {data.map(d => (
          <div key={d.key} onClick={() => onToggle(dim, d.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, opacity: (!hasSel || sel.includes(d.key)) ? 1 : 0.4 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colorFor(dim, d.key), flexShrink: 0 }} />
            <span style={{ color: 'var(--text)', fontWeight: sel.includes(d.key) ? 700 : 500 }}>{d.key}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontWeight: 700 }}>{((d.total / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Monthly trend — line + area, hover points, click a month to filter. */
function TrendChart({ points, filters, onToggle, setTip, height = 180 }) {
  const sel = filters.month || [];
  const w = 620, pad = 34;
  const max = Math.max(1, ...points.map(p => p.total));
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [pad + i * stepX, height - 24 - (p.total / max) * (height - 48)]);
  const line = xy.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = points.length ? `${line} L ${xy[xy.length - 1][0]} ${height - 24} L ${xy[0][0]} ${height - 24} Z` : '';
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" style={{ display: 'block' }}>
      <defs><linearGradient id="olapArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
      {area && <path d={area} fill="url(#olapArea)" />}
      {line && <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" />}
      {points.map((p, i) => {
        const on = sel.includes(p.key);
        return (
          <g key={p.key} style={{ cursor: 'pointer' }} onClick={() => onToggle('month', p.key)}
            onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, title: p.key, lines: [{ k: 'Scans', v: p.total.toLocaleString() }] })}
            onMouseMove={e => setTip(t => t && ({ ...t, x: e.clientX, y: e.clientY }))}
            onMouseLeave={() => setTip(null)}>
            <rect x={xy[i][0] - stepX / 2} y={0} width={stepX || 40} height={height} fill="transparent" />
            <circle cx={xy[i][0]} cy={xy[i][1]} r={on ? 6 : 4} fill={on ? 'var(--primary)' : '#fff'} stroke="var(--primary)" strokeWidth="2.5" />
            <text x={xy[i][0]} y={xy[i][1] - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">{p.total}</text>
            <text x={xy[i][0]} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">{p.key}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* Panel header used by every chart card. */
function ChartHead({ title, sub, dim, filters }) {
  const n = (filters[dim] || []).length;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
      {n > 0 && <Badge variant="info">{n} selected</Badge>}
    </div>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */

const KPI_STORE_KEY = 'hms_olap_kpis_v1';
const RANGES = [
  { key: 'all', label: 'All time', days: null },
  { key: '6m',  label: 'Last 6 months', days: 186 },
  { key: '3m',  label: 'Last 3 months', days: 93 },
  { key: '30d', label: 'Last 30 days', days: 30 },
];

const OlapDashboard = (cfg) => {
  const { eodByAxis, melTprByAge, melTprBySex, melTprByLoc } = ANALYTICS_DATA;
  const { data: liveA, online } = useLive(
    () => cfg.liveEndpoint ? apiFetch(cfg.liveEndpoint) : Promise.reject(new Error('no-live')),
    () => LiveSim.analytics(), 4000);

  const now = useMemo(() => new Date(), []);

  // ── Cube = REAL recorded scans only (DB when online, offline store fallback) ──
  const [cube, setCube] = useState([]);
  const [paused, setPaused] = useState(false);   // pause the auto-refresh feed
  const [factsOnline, setFactsOnline] = useState(false);
  const refresh = useCallback(() => {
    apiFetch(cfg.factsEndpoint)
      .then(d => { setCube(d.facts || []); setFactsOnline(true); })
      .catch(() => { setCube(cfg.offlineFacts()); setFactsOnline(false); });
  }, [cfg.factsEndpoint, cfg.offlineFacts]);
  // initial load + refresh whenever a scan is recorded offline
  useEffect(() => { refresh(); return ClinicStore.subscribe(refresh); }, [refresh]);
  // auto-refresh the real-time feed (unless paused)
  useEffect(() => { if (paused) return; const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [paused, refresh]);

  // Controls
  const [range, setRange] = useState('all');
  const [filters, setFilters] = useState({});
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState(null);

  const rangeRows = useMemo(() => {
    const days = RANGES.find(r => r.key === range)?.days;
    if (!days) return cube;
    const cut = now.getTime() - days * 864e5;
    return cube.filter(r => r.ts >= cut);
  }, [cube, range, now]);

  const filtered = useMemo(() => rangeRows.filter(r => passes(r, filters, null)), [rangeRows, filters]);

  // Stable category sets from range rows (so bars don't vanish under cross-filter)
  const cats = useMemo(() => {
    const out = {};
    for (const dim in OLAP_DIMS) {
      if (dim === 'month') continue;
      const present = new Set(rangeRows.map(r => OLAP_DIMS[dim].get(r)));
      out[dim] = (DIM_ORDER[dim] || []).filter(k => present.has(k));
      present.forEach(k => { if (!out[dim].includes(k)) out[dim].push(k); });
    }
    // months chronological
    const mset = {};
    rangeRows.forEach(r => { mset[r.month] = r.monthLabel; });
    out.month = Object.keys(mset).sort().map(m => mset[m]);
    return out;
  }, [rangeRows]);

  const toggle = (dim, key) => setFilters(f => {
    const cur = f[dim] || [];
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    const nf = { ...f, [dim]: next };
    if (!next.length) delete nf[dim];
    return nf;
  });
  const clearAll = () => setFilters({});
  const activeChips = Object.entries(filters).flatMap(([d, ks]) => ks.map(k => ({ d, k })));

  // Cross-filtered category data per dimension (exclude own dim)
  const dimData = (dim, orient) => {
    const rows = rangeRows.filter(r => passes(r, filters, dim));
    return catData(rows, dim, cats[dim] || [], hover);
  };
  const monthPoints = useMemo(() => {
    const rows = rangeRows.filter(r => passes(r, filters, 'month'));
    const g = {};
    rows.forEach(r => { g[r.month] = g[r.month] || { key: r.monthLabel, total: 0, m: r.month }; g[r.month].total++; });
    return Object.values(g).sort((a, b) => a.m.localeCompare(b.m));
  }, [rangeRows, filters]);

  // KPI cards (customizable + persisted)
  const [kpis, setKpis] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(cfg.kpiStoreKey)); if (Array.isArray(s)) { const v = s.filter(k => cfg.allowedMeasures.includes(k)); if (v.length) return v; } } catch {}
    return cfg.defaultKpis;
  });
  useEffect(() => { localStorage.setItem(cfg.kpiStoreKey, JSON.stringify(kpis)); }, [kpis, cfg.kpiStoreKey]);
  const [editKpi, setEditKpi] = useState(false);
  const modelVal = (m) => (liveA && liveA[m.modelKey] != null) ? liveA[m.modelKey] : m.fallback;
  const measureValue = (key) => {
    const m = OLAP_MEASURES[key];
    return m.kind === 'model' ? modelVal(m) : m.agg(filtered);
  };
  const setKpiAt = (i, key) => setKpis(k => k.map((x, j) => j === i ? key : x));
  const removeKpi = (i) => setKpis(k => k.length > 1 ? k.filter((_, j) => j !== i) : k);
  const addKpi = () => setKpis(k => k.length < 6 ? [...k, cfg.allowedMeasures.find(m => !k.includes(m)) || cfg.allowedMeasures[0]] : k);

  // Drill-down explorer
  const [path, setPath] = useState([]);           // [{dim,key}]
  const [axis, setAxis] = useState('location');
  const [drillOpen, setDrillOpen] = useState(false);
  const explorerRows = useMemo(() => filtered.filter(r => path.every(p => OLAP_DIMS[p.dim].get(r) === p.key)), [filtered, path]);
  const usedDims = path.map(p => p.dim);
  const axisData = catData(explorerRows, axis, cats[axis] || [], null);
  const drillInto = (key) => {
    setPath(p => [...p, { dim: axis, key }]);
    const nextAxis = Object.keys(OLAP_DIMS).find(d => d !== axis && !usedDims.includes(d) && d !== 'month' && cfg.dimKeys.includes(d));
    if (nextAxis) setAxis(nextAxis);
  };
  const popTo = (i) => { const np = path.slice(0, i); setPath(np); };

  const totalAll = rangeRows.length;
  const recentFeed = useMemo(() => cube.slice().sort((a, b) => b.ts - a.ts).slice(0, 12), [cube]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title={cfg.title} subtitle={cfg.subtitle}
        actions={<LiveBadge online={cfg.liveEndpoint ? online : factsOnline} />} />
      <PageContent>
        {/* ── Control bar ───────────────────────────── */}
        <Card style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="calendar" size={15} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Period</span>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 8 }}>
                {RANGES.map(r => (
                  <button key={r.key} onClick={() => setRange(r.key)} style={{
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                    background: range === r.key ? 'var(--primary)' : 'transparent', color: range === r.key ? '#fff' : 'var(--text-muted)',
                  }}>{r.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: paused ? 'var(--text-light)' : 'var(--success)', boxShadow: paused ? 'none' : '0 0 0 3px var(--success-bg)' }} />
                {paused ? 'Auto-refresh paused' : 'Auto-refresh on'}
              </span>
            </div>
          </div>
          {/* Active filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: activeChips.length ? 12 : 0 }}>
            {activeChips.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Filters:</span>}
            {activeChips.map(({ d, k }) => (
              <span key={d + k} onClick={() => toggle(d, k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary-dark)', border: '1px solid var(--primary)', borderRadius: 999, padding: '3px 10px' }}>
                <span style={{ opacity: 0.7 }}>{OLAP_DIMS[d].short}:</span> {k}
                <Icon name="x" size={12} />
              </span>
            ))}
            {activeChips.length > 0 && (
              <>
                <button onClick={clearAll} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Clear all</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>Showing <b style={{ color: 'var(--text)' }}>{filtered.length.toLocaleString()}</b> of {totalAll.toLocaleString()} scans</span>
              </>
            )}
          </div>
        </Card>

        {/* ── Customizable KPI cards ───────────────────────────── */}
        {cube.length === 0 && (
          <Card style={{ marginBottom: 22, borderColor: 'var(--info)', background: 'var(--info-bg)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name="info" size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{cfg.emptyMsg}</div>
            </div>
          </Card>
        )}

        {/* ── Customizable KPI cards ───────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Key Measures</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {editKpi && <Btn variant="ghost" icon="plus" onClick={addKpi}>Add card</Btn>}
            <Btn variant={editKpi ? 'primary' : 'ghost'} icon={editKpi ? 'checkCircle' : 'settings'} onClick={() => setEditKpi(e => !e)}>{editKpi ? 'Done' : 'Customize'}</Btn>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 14, marginBottom: 22 }}>
          {kpis.map((key, i) => {
            const m = OLAP_MEASURES[key];
            const val = measureValue(key);
            const share = (m.kind === 'cohort' && key !== 'melRate' && key !== 'avgConf' && m.agg(rangeRows) > 0) ? (val / m.agg(rangeRows) * 100) : null;
            return (
              <Card key={i} style={{ position: 'relative' }}>
                {editKpi && <button onClick={() => removeKpi(i)} title="Remove" style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'var(--danger-bg)', color: 'var(--danger)', width: 22, height: 22, borderRadius: 6, cursor: 'pointer', fontWeight: 800, lineHeight: 1 }}>×</button>}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `var(--${m.variant}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `var(--${m.variant})`, flexShrink: 0 }}>
                    <Icon name={m.icon} size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1 }}>{m.fmt(val)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-light)' }}>
                      {activeChips.length && share != null ? `${share.toFixed(0)}% of period` : m.desc}
                    </div>
                  </div>
                </div>
                {editKpi && (
                  <select value={key} onChange={e => setKpiAt(i, e.target.value)} style={{ marginTop: 10, width: '100%', fontFamily: 'inherit', fontSize: 12, padding: '5px 7px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                    {Object.entries(OLAP_MEASURES).filter(([k]) => cfg.allowedMeasures.includes(k)).map(([k, mm]) => <option key={k} value={k}>{mm.label}{mm.kind === 'model' ? ' (model)' : ''}</option>)}
                  </select>
                )}
              </Card>
            );
          })}
        </div>

        {/* ── Cross-filter chart grid ───────────────────────────── */}
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Slice &amp; Dice — click any bar or slice to cross-filter</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <ChartHead title="Scans by Diagnosis" sub="Click a class to filter the whole dashboard" dim="dx" filters={filters} />
            <CategoryChart dim="dx" orientation="h" data={dimData('dx')} filters={filters} onToggle={toggle} onHover={setHover} setTip={setTip} total={filtered.length} />
          </Card>
          <Card>
            <ChartHead title="Scans by Lesion Location" sub="Anatomical site — cross-filters on click" dim="location" filters={filters} />
            <CategoryChart dim="location" orientation="h" data={dimData('location')} filters={filters} onToggle={toggle} onHover={setHover} setTip={setTip} total={filtered.length} />
          </Card>
        </div>
        {cfg.showDemogCharts ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <ChartHead title="Scans by Age Group" sub="Hover to cross-highlight" dim="age" filters={filters} />
            <CategoryChart dim="age" data={dimData('age')} height={210} filters={filters} onToggle={toggle} onHover={setHover} setTip={setTip} total={filtered.length} />
          </Card>
          <Card>
            <ChartHead title="Sex" sub="Click to filter" dim="sex" filters={filters} />
            <OlapDonut dim="sex" data={dimData('sex')} filters={filters} onToggle={toggle} onHover={setHover} setTip={setTip} />
          </Card>
          <Card>
            <ChartHead title="Risk Outcome" sub="Click to filter" dim="risk" filters={filters} />
            <OlapDonut dim="risk" data={dimData('risk')} filters={filters} onToggle={toggle} onHover={setHover} setTip={setTip} />
          </Card>
        </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <ChartHead title="Risk Outcome" sub="How your scans break down by risk · click to filter" dim="risk" filters={filters} />
            <OlapDonut dim="risk" data={dimData('risk')} filters={filters} onToggle={toggle} onHover={setHover} setTip={setTip} />
          </Card>
        </div>
        )}

        {/* ── Monthly trend (historic) ───────────────────────────── */}
        <Card style={{ marginBottom: 22 }}>
          <ChartHead title="Scan Volume Over Time" sub="Monthly analyses — click a point to filter that month · auto-refreshes from the database" dim="month" filters={filters} />
          {monthPoints.length ? <TrendChart points={monthPoints} filters={filters} onToggle={toggle} setTip={setTip} /> : <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No scans in range.</div>}
        </Card>

        {/* ── Drill-down explorer + live feed ───────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 22 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Drill-Down Explorer</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Nest dimensions to drill · then open the underlying records</div>
              </div>
              <Btn variant="ghost" icon="fileText" onClick={() => setDrillOpen(true)}>View {explorerRows.length} records</Btn>
            </div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, marginBottom: 10 }}>
              <span onClick={() => popTo(0)} style={{ cursor: 'pointer', fontWeight: 700, color: path.length ? 'var(--primary)' : 'var(--text)' }}>All scans</span>
              {path.map((p, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="chevronRight" size={12} style={{ color: 'var(--text-light)' }} />
                  <span onClick={() => popTo(i + 1)} style={{ cursor: 'pointer', color: i === path.length - 1 ? 'var(--text)' : 'var(--primary)', fontWeight: 600 }}>{OLAP_DIMS[p.dim].short}: {p.key}</span>
                </span>
              ))}
            </div>
            {/* Axis picker */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>Break down by:</span>
              {Object.keys(OLAP_DIMS).filter(d => d !== 'month' && !usedDims.includes(d) && cfg.dimKeys.includes(d)).map(d => (
                <button key={d} onClick={() => setAxis(d)} style={{
                  border: '1px solid ' + (axis === d ? 'var(--primary)' : 'var(--border)'), cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  background: axis === d ? 'var(--primary-light)' : 'var(--surface)', color: axis === d ? 'var(--primary-dark)' : 'var(--text-muted)',
                }}>{OLAP_DIMS[d].short}</button>
              ))}
            </div>
            {usedDims.includes(axis)
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Pick a dimension above to break down further.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {axisData.filter(d => d.total > 0).map(d => {
                    const mx = Math.max(1, ...axisData.map(x => x.total));
                    return (
                      <div key={d.key} onClick={() => drillInto(d.key)} onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, title: `${OLAP_DIMS[axis].short}: ${d.key}`, lines: [{ k: 'Scans', v: d.total.toLocaleString() }, { k: 'Drill', v: 'click to nest' }] })} onMouseMove={e => setTip(t => t && ({ ...t, x: e.clientX, y: e.clientY }))} onMouseLeave={() => setTip(null)}
                        style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                          <span style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="cornerDownRight" size={12} style={{ color: 'var(--text-light)' }} />{d.key}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{d.total.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(d.total / mx) * 100}%`, background: colorFor(axis, d.key), borderRadius: 4, transition: 'width .4s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </Card>

          {/* Live feed */}
          <Card style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{cfg.feedTitle}</div>
              <Badge variant={paused ? 'default' : 'success'}>{paused ? 'Paused' : 'Live'}</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 300, overflowY: 'auto' }}>
              {recentFeed.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>No scans recorded yet.</div>}
              {recentFeed.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 8, background: i === 0 ? 'var(--primary-light)' : 'var(--surface-2)', animation: i === 0 ? 'olapIn .4s ease' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorFor('risk', f.risk), flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.scope === 'patient' ? f.dx : f.patientName}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{cfg.scope === 'patient' ? `${f.location} · ${f.date}` : `${f.dx} · ${f.location}`}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colorFor('risk', f.risk) }}>{(f.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {cfg.renderExtra && cfg.renderExtra({ filtered, filters, toggle, clearAll })}

        {cfg.showFairness && (<>
        {/* Model fairness (static evaluation) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px' }}>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Model Fairness — Deployed Evaluation</div>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-light)', textTransform: 'none', letterSpacing: 0, whiteSpace: 'nowrap' }}>Hover any bar for details</span>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>Equal Opportunity Difference by Protected Axis</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>Lower is fairer · baseline (Model A) vs deployed (Model E)</div>
            <GroupedBarChart data={eodByAxis} height={210} max={0.7} lowerIsBetter />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>Melanoma Sensitivity by Age Group</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>True-positive rate · baseline vs deployed</div>
            <GroupedBarChart data={melTprByAge} height={210} max={0.75} asPercent decimals={2} />
          </Card>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>Melanoma Sensitivity by Sex</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>Gap narrows from 8.4 to 1.3 points</div>
            <GroupedBarChart data={melTprBySex} height={170} max={0.6} asPercent decimals={2} />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>Melanoma Sensitivity by Lesion Location</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>True-positive rate · baseline vs deployed</div>
            <GroupedBarChart data={melTprByLoc} height={170} max={0.7} asPercent decimals={2} />
          </Card>
        </div>
        </>)}

        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-light)', lineHeight: 1.6 }}>
          {cfg.footnote}
        </div>
      </PageContent>

      {/* Drill-through modal */}
      {drillOpen && <DrillThrough rows={explorerRows} path={path} onClose={() => setDrillOpen(false)} showPatientCol={cfg.showPatientCol} fileName={cfg.csvName} />}
      <Tooltip tip={tip} />
      <style>{`@keyframes olapIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
};

/* ═══════════════════════ DRILL-THROUGH MODAL ═══════════════════════ */
function DrillThrough({ rows, path, onClose, showPatientCol = true, fileName = 'melanoscan_scans.csv' }) {
  const cols = [
    ['date', 'Date'], ...(showPatientCol ? [['patientName', 'Patient']] : []), ['ageGroup', 'Age Group'], ['sex', 'Sex'],
    ['location', 'Location'], ['dx', 'Diagnosis'], ['risk', 'Risk'], ['confidence', 'Conf.'],
  ].filter(Boolean);
  const sorted = rows.slice().sort((a, b) => b.ts - a.ts);
  const exportCsv = () => {
    const head = cols.map(c => c[1]).join(',');
    const body = sorted.map(r => cols.map(c => c[0] === 'confidence' ? (r.confidence * 100).toFixed(0) + '%' : `"${String(r[c[0]] ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([head + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = fileName; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,12,0.45)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: 'min(940px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Underlying Scan Records</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {sorted.length.toLocaleString()} records{path.length ? ' · ' + path.map(p => `${OLAP_DIMS[p.dim].short}: ${p.key}`).join(' › ') : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" icon="download" onClick={exportCsv}>Export CSV</Btn>
            <Btn variant="ghost" icon="x" onClick={onClose}>Close</Btn>
          </div>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
              {cols.map(c => <th key={c[0]} style={{ textAlign: c[0] === 'confidence' ? 'right' : 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c[1]}</th>)}
            </tr></thead>
            <tbody>
              {sorted.slice(0, 400).map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  {cols.map(c => {
                    if (c[0] === 'confidence') return <td key={c[0]} style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600 }}>{(r.confidence * 100).toFixed(0)}%</td>;
                    if (c[0] === 'patientName') return <td key={c[0]} style={{ padding: '9px 14px', fontWeight: 600 }}>{r.patientName}</td>;
                    if (c[0] === 'dx') return <td key={c[0]} style={{ padding: '9px 14px' }}><span style={{ color: r.dx === 'Melanoma' ? 'var(--danger)' : 'var(--text)', fontWeight: r.dx === 'Melanoma' ? 700 : 500 }}>{r.dx}</span></td>;
                    if (c[0] === 'risk') return <td key={c[0]} style={{ padding: '9px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, color: colorFor('risk', r.risk), background: `color-mix(in oklch, ${colorFor('risk', r.risk)} 14%, transparent)`, padding: '2px 8px', borderRadius: 999 }}>{r.risk}</span></td>;
                    if (c[0] === 'date') return <td key={c[0]} style={{ padding: '9px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.date}</td>;
                    return <td key={c[0]} style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{r[c[0]]}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length > 400 && <div style={{ padding: 12, textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>Showing first 400 of {sorted.length.toLocaleString()} — export CSV for the full set.</div>}
        </div>
      </div>
    </div>
  );
}

const DOCTOR_OLAP_CFG = {
  scope: 'doctor',
  title: 'Analytics & Fairness Metrics',
  subtitle: 'Interactive OLAP cube · real recorded scans · slice · drill · cross-filter',
  factsEndpoint: '/api/doctor/analytics-facts',
  liveEndpoint: '/api/doctor/analytics-live',
  offlineFacts: () => realFacts(ClinicStore.allAnalyses(), ClinicStore.patients()),
  dimKeys: ['dx', 'location', 'age', 'sex', 'risk', 'month'],
  allowedMeasures: ['scans', 'patients', 'melanoma', 'highRisk', 'melRate', 'avgConf', 'accuracy', 'auc', 'meanEOD'],
  defaultKpis: ['scans', 'melanoma', 'highRisk', 'accuracy'],
  kpiStoreKey: 'hms_olap_kpis_v1',
  showDemogCharts: true,
  showFairness: true,
  showPatientCol: true,
  feedTitle: 'Real-Time Scan Feed',
  csvName: 'melanoscan_scans.csv',
  emptyMsg: 'No melanoma-detection scans have been recorded yet. Run detections in the Detection Analysis page and this dashboard will populate from the database in real time.',
  footnote: "The OLAP cube aggregates real recorded HMS scans (melanoma-detection analyses stored in the database) across six dimensions, auto-refreshing as new scans are performed. Fairness charts are the deployed model's static Phase-3 evaluation.",
};

/* Base visual config for the patient's My Results OLAP dashboard. The caller
   (PatientResults) injects offlineFacts (their own scans) + renderExtra (the
   Past Scan Analysis Records list, cross-filtered). */
const PATIENT_OLAP_CFG = {
  scope: 'patient',
  title: 'My Detection Results',
  subtitle: 'Interactive analysis of your skin-lesion scans · slice · drill · cross-filter',
  factsEndpoint: '/api/patient/analytics-facts',
  liveEndpoint: null,
  dimKeys: ['dx', 'location', 'risk', 'month'],
  allowedMeasures: ['scans', 'melanoma', 'highRisk', 'melRate', 'avgConf'],
  defaultKpis: ['scans', 'melanoma', 'highRisk', 'avgConf'],
  kpiStoreKey: 'hms_patient_results_kpis_v1',
  showDemogCharts: false,
  showFairness: false,
  showPatientCol: false,
  feedTitle: 'Recent Scan Activity',
  csvName: 'my_scans.csv',
  emptyMsg: 'No scans on record yet. Run a skin-lesion scan and your interactive results dashboard will populate here.',
  footnote: 'This dashboard aggregates your own recorded skin-lesion scans and refreshes automatically as new scans are performed. Click any bar, slice, or point to cross-filter the whole view.',
};

const DoctorAnalytics = () => <OlapDashboard {...DOCTOR_OLAP_CFG} />;

Object.assign(window, { DoctorAnalytics, OlapDashboard, PATIENT_OLAP_CFG, realFacts });
