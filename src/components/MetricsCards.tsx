import React, { useEffect, useMemo } from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

interface MetricsCardsProps {
  totalStudents: number;
  activeStudents: number;
  activeSessions?: number;
  atRiskStudents: number;
  inactiveStudents: number;
  totalSessions?: number;
  trend?: 'up' | 'down' | 'stable';
  students?: { last_login?: string; is_currently_active: boolean }[];
}

const MiniGauge: React.FC<{ percentage: number; color: string; value: number }> = ({
  percentage, color, value,
}) => {
  const size = 72;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, percentage));
  const arc = pct > 0 ? Math.max(pct, 5) : 0;
  const offset = circ - (arc / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2D3748" strokeWidth={sw} opacity={0.6} />
        {pct > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', lineHeight: 1, fontFamily: FONT_SERIF }}>{value}</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color, marginTop: '2px' }}>{percentage}%</span>
      </div>
    </div>
  );
};

const MetricsCards: React.FC<MetricsCardsProps> = ({
  totalStudents, activeStudents, activeSessions, atRiskStudents, inactiveStudents, totalSessions, students,
}) => {
  useEffect(() => {
    const id = 'metrics-cards-animations';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes entrance-stagger { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      @keyframes dot-pulse { 0%,80%,100% { opacity:.3; transform:scale(.8) } 40% { opacity:1; transform:scale(1) } }
    `;
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const engRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
  const atRiskPct = totalStudents > 0 ? Math.round((atRiskStudents / totalStudents) * 100) : 0;
  const inactivePct = totalStudents > 0 ? Math.round((inactiveStudents / totalStudents) * 100) : 0;
  const sessVal = totalSessions ?? activeSessions ?? 0;
  const sessPct = totalStudents > 0 ? Math.min(100, Math.round((sessVal / totalStudents) * 100)) : 0;

  // DAU/WAU/MAU
  const now = Date.now();
  const { dau, wau, mau } = useMemo(() => {
    if (!students) return { dau: 0, wau: 0, mau: 0 };
    let d = 0, w = 0, m = 0;
    const H24 = 864e5, D7 = 7 * H24, D30 = 30 * H24;
    students.forEach(s => {
      if (!s.last_login) return;
      const diff = now - new Date(s.last_login).getTime();
      if (diff <= H24) d++;
      if (diff <= D7) w++;
      if (diff <= D30) m++;
    });
    return { dau: d, wau: w, mau: m };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const gaugeCards = [
    { label: 'Active', value: activeStudents, pct: engRate, color: '#10B981', sub: `${engRate}% engaged`, delay: 0 },
    { label: 'At-Risk', value: atRiskStudents, pct: atRiskPct, color: '#F59E0B', sub: atRiskStudents > 0 ? 'Need intervention' : 'All clear', delay: 0.05 },
    { label: 'Inactive', value: inactiveStudents, pct: inactivePct, color: '#F43F5E', sub: inactiveStudents > 0 ? 'Action needed' : 'None', delay: 0.1 },
  ];

  const total = Math.max(totalStudents, 1);
  const dauPct = Math.round((dau / total) * 100);
  const wauPct = Math.round((wau / total) * 100);
  const mauPct = Math.round((mau / total) * 100);

  const extraGauges = students ? [
    // { label: 'DAU', value: dau, pct: dauPct, color: '#14B8A6', sub: 'Daily Active Users', delay: 0.15 },
    // { label: 'WAU', value: wau, pct: wauPct, color: '#6366F1', sub: 'Weekly Active Users', delay: 0.2 },
    // { label: 'MAU', value: mau, pct: mauPct, color: '#EC4899', sub: 'Monthly Active Users', delay: 0.25 },
  ] : [];

  const cardStyle = (color: string, delay: number): React.CSSProperties => ({
    background: '#111827', borderRadius: '12px',
    border: `1px solid ${color}33`, borderTop: `3px solid ${color}`,
    padding: '14px 12px', textAlign: 'center', cursor: 'default', fontFamily: FONT,
    transition: 'all 0.25s ease', animation: `entrance-stagger 0.4s ease ${delay}s both`,
  });

  return (
    <>
      <style>{`
        .metrics-row-dark {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }
      `}</style>
      <div className="metrics-row-dark">
        {[...gaugeCards, ...extraGauges].map(c => (
          <div key={c.label} style={cardStyle(c.color, c.delay)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.color + '66'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E293B'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <MiniGauge percentage={c.pct} color={c.color} value={c.value} />
            <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>{c.label}</div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
};

export default MetricsCards;
