
const { useState, useEffect } = React;

/* ── Theme definitions ─────────────────────────────────── */
const THEMES = {
  coral: {
    '--primary':        'oklch(62% 0.16 35)',
    '--primary-dark':   'oklch(48% 0.16 35)',
    '--primary-light':  'oklch(94% 0.06 35)',
    '--secondary':      'oklch(58% 0.14 190)',
    '--accent':         'oklch(72% 0.16 75)',
    '--info':           'oklch(58% 0.16 240)',
    '--info-bg':        'oklch(94% 0.05 240)',
  },
  ocean: {
    '--primary':        'oklch(55% 0.18 240)',
    '--primary-dark':   'oklch(40% 0.18 240)',
    '--primary-light':  'oklch(94% 0.06 240)',
    '--secondary':      'oklch(58% 0.14 190)',
    '--accent':         'oklch(72% 0.16 75)',
    '--info':           'oklch(62% 0.16 270)',
    '--info-bg':        'oklch(94% 0.05 270)',
  },
  sage: {
    '--primary':        'oklch(52% 0.12 155)',
    '--primary-dark':   'oklch(38% 0.12 155)',
    '--primary-light':  'oklch(93% 0.05 155)',
    '--secondary':      'oklch(60% 0.12 80)',
    '--accent':         'oklch(68% 0.14 35)',
    '--info':           'oklch(55% 0.14 240)',
    '--info-bg':        'oklch(94% 0.05 240)',
  },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "coral",
  "fontScale": 1,
  "sidebarWide": true
}/*EDITMODE-END*/;

function applyTheme(theme) {
  const vars = THEMES[theme] || THEMES.coral;
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}

/* ── Login screen ───────────────────────────────────────── */
const LoginScreen = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = React.useState(null);
  const [form, setForm]   = React.useState({ username: '', password: '' });
  const [error, setError]  = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    if (!form.username || !form.password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await AuthApi.login(form.username, form.password);
      window.HMS_USER = user;           // make profile available globally
      onLogin(user.role);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  /* The rest of the JSX is identical to the original LoginScreen —
     only handleLogin changed.  Copy the existing return() block here. */
  return (
    <div style={{
      minHeight: '100vh', width: '100vw', display: 'flex',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {/* Left branding panel */}
      <div style={{
        width: '45%',
        background: 'linear-gradient(145deg, var(--primary-dark) 0%, var(--primary) 60%, var(--secondary) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '60px 48px', position: 'relative', overflow: 'hidden',
      }}>
        {[180, 280, 380].map(s => (
          <div key={s} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)' }} />
        ))}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#fff' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20,
            background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px', backdropFilter: 'blur(10px)' }}>
            <Icon name="shield" size={36} style={{ color: '#fff' }} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, marginBottom: 8 }}>MelanoScan HMS</div>
          <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.7, maxWidth: 280 }}>
            Hospital Management System for AI-powered melanoma detection and dermatology care.
          </div>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: 'scan',     text: 'AI-Powered Melanoma Detection'   },
              { icon: 'shield',   text: 'Bias-Corrected cGAN Framework'   },
              { icon: 'users',    text: 'Multi-role Patient Management'   },
              { icon: 'barChart', text: 'Fairness Metrics & Analytics'    },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', gap: 10, alignItems: 'center',
                background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                <Icon name={f.icon} size={16} style={{ color: 'rgba(255,255,255,0.9)' }} />
                <span style={{ fontSize: 13, opacity: 0.9 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Welcome back</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sign in to your MelanoScan account</div>
          </div>

          {!selectedRole ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12,
                letterSpacing: 0.5, textTransform: 'uppercase' }}>Select your role</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { role: 'doctor',  icon: 'microscope', label: 'Doctor',  sub: 'Clinical staff portal',  color: 'var(--primary)'   },
                  { role: 'patient', icon: 'heart',      label: 'Patient', sub: 'Personal health portal', color: 'var(--secondary)' },
                ].map(r => (
                  <button key={r.role} onClick={() => { setSelectedRole(r.role); setError(''); }}
                    style={{ padding: '24px 16px', borderRadius: 16, border: '2px solid var(--border)',
                      background: 'var(--surface)', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = 'var(--primary-light)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: r.color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 12px', color: r.color }}>
                      <Icon name={r.icon} size={22} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.sub}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { setSelectedRole(null); setForm({ username: '', password: '' }); setError(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                  color: 'var(--text-muted)', background: 'none', border: 'none',
                  cursor: 'pointer', marginBottom: 24, fontFamily: 'inherit' }}>
                <Icon name="chevronLeft" size={14} /> Back
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28,
                padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 10 }}>
                <Icon name={selectedRole === 'doctor' ? 'microscope' : 'heart'}
                  size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)',
                  textTransform: 'capitalize' }}>{selectedRole} Portal</span>
              </div>

              {[
                { label: 'Username', key: 'username', type: 'text',
                  placeholder: selectedRole === 'doctor' ? 'dr_ramaneiss' : 'john_doe' },
                { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>{f.label}</div>
                  <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    style={{ width: '100%', padding: '11px 16px', borderRadius: 10,
                      border: '1.5px solid var(--border)', fontSize: 14,
                      fontFamily: 'inherit', outline: 'none', color: 'var(--text)' }}
                  />
                </div>
              ))}

              {error && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 14 }}>{error}</div>}

              <button onClick={handleLogin} disabled={loading}
                style={{ width: '100%', padding: '13px', borderRadius: 11,
                  background: loading ? 'var(--text-muted)' : 'var(--primary)',
                  color: '#fff', fontSize: 15, fontWeight: 700, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div style={{ padding: '10px 14px', background: 'var(--surface-2)',
                borderRadius: 9, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong>Demo:</strong> {selectedRole === 'doctor' ? 'dr_ramaneiss / doctor123' : 'john_doe / patient123'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main App ───────────────────────────────────────────── */
const App = () => {
  const [tweaks, setTweaks] = useState(() => {
    try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem('hms_tweaks') || '{}') }; } catch { return TWEAK_DEFAULTS; }
  });
  const [role, setRole]   = useState(() => localStorage.getItem('hms_role') || null);
  const [page, setPage]   = useState(() => localStorage.getItem('hms_page') || 'dashboard');
  const [selectedPatientId,  setSelectedPatientId]  = useState(null);
  const [detectionPatientId, setDetectionPatientId] = useState(null);
  const [tweakVisible, setTweakVisible] = useState(false);

  // Persist state
  useEffect(() => { if (role) localStorage.setItem('hms_role', role); }, [role]);
  useEffect(() => { localStorage.setItem('hms_page', page); }, [page]);

  // Apply theme
  useEffect(() => { applyTheme(tweaks.theme); }, [tweaks.theme]);

  // Tweaks bridge
  useEffect(() => {
    const handler = e => {
      if (e.data?.type === '__activate_edit_mode')   setTweakVisible(true);
      if (e.data?.type === '__deactivate_edit_mode')  setTweakVisible(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateTweak = (key, val) => {
    const next = { ...tweaks, [key]: val };
    setTweaks(next);
    localStorage.setItem('hms_tweaks', JSON.stringify(next));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
  };

  const logout = async () => {
  try { await AuthApi.logout(); } catch (_) {}
  setRole(null);
  setPage('dashboard');
  localStorage.removeItem('hms_role');
  window.HMS_USER = null;
};

  // Navigation helpers
  const navigate = (p, extra = {}) => {
    if (extra.patientId)          setSelectedPatientId(extra.patientId);
    if (extra.detectionPatientId) setDetectionPatientId(extra.detectionPatientId);
    setPage(p);
  };

  if (!role) return <LoginScreen onLogin={r => { setRole(r); setPage('dashboard'); }} />;

  const user = role === 'doctor' ? DOCTOR_USER : PATIENT_USER;

  const renderDoctor = () => {
    const common = { setPage: (p, extra) => navigate(p, extra || {}), setSelectedPatientId, setDetectionPatientId };
    switch (page) {
      case 'dashboard':     return <DoctorDashboard {...common} />;
      case 'patients':      return <DoctorPatients {...common} />;
      case 'detection':     return <DoctorDetection detectionPatientId={detectionPatientId} />;
      case 'record':        return <DoctorRecord selectedPatientId={selectedPatientId} setPage={p => setPage(p)} setDetectionPatientId={setDetectionPatientId} />;
      case 'appointments':  return <DoctorAppointments />;
      case 'messages':      return <DoctorMessages />;
      case 'analytics':     return <DoctorAnalytics />;
      case 'models':        return <DoctorModelPerformance />;
      case 'notifications': return <DoctorNotifications />;
      default:              return <DoctorDashboard {...common} />;
    }
  };

  const renderPatient = () => {
    const setP = p => setPage(p);
    switch (page) {
      case 'dashboard':     return <PatientDashboard setPage={setP} />;
      case 'profile':       return <PatientProfile />;
      case 'detection':     return <PatientDetection />;
      case 'appointments':  return <PatientAppointments />;
      case 'results':       return <PatientResults />;
      case 'messages':      return <PatientMessages />;
      case 'notifications': return <PatientNotifications />;
      default:              return <PatientDashboard setPage={setP} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      <Sidebar role={role} page={page} setPage={setPage} user={user} onLogout={logout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {role === 'doctor' ? renderDoctor() : renderPatient()}
      </div>

      {/* Tweaks Panel */}
      {tweakVisible && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, width: 260,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          zIndex: 9999, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', gap: 7, alignItems: 'center' }}>
              <Icon name="sliders" size={15} style={{ color: 'var(--primary)' }} /> Tweaks
            </div>
            <button onClick={() => setTweakVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Icon name="xMark" size={15} />
            </button>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Color theme */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Color Theme</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'coral', color: 'oklch(62% 0.16 35)',  label: 'Coral' },
                  { id: 'ocean', color: 'oklch(55% 0.18 240)', label: 'Ocean' },
                  { id: 'sage',  color: 'oklch(52% 0.12 155)', label: 'Sage'  },
                ].map(t => (
                  <button key={t.id} onClick={() => updateTweak('theme', t.id)} title={t.label} style={{
                    width: 32, height: 32, borderRadius: '50%', background: t.color, border: `3px solid ${tweaks.theme === t.id ? 'var(--text)' : 'transparent'}`,
                    cursor: 'pointer', transition: 'border 0.15s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textTransform: 'capitalize' }}>
                Active: {tweaks.theme}
              </div>
            </div>

            {/* Role switch */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Switch Portal</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['doctor', 'patient'].map(r => (
                  <button key={r} onClick={() => { setRole(r); setPage('dashboard'); localStorage.setItem('hms_role', r); }} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit',
                    background: role === r ? 'var(--primary)' : 'var(--surface)',
                    color: role === r ? '#fff' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  }}>{r}</button>
                ))}
              </div>
            </div>

            {/* Doctor: quick page nav */}
            {role === 'doctor' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Jump to</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[['dashboard','Dashboard'],['patients','Patients'],['detection','Detection'],['analytics','Analytics']].map(([p,l]) => (
                    <button key={p} onClick={() => setPage(p)} style={{
                      padding: '7px 10px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
                      background: page === p ? 'var(--primary-light)' : 'transparent',
                      color: page === p ? 'var(--primary)' : 'var(--text-muted)',
                      fontSize: 13, fontWeight: page === p ? 700 : 400, cursor: 'pointer', textAlign: 'left',
                    }}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
