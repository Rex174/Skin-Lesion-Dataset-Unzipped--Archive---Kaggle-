
const { useState, useRef, useEffect } = React;

/* ════════════════════════════════════════
   PATIENT DASHBOARD
════════════════════════════════════════ */
const PatientDashboard = ({ setPage }) => {
  const pt = PATIENT_USER;
  const myDetections  = DETECTIONS.filter(d => d.patientId === pt.id);
  const myAppointments = APPOINTMENTS.filter(a => a.patientId === pt.id);
  const latest  = myDetections[0];
  const nextApt = myAppointments.find(a => a.status === 'scheduled');
  const unread  = NOTIFICATIONS_PATIENT.filter(n => !n.read).length;

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
          <StatCard icon="heart"    label="Risk Level"         value={pt.riskLevel === 'high' ? '⚠ High' : pt.riskLevel === 'medium' ? 'Moderate' : 'Low'} sub="Current assessment" iconColor={pt.riskLevel === 'high' ? 'var(--danger)' : 'var(--success)'} />
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
                  ⚠ {latest.recommendation}
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
                    <div style={{ fontSize: 11, color: 'var(--info)', opacity: 0.8 }}>APR</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{nextApt.reason}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dr. Ramaneiss Pillai · {nextApt.time} · {nextApt.duration} min</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <Btn variant="secondary" size="sm">Reschedule</Btn>
                  <Btn variant="danger" size="sm">Cancel</Btn>
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
  const [editing, setEditing] = useState(false);

  const Field = ({ label, value, icon }) => (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
      <Icon name={icon || 'user'} size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Profile" actions={<Btn icon="edit" variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing(e => !e)}>{editing ? 'Save Changes' : 'Edit Profile'}</Btn>} />
      <PageContent>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, maxWidth: 860 }}>
          {/* Profile card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ textAlign: 'center' }} padding="28px">
              <Avatar name={pt.name} size={72} />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{pt.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{pt.id}</div>
              <RiskBadge level={pt.riskLevel} />
              <Divider style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {[['Age', `${pt.age}y`], ['Skin', `Type ${pt.skinType}`], ['Blood', pt.bloodType]].map(([k, v]) => (
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
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Your registered details</div>
              <Field label="Full Name" value={pt.name} icon="user" />
              <Field label="Age" value={`${pt.age} years old`} icon="clock" />
              <Field label="Sex" value={pt.sex} icon="user" />
              <Field label="Phone" value={pt.phone} icon="phone" />
              <Field label="Email" value={pt.email} icon="mail" />
              <Field label="Address" value={pt.address} icon="mapPin" />
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Medical Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Blood Type', pt.bloodType],
                  ['Skin Type', `Type ${pt.skinType} (ITA ${pt.ita}°)`],
                  ['Allergies', pt.allergies],
                  ['Primary Lesion Site', pt.localization],
                  ['Known Condition', DX_LABELS[pt.diagnosis] || pt.diagnosis],
                  ['Attending Doctor', 'Dr. Ramaneiss Pillai'],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 9 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {pt.riskLevel === 'high' && (
              <Card style={{ borderColor: 'var(--danger)', background: 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Icon name="alertTriangle" size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>High-Risk Status</div>
                    <div style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.6 }}>{pt.notes}</div>
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

const PatientDetection = () => {
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

            {/* EOD / bias-reduction card */}
            <Card style={{ border: '1.5px solid var(--success)', background: 'linear-gradient(150deg, var(--success-bg), var(--surface))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="shield" size={16} style={{ color: 'var(--success)' }} />
                <div style={{ fontSize: 14, fontWeight: 800 }}>Fair & Bias-Corrected Result</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                For your demographic group (<strong>{result.eodSubgroup}</strong>), our Enhanced model cut the
                Equal Opportunity Difference from <strong>{result.eodBaseline.toFixed(3)}</strong> down to
                <strong> {result.eodEnhanced.toFixed(3)}</strong> — a
                <strong style={{ color: 'var(--success)' }}> {result.eodReduction}% reduction in diagnostic bias</strong>
                compared with a standard model. This means your result is held to the same accuracy standard as every other group.
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Doctor's Recommendation</div>
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 16 }}>{result.recommendation}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn icon="calendar">Book Appointment</Btn>
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
  const myApts = APPOINTMENTS.filter(a => a.patientId === pt.id);
  const upcoming  = myApts.filter(a => a.status === 'scheduled');
  const past      = myApts.filter(a => a.status === 'completed');
  const [booking, setBooking] = useState(false);
  const [form, setForm] = useState({ date: '', time: '', reason: '' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Appointments" actions={<Btn icon="plus" onClick={() => setBooking(b => !b)}>{booking ? 'Cancel' : 'Book Appointment'}</Btn>} />
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
                <input type={f.type} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
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
            <Btn icon="check" onClick={() => setBooking(false)} style={{ width: '100%', justifyContent: 'center' }}>Confirm Booking</Btn>
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
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--info)' }}>{a.date.split('-')[2]}</div>
                    <div style={{ fontSize: 10, color: 'var(--info)', opacity: 0.8 }}>APR</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.reason}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dr. Ramaneiss · {a.time} · {a.duration} min</div>
                  </div>
                  <StatusBadge status={a.status} />
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
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-muted)' }}>{a.date.split('-')[2]}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)' }}>APR</div>
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
  const myResults = DETECTIONS.filter(d => d.patientId === pt.id);
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="My Detection Results" subtitle={`${myResults.length} scan(s) on record`} />
      <PageContent>
        <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                      <RiskBadge level={r.riskLevel} />
                      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  {open && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 14, background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 9 }}>
                        {r.recommendation}
                      </div>
                      {DX_ORDER.map(dx => (
                        <ConfidenceBar key={dx} label={DX_LABELS[dx]} value={r.scores[dx] || 0} isMain={dx === r.dx} />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          }
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
  const [notifs, setNotifs] = useState(NOTIFICATIONS_PATIENT);
  const unread = notifs.filter(n => !n.read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Notifications" subtitle={`${unread} unread`}
        actions={unread > 0 && <Btn variant="ghost" size="sm" onClick={() => setNotifs(n => n.map(x => ({ ...x, read: true })))}>Mark all read</Btn>} />
      <PageContent>
        <Card padding="0" style={{ maxWidth: 600 }}>
          {notifs.map(n => (
            <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{
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
