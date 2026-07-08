
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
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Good morning, Dr. Ramaneiss 👋</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>You have {upcomingCount} appointment{upcomingCount === 1 ? '' : 's'} scheduled and {highRiskCount} high-risk case{highRiskCount === 1 ? '' : 's'} to review.</div>
          </div>
          <div style={{ opacity: 0.18, fontSize: 72 }}>🔬</div>
        </div>

        {/* Stats — live */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard icon="users"         label="Total Patients"  value={<AnimatedNumber value={totalPatients} />} sub="Under your care" />
          <StatCard icon="scan"          label="Analyses Today"  value={<AnimatedNumber value={analysesToday} />} sub="Updating in real time" />
          <StatCard icon="calendar"      label="Upcoming Appts"  value={<AnimatedNumber value={upcomingCount} />} sub="Next: 09:00 today" />
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
   DOCTOR PATIENTS LIST
════════════════════════════════════════ */
const DoctorPatients = ({ setPage, setSelectedPatientId, setDetectionPatientId }) => {
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');
  const clinic = useClinic();  // live DB when online, demo cohort offline

  const filtered = (clinic.patients || []).filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.diagnosis || '').includes(search.toLowerCase());
    const matchRisk = filterRisk === 'all' || p.riskLevel === filterRisk;
    return matchSearch && matchRisk;
  });
  const totalCount = (clinic.patients || []).length;

  const skinTypeColor = t => ({ I:'#FAE8D4', II:'#F5D5B0', III:'#E5B98A', IV:'#C6935A', V:'#9B6B3A', VI:'#6B3E1A' }[t] || '#ccc');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Patient Management" subtitle={`${filtered.length} of ${totalCount} patients`} />
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
                {['Patient','Age / Sex','Skin Type','Localization','Last Visit','Risk','Actions'].map(h => (
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
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text)' }}>{p.age} / {p.sex}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: skinTypeColor(p.skinType), border: '1.5px solid var(--border)' }} />
                      <span style={{ fontSize: 13 }}>Type {p.skinType}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text)', textTransform: 'capitalize' }}>{p.localization}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{p.lastVisit}</td>
                  <td style={{ padding: '13px 16px' }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="secondary" size="sm" icon="eye" onClick={() => { setSelectedPatientId(ClinicStore.demoIdForName(p.name) || p.id); setPage('record'); }}>View</Btn>
                      <Btn variant="primary"   size="sm" icon="scan" onClick={() => { setDetectionPatientId(ClinicStore.demoIdForName(p.name) || p.id); setPage('detection'); }}>Analyze</Btn>
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
              {isEnhanced ? 'Intersectional Sampling + Reweighting + cGAN' : 'Original HAM10000 (unmodified)'}
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
      <TopBar title="Melanoma Detection Analysis" subtitle="AI-powered analysis using the deployed best model — Enhanced v2 (Hybrid)" />
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)' }}>Deployed model: Enhanced v2 (Hybrid)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>The best-performing, bias-corrected model is used for all clinical analyses. Compare every trained model under <strong>Model Performance</strong>.</div>
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
          const eod = eodForPatient(patient);
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
                  onClick={() => patient && DoctorApi.generateReport(patient.id)}>
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
              <ModelResultCard result={resultE} modelLabel="Model E — Full Framework" isEnhanced={true} />

              {/* ── EOD / BIAS REDUCTION PANEL (age · sex · location) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card style={{ border: '2px solid var(--success)', background: 'linear-gradient(150deg, var(--success-bg), var(--surface))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Icon name="shield" size={17} style={{ color: 'var(--success)' }} />
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Fairness for this patient</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    Equal Opportunity Difference on the protected axes this patient sits on, comparing the baseline model with the deployed Full Framework.
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

                  <div style={{ marginTop: 6, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                    The hybrid framework (stratified sampling + reweighting + cGAN augmentation) equalises melanoma detection across age, sex and lesion location — the largest gains are in age-group and sex fairness.
                  </div>
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
  const patient = PATIENTS.find(p => p.id === selectedPatientId) || PATIENTS[0];
  const detections = DETECTIONS.filter(d => d.patientId === patient.id);
  const appointments = APPOINTMENTS.filter(a => a.patientId === patient.id);
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState(patient.notes);

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
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{patient.id}</div>
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
   DOCTOR ANALYTICS
════════════════════════════════════════ */
const DoctorAnalytics = () => {
  const { eodByAxis, melTprByAge, melTprBySex, melTprByLoc, dxDistribution, cohort } = ANALYTICS_DATA;
  const { data: liveA, online } = useLive(
    () => apiFetch('/api/doctor/analytics-live'),
    () => LiveSim.analytics(),
    4000
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Analytics & Fairness Metrics" subtitle="HAM10000 · Model E (Full Framework, deployed) · live bias audit"
        actions={<LiveBadge online={online} />} />
      <PageContent>
        {/* Key metrics — live, real deployed-model numbers */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon:'shield',     label:'Overall Accuracy',   value:<AnimatedNumber value={(liveA?.overallAccuracy ?? 0.7327) * 100} decimals={1} suffix="%" />, sub:'Deployed model (E)',    variant:'info'    },
            { icon:'activity',   label:'Macro AUC',          value:<AnimatedNumber value={liveA?.macroAuc ?? 0.9276} decimals={3} />,                            sub:'Discrimination',        variant:'success' },
            { icon:'trendingUp', label:'Mean EOD',           value:<AnimatedNumber value={liveA?.meanEOD ?? 0.130} decimals={3} />,                              sub:'age · sex · location',  variant:'success' },
            { icon:'layers',     label:'Images Evaluated',   value:<AnimatedNumber value={liveA?.imagesEvaluated ?? 1503} />,                                    sub:'Updating in real time', variant:'info'    },
          ].map(m => (
            <Card key={m.label} style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `var(--${m.variant}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `var(--${m.variant})` }}>
                  <Icon name={m.icon} size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{m.sub}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Trade-off callout */}
        <Card style={{ marginBottom: 20, borderColor: 'var(--info)', background: 'var(--info-bg)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="info" size={18} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              <strong>Fairness–accuracy trade-off.</strong> The Full Framework reduces mean Equal Opportunity Difference by
              <strong> 65%</strong> (0.368 → 0.130) versus the baseline — age-group EOD falls 91% and sex EOD 85% — while overall
              accuracy moves from 86.0% to 73.3%. The deployed model is chosen for equitable melanoma detection across demographic groups.
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* EOD by axis — baseline vs deployed */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Equal Opportunity Difference by Protected Axis</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Lower is fairer · baseline (Model A) vs deployed (Model E)</div>
            <GroupedBarChart data={eodByAxis} height={210} max={0.7} />
          </Card>

          {/* Melanoma TPR by age */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Melanoma Sensitivity by Age Group</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>True-positive rate equalises across groups (Pediatric had no test positives)</div>
            <GroupedBarChart data={melTprByAge} height={210} max={0.75} asPercent decimals={2} />
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Melanoma TPR by sex + location stacked in one card */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Melanoma Sensitivity by Sex</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Gap narrows from 8.4 to 1.3 points</div>
            <GroupedBarChart data={melTprBySex} height={180} max={0.6} asPercent decimals={2} />
          </Card>

          {/* DX distribution */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>HAM10000 Class Distribution</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>10,015 dermoscopic images — severe class imbalance</div>
            {dxDistribution.map(d => (
              <div key={d.label} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text)' }}>{d.label}</span>
                  <span style={{ fontWeight: 600 }}>{d.value.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({(d.pct * 100).toFixed(1)}%)</span></span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.pct * 100}%`, background: 'var(--accent)', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* ═══ PATIENT COHORT & ANALYSIS DIVERSITY ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '30px 0 16px' }}>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Patient Cohort &amp; Analysis Diversity</div>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        </div>

        {/* Row 1: Age distribution + Lesion location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Patient Age Distribution</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Cohort skews middle-aged and older — key for melanoma screening</div>
            <BarChart data={cohort.age} height={190} colorFn={() => 'var(--secondary)'} />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Lesion Location Diversity</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Anatomical site of the analysed skin lesions</div>
            <HBarChart data={cohort.localization} color="var(--primary)" />
          </Card>
        </div>

        {/* Row 2: Sex + Confirmation method + Risk outcome donuts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Patient Sex</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Gender balance of the cohort</div>
            <DonutChart data={cohort.sex} centerLabel="10k" centerSub="patients" />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Diagnosis Confirmation</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>How each ground-truth label was verified</div>
            <DonutChart data={cohort.dxType} centerLabel={`${Math.round(cohort.dxType[0].value / cohort.dxType.reduce((s,d)=>s+d.value,0) * 100)}%`} centerSub="histo." />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Risk Outcome Mix</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Risk level of analysed lesions</div>
            <DonutChart data={cohort.riskOutcome} centerLabel={`${(cohort.riskOutcome[0].value / cohort.riskOutcome.reduce((s,d)=>s+d.value,0) * 100).toFixed(0)}%`} centerSub="high" />
          </Card>
        </div>

        {/* Row 3: Analyses over time */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Skin-Lesion Analyses Performed</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Melanoma detection scans conducted in the HMS, per month</div>
            </div>
            <Badge variant="success">▲ {Math.round((cohort.analysesTrend.at(-1).value / cohort.analysesTrend[0].value - 1) * 100)}% since Jan</Badge>
          </div>
          <div style={{ marginTop: 8 }}>
            <AreaTrend data={cohort.analysesTrend} height={170} color="var(--primary)" />
          </div>
        </Card>

        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-light)', lineHeight: 1.6 }}>
          Cohort diversity charts are grounded in HAM10000 dataset metadata (10,015 dermoscopic images). Analyses-performed reflects MelanoScan HMS clinical activity.
        </div>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR NOTIFICATIONS
════════════════════════════════════════ */
const DoctorNotifications = () => {
  const [notifs, setNotifs] = useState(NOTIFICATIONS_DOCTOR);
  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })));
  const unread = notifs.filter(n => !n.read).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Notifications" subtitle={`${unread} unread`}
        actions={unread > 0 && <Btn variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Btn>} />
      <PageContent>
        <Card padding="0" style={{ maxWidth: 680 }}>
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
              {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))}
        </Card>
      </PageContent>
    </div>
  );
};

/* ════════════════════════════════════════
   DOCTOR — MODEL PERFORMANCE  (all trained models)
════════════════════════════════════════ */
const DoctorModelPerformance = () => {
  const { data: models, online } = useLive(
    () => ModelsApi.comparison(),
    () => MODEL_REGISTRY,
    8000
  );
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
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>{best.note}</div>
            </div>
            <div style={{ display: 'flex', gap: 22, textAlign: 'center' }}>
              {[
                ['Accuracy', `${(best.accuracy * 100).toFixed(1)}%`, 'var(--text)'],
                ['Mean EOD', best.meanEOD.toFixed(3), 'var(--success)'],
                ['Bias ↓ vs baseline', `${biasReduction(best)}%`, 'var(--primary)'],
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
          <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 15 }}>All Trained Models — Detailed Comparison</div>
          <Divider />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Model','Mitigation Strategy','Accuracy','AUC','Mel. Sens.','EOD age','EOD sex','EOD loc','Bias ↓'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Model' || h === 'Mitigation Strategy' ? 'left' : 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(m => (
                  <tr key={m.key} style={{ borderTop: '1px solid var(--border)', background: m.isBest ? 'var(--primary-light)' : 'transparent' }}>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{m.name}</span>
                        {m.isBest && <span style={{ fontSize: 9, background: 'var(--primary)', color: '#fff', borderRadius: 999, padding: '2px 7px', fontWeight: 800 }}>DEPLOYED</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.arch}</div>
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text)' }}>{m.mitigation}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{(m.accuracy * 100).toFixed(1)}%</td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{m.auc.toFixed(3)}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{(m.melSensitivity * 100).toFixed(0)}%</td>
                    {['eodAge','eodSex','eodLoc'].map(k => (
                      <td key={k} style={{ padding: '13px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: m[k] <= 0.08 ? 'var(--success)' : m[k] <= 0.20 ? 'var(--warning)' : 'var(--danger)' }}>{m[k].toFixed(3)}</span>
                      </td>
                    ))}
                    <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: biasReduction(m) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {m.key === baseline.key ? '—' : `${biasReduction(m)}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', fontSize: 11, color: 'var(--text-light)', borderTop: '1px solid var(--border)' }}>
            EOD = Equal Opportunity Difference (max melanoma-TPR gap across subgroups on that axis; lower is fairer). Bias ↓ = mean-EOD reduction vs Model A. Model E is deployed for equitable detection despite lower raw accuracy.
            {!online && ' · Reference values from Phase-1 results — connect the Flask backend (/api/models/comparison) for live figures.'}
          </div>
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
  DoctorRecord, DoctorAppointments, DoctorAnalytics, DoctorNotifications,
  DoctorModelPerformance, DoctorMessages,
});
