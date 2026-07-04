
const { useState, useRef } = React;

/* ── Avatar ─────────────────────────────────────────────── */
const Avatar = ({ name = '?', size = 36 }) => {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const palette = ['#C4796A','#6A8EB0','#6AAB8E','#B09A6A','#8E6AB0','#A08570'];
  const bg = palette[name.charCodeAt(0) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.37, letterSpacing: 0.5,
    }}>{initials}</div>
  );
};

/* ── Badge ───────────────────────────────────────────────── */
const Badge = ({ children, variant = 'default', size = 'sm' }) => {
  const v = {
    default: { bg: 'var(--surface-2)', color: 'var(--text-muted)', border: 'var(--border)' },
    primary: { bg: 'var(--primary-light)', color: 'var(--primary-dark)', border: 'transparent' },
    success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'transparent' },
    danger:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'transparent' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'transparent' },
    info:    { bg: 'var(--info-bg)',    color: 'var(--info)',    border: 'transparent' },
  }[variant] || {};
  return (
    <span style={{
      background: v.bg, color: v.color, border: `1px solid ${v.border || 'transparent'}`,
      borderRadius: 999, fontSize: size === 'sm' ? 11 : 13, fontWeight: 600,
      padding: size === 'sm' ? '2px 9px' : '4px 13px',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
};

/* ── RiskBadge ───────────────────────────────────────────── */
const RiskBadge = ({ level }) => {
  const map = { high: ['danger','High Risk'], medium: ['warning','Moderate'], low: ['success','Low Risk'] };
  const [variant, label] = map[level] || map.low;
  return <Badge variant={variant}>{label}</Badge>;
};

/* ── StatusBadge ─────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = { scheduled: ['info','Scheduled'], completed: ['success','Completed'], cancelled: ['danger','Cancelled'] };
  const [variant, label] = map[status] || ['default', status];
  return <Badge variant={variant}>{label}</Badge>;
};

/* ── Card ────────────────────────────────────────────────── */
const Card = ({ children, style = {}, onClick, padding = '20px' }) => (
  <div onClick={onClick} style={{
    background: 'var(--surface)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
    padding, cursor: onClick ? 'pointer' : 'default', ...style,
  }}>{children}</div>
);

/* ── StatCard ────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, trend, iconColor }) => (
  <Card style={{ flex: 1, minWidth: 150 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11, background: 'var(--primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor || 'var(--primary)',
      }}><Icon name={icon} size={19} /></div>
      {trend != null && <span style={{ fontSize: 12, fontWeight: 600, color: trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {trend >= 0 ? '+' : ''}{trend}%
      </span>}
    </div>
    <div style={{ marginTop: 14, fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>{sub}</div>}
  </Card>
);

/* ── Divider ─────────────────────────────────────────────── */
const Divider = ({ style = {} }) => <div style={{ height: 1, background: 'var(--border)', ...style }} />;

/* ── Btn ─────────────────────────────────────────────────── */
const Btn = ({ children, variant = 'primary', size = 'md', icon, onClick, disabled, style = {}, type = 'button' }) => {
  const sz = { sm: { p: '7px 14px', fs: 12 }, md: { p: '10px 20px', fs: 14 }, lg: { p: '13px 28px', fs: 15 } }[size] || {};
  const vr = {
    primary:   { bg: 'var(--primary)',     color: '#fff',                border: 'transparent' },
    secondary: { bg: 'var(--surface)',     color: 'var(--text)',         border: 'var(--border)' },
    ghost:     { bg: 'transparent',        color: 'var(--text-muted)',   border: 'transparent' },
    danger:    { bg: 'var(--danger-bg)',   color: 'var(--danger)',       border: 'transparent' },
    success:   { bg: 'var(--success-bg)',  color: 'var(--success)',      border: 'transparent' },
  }[variant] || {};
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: sz.p, fontSize: sz.fs, fontWeight: 600, borderRadius: 9, fontFamily: 'inherit',
      border: `1px solid ${vr.border}`, background: vr.bg, color: vr.color,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <Icon name={icon} size={sz.fs - 1} />}
      {children}
    </button>
  );
};

/* ── SearchBar ───────────────────────────────────────────── */
const SearchBar = ({ value, onChange, placeholder = 'Search…', style = {} }) => (
  <div style={{ position: 'relative', ...style }}>
    <Icon name="search" size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 9,
      border: '1px solid var(--border)', background: 'var(--surface)',
      fontSize: 14, color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
    }} />
  </div>
);

/* ── PageContent ─────────────────────────────────────────── */
const PageContent = ({ children, style = {} }) => (
  <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', ...style }}>{children}</div>
);

/* ── SectionHeader ───────────────────────────────────────── */
const SectionHeader = ({ title, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
    {action}
  </div>
);

/* ── EmptyState ──────────────────────────────────────────── */
const EmptyState = ({ icon, message }) => (
  <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
    <Icon name={icon} size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
    <div style={{ fontSize: 14 }}>{message}</div>
  </div>
);

/* ── TopBar ──────────────────────────────────────────────── */
const TopBar = ({ title, subtitle, actions }) => (
  <div style={{
    height: 'var(--topbar-height)', background: 'var(--surface)',
    borderBottom: '1px solid var(--border)', display: 'flex',
    alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0,
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
    </div>
    {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{actions}</div>}
  </div>
);

/* ── Sidebar ─────────────────────────────────────────────── */
const Sidebar = ({ role, page, setPage, user, onLogout }) => {
  const doctorNav = [
    { id:'dashboard',     label:'Dashboard',          icon:'home'      },
    { id:'patients',      label:'Patients',           icon:'users'     },
    { id:'detection',     label:'Detection Analysis', icon:'scan'      },
    { id:'appointments',  label:'Appointments',       icon:'calendar'  },
    { id:'messages',      label:'Messages',           icon:'message'   },
    { id:'analytics',     label:'Analytics',          icon:'barChart'  },
    { id:'models',        label:'Model Performance',  icon:'layers'    },
    { id:'notifications', label:'Notifications',      icon:'bell'      },
  ];
  const patientNav = [
    { id:'dashboard',     label:'Home',               icon:'home'      },
    { id:'profile',       label:'My Profile',         icon:'user'      },
    { id:'detection',     label:'Scan Analysis',      icon:'scan'      },
    { id:'appointments',  label:'My Appointments',    icon:'calendar'  },
    { id:'results',       label:'My Results',         icon:'fileText'  },
    { id:'messages',      label:'Messages',           icon:'message'   },
    { id:'notifications', label:'Notifications',      icon:'bell'      },
  ];
  const nav = role === 'doctor' ? doctorNav : patientNav;
  const unread = (typeof useUnread === 'function') ? useUnread(role) : 0;

  return (
    <div style={{
      width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
      height: '100vh', background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="shield" size={19} style={{ color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: -0.3 }}>MelanoScan</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>HMS</div>
        </div>
      </div>

      <Divider />

      {/* Role pill */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{
          background: role === 'doctor' ? 'var(--primary-light)' : 'var(--info-bg)',
          color: role === 'doctor' ? 'var(--primary-dark)' : 'var(--info)',
          borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name={role === 'doctor' ? 'microscope' : 'heart'} size={13} />
          {role === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
        {nav.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 9, border: 'none',
              background: active ? 'var(--primary-light)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: active ? 700 : 500, fontSize: 14, cursor: 'pointer',
              textAlign: 'left', marginBottom: 2, fontFamily: 'inherit',
            }}>
              <Icon name={item.icon} size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === 'messages' && unread > 0 && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{unread}</span>
              )}
            </button>
          );
        })}
      </nav>

      <Divider />

      {/* User info */}
      <div style={{ padding: '12px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={user?.name || '?'} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{role === 'doctor' ? (user?.specialty || 'Dermatologist') : 'Patient'}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-muted)', fontSize: 13,
          cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
        }}>
          <Icon name="logOut" size={14} /> Sign out
        </button>
      </div>
    </div>
  );
};

/* ── BarChart (simple div-based) ─────────────────────────── */
const BarChart = ({ data, height = 180, colorFn }) => {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, padding: '0 4px' }}>
      {data.map((d, i) => {
        const barH = max > 0 ? ((d.value / max) * (height - 44)) : 0;
        const color = colorFn ? colorFn(d, i) : 'var(--primary)';
        return (
          <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {typeof d.value === 'number' && d.value <= 1 ? `${(d.value * 100).toFixed(0)}%` : d.value.toLocaleString()}
            </div>
            <div style={{ width: '100%', height: barH, background: color, borderRadius: '5px 5px 0 0', minHeight: 4 }} />
            <div style={{ width: '100%', height: 1, background: 'var(--border)' }} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, textAlign: 'center', lineHeight: 1.3 }}>{d.label}</div>
            {d.count != null && <div style={{ fontSize: 9, color: 'var(--text-light)', textAlign: 'center' }}>n={d.count}</div>}
          </div>
        );
      })}
    </div>
  );
};

/* ── GroupedBarChart — two series per label (e.g. baseline vs deployed) ── */
const GroupedBarChart = ({ data, height = 200, max, seriesA = { key: 'baseline', label: 'Baseline (Model A)', color: 'var(--danger)' }, seriesB = { key: 'enhanced', label: 'Deployed (Model E)', color: 'var(--success)' }, asPercent = false, decimals = 3 }) => {
  const hi = max != null ? max : Math.max(...data.flatMap(d => [d[seriesA.key], d[seriesB.key]]));
  const fmt = v => asPercent ? `${(v * 100).toFixed(0)}%` : v.toFixed(decimals);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height, padding: '0 4px' }}>
        {data.map(d => (
          <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 5, width: '100%', height: height - 34 }}>
              {[seriesA, seriesB].map(s => (
                <div key={s.key} style={{ flex: 1, maxWidth: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: s.color, marginBottom: 3 }}>{fmt(d[s.key])}</div>
                  <div style={{ width: '100%', height: hi > 0 ? `${(d[s.key] / hi) * 100}%` : '0%', background: s.color, borderRadius: '4px 4px 0 0', minHeight: 3, transition: 'height 0.9s ease' }} />
                </div>
              ))}
            </div>
            <div style={{ width: '100%', height: 1, background: 'var(--border)' }} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, textAlign: 'center', lineHeight: 1.3 }}>{d.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11 }}>
        {[seriesA, seriesB].map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── ConfidenceBar ───────────────────────────────────────── */
const ConfidenceBar = ({ label, value, isMain }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
      <span style={{ fontWeight: isMain ? 700 : 400, color: isMain ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: isMain ? 'var(--primary)' : 'var(--text-muted)' }}>{(value * 100).toFixed(1)}%</span>
    </div>
    <div style={{ height: 9, background: 'var(--surface-2)', borderRadius: 5, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${value * 100}%`,
        background: isMain ? 'var(--primary)' : 'var(--border)',
        borderRadius: 5, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  </div>
);

/* ── NotificationIcon ────────────────────────────────────── */
const NotifIcon = ({ type }) => {
  const map = {
    alert:       { icon: 'alertTriangle', color: 'var(--danger)',  bg: 'var(--danger-bg)'  },
    appointment: { icon: 'calendar',      color: 'var(--info)',    bg: 'var(--info-bg)'    },
    info:        { icon: 'info',          color: 'var(--warning)', bg: 'var(--warning-bg)' },
  };
  const { icon, color, bg } = map[type] || map.info;
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={16} />
    </div>
  );
};

Object.assign(window, {
  Avatar, Badge, RiskBadge, StatusBadge, Card, StatCard, Divider,
  Btn, SearchBar, PageContent, SectionHeader, EmptyState,
  TopBar, Sidebar, BarChart, GroupedBarChart, ConfidenceBar, NotifIcon,
});
