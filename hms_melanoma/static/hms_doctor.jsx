
const { useState, useRef, useEffect } = React;

/* ════════════════════════════════════════
   DOCTOR DASHBOARD
════════════════════════════════════════ */
const DoctorDashboard = ({ setPage, setSelectedPatientId }) => {
  const clinic = useClinic();
  const online = clinic.online;
  const apptState = useAppointments('doctor');
  const upcomingApts = (apptState.list || []).filter(a => a.status === 'scheduled').slice(0, 3);
  const recentDetections = (clinic.recentChecks || []).slice(0, 6);
  const totalPatients = clinic.totalPatients;
  const analysesToday = clinic.analysesToday;
  const highRiskCount = clinic.highRiskCount;
  const upcomingCount = clinic.upcomingCount;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Dashboard" subtitle={today}
        actions={<><LiveBadge online={online} /><Btn icon="plus" onClick={() => setPage('detection')}>New Analysis</Btn></>} />
      <PageContent>
        {/* Welcome */}
        <div style={{ background: 'linear-gradient(120deg, var(--primary) 0%, var(--primary-dark) 100%)', borderRadius: 'var(--radius-lg)', padding: '22px 28px', color: '#fff', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Good morning, {(typeof DOCTOR_USER !== 'undefined' && DOCTOR_USER.name) || 'Doctor'} 👋</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>You have {upcomingCount} appointment{upcomingCount === 1 ? '' : 's'} scheduled and {highRiskCount} high-risk case{highRiskCount === 1 ? '' : 's'} to review.</div>
          </div>
          <div style={{ opacity: 0.18, fontSize: 72 }}>🔬</div>
        </div>

        {/* Stats — live */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard icon="users"         label="Total Patients"  value={<AnimatedNumber value={totalPatients} />} sub="Under your care" />
          <StatCard icon="scan"          label="Analyses Today"  value={<AnimatedNumber value={analysesToday} />} sub="Updating in real time" />
          <StatCard icon="calendar"      label="Upcoming Appts"  value={<AnimatedNumber value={upcomingCount} />} />
          <StatCard icon="alertTriangle" label="High-Risk Cases" value={<AnimatedNumber value={highRiskCount} />} sub="Requires immediate action" iconColor="var(--danger)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Recent analyses — live feed */}
          <Card padding="0">
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Recent Analyses</div>
                <LiveBadge online={online} />
              </div>
              <Btn variant="ghost" size="sm" onClick={() => setPage('detection')}>New analysis</Btn>
            </div>
            <Divider />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Patient','Diagnosis','Confidence','Risk','Date'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDetections.map((d, i) => {
                  const pt = PATIENTS.find(p => p.id === d.patientId);
                  const name = d.patientName || pt?.name || 'Unknown';
                  return (
                    <tr key={d.id} className={d.live ? 'hms-row-new' : ''}
                      onClick={() => { setSelectedPatientId(ClinicStore.demoIdForName(d.patientName) || d.patientId); setPage('record'); }}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar name={name} size={28} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text)' }}>{d.dxLabel}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${d.confidence * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{(d.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px' }}><RiskBadge level={d.riskLevel} /></td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{d.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Upcoming appointments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <SectionHeader title="Upcoming Appointments" action={<Btn variant="ghost" size="sm" onClick={() => setPage('appointments')}>See all</Btn>} />
              {upcomingApts.map(apt => (
                <div key={apt.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--info-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--info)', lineHeight: 1 }}>{apt.time.split(':')[0]}</div>
                    <div style={{ fontSize: 10, color: 'var(--info)', opacity: 0.8 }}>{apt.time.split(':')[1]} {apt.time >= '12:00' ? 'PM' : 'AM'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{apt.patientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{apt.reason} · {apt.duration}min</div>
                  </div>
                </div>
              ))}
            </Card>

            {/* High risk alert */}
            {(() => { const highRisk = clinic.highRiskPatients || []; return highRisk.length > 0 && (
              <Card style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="alertTriangle" size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>High-Risk Cases Pending</div>
                    {highRisk.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPatientId(ClinicStore.demoIdForName(p.name) || p.id); setPage('record'); }}
                        style={{ fontSize: 13, color: 'var(--danger)', cursor: 'pointer', marginBottom: 2 }}>
                        → {p.name}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ); })()}
          </div>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   ADD PATIENT — registration modal
════════════════════════════════════════ */
const AddPatientModal = ({ onClose, onSaved }) => {
  const BLANK = {
    name: '', age: '', sex: 'Female', phone: '', email: '', address: '',
    bloodType: '', skinType: 'III', ita: '', localization: 'back',
    diagnosis: '', allergies: '', notes: '',
  };
  const [f, setF] = React.useState(BLANK);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const inputStyle = {
    width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, display: 'block', letterSpacing: 0.2 };

  const field = (label, k, { type, options, placeholder, full } = {}) => (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={labelStyle}>{label}</label>
      {options ? (
        <select value={f[k]} onChange={e => set(k, e.target.value)} style={inputStyle}>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : (
        <input type={type || 'text'} value={f[k]} placeholder={placeholder || ''} onChange={e => set(k, e.target.value)} style={inputStyle} />
      )}
    </div>
  );

  const save = async () => {
    setErr('');
    if (!f.name.trim()) { setErr('Patient name is required.'); return; }
    if (!f.age || isNaN(parseInt(f.age, 10))) { setErr('A valid age is required.'); return; }
    const payload = {
      name: f.name.trim(), age: parseInt(f.age, 10), sex: f.sex,
      phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(),
      bloodType: f.bloodType.trim(), skinType: f.skinType,
      ita: f.ita === '' ? null : parseInt(f.ita, 10),
      localization: f.localization, diagnosis: f.diagnosis,
      allergies: f.allergies.trim(), notes: f.notes.trim(),
    };
    setBusy(true);
    try {
      await DoctorApi.addPatient(payload);   // persists to DB + assigns to doctor
      ClinicStore.notify();                  // trigger immediate re-poll of the list
    } catch (e) {
      ClinicStore.addPatientLocal(payload);  // offline demo fallback (incremental P-ID)
    }
    setBusy(false);
    onSaved && onSaved();
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(30,20,15,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 640,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Register New Patient</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>New patients start at Low risk; scans update it. ID is assigned automatically.</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <Icon name="xMark" size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '62vh', overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Personal Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {field('Full Name', 'name', { full: true, placeholder: 'e.g. Nadia Hassan' })}
              {field('Age', 'age', { type: 'number', placeholder: 'e.g. 42' })}
              {field('Sex', 'sex', { options: ['Female', 'Male', 'Other'] })}
              {field('Phone', 'phone', { placeholder: '+60 12-345 6789' })}
              {field('Email', 'email', { type: 'email', placeholder: 'name@email.com' })}
              {field('Address', 'address', { full: true })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Medical Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {field('Blood Type', 'bloodType', { options: ['', 'A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => ({ value: v, label: v || '—' })) })}
              {field('Skin Type (Fitzpatrick)', 'skinType', { options: ['I','II','III','IV','V','VI'] })}
              {field('ITA (°)', 'ita', { type: 'number', placeholder: 'e.g. 25' })}
              {field('Primary Lesion Site', 'localization', { options: (typeof LOCALIZATIONS !== 'undefined' ? LOCALIZATIONS : ['back']).map(l => ({ value: l, label: l.replace(/\b\w/g, c => c.toUpperCase()) })) })}
              {field('Known Condition', 'diagnosis', { options: [{ value: '', label: 'None' }, ...DX_ORDER.map(dx => ({ value: dx, label: DX_LABELS[dx] }))] })}
              {field('Allergies', 'allergies', { placeholder: 'e.g. NSAIDs' })}
              {field('Clinical Notes', 'notes', { full: true })}
            </div>
          </div>

          {err && <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>{err}</div>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="secondary" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn icon="check" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Register Patient'}</Btn>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR PATIENTS LIST
════════════════════════════════════════ */
const DoctorPatients = ({ setPage, setSelectedPatientId, setDetectionPatientId }) => {
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const clinic = useClinic();  // live DB when online, demo cohort offline

  const deletePatient = async (p) => {
    setBusyId(p.id);
    try {
      await DoctorApi.deletePatient(p.id);   // persist to DB
      ClinicStore.notify();                  // trigger immediate re-poll
    } catch (e) {
      ClinicStore.deletePatientLocal(p.id);  // offline demo fallback
    }
    setBusyId(null);
    setConfirmId(null);
  };

  const filtered = (clinic.patients || []).filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.diagnosis || '').includes(search.toLowerCase());
    const matchRisk = filterRisk === 'all' || p.riskLevel === filterRisk;
    return matchSearch && matchRisk;
  });
  const totalCount = (clinic.patients || []).length;

  const skinTypeColor = t => ({ I:'#FAE8D4', II:'#F5D5B0', III:'#E5B98A', IV:'#C6935A', V:'#9B6B3A', VI:'#6B3E1A' }[t] || '#ccc');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Patient Management" subtitle={`${filtered.length} of ${totalCount} patients`}
        actions={<Btn icon="plus" onClick={() => setShowAdd(true)}>Add Patient</Btn>} />
      {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} />}
      <PageContent>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search patients…" style={{ flex: 1, maxWidth: 340 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {['all','high','medium','low'].map(r => (
              <button key={r} onClick={() => setFilterRisk(r)} style={{
                padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', fontFamily: 'inherit',
                background: filterRisk === r ? 'var(--primary)' : 'var(--surface)',
                color: filterRisk === r ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}>{r === 'all' ? 'All Risk' : r}</button>
            ))}
          </div>
        </div>

        <Card padding="0">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Patient','Age / Sex','Localization','Last Visit','Risk','Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.name} size={32} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{/^\d+$/.test(String(p.id)) ? 'P' + String(p.id).padStart(3, '0') : p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text)' }}>{p.age} / {p.sex}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text)', textTransform: 'capitalize' }}>{p.localization}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{p.lastVisit}</td>
                  <td style={{ padding: '13px 16px' }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Btn variant="secondary" size="sm" icon="eye" onClick={() => { setSelectedPatientId(p.id); setPage('record'); }}>View</Btn>
                      <Btn variant="primary"   size="sm" icon="scan" onClick={() => { setDetectionPatientId(p.id); setPage('detection'); }}>Analyze</Btn>
                      {confirmId === p.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button title="Confirm delete" onClick={() => deletePatient(p)} disabled={busyId === p.id} style={{
                            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--success)', background: 'var(--success-bg, #E7F5EC)',
                            color: 'var(--success)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}><Icon name="check" size={15} /></button>
                          <button title="Cancel" onClick={() => setConfirmId(null)} disabled={busyId === p.id} style={{
                            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
                            color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}><Icon name="xMark" size={15} /></button>
                        </div>
                      ) : (
                        <button title="Delete patient" onClick={() => setConfirmId(p.id)} style={{
                          width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
                          color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        }}><Icon name="trash" size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR DETECTION ANALYSIS
════════════════════════════════════════ */

const DoctorDetection = ({ detectionPatientId }) => {
  const clinic = useClinic();                 // live DB patients (numeric ids) when online
  const patients = clinic.patients || [];
  const [selectedPid,   setSelectedPid]   = React.useState(detectionPatientId || '');
  const [localization,  setLocalization]  = React.useState('back');
  const runCompare = false; // Detection always uses ONLY the deployed best model (Enhanced v2)
  const [step,          setStep]          = React.useState('upload'); // upload | analyzing | result | error
  const [fileUrl,       setFileUrl]       = React.useState(null);
  const [fileObj,       setFileObj]       = React.useState(null);
  const [resultE,       setResultE]       = React.useState(null);   // Enhanced model
  const [resultB,       setResultB]       = React.useState(null);   // Baseline model
  const [progress,      setProgress]      = React.useState(0);
  const [errorMsg,      setErrorMsg]      = React.useState('');
  const [notes,         setNotes]         = React.useState('');
  const fileRef = React.useRef();

  React.useEffect(() => { if (detectionPatientId) setSelectedPid(detectionPatientId); }, [detectionPatientId]);

  // Past detection history for the selected patient (live DB when numeric id)
  const [history, setHistory] = React.useState([]);
  React.useEffect(() => {
    const isDbId = /^\d+$/.test(String(selectedPid));
    if (!selectedPid) { setHistory([]); return; }
    if (!isDbId) { setHistory(DETECTIONS.filter(d => d.patientId === selectedPid)); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await apiFetch('/api/doctor/patients/' + selectedPid + '/record');
        const d = r.data || r;
        if (alive) setHistory(d.detections || []);
      } catch (e) { if (alive) setHistory([]); }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [selectedPid, step]);

  const handleFile = e => {
    const f = e.target.files[0];
    if (f) { setFileUrl(URL.createObjectURL(f)); setFileObj(f); }
  };

  const runAnalysis = async () => {
    if (!selectedPid || !fileObj) return;
    setStep('analyzing'); setProgress(0); setErrorMsg('');

    // Animate progress bar while API call runs
    const iv = setInterval(() => setProgress(p => Math.min(p + 2, 88)), 120);

    // Map API/sim response to the shape the result panel expects (hoisted so the
    // catch fallback can use it too)
    const mapResult = (r) => r ? {
      dx:           r.predicted_class,
      dxLabel:      r.predicted_label,
      confidence:   r.confidence_score,
      riskLevel:    r.risk_level,
      scores:       Object.fromEntries(Object.entries(r.all_probabilities).map(([k,v]) => [k, v/100])),
      fairnessNote: r.fairness_note,
      recommendation: getReco(r.predicted_class, r.risk_level),
      modelUsed:    r.model_used,
      demo:         r._demo,
      eodBaseline:  r.eod_baseline,
      eodEnhanced:  r.eod_enhanced,
      eodReduction: r.eod_reduction,
      eodSubgroup:  r.eod_subgroup,
    } : null;

    try {
      // Use the direct endpoint that handles both real DB IDs and mock IDs (e.g. 'P001')
      const fd = new FormData();
      fd.append('image', fileObj);
      fd.append('localization', localization);
      fd.append('runComparison', runCompare ? 'true' : 'false');
      fd.append('notes', notes || '');
      fd.append('patientAgeGroup', patient ? patient.ageGroup || '' : '');
      fd.append('patientSex', patient ? (patient.sex || '').toLowerCase() : '');
      // Pass real DB id if available (numeric), or skip
      const dbId = patient && String(patient.id).match(/^\d+$/) ? patient.id : '';
      fd.append('patientDbId', dbId);

      // Distinguish "server unreachable" (→ offline demo) from "server replied
      // with an error" (→ show the real reason, don't mask it as demo).
      let resp;
      try {
        resp = await fetch('/api/doctor/melanoma-check', {
          method: 'POST',
          credentials: 'same-origin',
          body: fd,
        });
      } catch (netErr) {
        // Truly could not reach Flask → simulated fallback for offline demos
        clearInterval(iv); setProgress(100);
        const sim = simulatePrediction(patient, localization);
        setTimeout(() => {
          const rE = mapResult(sim);
          setResultE(rE); setResultB(null); setStep('result');
          ClinicStore.recordAnalysis({
            patientId: selectedPid, patientName: patient?.name,
            dx: rE.dx, dxLabel: rE.dxLabel, confidence: rE.confidence, riskLevel: rE.riskLevel,
          });
        }, 300);
        return;
      }

      // Server responded — surface real HTTP/validation errors
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error ${resp.status}`);
      }
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Unknown error');
      const data = json.data; 
      clearInterval(iv); setProgress(100);

      if (data.enhanced?.error) {
        setErrorMsg(data.enhanced.error);
        setStep('error');
        return;
      }

      setTimeout(() => {
        const rE = mapResult(data.enhanced);
        setResultE(rE);
        setResultB(runCompare ? mapResult(data.baseline) : null);
        setStep('result');
        ClinicStore.recordAnalysis({
          patientId: selectedPid, patientName: patient?.name,
          dx: rE.dx, dxLabel: rE.dxLabel, confidence: rE.confidence, riskLevel: rE.riskLevel,
        });
      }, 300);

    } catch (err) {
      // Reachable server but the request failed (400/500/etc.) — show the real
      // reason instead of a misleading "demo" result.
      clearInterval(iv); setProgress(100);
      setErrorMsg(err.message || 'Analysis failed. Please try again.');
      setStep('error');
    }
  };

  const reset = () => { setStep('upload'); setFileUrl(null); setFileObj(null); setResultE(null); setResultB(null); setProgress(0); setNotes(''); };

  const patient = patients.find(p => String(p.id) === String(selectedPid));

  // Clinical recommendations by class
  const getReco = (dx, risk) => ({
    mel:   'Immediate excisional biopsy recommended. Urgent referral to surgical oncology.',
    bcc:   'Surgical excision recommended. Refer to surgical oncology for excision margins.',
    akiec: 'Topical 5-FU or cryotherapy recommended. Regular 6-month monitoring required.',
    nv:    'Benign lesion confirmed. Continue routine annual dermoscopic monitoring.',
    bkl:   'Benign seborrheic keratosis. No treatment necessary. Reassure patient.',
    df:    'Benign dermatofibroma confirmed. No intervention required.',
    vasc:  'Vascular lesion noted. Monitor for changes. Dermatologist review recommended.',
  }[dx] || 'Please review with a dermatologist.');

  // ── Model result card (used for both Enhanced and Baseline panels) ──────────
  const ModelResultCard = ({ result, modelLabel, isEnhanced }) => {
    if (!result) return null;
    const borderColor = isEnhanced
      ? (result.riskLevel === 'high' ? 'var(--danger)' : 'var(--primary)')
      : 'var(--border)';
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Model badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          background: isEnhanced ? 'var(--primary-light)' : 'var(--surface-2)',
          borderRadius: 10, border: `1px solid ${isEnhanced ? 'var(--primary)' : 'var(--border)'}` }}>
          <Icon name={isEnhanced ? 'shield' : 'activity'} size={15}
            style={{ color: isEnhanced ? 'var(--primary)' : 'var(--text-muted)' }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800,
              color: isEnhanced ? 'var(--primary-dark)' : 'var(--text-muted)' }}>{modelLabel}</div>
            <div style={{ fontSize: 10, color: isEnhanced ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.8 }}>
              {isEnhanced ? 'Intersectional Sampling + Reweighting + cGAN + Melanoma-sensitivity Boosting' : 'Original HAM10000 (unmodified)'}
            </div>
          </div>
          {isEnhanced && (
            <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--primary)',
              color: '#fff', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>RECOMMENDED</span>
          )}
        </div>

        {/* Primary result */}
        <Card style={{ textAlign: 'center', border: `2px solid ${borderColor}` }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Predicted Diagnosis</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>{result.dxLabel}</div>
          <div style={{ fontSize: 36, fontWeight: 900,
            color: result.riskLevel === 'high' ? 'var(--danger)' : result.riskLevel === 'medium' ? 'var(--warning)' : 'var(--success)',
            marginBottom: 4 }}>
            {(result.confidence * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>confidence score</div>
          <RiskBadge level={result.riskLevel} />
        </Card>

        {/* Probability bars */}
        <Card padding="16px">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Probability by Class</div>
          {DX_ORDER.map(dx => (
            <ConfidenceBar key={dx} label={DX_LABELS[dx]} value={result.scores[dx] || 0} isMain={dx === result.dx} />
          ))}
        </Card>

        {/* Fairness note (Enhanced only) */}
        {isEnhanced && result.fairnessNote && (
          <Card style={{ background: 'var(--info-bg)', borderColor: 'var(--info)' }} padding="14px">
            <div style={{ display: 'flex', gap: 8 }}>
              <Icon name="shield" size={15} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', marginBottom: 4 }}>Fairness Note</div>
                <div style={{ fontSize: 12, color: 'var(--info)', lineHeight: 1.6 }}>{result.fairnessNote}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Recommendation */}
        <Card style={{ background: result.riskLevel === 'high' ? 'var(--danger-bg)' : 'var(--surface)',
          borderColor: result.riskLevel === 'high' ? 'var(--danger)' : 'var(--border)' }} padding="14px">
          <div style={{ fontSize: 12, fontWeight: 700,
            color: result.riskLevel === 'high' ? 'var(--danger)' : 'var(--text)', marginBottom: 6 }}>
            {result.riskLevel === 'high' ? '⚠ Clinical Recommendation' : 'Clinical Recommendation'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{result.recommendation}</div>
        </Card>
      </div>
    );
  };

  // ── Delta comparison summary ────────────────────────────────────────────────
  const DeltaSummary = ({ enh, base }) => {
    if (!enh || !base) return null;
    const confDelta = ((enh.confidence - base.confidence) * 100).toFixed(1);
    const sameClass = enh.dx === base.dx;
    const deltaColor = parseFloat(confDelta) >= 0 ? 'var(--success)' : 'var(--danger)';
    return (
      <Card style={{ background: 'linear-gradient(120deg, var(--primary-light), var(--surface-2))',
        border: '1.5px solid var(--primary)', marginBottom: 4 }} padding="16px">
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 12 }}>
          Framework Impact Summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Agreement', value: sameClass ? '✓ Match' : '✗ Different', sub: 'Both models agree?',
              color: sameClass ? 'var(--success)' : 'var(--warning)' },
            { label: 'Confidence Δ', value: `${confDelta >= 0 ? '+' : ''}${confDelta}%`, sub: 'Enhanced vs Baseline',
              color: deltaColor },
            { label: 'Fairness Note', value: enh.fairnessNote ? 'Applied' : 'Standard', sub: 'Subgroup detected',
              color: enh.fairnessNote ? 'var(--info)' : 'var(--text-muted)' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: '10px 8px',
              background: 'var(--surface)', borderRadius: 9, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
          ))}
        </div>
        {!sameClass && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--warning-bg)',
            borderRadius: 8, fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
            ⚠ The two models disagree on the primary diagnosis. The Enhanced (debiased) model result is recommended for clinical decision-making.
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Melanoma Detection Analysis" subtitle="AI-powered analysis using the deployed best model" />
      <PageContent>

        {/* ── UPLOAD STEP ─────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
            {/* Patient selector */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>1. Select Patient</div>
              <select value={selectedPid} onChange={e => setSelectedPid(e.target.value)} style={{
                width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)',
                fontSize: 14, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', outline: 'none',
              }}>
                <option value="">— Select patient —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {patient && (
                <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-2)', borderRadius: 9 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={patient.name} size={38} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{patient.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{patient.age}y · {patient.sex} · Skin Type {patient.skinType}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <RiskBadge level={patient.riskLevel} />
                    <Badge variant="default">{patient.localization}</Badge>
                  </div>
                </div>
              )}

              {/* Localization */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lesion Site</div>
                <select value={localization} onChange={e => setLocalization(e.target.value)} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', outline: 'none',
                }}>
                  {LOCALIZATIONS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>

              {/* Best-model notice */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 9 }}>
                <Icon name="shield" size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)' }}>Deployed model: Model E — MelBoost 3.0</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>The best-performing bias-corrected model is used for all clinical analyses.</div>
                </div>
              </div>
            </Card>

            {/* Image upload */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>2. Upload Dermoscopic Image</div>
              <div onClick={() => fileRef.current.click()} style={{
                border: '2px dashed var(--border)', borderRadius: 10, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer', background: fileUrl ? 'var(--surface-2)' : 'transparent',
              }}>
                {fileUrl ? (
                  <img src={fileUrl} alt="Dermoscopic" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <>
                    <Icon name="upload" size={32} style={{ color: 'var(--primary)', marginBottom: 10 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Drop image here or click to upload</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPEG, PNG · HAM10000 dermoscopic images</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              {fileUrl && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', textAlign: 'center', fontWeight: 600 }}>✓ Image ready for analysis</div>}

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Clinical Notes (optional)</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add any relevant clinical observations..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 72, outline: 'none', color: 'var(--text)' }} />
              </div>
            </Card>

            <div style={{ gridColumn: '1 / -1' }}>
              <Btn icon="scan" size="lg" onClick={runAnalysis}
                disabled={!selectedPid || !fileObj}
                style={{ width: '100%', justifyContent: 'center' }}>
                Run Melanoma Detection Analysis
              </Btn>
              {(!selectedPid || !fileObj) && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Select a patient and upload an image to begin
                </div>
              )}
            </div>

            {/* Detection History for the selected patient */}
            {selectedPid && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Card padding="0">
                  <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Detection History{patient ? ` — ${patient.name}` : ''}</div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{history.length} past analysis{history.length === 1 ? '' : 'es'}</span>
                  </div>
                  <Divider />
                  {history.length === 0 ? (
                    <EmptyState icon="scan" message="No past analyses for this patient yet" />
                  ) : history.map(h => (
                    <div key={h.id} style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="fileText" size={16} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{h.dxLabel}</span>
                          <RiskBadge level={h.riskLevel} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.date} · Confidence {((h.confidence <= 1 ? h.confidence * 100 : h.confidence)).toFixed(0)}%{h.notes ? ' · has notes' : ''}</div>
                      </div>
                      <Btn variant="secondary" size="sm" icon="download"
                        onClick={() => downloadAnalysisReport(
                          patient,
                          { ...h, localization: h.localization || (patient && patient.localization) || localization, eodAxes: (eodForPatient(patient, h.localization) || {}).axes },
                          h.notes
                        )}>
                        Report
                      </Btn>
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYZING STEP ──────────────────────────────────────────────── */}
        {step === 'analyzing' && (
          <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Icon name="scan" size={36} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Analysing Image…</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
              Running hybrid preprocessing framework · cGAN augmentation · Bias-corrected inference
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)',
                borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{progress}% complete</div>
          </div>
        )}

        {/* ── ERROR STEP ───────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
            <Card style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)' }}>
              <Icon name="alertTriangle" size={36} style={{ color: 'var(--danger)', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)', marginBottom: 8 }}>Analysis Failed</div>
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 20, lineHeight: 1.6 }}>{errorMsg}</div>
              <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 8,
                fontSize: 12, color: 'var(--text-muted)', textAlign: 'left', marginBottom: 20 }}>
                <strong>Checklist:</strong><br/>
                • Flask server running at http://127.0.0.1:5000<br/>
                • Phase 1 model files exist (check config.py MODEL_ENHANCED_V2 path)<br/>
                • Run python app.py --init-db if first time<br/>
                • TensorFlow installed: pip install tensorflow
              </div>
              <Btn icon="refresh" onClick={reset}>Try Again</Btn>
            </Card>
          </div>
        )}

        {/* ── RESULT STEP ─────────────────────────────────────────────────── */}
        {step === 'result' && resultE && (() => {
          const eod = eodForPatient(patient, localization);
          const eodAxes = resultE.eodAxes || eod.axes;
          const eodBase = resultE.eodBaseline ?? eod.meanBaseline;
          const eodEnh  = resultE.eodEnhanced ?? eod.meanEnhanced;
          const eodRed  = resultE.eodReduction ?? eod.meanReduction;
          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
            {/* Header row with image and actions */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Card padding="12px" style={{ width: 96, flexShrink: 0 }}>
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {fileUrl
                    ? <img src={fileUrl} alt="Lesion" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="scan" size={32} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  }
                </div>
              </Card>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{patient?.name || 'Patient'} · {patient ? `${patient.age}y · ${patient.sex}` : ''} · {localization}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{resultE.dxLabel}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: resultE.riskLevel === 'high' ? 'var(--danger)' : resultE.riskLevel === 'medium' ? 'var(--warning)' : 'var(--success)' }}>{(resultE.confidence * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>confidence</span>
                  <RiskBadge level={resultE.riskLevel} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Btn variant="secondary" icon="refresh" onClick={reset}>New Analysis</Btn>
                <Btn variant="primary" icon="download"
                  onClick={() => downloadAnalysisReport(
                    patient,
                    { ...resultE, localization, date: new Date().toISOString().slice(0,10), eodAxes: (eodForPatient(patient, localization) || {}).axes },
                    notes
                  )}>
                  Download Report
                </Btn>
              </div>
            </div>

            {resultE.demo && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', background: 'var(--warning-bg)', borderRadius: 9, fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
                <Icon name="info" size={14} /> Demo result — Flask backend not reachable, showing simulated output. Start the server for live model predictions.
              </div>
            )}

            {/* Two-column: best-model result + EOD/bias panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
              <ModelResultCard result={resultE} modelLabel="Model E — MelBoost 3.0" isEnhanced={true} />

              {/* ── EOD / BIAS REDUCTION PANEL (age · sex · location) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card style={{ border: '2px solid var(--success)', background: 'linear-gradient(150deg, var(--success-bg), var(--surface))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Icon name="shield" size={17} style={{ color: 'var(--success)' }} />
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Fairness for this patient</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    Equal Opportunity Difference on the protected axes this patient sits on, comparing the baseline model with the deployed MelBoost 3.0 model.
                  </div>

                  {/* Aggregate reduction */}
                  <div style={{ textAlign: 'center', padding: '4px 0 12px' }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>
                      <AnimatedNumber value={eodRed} suffix="%" />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>mean bias reduction · EOD {eodBase.toFixed(3)} → {eodEnh.toFixed(3)}</div>
                  </div>

                  {/* Per-axis rows */}
                  {eodAxes.map(ax => (
                    <div key={ax.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text)' }}>{ax.axisLabel} <span style={{ color: 'var(--text-muted)' }}>· {ax.subgroup}</span></span>
                        <span style={{ fontWeight: 800, color: 'var(--success)' }}>−{ax.reduction}%</span>
                      </div>
                      <div style={{ position: 'relative', height: 8, background: 'var(--surface-2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(ax.baseline / 0.7 * 100, 100)}%`, background: 'var(--danger)', opacity: 0.28 }} />
                        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(ax.enhanced / 0.7 * 100, 100)}%`, background: 'var(--success)', borderRadius: 5 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span>baseline {ax.baseline.toFixed(3)}</span>
                        <span>deployed {ax.enhanced.toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>
          );
        })()}
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR PATIENT RECORD
════════════════════════════════════════ */
const DoctorRecord = ({ selectedPatientId, setPage, setDetectionPatientId }) => {
  const clinic = useClinic();
  const isDbId = /^\d+$/.test(String(selectedPatientId));
  // Patient: prefer the live DB list, fall back to the demo cohort
  const patient = (clinic.patients || []).find(p => String(p.id) === String(selectedPatientId))
    || PATIENTS.find(p => p.id === selectedPatientId) || PATIENTS[0];

  // Detection history + appointments — live from the DB when we have a numeric id,
  // else the demo arrays. Polls so new analyses / appointments appear automatically.
  const [live, setLive] = useState({ detections: null, appointments: null });
  useEffect(() => {
    if (!isDbId) { setLive({ detections: null, appointments: null }); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await apiFetch('/api/doctor/patients/' + selectedPatientId + '/record');
        const d = r.data || r;
        if (alive) setLive({ detections: d.detections || [], appointments: d.appointments || [] });
      } catch (e) { if (alive) setLive({ detections: null, appointments: null }); }
    };
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [selectedPatientId, isDbId]);

  const detections   = live.detections   != null ? live.detections   : DETECTIONS.filter(d => d.patientId === patient.id);
  const appointments = live.appointments != null ? live.appointments : APPOINTMENTS.filter(a => a.patientId === patient.id);
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState(patient.notes);
  useEffect(() => { setNotes(patient.notes); }, [patient.id]);
  const displayId = /^\d+$/.test(String(patient.id)) ? 'P' + String(patient.id).padStart(3, '0') : patient.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Patient Record" subtitle={patient.name}
        actions={
          <>
            <Btn variant="secondary" icon="scan" onClick={() => { setDetectionPatientId(patient.id); setPage('detection'); }}>Analyze</Btn>
            <Btn icon="edit" onClick={() => setEditNotes(true)}>Edit Record</Btn>
          </>
        }
      />
      <PageContent>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* Patient info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ textAlign: 'center' }} padding="24px">
              <Avatar name={patient.name} size={64} />
              <div style={{ marginTop: 14, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{patient.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{displayId}</div>
              <RiskBadge level={patient.riskLevel} />
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Demographics</div>
              {[
                ['Age', `${patient.age} years`],
                ['Sex', patient.sex],
                ['Skin Type', `Type ${patient.skinType} (ITA ${patient.ita}°)`],
                ['Blood Type', patient.bloodType],
                ['Allergies', patient.allergies],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Contact</div>
              {[
                ['phone', patient.phone],
                ['mail', patient.email],
                ['mapPin', patient.address],
              ].map(([icon, val]) => (
                <div key={icon} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: 'var(--text)' }}>
                  <Icon name={icon} size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                  <span>{val}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Notes */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Clinical Notes</div>
                <Btn variant="ghost" size="sm" icon={editNotes ? 'check' : 'edit'} onClick={() => setEditNotes(e => !e)}>
                  {editNotes ? 'Save' : 'Edit'}
                </Btn>
              </div>
              {editNotes ? (
                <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{
                  width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 14, color: 'var(--text)', lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                }} />
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8 }}>{notes}</div>
              )}
            </Card>

            {/* Detection history */}
            <Card padding="0">
              <div style={{ padding: '14px 18px', fontWeight: 700, fontSize: 15 }}>Detection History</div>
              <Divider />
              {detections.length === 0 ? <EmptyState icon="scan" message="No analyses yet" /> : detections.map(d => (
                <div key={d.id} style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="scan" size={18} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{d.dxLabel}</span>
                      <RiskBadge level={d.riskLevel} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{d.date} · Confidence: {(d.confidence * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{d.recommendation}</div>
                  </div>
                  <Btn variant="secondary" size="sm" icon="download"
                    onClick={() => downloadAnalysisReport(
                      patient,
                      { ...d, localization: d.localization || (patient && patient.localization), eodAxes: (eodForPatient(patient, d.localization) || {}).axes },
                      d.notes
                    )}>
                    Report
                  </Btn>
                </div>
              ))}
            </Card>

            {/* Appointments */}
            <Card padding="0">
              <div style={{ padding: '14px 18px', fontWeight: 700, fontSize: 15 }}>Appointments</div>
              <Divider />
              {appointments.length === 0 ? <EmptyState icon="calendar" message="No appointments" /> : appointments.map(a => (
                <div key={a.id} style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.reason}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.date} at {a.time} · {a.duration} min</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </Card>
          </div>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR APPOINTMENTS
════════════════════════════════════════ */
const DoctorAppointments = () => {
  const { list, online, changeStatus, reschedule } = useAppointments('doctor');
  const upcoming  = (list || []).filter(a => a.status === 'scheduled');
  const completed = (list || []).filter(a => a.status === 'completed');
  const cancelled = (list || []).filter(a => a.status === 'cancelled');
  const [actionSel, setActionSel] = React.useState({}); // { [apptId]: 'completed'|'reschedule'|'cancelled' }
  const [form, setForm] = React.useState({});           // { [apptId]: {date, time} }
  const [busyId, setBusyId] = React.useState(null);

  const setAction = (id, val) => setActionSel(s => ({ ...s, [id]: val }));
  const setField  = (id, patch) => setForm(s => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));

  const confirmAction = async (a) => {
    const action = actionSel[a.id];
    if (!action) return;
    setBusyId(a.id);
    if (action === 'reschedule') {
      const f = form[a.id] || {};
      if (!f.date || !f.time) { setBusyId(null); return; }
      await reschedule(a, { date: f.date, time: f.time });
    } else {
      await changeStatus(a, action); // 'completed' | 'cancelled'
    }
    setBusyId(null);
    setActionSel(s => { const n = { ...s }; delete n[a.id]; return n; });
  };

  const AptCard = ({ a }) => {
    const action = actionSel[a.id] || '';
    const f = form[a.id] || { date: a.date || '', time: a.time || '' };
    const isReschedule = action === 'reschedule';
    return (
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 18px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: a.status === 'cancelled' ? 'var(--surface-2)' : 'var(--info-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: a.status === 'cancelled' ? 'var(--text-muted)' : 'var(--info)', lineHeight: 1 }}>{a.time}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{a.patientName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{a.reason} · {a.date} · {a.duration} min</div>
          </div>
          {a.status === 'scheduled' ? (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              <select value={action} onChange={e => setAction(a.id, e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: action ? 'var(--text)' : 'var(--text-muted)', background: 'var(--surface)', outline: 'none', cursor: 'pointer' }}>
                <option value="">Select action…</option>
                <option value="completed">Mark done</option>
                <option value="reschedule">Reschedule</option>
                <option value="cancelled">Cancel</option>
              </select>
              <Btn size="sm" icon="check" onClick={() => confirmAction(a)}
                disabled={!action || busyId === a.id || (isReschedule && (!f.date || !f.time))}>
                {busyId === a.id ? 'Saving…' : 'Confirm'}
              </Btn>
            </div>
          ) : (
            <StatusBadge status={a.status} />
          )}
        </div>
        {a.status === 'scheduled' && isReschedule && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '0 18px 16px 84px', background: 'var(--surface-2)' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '10px 0 5px' }}>New date</div>
              <input type="date" value={f.date} onChange={e => setField(a.id, { date: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--text)' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '10px 0 5px' }}>New time</div>
              <input type="time" value={f.time} onChange={e => setField(a.id, { time: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--text)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingBottom: 9 }}>Click <strong>Confirm</strong> to save the new slot</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Appointments" subtitle="Manage your schedule"
        actions={<LiveBadge online={online} />} />
      <PageContent>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card padding="0">
            <div style={{ padding: '16px 18px', fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Upcoming <Badge variant="info">{upcoming.length}</Badge>
            </div>
            <Divider />
            {upcoming.length === 0 ? <EmptyState icon="calendar" message="No upcoming appointments" /> : upcoming.map(a => <AptCard key={a.id} a={a} />)}
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card padding="0">
              <div style={{ padding: '16px 18px', fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Completed <Badge variant="success">{completed.length}</Badge>
              </div>
              <Divider />
              {completed.length === 0 ? <EmptyState icon="check" message="No completed appointments" /> : completed.map(a => <AptCard key={a.id} a={a} />)}
            </Card>
            <Card padding="0">
              <div style={{ padding: '16px 18px', fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Cancelled <Badge variant="danger">{cancelled.length}</Badge>
              </div>
              <Divider />
              {cancelled.length === 0 ? <EmptyState icon="xMark" message="No cancelled appointments" /> : cancelled.map(a => <AptCard key={a.id} a={a} />)}
            </Card>
          </div>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR NOTIFICATIONS
════════════════════════════════════════ */
const DoctorNotifications = () => {
  const store = useDoctorNotifs();
  const notifs = store.list();
  // Persist which notifications have been read so they stay read across
  // navigation / reload (previously the read state was in-memory only).
  const READ_KEY = 'hms_doctor_read_notifs';
  const loadRead = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); } };
  const [readIds, setReadIds] = useState(loadRead);
  const persist = (set) => { localStorage.setItem(READ_KEY, JSON.stringify([...set])); };

  const isRead = (n) => n.read || readIds.has(n.id);
  const markRead = (id) => setReadIds(prev => {
    if (prev.has(id)) return prev;
    const next = new Set(prev); next.add(id); persist(next); return next;
  });
  const markAllRead = () => setReadIds(() => {
    const next = new Set(notifs.map(n => n.id)); persist(next); return next;
  });
  const unread = notifs.filter(n => !isRead(n)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Notifications" subtitle={`${unread} unread`}
        actions={unread > 0 && <Btn variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Btn>} />
      <PageContent>
        <Card padding="0" style={{ maxWidth: 680 }}>
          {notifs.map(n => {
            const read = isRead(n);
            return (
            <div key={n.id} onClick={() => markRead(n.id)} style={{
              display: 'flex', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: read ? 'transparent' : 'var(--primary-light)', cursor: 'pointer',
            }}>
              <NotifIcon type={n.type} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: read ? 500 : 700, color: 'var(--text)' }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.message}</div>
              </div>
              {!read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
            </div>
            );
          })}
        </Card>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR — MODEL PERFORMANCE  (all trained models)
════════════════════════════════════════ */
/* Lesion thumbnail for the Proof-of-Concept gallery. Falls back to a
   labelled placeholder tile when the ISIC image file has not been dropped
   into /static/poc_images/ yet, so the section renders cleanly offline. */
const PoCLesionImage = ({ id }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <div style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 10, background: 'var(--surface-2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-light)', border: '1px solid var(--border)', gap: 6,
      }}>
        <Icon name="scan" size={26} style={{ opacity: 0.5 }} />
        <span style={{ fontSize: 10 }}>{id}.jpg</span>
      </div>
    );
  }
  return (
    <img src={POC_IMG_BASE + id + '.jpg'} alt={id} onError={() => setFailed(true)}
      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', borderRadius: 10,
               border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'block' }} />
  );
};

const DoctorModelPerformance = () => {
  const { data: models, online } = useLive(
    () => ModelsApi.comparison(),
    () => MODEL_REGISTRY,
    8000
  );
  const { data: pocData } = useLive(
    () => ModelsApi.externalValidation(),
    () => POC_ISIC2020,
    30000
  );
  const ext = pocData && pocData.cases ? pocData : POC_ISIC2020;
  const list = Array.isArray(models) && models.length ? models : MODEL_REGISTRY;
  const best = list.find(m => m.isBest) || list[list.length - 1];
  const baseline = list.find(m => m.key === 'baseline') || list.reduce((a, b) => (b.meanEOD > a.meanEOD ? b : a), list[0]);

  const accData = list.map(m => ({ label: m.name.split('—')[0].trim(), value: m.accuracy, best: m.isBest }));
  const eodData = list.map(m => ({ label: m.name.split('—')[0].trim(), value: m.meanEOD, best: m.isBest }));
  const biasReduction = m => baseline.meanEOD > 0 ? Math.round((1 - m.meanEOD / baseline.meanEOD) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Model Performance" subtitle="Comparison of all models trained in Phase 1"
        actions={<LiveBadge online={online} />} />
      <PageContent>
        {/* Best model hero */}
        <Card style={{ border: '2px solid var(--primary)', background: 'linear-gradient(120deg, var(--primary-light), var(--surface))', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="shield" size={26} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{best.name}</div>
                <span style={{ fontSize: 10, background: 'var(--primary)', color: '#fff', borderRadius: 999, padding: '3px 10px', fontWeight: 800, letterSpacing: 0.5 }}>DEPLOYED BEST MODEL</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 22, textAlign: 'center' }}>
              {[
                ['Melanomas Detected', `${(best.melSensitivity * 100).toFixed(0)}%`, 'var(--success)'],
                ['Missed per 100', `${best.melMissed ?? Math.round((1 - best.melSensitivity) * 100)}`, 'var(--text)'],
                ['Worst-Group TPR', best.worstGroupTPR?.toFixed(3) ?? '—', 'var(--success)'],
                ['Accuracy', `${(best.accuracy * 100).toFixed(1)}%`, 'var(--text-muted)'],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 90 }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Diagnostic Accuracy by Model</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Higher is better · green = deployed best model</div>
            <BarChart data={accData} height={200} colorFn={(d) => d.best ? 'var(--primary)' : 'var(--border)'} />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Mean Equal Opportunity Difference (EOD)</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Lower is fairer · green = deployed best model</div>
            <BarChart data={eodData} height={200} colorFn={(d) => d.best ? 'var(--success)' : (d.value > 0.15 ? 'var(--danger)' : 'var(--warning)')} />
          </Card>
        </div>

        {/* Full comparison table */}
        <Card padding="0">
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>All Trained Models — Detailed Comparison</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Clinical performance first · a model that fails all groups equally scores a perfect EOD
            </div>
          </div>
          <Divider />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Model','Mitigation Strategy','Mel. Sens.','Missed / 100','Worst-Group TPR','Best-Group TPR','Verdict','Accuracy','AUC','EOD age','EOD sex','EOD loc'].map(h => {
                    const sub = { 'Mel. Sens.': 'True Positive Rate / Recall', 'Missed / 100': 'False Negative Rate', 'Worst-Group TPR': 'Unprivileged Group', 'Best-Group TPR': 'Privileged Group' }[h];
                    return (
                    <th key={h} style={{
                      padding: '11px 12px',
                      textAlign: (h === 'Model' || h === 'Mitigation Strategy') ? 'left' : 'center',
                      fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                      borderBottom: ['Mel. Sens.','Missed / 100','Worst-Group TPR','Best-Group TPR','Verdict'].includes(h)
                        ? '2px solid var(--primary)' : 'none',
                    }}>
                      {h}
                      {sub && <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-light)', marginTop: 2 }}>{sub}</div>}
                    </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {list.map(m => {
                  const baseMel   = baseline.melSensitivity ?? 0.39;
                  const baseWorst = baseline.worstGroupTPR  ?? 0.3148;
                  const baseBest  = baseline.bestGroupTPR   ?? null;
                  const missed    = m.melMissed ?? Math.round((1 - m.melSensitivity) * 100);
                  const melBeats  = m.melSensitivity >= baseMel;
                  const wgBeats   = (m.worstGroupTPR ?? 0) >= baseWorst;
                  const bgBeats   = (m.bestGroupTPR != null && baseBest != null) ? m.bestGroupTPR >= baseBest : null;

                  const VERDICT = {
                    uplift:         { label: 'GENUINE UPLIFT',  bg: 'var(--success-bg)', fg: 'var(--success)' },
                    levelling_down: { label: 'LEVELLING DOWN',  bg: 'var(--danger-bg)',  fg: 'var(--danger)'  },
                    mixed:          { label: 'MIXED',           bg: 'var(--warning-bg)', fg: 'var(--warning)' },
                    baseline:       { label: 'BASELINE',        bg: 'var(--surface-2)',  fg: 'var(--text-muted)' },
                  }[m.verdict || 'mixed'];

                  return (
                    <tr key={m.key} style={{ borderTop: '1px solid var(--border)', background: m.isBest ? 'var(--primary-light)' : 'transparent' }}>
                      <td style={{ padding: '13px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{m.name}</span>
                          {m.isBest && <span style={{ fontSize: 9, background: 'var(--primary)', color: '#fff', borderRadius: 999, padding: '2px 7px', fontWeight: 800 }}>DEPLOYED</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.arch}</div>
                      </td>

                      <td style={{ padding: '13px 12px', fontSize: 12, color: 'var(--text)' }}>CNN + {m.mitigation}</td>

                      {/* Melanoma sensitivity — the clinical metric */}
                      <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: melBeats ? 'var(--success)' : 'var(--danger)' }}>
                          {(m.melSensitivity * 100).toFixed(0)}%
                        </span>
                      </td>

                      {/* Melanomas missed per 100 */}
                      <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: melBeats ? 'var(--success)' : 'var(--danger)' }}>
                          {missed}
                        </span>
                        <div style={{ fontSize: 9.5, color: 'var(--text-light)' }}>patients</div>
                      </td>

                      {/* Worst-group melanoma TPR — the Group DRO metric */}
                      <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: wgBeats ? 'var(--success)' : 'var(--danger)' }}>
                          {m.worstGroupTPR != null ? m.worstGroupTPR.toFixed(3) : '—'}
                        </span>
                        {m.verdict !== 'baseline' && m.worstGroupTPR != null && (
                          <div style={{ fontSize: 9.5, color: wgBeats ? 'var(--success)' : 'var(--danger)' }}>
                            {(m.worstGroupTPR - baseWorst >= 0 ? '+' : '')}{(m.worstGroupTPR - baseWorst).toFixed(3)}
                          </div>
                        )}
                      </td>

                      {/* Best-group melanoma TPR — the ceiling, for context alongside the floor */}
                      <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: bgBeats == null ? 'var(--text-muted)' : (bgBeats ? 'var(--success)' : 'var(--danger)') }}>
                          {m.bestGroupTPR != null ? m.bestGroupTPR.toFixed(3) : '—'}
                        </span>
                        {m.verdict !== 'baseline' && m.bestGroupTPR != null && baseBest != null && (
                          <div style={{ fontSize: 9.5, color: bgBeats ? 'var(--success)' : 'var(--danger)' }}>
                            {(m.bestGroupTPR - baseBest >= 0 ? '+' : '')}{(m.bestGroupTPR - baseBest).toFixed(3)}
                          </div>
                        )}
                      </td>

                      {/* Levelling-down verdict */}
                      <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, background: VERDICT.bg, color: VERDICT.fg,
                                       borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
                          {VERDICT.label}
                        </span>
                      </td>

                      <td style={{ padding: '13px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{(m.accuracy * 100).toFixed(1)}%</td>
                      <td style={{ padding: '13px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-light)' }}>{m.auc.toFixed(3)}</td>

                      {['eodAge','eodSex','eodLoc'].map(k => (
                        <td key={k} style={{ padding: '13px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{m[k].toFixed(3)}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </Card>

        {/* ════════════════════════════════════════════════════════
            PROOF OF CONCEPT — external validation on ISIC 2020
        ════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '30px 0 16px' }}>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Proof of Concept (ISIC 2020)</div>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        </div>
        <Card padding="0">
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Proof of Concept — External Validation on ISIC 2020</div>
              <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--success-bg)', color: 'var(--success)',
                             borderRadius: 999, padding: '3px 9px', letterSpacing: 0.3 }}>OUT-OF-DISTRIBUTION</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <span>Total evaluation images = <strong style={{ color: 'var(--text)' }}>{ext.evalTotal.toLocaleString()}</strong></span>
              <span>Total melanoma = <strong style={{ color: 'var(--text)' }}>{ext.evalMelanoma.toLocaleString()}</strong></span>
              <span>Total benign = <strong style={{ color: 'var(--text)' }}>{ext.evalBenign.toLocaleString()}</strong></span>
            </div>
          </div>
          <Divider />

          {/* Headline stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)' }}>
            {[
              ['Melanoma sensitivity', `${(ext.sensitivity.baseline * 100).toFixed(1)}% → ${(ext.sensitivity.enhanced * 100).toFixed(1)}%`, `+${(ext.sensitivity.delta * 100).toFixed(1)} pts · Model A → Model E`, 'var(--success)', 'True Positive Rate / Recall'],
              ['Melanomas recovered', `${ext.recovered}`, 'missed by Model A · caught by Model E', 'var(--success)', null],
              ['Missed per 100', `${ext.missedPer100.baseline} → ${ext.missedPer100.enhanced}`, 'fewer melanomas missed', 'var(--text)', 'False Negative Rate'],
              ['Fairness verdict', 'GENUINE UPLIFT', 'on all three protected axes', 'var(--success)', null],
            ].map(([k, v, s, c, sub]) => (
              <div key={k} style={{ background: 'var(--surface)', padding: '15px 18px' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: sub ? 1 : 6 }}>{k}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 6 }}>{sub}</div>}
                <div style={{ fontSize: 20, fontWeight: 900, color: c, lineHeight: 1.15 }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{s}</div>
              </div>
            ))}
          </div>
          <Divider />

          {/* Per-axis worst-group AND best-group detection on the external set */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              Worst-group & Best-group melanoma detection (TPR) on ISIC 2020
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              Best-group TPR is shown alongside for the full spread on each axis.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th rowSpan={2} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>Protected axis</th>
                    <th colSpan={3} style={{ padding: '7px 12px 4px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>Worst-group TPR (Unprivileged)</th>
                    <th colSpan={3} style={{ padding: '7px 12px 4px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>Best-group TPR (Privileged)</th>
                    <th rowSpan={2} style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>Verdict</th>
                  </tr>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['Model A', 'Model E', 'Δ change', 'Model A', 'Model E', 'Δ change'].map((h, i) => (
                      <th key={i} style={{ padding: '4px 12px 9px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ext.fairness.map(f => (
                    <tr key={f.axis} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{f.axis}</td>

                      {/* Worst-group (floor) */}
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{f.baselineWorst != null ? f.baselineWorst.toFixed(3) : '—'}</span>
                        <div style={{ fontSize: 9.5, color: 'var(--text-light)' }}>{f.baselineWorstGroup}</div>
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>{f.enhancedWorst != null ? f.enhancedWorst.toFixed(3) : '—'}</span>
                        <div style={{ fontSize: 9.5, color: 'var(--text-light)' }}>{f.enhancedWorstGroup}</div>
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>
                        {f.worstDelta != null ? `+${f.worstDelta.toFixed(3)}` : '—'}
                      </td>

                      {/* Best-group (ceiling) */}
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{f.baselineBest != null ? f.baselineBest.toFixed(3) : '—'}</span>
                        <div style={{ fontSize: 9.5, color: 'var(--text-light)' }}>{f.baselineBestGroup || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>{f.enhancedBest != null ? f.enhancedBest.toFixed(3) : '—'}</span>
                        <div style={{ fontSize: 9.5, color: 'var(--text-light)' }}>{f.enhancedBestGroup || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>
                        {(f.baselineBest != null && f.enhancedBest != null) ? `${f.enhancedBest - f.baselineBest >= 0 ? '+' : ''}${(f.enhancedBest - f.baselineBest).toFixed(3)}` : '—'}
                      </td>

                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--success-bg)', color: 'var(--success)',
                                       borderRadius: 999, padding: '4px 9px', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>GENUINE UPLIFT</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-light)', marginTop: 10, lineHeight: 1.5 }}>
              Best-group TPR values and subgroup names are confirmed for every axis from the Phase-4 external validation notebook.
            </div>
          </div>
          <Divider />

          {/* Case-level gallery */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>
              Case-level evidence — melanomas Model A missed but Model E caught
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              Six confirmed melanomas from ISIC 2020, ranked by confidence gap. Ground truth for every case below is
              {' '}<strong style={{ color: 'var(--danger)' }}>malignant melanoma</strong>.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {ext.cases.map(c => (
                <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                                         overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ padding: 10, paddingBottom: 0 }}><PoCLesionImage id={c.id} /></div>
                  <div style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{c.id}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--danger-bg)', color: 'var(--danger)',
                                     borderRadius: 999, padding: '3px 8px' }}>MELANOMA</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{c.age} · {c.sex} · {c.loc}</div>

                    {/* Model A */}
                    <div style={{ marginTop: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Model A</span>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>P(mel) {c.probA.toFixed(3)} · MISSED</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <div style={{ width: `${(c.probA * 100).toFixed(1)}%`, height: '100%', background: 'var(--danger)' }} />
                      </div>
                      {c.predA && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Predicted as <strong style={{ color: 'var(--text-muted)' }}>{c.predA}</strong></div>}
                    </div>

                    {/* Model E */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Model E</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>P(mel) {c.probE.toFixed(3)} · CAUGHT</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <div style={{ width: `${(c.probE * 100).toFixed(1)}%`, height: '100%', background: 'var(--success)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footnote */}
          {!online && (
            <div style={{ padding: '14px 20px', fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
                          lineHeight: 1.65, background: 'var(--surface-2)' }}>
              Reference values from Phase-4 external validation — connect the Flask backend for live figures.
            </div>
          )}
        </Card>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR — MESSAGES  (conversation list + thread)
════════════════════════════════════════ */
const DoctorMessages = () => {
  const [threads, setThreads] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [search, setSearch] = React.useState('');

  const refresh = React.useCallback(async () => {
    const t = await MessageStore.threads();
    setThreads(t);
    setActiveId(prev => prev || (t.find(c => c.unread > 0) || t.find(c => c.last) || t[0])?.patientId || null);
  }, []);

  React.useEffect(() => {
    refresh();
    const unsub = MessageStore.subscribe(refresh);
    return unsub;
  }, [refresh]);

  const filtered = threads.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const active = threads.find(c => c.patientId === activeId);
  const activePatient = PATIENTS.find(p => p.id === activeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Messages" subtitle="Patient conversations"
        actions={<LiveBadge online={MessageStore.isOnline()} label={MessageStore.isOnline() ? 'LIVE' : 'LIVE · LOCAL'} />} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 0 }}>
        {/* Conversation list */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', minHeight: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search patients…" />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filtered.map(c => {
              const isActive = c.patientId === activeId;
              return (
                <button key={c.patientId} onClick={() => setActiveId(c.patientId)} style={{
                  display: 'flex', gap: 11, alignItems: 'center', width: '100%', textAlign: 'left',
                  padding: '13px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                  background: isActive ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <Avatar name={c.name} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      {c.last && <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtMsgTime(c.last.ts)}</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: c.unread ? 'var(--text)' : 'var(--text-muted)', fontWeight: c.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.last ? (c.last.from === 'doctor' ? 'You: ' : '') + c.last.text : 'No messages yet'}
                      </span>
                      {c.unread > 0 && (
                        <span style={{ flexShrink: 0, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{c.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active thread */}
        <div style={{ minHeight: 0, background: 'var(--bg)' }}>
          {active ? (
            <ChatThread
              key={activeId}
              cid={activeId}
              role="doctor"
              otherName={active.name}
              otherSubtitle={activePatient ? `${activePatient.age}y · ${activePatient.sex} · Skin Type ${activePatient.skinType}` : 'Patient'}
              emptyHint={`Start the conversation with ${active.name}.`}
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState icon="message" message="Select a conversation" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  DoctorDashboard, DoctorPatients, DoctorDetection,
  DoctorRecord, DoctorAppointments, DoctorNotifications,
  DoctorModelPerformance, DoctorMessages,
});
