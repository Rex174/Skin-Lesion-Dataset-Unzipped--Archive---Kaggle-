
const { useState, useRef, useEffect } = React;

/* ════════════════════════════════════════
   PATIENT DASHBOARD
════════════════════════════════════════ */
const PatientDashboard = ({ setPage }) => {
  const pt = PATIENT_USER;
  const { analyses, record } = usePatientClinic(pt.id);
  const dbChecks = usePatientChecks(pt.id, pt.localization);
  const notifStore = usePatientNotifs();
  const myDetections  = dbChecks != null ? dbChecks : analyses;
  const apptState = useAppointments('patient');
  const myAppointments = apptState.list || [];
  const latest  = myDetections[0];
  const nextApt = myAppointments.find(a => a.status === 'scheduled');
  const unread  = notifStore.unreadCount();
  const dbProfile = usePatientProfile();
  const riskLevel = (dbProfile && dbProfile.riskLevel) || (record && record.riskLevel) || pt.riskLevel;

  // Detections seeded from history don't carry a recommendation string.
  const RECO = {
    mel: 'Immediate excisional biopsy recommended. Urgent referral to surgical oncology.',
    bcc: 'Surgical excision recommended. Consult with your dermatologist.',
    akiec: 'Topical treatment or cryotherapy may be required. Book a follow-up.',
    nv: 'Benign lesion detected. Continue annual dermoscopic monitoring.',
    bkl: 'Benign keratosis detected. No immediate treatment required.',
    df: 'Benign lesion confirmed. No intervention required.',
    vasc: 'Vascular lesion noted. Dermatologist review recommended.',
  };

  const rescheduleAppt = () => {
    window.__pendingMessageDraft = 'Hi doctor, I would like to reschedule my appointment';
    setPage('messages');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Health Dashboard" subtitle="MelanoScan Patient Portal" actions={<LiveBadge online={false} />} />
      <PageContent>
        {/* Welcome banner */}
        <div style={{
          background: 'linear-gradient(120deg, var(--primary) 0%, var(--primary-dark) 100%)',
          borderRadius: 'var(--radius-lg)', padding: '24px 28px', color: '#fff', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Hello, {pt.name.split(' ')[0]} 👋</div>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 16 }}>
              Your latest scan was on <strong>{latest?.date || '—'}</strong>. Stay on top of your skin health.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={() => setPage('detection')} style={{ background: '#fff', color: 'var(--primary)' }} icon="scan">New Scan</Btn>
              <Btn onClick={() => setPage('appointments')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }} icon="calendar">Book Appointment</Btn>
            </div>
          </div>
          <div style={{ opacity: 0.15, fontSize: 80 }}>🩺</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <StatCard icon="scan"     label="Total Scans"        value={myDetections.length}    sub="All-time analyses" />
          <StatCard icon="calendar" label="Upcoming Appt"      value={nextApt ? '1' : '0'}   sub={nextApt ? `${nextApt.date} at ${nextApt.time}` : 'None scheduled'} />
          <StatCard icon="bell"     label="Unread Alerts"      value={unread}                 sub="Tap to view" iconColor="var(--warning)" />
          <StatCard icon="heart"    label="Risk Level"         value={riskLevel === 'high' ? '⚠ High' : riskLevel === 'medium' ? 'Moderate' : 'Low'} sub="Current assessment" iconColor={riskLevel === 'high' ? 'var(--danger)' : 'var(--success)'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Latest detection result */}
          {latest && (
            <Card>
              <SectionHeader title="Latest Detection Result" action={<Btn variant="ghost" size="sm" onClick={() => setPage('results')}>All results</Btn>} />
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="scan" size={28} style={{ color: 'var(--primary)', opacity: 0.4 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{latest.dxLabel}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{latest.date} · {(latest.confidence * 100).toFixed(0)}% confidence</div>
                  <RiskBadge level={latest.riskLevel} />
                </div>
              </div>
              {latest.riskLevel === 'high' && (
                <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 9, fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
                  ⚠ {latest.recommendation || RECO[latest.dx] || 'Please consult your dermatologist.'}
                </div>
              )}
            </Card>
          )}

          {/* Next appointment */}
          <Card>
            <SectionHeader title="Next Appointment" action={<Btn variant="ghost" size="sm" onClick={() => setPage('appointments')}>Manage</Btn>} />
            {nextApt ? (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--info-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--info)', lineHeight: 1 }}>{nextApt.date.split('-')[2]}</div>
                    <div style={{ fontSize: 11, color: 'var(--info)', opacity: 0.8 }}>{['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][(parseInt(nextApt.date.split('-')[1], 10) || 1) - 1]}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{nextApt.reason}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dr. Ramaneiss Pillai · {nextApt.time} · {nextApt.duration} min</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <Btn variant="secondary" size="sm" onClick={rescheduleAppt}>Reschedule</Btn>
                  <Btn variant="danger" size="sm" onClick={() => setPage('appointments')}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <EmptyState icon="calendar" message="No upcoming appointments" />
                <Btn onClick={() => setPage('appointments')} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>Book Appointment</Btn>
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Quick Actions</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { icon: 'scan',     label: 'New Skin Scan',    page: 'detection',    color: 'var(--primary)'   },
                { icon: 'calendar', label: 'Book Appointment', page: 'appointments', color: 'var(--info)'      },
                { icon: 'fileText', label: 'View My Results',  page: 'results',      color: 'var(--success)'   },
                { icon: 'message',  label: 'Message Doctor',   page: 'messages',     color: 'var(--secondary)' },
                { icon: 'user',     label: 'My Profile',       page: 'profile',      color: 'var(--accent)'    },
              ].map(q => (
                <button key={q.label} onClick={() => setPage(q.page)} style={{
                  flex: 1, minWidth: 120, padding: '16px 12px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: q.color + '20', color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Icon name={q.icon} size={19} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{q.label}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   PATIENT PROFILE
════════════════════════════════════════ */
const PatientProfile = () => {
  const pt = PATIENT_USER;
  const { record } = usePatientClinic(pt.id);
  const dbProfile = usePatientProfile();
  const base = record || pt;
  // Prefer live DB values so the profile matches the doctor's Patient Record.
  const person = dbProfile ? {
    ...base,
    name: dbProfile.name ?? base.name,
    age: dbProfile.age ?? base.age,
    sex: dbProfile.sex ?? base.sex,
    phone: dbProfile.contact ?? base.phone,
    email: dbProfile.email ?? base.email,
    address: dbProfile.address ?? base.address,
    riskLevel: dbProfile.riskLevel ?? base.riskLevel,
    skinType: dbProfile.skinType ?? base.skinType,
    ita: dbProfile.ita ?? base.ita,
    bloodType: dbProfile.bloodType ?? base.bloodType,
    allergies: dbProfile.allergies ?? base.allergies,
    localization: dbProfile.localization ?? base.localization,
    diagnosis: dbProfile.diagnosis ?? base.diagnosis,
  } : base;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setForm({
      name: person.name, age: person.age, sex: person.sex,
      phone: person.phone, email: person.email, address: person.address,
    });
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setForm({}); };
  const confirmEdit = async () => {
    setBusy(true);
    const patch = {
      name: (form.name || '').trim() || person.name,
      age: parseInt(form.age, 10) || person.age,
      sex: form.sex,
      phone: (form.phone || '').trim(),
      email: (form.email || '').trim(),
      address: (form.address || '').trim(),
    };
    // Update the in-browser store (offline/demo + instant UI mirror)
    ClinicStore.updatePatient(pt.id, patch);
    // Persist to the backend so the doctor's DB-backed Patient Record reflects it
    try {
      await PatientApi.updateProfile({
        name: patch.name, age: patch.age, sex: patch.sex,
        contact: patch.phone, email: patch.email, address: patch.address,
      });
    } catch (e) { /* backend unreachable — offline demo keeps the client update */ }
    setBusy(false);
    setEditing(false);
  };
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const inputStyle = {
    width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)', outline: 'none',
  };

  /* Plain render helpers (NOT nested components — calling them inline keeps
     element identity stable so inputs don't lose focus on each keystroke). */
  const roRow = (label, value, icon) => (
    <div key={label} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
      <Icon name={icon || 'user'} size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  );

  const editRow = (label, icon, k, { type, options } = {}) => (
    <div key={k} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
      <Icon name={icon || 'user'} size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {options ? (
          <select value={form[k] || ''} onChange={e => set(k, e.target.value)} style={inputStyle}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type || 'text'} value={form[k] ?? ''} onChange={e => set(k, e.target.value)} style={inputStyle} />
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Profile" actions={!editing && <Btn icon="edit" variant="secondary" onClick={startEdit}>Edit Profile</Btn>} />
      <PageContent>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, maxWidth: 860 }}>
          {/* Profile card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ textAlign: 'center' }} padding="28px">
              <Avatar name={person.name} size={72} />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{person.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{person.id}</div>
              <RiskBadge level={person.riskLevel} />
              <Divider style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {[['Age', `${person.age}y`], ['Skin', `Type ${person.skinType}`], ['Blood', person.bloodType]].map(([k, v]) => (
                  <div key={k} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>My Doctor</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar name={DOCTOR_USER.name} size={38} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{DOCTOR_USER.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{DOCTOR_USER.specialty}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Info panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Personal Information</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{editing ? 'Update your details, then confirm' : 'Your registered details'}</div>
              {editing ? (
                <>
                  {editRow('Full Name', 'user', 'name')}
                  {editRow('Age', 'clock', 'age', { type: 'number' })}
                  {editRow('Sex', 'user', 'sex', { options: ['Female', 'Male', 'Other'] })}
                  {editRow('Phone', 'phone', 'phone')}
                  {editRow('Email', 'mail', 'email', { type: 'email' })}
                  {editRow('Address', 'mapPin', 'address')}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <Btn icon="check" onClick={confirmEdit} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Btn>
                    <Btn variant="secondary" onClick={cancelEdit} disabled={busy}>Cancel</Btn>
                  </div>
                </>
              ) : (
                <>
                  {roRow('Full Name', person.name, 'user')}
                  {roRow('Age', `${person.age} years old`, 'clock')}
                  {roRow('Sex', person.sex, 'user')}
                  {roRow('Phone', person.phone, 'phone')}
                  {roRow('Email', person.email, 'mail')}
                  {roRow('Address', person.address, 'mapPin')}
                </>
              )}
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Medical Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Blood Type', person.bloodType],
                  ['Skin Type', `Type ${person.skinType} (ITA ${person.ita}°)`],
                  ['Allergies', person.allergies],
                  ['Primary Lesion Site', person.localization],
                  ['Known Condition', DX_LABELS[person.diagnosis] || person.diagnosis],
                  ['Attending Doctor', 'Dr. Ramaneiss Pillai'],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 9 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {person.riskLevel === 'high' && (
              <Card style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Icon name="alertTriangle" size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>High-Risk Status</div>
                    <div style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.6 }}>{person.notes}</div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   PATIENT DETECTION ANALYSIS
════════════════════════════════════════ */

const PatientDetection = ({ setPage }) => {
  const pt = PATIENT_USER;
  const [step,     setStep]    = React.useState('upload');
  const [fileUrl,  setFileUrl] = React.useState(null);
  const [fileObj,  setFileObj] = React.useState(null);
  const [result,   setResult]  = React.useState(null);
  const [progress, setProgress]= React.useState(0);
  const [localization, setLocalization] = React.useState('back');
  const [errorMsg, setErrorMsg]= React.useState('');
  const fileRef = React.useRef();

  const handleFile = e => {
    const f = e.target.files[0];
    if (f) { setFileUrl(URL.createObjectURL(f)); setFileObj(f); }
  };

  const runAnalysis = async () => {
    if (!fileObj) return;
    setStep('analyzing'); setProgress(0); setErrorMsg('');

    const iv = setInterval(() => setProgress(p => Math.min(p + 2, 88)), 120);

    const recordPatientAnalysis = (r) => {
      if (typeof ClinicStore !== 'undefined') ClinicStore.recordAnalysis({
        patientId: pt.id, patientName: pt.name,
        dx: r.dx, dxLabel: r.dxLabel, confidence: r.confidence, riskLevel: r.riskLevel,
        scores: r.scores, recommendation: r.recommendation, localization,
      });
    };

    const RECO = {
      mel:   'Immediate excisional biopsy recommended. Urgent referral to surgical oncology.',
      bcc:   'Surgical excision recommended. Consult with your dermatologist.',
      akiec: 'Topical treatment or cryotherapy may be required. Book a follow-up.',
      nv:    'Benign lesion detected. Continue annual dermoscopic monitoring.',
      bkl:   'Benign keratosis detected. No immediate treatment required.',
      df:    'Benign lesion confirmed. No intervention required.',
      vasc:  'Vascular lesion noted. Dermatologist review recommended.',
    };
    const mapData = (data) => {
      const e = eodForPatient(pt);
      return {
        dx:           data.predicted_class,
        dxLabel:      data.predicted_label,
        confidence:   data.confidence_score,
        riskLevel:    data.risk_level,
        scores:       Object.fromEntries(Object.entries(data.all_probabilities).map(([k,v]) => [k, v/100])),
        fairnessNote: data.fairness_note,
        recommendation: RECO[data.predicted_class] || 'Please consult your dermatologist.',
        eodBaseline:  data.eod_baseline  ?? e.baseline,
        eodEnhanced:  data.eod_enhanced  ?? e.enhanced,
        eodReduction: data.eod_reduction ?? e.reduction,
        eodSubgroup:  data.eod_subgroup  ?? e.label,
        demo:         data._demo,
      };
    };

    try {
      const data = await PatientApi.melanomaCheck(fileObj, localization);
      clearInterval(iv); setProgress(100);
      setTimeout(() => { const r = mapData(data); setResult(r); setStep('result'); recordPatientAnalysis(r); }, 300);
    } catch (err) {
      // Backend unreachable — show a simulated result so the demo still works offline.
      clearInterval(iv); setProgress(100);
      const sim = simulatePrediction(pt, localization);
      setTimeout(() => { const r = mapData(sim); setResult(r); setStep('result'); recordPatientAnalysis(r); }, 300);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Skin Lesion Scan" subtitle="AI-powered analysis using our bias-corrected melanoma detection model" />
      <PageContent>

        {step === 'upload' && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <Card style={{ marginBottom: 16, background: 'var(--info-bg)', borderColor: 'var(--info)' }}>
              <div style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--info)' }}>
                <Icon name="info" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>This tool uses our bias-corrected Enhanced AI model for equitable screening. Always consult your doctor for a definitive diagnosis.</span>
              </div>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Upload Skin Image</div>
              <div onClick={() => fileRef.current.click()} style={{
                border: '2px dashed var(--border)', borderRadius: 12, padding: '40px 24px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
              }}>
                {fileUrl ? (
                  <img src={fileUrl} alt="Skin lesion" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <>
                    <Icon name="upload" size={36} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Tap to upload photo</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Best results: clear, close-up, well-lit dermoscopic image</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Where is the lesion?</div>
                <select value={localization} onChange={e => setLocalization(e.target.value)} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', outline: 'none',
                }}>
                  {LOCALIZATIONS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>

              <Btn icon="scan" size="lg" onClick={runAnalysis} disabled={!fileObj}
                style={{ width: '100%', justifyContent: 'center' }}>
                Run Scan Analysis
              </Btn>
            </Card>
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong>Photo tips:</strong> Ensure good lighting · Remove hair if covering lesion · Keep camera steady
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div style={{ maxWidth: 440, margin: '60px auto', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Icon name="scan" size={36} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Analysing your image…</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
              Our bias-corrected AI model is reviewing your skin lesion. This usually takes a few seconds.
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)',
                borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{progress}%</div>
          </div>
        )}

        {step === 'error' && (
          <div style={{ maxWidth: 480, margin: '60px auto' }}>
            <Card style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)', textAlign: 'center' }}>
              <Icon name="alertTriangle" size={32} style={{ color: 'var(--danger)', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>Scan Failed</div>
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{errorMsg}</div>
              <Btn icon="refresh" onClick={() => setStep('upload')}>Try Again</Btn>
            </Card>
          </div>
        )}

        {step === 'result' && result && (
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {result.demo && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', background: 'var(--warning-bg)', borderRadius: 9, fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
                <Icon name="info" size={14} /> Demo result — backend not reachable, showing simulated output.
              </div>
            )}
            {result.riskLevel === 'high' && (
              <Card style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Icon name="alertTriangle" size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>High-Risk Result Detected</div>
                    <div style={{ fontSize: 13, color: 'var(--danger)', opacity: 0.85, marginTop: 2 }}>Your result has been flagged and shared with your doctor. Please book an appointment urgently.</div>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: 14, overflow: 'hidden',
                  background: 'var(--surface-2)', flexShrink: 0 }}>
                  {fileUrl
                    ? <img src={fileUrl} alt="Lesion" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="scan" size={32} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  }
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Diagnosis</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{result.dxLabel}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>{(result.confidence * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>confidence</span>
                    <RiskBadge level={result.riskLevel} />
                  </div>
                </div>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8,
                fontSize: 11, color: 'var(--primary-dark)', marginBottom: 16 }}>
                🛡 Analysed by Enhanced Model v2 — trained with intersectional bias correction across age, sex & anatomical site
              </div>
              <Divider />
              <div style={{ fontWeight: 700, fontSize: 14, margin: '16px 0 12px' }}>Probability by Condition</div>
              {DX_ORDER.map(dx => (
                <ConfidenceBar key={dx} label={DX_LABELS[dx]} value={result.scores[dx] || 0} isMain={dx === result.dx} />
              ))}
              {result.fairnessNote && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--info-bg)',
                  borderRadius: 9, fontSize: 12, color: 'var(--info)', lineHeight: 1.6 }}>
                  🛡 {result.fairnessNote}
                </div>
              )}
            </Card>

            {/* EOD / bias-reduction visualization (matches the doctor portal) */}
            {(() => {
              const eod = eodForPatient(pt);
              const eodAxes = eod.axes;
              const eodBase = result.eodBaseline ?? eod.meanBaseline;
              const eodEnh  = result.eodEnhanced ?? eod.meanEnhanced;
              const eodRed  = result.eodReduction ?? eod.meanReduction;
              return (
                <Card style={{ border: '2px solid var(--success)', background: 'linear-gradient(150deg, var(--success-bg), var(--surface))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Icon name="shield" size={17} style={{ color: 'var(--success)' }} />
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Fair &amp; Bias-Corrected Result</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    Equal Opportunity Difference on the protected axes you sit on, comparing the baseline model with the deployed Full Framework.
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
              );
            })()}

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Doctor's Recommendation</div>
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 16 }}>{result.recommendation}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn icon="calendar" onClick={() => setPage && setPage('appointments')}>Book Appointment</Btn>
                <Btn variant="secondary" icon="download" onClick={() => downloadAnalysisReport(
                  pt,
                  { ...result, localization, date: new Date().toISOString().slice(0, 10), eodAxes: (eodForPatient(pt) || {}).axes },
                  ''
                )}>Download Report</Btn>
                <Btn variant="secondary" icon="refresh" onClick={() => setStep('upload')}>New Scan</Btn>
              </div>
            </Card>
          </div>
        )}
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   PATIENT APPOINTMENTS
════════════════════════════════════════ */
const PatientAppointments = () => {
  const pt = PATIENT_USER;
  const { list, online, book, changeStatus } = useAppointments('patient');
  const upcoming  = (list || []).filter(a => a.status === 'scheduled');
  const past      = (list || []).filter(a => a.status !== 'scheduled');
  const [booking, setBooking] = useState(false);
  const [form, setForm] = useState({ date: '', time: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const todayISO = new Date().toISOString().slice(0, 10);

  const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const monOf = d => { const m = parseInt((d || '').split('-')[1], 10); return MON[(m || 1) - 1]; };
  const dayOf = d => (d || '').split('-')[2] || '?';

  const confirmBooking = async () => {
    if (!form.date || !form.time || !form.reason) return;
    // Reject appointments in the past (date OR time earlier than now)
    const when = new Date(`${form.date}T${form.time}`);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) {
      setError('Please choose a date and time in the future — appointments cannot be booked in the past.');
      return;
    }
    setError('');
    setBusy(true);
    await book({ patientId: pt.id, date: form.date, time: form.time, duration: 30, reason: form.reason });
    setBusy(false); setBooking(false); setForm({ date: '', time: '', reason: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Appointments" actions={<><LiveBadge online={online} /><Btn icon="plus" onClick={() => setBooking(b => !b)}>{booking ? 'Close' : 'Book Appointment'}</Btn></>} />
      <PageContent>
        {booking && (
          <Card style={{ maxWidth: 500, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Book New Appointment</div>
            {[
              { label: 'Preferred Date', type: 'date', key: 'date' },
              { label: 'Preferred Time', type: 'time', key: 'time' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{f.label}</div>
                <input type={f.type} value={form[f.key]} min={f.type === 'date' ? todayISO : undefined} onChange={e => { setError(''); setForm(prev => ({ ...prev, [f.key]: e.target.value })); }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: 'var(--text)' }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Reason for Visit</div>
              <select value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: 'var(--text)', background: 'var(--surface)' }}>
                <option value="">Select reason…</option>
                <option>Follow-up Consultation</option>
                <option>New Lesion Assessment</option>
                <option>Annual Skin Check</option>
                <option>Biopsy Follow-up</option>
                <option>Treatment Review</option>
              </select>
            </div>
            {error && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', marginBottom: 14, background: 'var(--danger-bg)', borderRadius: 9, fontSize: 13, color: 'var(--danger)', fontWeight: 500 }}>
                <Icon name="alertTriangle" size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}
            <Btn icon="check" onClick={confirmBooking} disabled={busy || !form.date || !form.time || !form.reason} style={{ width: '100%', justifyContent: 'center' }}>{busy ? 'Booking…' : 'Confirm Booking'}</Btn>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card padding="0">
            <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'space-between' }}>Upcoming <Badge variant="info">{upcoming.length}</Badge></div>
            <Divider />
            {upcoming.length === 0 ? <EmptyState icon="calendar" message="No upcoming appointments" /> :
              upcoming.map(a => (
                <div key={a.id} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--info-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--info)' }}>{dayOf(a.date)}</div>
                    <div style={{ fontSize: 10, color: 'var(--info)', opacity: 0.8 }}>{monOf(a.date)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.reason}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dr. Ramaneiss · {a.time} · {a.duration} min</div>
                  </div>
                  <Btn variant="danger" size="sm" onClick={() => changeStatus(a, 'cancelled')}>Cancel</Btn>
                </div>
              ))
            }
          </Card>

          <Card padding="0">
            <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'space-between' }}>Past <Badge variant="default">{past.length}</Badge></div>
            <Divider />
            {past.length === 0 ? <EmptyState icon="clock" message="No past appointments" /> :
              past.map(a => (
                <div key={a.id} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-muted)' }}>{dayOf(a.date)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)' }}>{monOf(a.date)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.reason}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dr. Ramaneiss · {a.time}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            }
          </Card>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   PATIENT RESULTS
════════════════════════════════════════ */
const PatientResults = () => {
  const pt = PATIENT_USER;
  const { analyses } = usePatientClinic(pt.id);
  const [expanded, setExpanded] = useState(null);

  // Live database records (when the Flask backend is reachable). Prefer these
  // over the offline store so results survive a hard reload; fall back to the
  // live store when the backend is unavailable (offline demo).
  const dbChecks = usePatientChecks(pt.id, pt.localization);

  const myResults = dbChecks != null ? dbChecks : analyses;

  const RECO = {
    mel: 'Immediate excisional biopsy recommended. Urgent referral to surgical oncology.',
    bcc: 'Surgical excision recommended. Consult with your dermatologist.',
    akiec: 'Topical treatment or cryotherapy may be required. Book a follow-up.',
    nv: 'Benign lesion detected. Continue annual dermoscopic monitoring.',
    bkl: 'Benign keratosis detected. No immediate treatment required.',
    df: 'Benign lesion confirmed. No intervention required.',
    vasc: 'Vascular lesion noted. Dermatologist review recommended.',
  };

  // ── Chart data derived from this patient's scans (updates live) ──
  const classData = DX_ORDER
    .map(dx => ({ label: `${DX_LABELS[dx]} (${dx})`, value: myResults.filter(r => r.dx === dx).length }))
    .filter(d => d.value > 0);
  const classTotal = classData.reduce((s, d) => s + d.value, 0);

  const locCounts = {};
  myResults.forEach(r => {
    const loc = r.localization || pt.localization || 'unknown';
    locCounts[loc] = (locCounts[loc] || 0) + 1;
  });
  const locData = Object.entries(locCounts)
    .map(([loc, value]) => ({ label: loc.replace(/\b\w/g, c => c.toUpperCase()).replace('Extremity', 'Ext.'), value }))
    .sort((a, b) => b.value - a.value);

  // Analyses performed per day, chronological
  const byDate = {};
  myResults.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + 1; });
  const trendData = Object.keys(byDate).sort()
    .map(date => ({ label: date.slice(5), value: byDate[date] }));

  const hasData = myResults.length > 0;

  const downloadRecord = (r, e) => {
    e.stopPropagation();
    downloadAnalysisReport(
      pt,
      { ...r, recommendation: r.recommendation || RECO[r.dx] || '', localization: r.localization || pt.localization,
        eodAxes: (eodForPatient(pt) || {}).axes },
      ''
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Detection Results" subtitle={`${myResults.length} scan(s) on record`} />
      <PageContent>
        <div style={{ maxWidth: 1160, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left column: charts — update dynamically as more scans are run */}
          {hasData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Skin Lesion Class Distribution</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{classTotal.toLocaleString()} analysis(es) performed — grows as scans are done</div>
                {classData.map(d => {
                  const pct = classTotal ? d.value / classTotal : 0;
                  return (
                    <div key={d.label} style={{ marginBottom: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text)' }}>{d.label}</span>
                        <span style={{ fontWeight: 600 }}>{d.value.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({(pct * 100).toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </Card>
              <Card>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Lesion Location Diversity</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Anatomical site of your analyses — grows as scans are done</div>
                <HBarChart data={locData} color="var(--primary)" />
              </Card>
              <Card>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Skin-Lesion Analyses Performed</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Scans over time</div>
                {trendData.length >= 2
                  ? <AreaTrend data={trendData} height={150} />
                  : <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-2)', borderRadius: 9 }}>
                      Run at least two scans to see your analyses trend over time.
                    </div>}
              </Card>
            </div>
          )}

          {/* Right column: past scan records */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Past Scan Analysis Records</div>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>

          {myResults.length === 0 ? <EmptyState icon="fileText" message="No results yet — run a scan to get started" /> :
            myResults.map(r => {
              const open = expanded === r.id;
              return (
                <Card key={r.id} onClick={() => setExpanded(open ? null : r.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 11, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="scan" size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{r.dxLabel}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.date} · {(r.confidence * 100).toFixed(0)}% confidence</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Btn variant="secondary" size="sm" icon="download" onClick={e => downloadRecord(r, e)}>Report</Btn>
                      <RiskBadge level={r.riskLevel} />
                      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  {open && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 14, background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 9 }}>
                        {r.recommendation || RECO[r.dx] || 'Please consult your dermatologist.'}
                      </div>
                      {DX_ORDER.map(dx => (
                        <ConfidenceBar key={dx} label={DX_LABELS[dx]} value={(r.scores || {})[dx] || 0} isMain={dx === r.dx} />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          }
          </div>
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   PATIENT MESSAGES
════════════════════════════════════════ */
const PatientMessages = () => {
  const cid = PATIENT_USER.id;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Messages" subtitle="Chat with your attending doctor" />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatThread
          cid={cid}
          role="patient"
          otherName={DOCTOR_USER.name}
          otherSubtitle={DOCTOR_USER.specialty + ' · Your attending doctor'}
          emptyHint="Send a message to your doctor — they'll reply here."
        />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   PATIENT NOTIFICATIONS
════════════════════════════════════════ */
const PatientNotifications = () => {
  const store = usePatientNotifs();
  const notifs = store.list();
  const unread = store.unreadCount();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Notifications" subtitle={`${unread} unread`}
        actions={unread > 0 && <Btn variant="ghost" size="sm" onClick={() => store.markAllRead()}>Mark all read</Btn>} />
      <PageContent>
        <Card padding="0" style={{ maxWidth: 600 }}>
          {notifs.map(n => (
            <div key={n.id} onClick={() => store.markRead(n.id)} style={{
              display: 'flex', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: n.read ? 'transparent' : 'var(--primary-light)', cursor: 'pointer',
            }}>
              <NotifIcon type={n.type} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: n.read ? 500 : 700, color: 'var(--text)' }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.message}</div>
              </div>
              {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />}
            </div>
          ))}
        </Card>
      </PageContent>
    </div>
  );
};

Object.assign(window, {
  PatientDashboard, PatientProfile, PatientDetection,
  PatientAppointments, PatientResults, PatientMessages, PatientNotifications,
});
