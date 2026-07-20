import React, { useEffect, useState, useRef } from 'react';
import { examAPI, MockExamItem, MockExamResultItem, dashboardAPI } from '../services/api';

const FONT = "'Plus Jakarta Sans', sans-serif";

const C = {
  card: '#FFFFFF',
  cardAlt: '#F5F3FF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  purple: '#7C3AED',
  purpleSoft: 'rgba(124,58,237,0.10)',
  green: '#10B981',
  greenSoft: 'rgba(16,185,129,0.09)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.09)',
  red: '#F43F5E',
  redSoft: 'rgba(244,63,94,0.09)',
  orange: '#F97316',
  orangeSoft: 'rgba(249,115,22,0.09)',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
  shadowLg: '0 8px 32px rgba(0,0,0,0.14)',
};

type QuadrantKey = 'app-drove' | 'review-content' | 'external-study' | 'needs-attention';

const QUADRANT_CFG: Record<QuadrantKey, { label: string; color: string; bg: string; desc: string }> = {
  'app-drove':       { label: 'App Drove This',     color: C.green,  bg: C.greenSoft,  desc: 'Using app · Improving' },
  'review-content':  { label: 'Review Content',     color: C.orange, bg: C.orangeSoft, desc: 'Using app · Decreasing' },
  'external-study':  { label: 'External Study',     color: C.amber,  bg: C.amberSoft,  desc: 'Not using app · Improving' },
  'needs-attention': { label: 'Needs Intervention', color: C.red,    bg: C.redSoft,    desc: 'Not using app · Decreasing' },
};

function getQuadrant(delta: number, sessions: number, threshold: number): QuadrantKey {
  const improved = delta >= 0;
  const usingApp = sessions >= threshold;
  if (improved && usingApp)   return 'app-drove';
  if (!improved && usingApp)  return 'review-content';
  if (improved && !usingApp)  return 'external-study';
  return 'needs-attention';
}

interface ScatterPoint {
  student_id: number;
  username: string | null;
  name: string;
  cls: string | null;
  sec: string | null;
  s1: number;
  s2: number;
  delta: number;
  sessions: number;
  timeSec: number;
}

const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const fmtTime = (sec: number) => {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface ScatterPlotProps {
  schoolCode: string;
  classCode?: string;
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ schoolCode, classCode = '10' }) => {
  const [exams, setExams]         = useState<MockExamItem[]>([]);
  const [examsLoading, setExamsL] = useState(true);
  const [exam1, setExam1]         = useState<MockExamItem | null>(null);
  const [exam2, setExam2]         = useState<MockExamItem | null>(null);
  const [points, setPoints]       = useState<ScatterPoint[]>([]);
  const [pointsLoading, setPtsL]  = useState(false);
  const [threshold, setThresh]    = useState(3);
  const [hovered, setHovered]     = useState<{ point: ScatterPoint; x: number; y: number } | null>(null);
  const [sortCol, setSortCol]     = useState<'delta' | 'sessions' | 'name'>('delta');
  const svgRef = useRef<SVGSVGElement>(null);

  // Load class exams on mount
  useEffect(() => {
    const load = async () => {
      setExamsL(true);
      try {
        const data = await examAPI.getMockExamsByClassSection({ school_code: schoolCode, class_code: classCode, limit: 50 });
        const sorted = (data.items ?? []).sort((a, b) =>
          (b.date_assigned ?? '').localeCompare(a.date_assigned ?? '')
        );
        setExams(sorted);
        if (sorted.length >= 2) { setExam1(sorted[1]); setExam2(sorted[0]); }
        else if (sorted.length === 1) setExam2(sorted[0]);
      } catch { setExams([]); }
      finally { setExamsL(false); }
    };
    load();
  }, [schoolCode, classCode]);

  // Load results + login logs when exam pair changes
  useEffect(() => {
    if (!exam1 || !exam2) { setPoints([]); return; }
    const load = async () => {
      setPtsL(true);
      try {
        const [r1data, r2data] = await Promise.all([
          examAPI.getMockExamResults(exam1.homework_id, 500),
          examAPI.getMockExamResults(exam2.homework_id, 500),
        ]);
        const map1 = new Map<number, MockExamResultItem>(r1data.items.map(r => [r.student_id, r]));
        const intersection = r2data.items.filter(r => map1.has(r.student_id));

        const d1 = exam1.date_assigned ? new Date(exam1.date_assigned) : null;
        const d2 = exam2.date_assigned ? new Date(exam2.date_assigned) : null;

        // Parallel-fetch login logs for all students in the intersection
        const logsArr = await Promise.all(
          intersection.map(r =>
            r.username
              ? dashboardAPI.getUserLoginLogs(r.username, 200).catch(() => null)
              : Promise.resolve(null)
          )
        );

        const pts: ScatterPoint[] = intersection.map((r2item, i) => {
          const r1item = map1.get(r2item.student_id)!;
          const logs = logsArr[i];

          const windowDays: any[] = (logs?.items ?? []).filter((d: any) => {
            const date = new Date(d.date);
            if (d1 && date < d1) return false;
            if (d2 && date > d2) return false;
            return true;
          });

          return {
            student_id: r2item.student_id,
            username: r2item.username ?? null,
            name: r2item.student_name || r2item.username || `#${r2item.student_id}`,
            cls: r2item.class_name,
            sec: r2item.section_name,
            s1: Number(r1item.score),
            s2: Number(r2item.score),
            delta: Number(r2item.score) - Number(r1item.score),
            sessions: windowDays.reduce((s, d) => s + Number(d.total_sessions ?? 0), 0),
            timeSec:  windowDays.reduce((s, d) => s + Number(d.total_time_seconds ?? 0), 0),
          };
        });

        setPoints(pts);
      } catch { setPoints([]); }
      finally { setPtsL(false); }
    };
    load();
  }, [exam1?.homework_id, exam2?.homework_id]);

  // ── Chart dimensions ────────────────────────────────────────────────────────
  const W = 540, H = 400;
  const ML = 62, MR = 28, MT = 32, MB = 58;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  const maxSessions = Math.max(...points.map(p => p.sessions), threshold * 2 + 2, 12);
  const maxDelta    = Math.max(...points.map(p => Math.abs(p.delta)), 15);
  const yRange      = maxDelta + 5;

  const xS = (s: number) => ML + (s / maxSessions) * PW;
  const yS = (d: number) => MT + PH / 2 - (d / yRange) * (PH / 2);
  const xTh = xS(threshold);
  const yMid = MT + PH / 2;

  const qCounts = { 'app-drove': 0, 'review-content': 0, 'external-study': 0, 'needs-attention': 0 } as Record<QuadrantKey, number>;
  points.forEach(p => qCounts[getQuadrant(p.delta, p.sessions, threshold)]++);

  const yTicks = [-20, -10, 0, 10, 20].filter(d => Math.abs(d) <= yRange + 3);
  const xTicks = [0, 5, 10, 15, 20].filter(s => s <= maxSessions + 2);

  const sortedPoints = [...points].sort((a, b) =>
    sortCol === 'delta'    ? b.delta - a.delta :
    sortCol === 'sessions' ? b.sessions - a.sessions :
    a.name.localeCompare(b.name)
  );

  return (
    <div style={{ fontFamily: FONT }}>
      <style>{`@keyframes dot-pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { label: 'Previous Exam (Before)', val: exam1, set: setExam1 },
          { label: 'New Exam (After)',        val: exam2, set: setExam2 },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
            <select
              value={val?.homework_id ?? ''}
              onChange={e => set(exams.find(ex => ex.homework_id === Number(e.target.value)) ?? null)}
              disabled={examsLoading}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${val ? C.purple : C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, cursor: 'pointer', minWidth: 220 }}
            >
              <option value="">Select exam…</option>
              {exams.map(ex => (
                <option key={ex.homework_id} value={ex.homework_id}>
                  {ex.title ?? ex.homework_code ?? `#${ex.homework_id}`} · {fmtDate(ex.date_assigned)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            "Using App" threshold: <span style={{ color: C.purple }}>{threshold} sessions</span>
          </div>
          <input
            type="range" min={1} max={10} value={threshold}
            onChange={e => setThresh(Number(e.target.value))}
            style={{ width: 160, accentColor: C.purple, display: 'block', marginTop: 4 }}
          />
        </div>
      </div>

      {examsLoading ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i*0.16}s infinite` }} />)}
        </div>
      ) : exams.length < 2 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMuted, fontSize: 14 }}>
          Need at least 2 Class {classCode} mock exams to plot.
        </div>
      ) : !exam1 || !exam2 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMuted, fontSize: 14 }}>
          Select both a Previous and a New exam above.
        </div>
      ) : (
        <>
          {/* ── Chart + quadrant legend ─────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>

            {/* Chart card */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow, position: 'relative', flex: 1, minWidth: 0 }}>
              {pointsLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.88)', borderRadius: 16, zIndex: 10, flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i*0.16}s infinite` }} />)}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Fetching app activity for {exam2.total_submissions} students…</div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Class {classCode} · App Usage vs Score Change</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                  {exam1.title ?? `Exam #${exam1.homework_id}`} → {exam2.title ?? `Exam #${exam2.homework_id}`}
                  {!pointsLoading && ` · ${points.length} students`}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', fontFamily: FONT, maxWidth: '100%' }}>
                  <defs><clipPath id="sc-clip"><rect x={ML} y={MT} width={PW} height={PH} /></clipPath></defs>

                  {/* Quadrant backgrounds */}
                  <rect x={ML}   y={MT}   width={xTh - ML}         height={PH / 2} fill="rgba(245,158,11,0.08)" />
                  <rect x={xTh}  y={MT}   width={ML + PW - xTh}    height={PH / 2} fill="rgba(16,185,129,0.08)" />
                  <rect x={ML}   y={yMid} width={xTh - ML}         height={PH / 2} fill="rgba(244,63,94,0.08)" />
                  <rect x={xTh}  y={yMid} width={ML + PW - xTh}    height={PH / 2} fill="rgba(249,115,22,0.08)" />

                  {/* Y grid + labels */}
                  {yTicks.map(d => {
                    const y = yS(d);
                    return (
                      <g key={d}>
                        <line x1={ML} x2={ML + PW} y1={y} y2={y} stroke={d === 0 ? C.textSecondary : C.border} strokeWidth={d === 0 ? 1.5 : 1} strokeDasharray={d === 0 ? '' : '4 3'} />
                        <text x={ML - 8} y={y + 4} textAnchor="end" fontSize={10} fill={C.textMuted}>{d > 0 ? `+${d}` : d}%</text>
                      </g>
                    );
                  })}

                  {/* X grid + labels */}
                  {xTicks.map(s => {
                    const x = xS(s);
                    return (
                      <g key={s}>
                        <line x1={x} x2={x} y1={MT} y2={MT + PH} stroke={C.border} strokeWidth={1} strokeDasharray="4 3" />
                        <text x={x} y={MT + PH + 18} textAnchor="middle" fontSize={10} fill={C.textMuted}>{s}</text>
                      </g>
                    );
                  })}

                  {/* Threshold line */}
                  <line x1={xTh} x2={xTh} y1={MT} y2={MT + PH} stroke={C.purple} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.75} />
                  <text x={xTh + 5} y={MT + 13} fontSize={9} fill={C.purple} fontWeight="700">{threshold} sessions →</text>

                  {/* Quadrant corner labels */}
                  <text x={ML + 7}  y={MT + 18}      fontSize={9} fill={C.amber}  fontWeight="700" opacity={0.9}>External Study</text>
                  <text x={xTh + 7} y={MT + 18}      fontSize={9} fill={C.green}  fontWeight="700" opacity={0.9}>App Drove This</text>
                  <text x={ML + 7}  y={MT + PH - 7}  fontSize={9} fill={C.red}    fontWeight="700" opacity={0.9}>Needs Intervention</text>
                  <text x={xTh + 7} y={MT + PH - 7}  fontSize={9} fill={C.orange} fontWeight="700" opacity={0.9}>Review Content</text>

                  {/* Axis labels */}
                  <text x={ML + PW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={C.textSecondary} fontWeight="600">Sessions in App (between exams)</text>
                  <text transform={`translate(13,${MT + PH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={C.textSecondary} fontWeight="600">Score Change (%)</text>

                  {/* Data points */}
                  <g clipPath="url(#sc-clip)">
                    {points.map(p => {
                      const q    = getQuadrant(p.delta, p.sessions, threshold);
                      const col  = QUADRANT_CFG[q].color;
                      const cx   = xS(p.sessions);
                      const cy   = yS(p.delta);
                      const isHovered = hovered?.point.student_id === p.student_id;
                      return (
                        <g key={p.student_id}>
                          {isHovered && <circle cx={cx} cy={cy} r={14} fill={col} fillOpacity={0.15} />}
                          <circle
                            cx={cx} cy={cy} r={isHovered ? 9 : 7}
                            fill={col} fillOpacity={0.88}
                            stroke="#fff" strokeWidth={isHovered ? 2 : 1.5}
                            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                            onMouseEnter={() => setHovered({ point: p, x: cx, y: cy })}
                            onMouseLeave={() => setHovered(null)}
                          />
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Tooltip */}
                {hovered && (() => {
                  const { point: p, x, y } = hovered;
                  const q    = getQuadrant(p.delta, p.sessions, threshold);
                  const qcfg = QUADRANT_CFG[q];
                  const tipLeft = x < W / 2 ? x + 18 : x - 200;
                  const tipTop  = y < H / 2 ? y + 18 : y - 130;
                  return (
                    <div style={{ position: 'absolute', left: tipLeft, top: tipTop, background: C.card, border: `1.5px solid ${qcfg.color}`, borderRadius: 10, padding: '10px 14px', boxShadow: C.shadowLg, minWidth: 186, pointerEvents: 'none', zIndex: 100 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{[p.cls, p.sec].filter(Boolean).join(' / ') || '—'}</div>
                      {[
                        ['Score change',  `${p.delta > 0 ? '+' : ''}${p.delta}%`, p.delta > 0 ? C.green : p.delta < 0 ? C.red : C.textMuted],
                        ['Sessions',      String(p.sessions), C.text],
                        p.timeSec > 0 ? ['Time on app', fmtTime(p.timeSec), C.text] : null,
                        ['Scores',        `${p.s1}% → ${p.s2}%`, C.textSecondary],
                      ].filter(Boolean).map(([label, val, color]: any) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: C.textSecondary }}>{label}</span>
                          <span style={{ fontWeight: 700, color }}>{val}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: qcfg.color, background: qcfg.bg, borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>
                        {qcfg.label}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Quadrant summary cards */}
            <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(Object.entries(QUADRANT_CFG) as [QuadrantKey, typeof QUADRANT_CFG[QuadrantKey]][]).map(([key, cfg]) => (
                <div key={key} style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{qCounts[key]}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, marginTop: 4 }}>{cfg.label}</div>
                  <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{cfg.desc}</div>
                </div>
              ))}
              {/* Legend: dots */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginTop: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Legend</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(Object.values(QUADRANT_CFG)).map(cfg => (
                    <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.textSecondary }}>{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Student table ───────────────────────────────────────────────── */}
          {points.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: C.shadow }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Student Breakdown</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>· {points.length} students in both exams</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {([['delta', 'Score change'], ['sessions', 'Sessions'], ['name', 'Name']] as const).map(([col, lbl]) => (
                    <button key={col} onClick={() => setSortCol(col)} style={{ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${sortCol === col ? C.purple : C.border}`, background: sortCol === col ? C.purpleSoft : 'transparent', color: sortCol === col ? C.purple : C.textSecondary, fontSize: 11, fontWeight: sortCol === col ? 700 : 500, cursor: 'pointer', fontFamily: FONT }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                      {['Student', 'Class/Sec', 'Before', 'After', 'Change', 'Sessions', 'Time on App', 'Verdict'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPoints.map((p, i) => {
                      const q    = getQuadrant(p.delta, p.sessions, threshold);
                      const qcfg = QUADRANT_CFG[q];
                      const sc   = (s: number) => s >= 70 ? C.green : s >= 50 ? C.amber : C.red;
                      return (
                        <tr
                          key={p.student_id}
                          style={{ borderBottom: i < sortedPoints.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.cardAlt)}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>{p.name}</td>
                          <td style={{ padding: '10px 14px', color: C.textSecondary }}>{[p.cls, p.sec].filter(Boolean).join(' / ') || '—'}</td>
                          <td style={{ padding: '10px 14px', color: C.textMuted, fontWeight: 500 }}>{p.s1}%</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: sc(p.s2) }}>{p.s2}%</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontWeight: 800, color: p.delta > 0 ? C.green : p.delta < 0 ? C.red : C.textMuted, background: p.delta > 0 ? 'rgba(16,185,129,0.1)' : p.delta < 0 ? 'rgba(244,63,94,0.1)' : 'transparent', borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>
                              {p.delta > 0 ? '+' : ''}{p.delta}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: C.text, fontWeight: 600 }}>{p.sessions}</td>
                          <td style={{ padding: '10px 14px', color: C.textSecondary }}>{fmtTime(p.timeSec)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: qcfg.color, background: qcfg.bg, borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                              {qcfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!pointsLoading && points.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: 14 }}>
              No students found who submitted both exams.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScatterPlot;
