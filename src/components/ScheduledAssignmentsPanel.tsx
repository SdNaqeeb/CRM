import React, { useMemo, useState } from 'react';
import { ScheduledAssignmentItem } from '../services/api';
import DashboardIcon from './DashboardIcon';

const SERIF = '"Source Serif 4", Georgia, serif';
const SANS  = '"Plus Jakarta Sans", system-ui, sans-serif';

const C = {
  border: '#E2E8F0',
  text: '#0F172A', textSecondary: '#475569', textMuted: '#64748B',
  teal: '#7C3AED', tealSoft: 'rgba(124,58,237,0.10)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B', amberSoft: 'rgba(245,158,11,0.12)',
  red: '#F43F5E', redSoft: 'rgba(244,63,94,0.12)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.10)',
  slate: '#94A3B8', slateSoft: 'rgba(148,163,184,0.12)',
  card: '#FFFFFF', cardAlt: '#F5F3FF', pageBg: '#F8FAFC',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
  shadowMd: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
};

type AssignStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Overdue';

const STATUS_META: Record<AssignStatus, { dot: string; soft: string; fg: string }> = {
  'Upcoming':    { dot: C.slate,  soft: C.slateSoft, fg: C.textSecondary },
  'In Progress': { dot: C.amber,  soft: C.amberSoft,  fg: '#B45309' },
  'Completed':   { dot: C.green,  soft: C.greenSoft,  fg: '#047857' },
  'Overdue':     { dot: C.red,    soft: C.redSoft,    fg: '#BE123C' },
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getStatus(item: ScheduledAssignmentItem): AssignStatus {
  const today = new Date().toISOString().split('T')[0];
  const due = item.due_date ? item.due_date.split('T')[0] : null;
  if (item.assigned_count > 0 && item.submitted_count >= item.assigned_count) return 'Completed';
  if (due && due < today) return 'Overdue';
  if (item.scheduled_date && item.scheduled_date.split('T')[0] <= today) return 'In Progress';
  return 'Upcoming';
}

function toDateKey(d: string | null): string | null {
  if (!d) return null;
  return d.split('T')[0];
}

function fmtDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface Props {
  assignments: ScheduledAssignmentItem[];
  loading: boolean;
  activeTopic: string;
  onTopicClick: (topic: string) => void;
}

const ScheduledAssignmentsPanel: React.FC<Props> = ({ assignments, loading, activeTopic, onTopicClick }) => {
  const todayDate = new Date();
  const todayKey  = todayDate.toISOString().split('T')[0];

  const [subjectFilter, setSubjectFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [viewYear,  setViewYear]  = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const s = new Set(assignments.map(a => a.subject_name).filter(Boolean) as string[]);
    return ['All', ...Array.from(s).sort()];
  }, [assignments]);

  const sections = useMemo(() => {
    const s = new Set(assignments.map(a => a.section_name).filter(Boolean) as string[]);
    return ['All', ...Array.from(s).sort()];
  }, [assignments]);

  const filtered = useMemo(() => assignments.filter(a => {
    if (subjectFilter !== 'All' && a.subject_name !== subjectFilter) return false;
    if (sectionFilter !== 'All' && a.section_name !== sectionFilter) return false;
    return true;
  }), [assignments, subjectFilter, sectionFilter]);

  // Build date → assignments map keyed by scheduled_date
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduledAssignmentItem[]>();
    filtered.forEach(a => {
      const key = toDateKey(a.scheduled_date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [filtered]);

  // Build 42-cell calendar grid for the viewed month
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { dateKey: string; dayNum: number; inMonth: boolean }[] = [];

    // Previous month fill
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i);
      cells.push({ dateKey: d.toISOString().split('T')[0], dayNum: d.getDate(), inMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      cells.push({ dateKey: dt.toISOString().split('T')[0], dayNum: d, inMonth: true });
    }
    // Next month fill
    let next = 1;
    while (cells.length < 42) {
      const d = new Date(viewYear, viewMonth + 1, next++);
      cells.push({ dateKey: d.toISOString().split('T')[0], dayNum: d.getDate(), inMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const totals = useMemo(() => ({
    assigned:  filtered.reduce((s, a) => s + a.assigned_count, 0),
    viewed:    filtered.reduce((s, a) => s + a.viewed_count, 0),
    submitted: filtered.reduce((s, a) => s + a.submitted_count, 0),
  }), [filtered]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }

  const selectedAssignments = selectedDay ? (byDate.get(selectedDay) ?? []) : filtered;
  const isViewAll = selectedDay === null;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 16, overflow: 'hidden' }}>

      {/* ── Panel header ────────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: C.tealSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <DashboardIcon name="calendar" size={16} color={C.teal} />
          </span>
          <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.text }}>
            Scheduled Assignments
          </h3>
          {!loading && (
            <span style={{ background: C.cardAlt, color: C.textSecondary, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999 }}>
              {filtered.length} assignments
            </span>
          )}
          {activeTopic && activeTopic !== 'All' && (
            <span style={{ background: C.tealSoft, color: C.teal, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5 }}>
              <DashboardIcon name="activity" size={10} color={C.teal} />
              Tracking: {activeTopic}
            </span>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Assigned',  v: totals.assigned,  color: C.teal,  bg: C.tealSoft },
              { label: 'Viewed',    v: totals.viewed,    color: C.blue,  bg: C.blueSoft },
              { label: 'Submitted', v: totals.submitted, color: C.green, bg: C.greenSoft },
            ].map(({ label, v, color, bg }) => (
              <div key={label} style={{ padding: '4px 12px', borderRadius: 999, background: bg, display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: SERIF }}>{v}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: C.cardAlt }}>
        {([
          { label: 'Subject', value: subjectFilter, opts: subjects, set: setSubjectFilter },
          { label: 'Section', value: sectionFilter, opts: sections, set: setSectionFilter },
        ] as const).map(({ label, value, opts, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <select
              value={value}
              onChange={e => (set as any)(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 12, fontFamily: SANS, cursor: 'pointer' }}
            >
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        {(subjectFilter !== 'All' || sectionFilter !== 'All') && (
          <button
            onClick={() => { setSubjectFilter('All'); setSectionFilter('All'); }}
            style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '56px 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: C.teal, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontFamily: SANS }}>Loading assignments...</p>
        </div>
      ) : (
        <div style={{ padding: '20px 22px 22px' }}>

          {/* ── Calendar card ─────────────────────────────────────────────── */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: C.pageBg }}>

            {/* Month navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
              <button onClick={prevMonth} style={navBtn}>
                <DashboardIcon name="chevL" size={15} color={C.textSecondary} />
              </button>
              <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: C.text, minWidth: 120, textAlign: 'center' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} style={navBtn}>
                <DashboardIcon name="chevR" size={15} color={C.textSecondary} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: C.card, borderBottom: `1px solid ${C.border}` }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: C.textMuted, fontFamily: SANS }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calendarCells.map(cell => {
                const cellItems = byDate.get(cell.dateKey) ?? [];
                const isToday   = cell.dateKey === todayKey;
                const isSelected = cell.dateKey === selectedDay;
                const dotItems  = cellItems.slice(0, 3);
                const overflow  = cellItems.length - 3;

                return (
                  <div
                    key={cell.dateKey}
                    onClick={() => {
                      if (!cell.inMonth) return;
                      setSelectedDay(prev => prev === cell.dateKey ? null : cell.dateKey);
                    }}
                    style={{
                      minHeight: 64,
                      padding: '8px 6px 6px',
                      borderRight: `1px solid ${C.border}`,
                      borderBottom: `1px solid ${C.border}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      background: isSelected ? C.tealSoft : 'transparent',
                      cursor: cell.inMonth && cellItems.length > 0 ? 'pointer' : cell.inMonth ? 'default' : 'default',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (cell.inMonth && cellItems.length > 0) (e.currentTarget as HTMLDivElement).style.background = isSelected ? C.tealSoft : 'rgba(124,58,237,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? C.tealSoft : 'transparent'; }}
                  >
                    {/* Date number */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: isToday ? 700 : 500,
                      fontFamily: SANS,
                      color: isToday ? C.teal : cell.inMonth ? C.text : C.slate,
                      border: isToday ? `2px solid ${C.teal}` : isSelected ? `2px solid ${C.teal}` : '2px solid transparent',
                      background: isToday && isSelected ? C.tealSoft : 'transparent',
                    }}>
                      {cell.dayNum}
                    </div>

                    {/* Dots */}
                    {dotItems.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {dotItems.map((a, i) => {
                          const s = getStatus(a);
                          return (
                            <div
                              key={i}
                              title={`${a.title ?? a.assignment_code} — ${s}`}
                              style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_META[s].dot, flexShrink: 0 }}
                            />
                          );
                        })}
                        {overflow > 0 && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: C.teal, fontFamily: SANS, lineHeight: 1 }}>
                            +{overflow}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Legend ────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {(Object.entries(STATUS_META) as [AssignStatus, typeof STATUS_META[AssignStatus]][]).map(([status, meta]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot }} />
                  <span style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS, fontWeight: 500 }}>{status}</span>
                </div>
              ))}
            </div>

            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                style={{ fontSize: 12, fontWeight: 600, color: C.teal, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View All Assignments ›
              </button>
            )}
          </div>

          {/* ── Selected-day / all assignments detail ─────────────────────── */}
          {filtered.length === 0 ? (
            <div style={{ marginTop: 20, padding: '32px 0', textAlign: 'center', color: C.textMuted, fontSize: 13, fontFamily: SANS }}>
              No assignments match the selected filters.
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: SANS }}>
                  {isViewAll
                    ? 'All Assignments'
                    : `${new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
                  }
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, background: C.cardAlt, padding: '2px 9px', borderRadius: 999 }}>
                  {selectedAssignments.length}
                </span>
              </div>

              {selectedAssignments.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: 13, fontFamily: SANS, border: `1.5px dashed ${C.border}`, borderRadius: 10 }}>
                  No assignments on this day.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {selectedAssignments.map(a => (
                    <AssignmentCard key={a.assignment_id} item={a} activeTopic={activeTopic} onTopicClick={onTopicClick} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Nav button style ─────────────────────────────────────────────────────── */
const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: `1px solid ${C.border}`, background: C.cardAlt,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

/* ── Assignment detail card ───────────────────────────────────────────────── */
interface CardProps {
  item: ScheduledAssignmentItem;
  activeTopic: string;
  onTopicClick: (t: string) => void;
}

const AssignmentCard: React.FC<CardProps> = ({ item: a, activeTopic, onTopicClick }) => {
  const [hovered, setHovered] = useState(false);
  const status    = getStatus(a);
  const meta      = STATUS_META[status];
  const isActive  = activeTopic === (a.topic_name ?? '');
  const submittedPct = a.assigned_count > 0 ? Math.round((a.submitted_count / a.assigned_count) * 100) : 0;
  const viewedPct    = a.assigned_count > 0 ? Math.round((a.viewed_count    / a.assigned_count) * 100) : 0;
  const barColor = submittedPct >= 70 ? C.green : submittedPct >= 40 ? C.amber : C.red;
  const title = a.title ? a.title.replace(/^[^-]+-\s*/, '') : a.assignment_code ?? '—';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.card,
        borderRadius: 12,
        border: isActive ? `1.5px solid ${C.teal}` : `1px solid ${C.border}`,
        borderLeft: `3px solid ${isActive ? C.teal : meta.dot}`,
        boxShadow: hovered ? C.shadowMd : C.shadow,
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all 0.15s ease',
        padding: '12px 13px 11px',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}
    >
      {/* Status + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ padding: '2px 8px', borderRadius: 999, background: meta.soft, color: meta.fg, fontSize: 10, fontWeight: 700, fontFamily: SANS }}>
          {status}
        </span>
        {a.subject_name && (
          <span style={{ padding: '2px 8px', borderRadius: 999, background: C.tealSoft, color: C.teal, fontSize: 10, fontWeight: 700 }}>
            {a.subject_name}
          </span>
        )}
        {a.section_name && (
          <span style={{ padding: '2px 8px', borderRadius: 999, background: C.blueSoft, color: C.blue, fontSize: 10, fontWeight: 700 }}>
            {a.section_name}
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{
        fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.35,
        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
      }} title={a.title ?? ''}>
        {title}
      </div>

      {/* Topic */}
      {a.topic_name && (
        <div style={{ fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.topic_name}>
          {a.topic_name}
        </div>
      )}

      {/* Dates */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSecondary }}>
        <DashboardIcon name="calendar" size={11} color={C.textMuted} />
        <span>{fmtDateShort(a.scheduled_date)}</span>
        {a.due_date && (
          <>
            <span style={{ color: C.border }}>→</span>
            <span>{fmtDateShort(a.due_date)}</span>
          </>
        )}
        {a.question_count > 0 && (
          <span style={{ marginLeft: 'auto', color: C.textMuted, fontWeight: 600 }}>{a.question_count}Q</span>
        )}
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          {[
            { label: 'Assigned',  v: a.assigned_count,  color: C.textSecondary },
            { label: 'Viewed',    v: a.viewed_count,    color: C.blue },
            { label: 'Submitted', v: a.submitted_count, color: barColor },
          ].map(({ label, v, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: SERIF }}>{v}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: 5, borderRadius: 999, background: C.cardAlt, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${viewedPct}%`, borderRadius: 999, background: C.blueSoft }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${submittedPct}%`, borderRadius: 999, background: barColor }} />
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3, textAlign: 'right' }}>{submittedPct}% submitted</div>
      </div>

      {/* Track button */}
      <button
        onClick={() => onTopicClick(isActive ? 'All' : (a.topic_name ?? 'All'))}
        style={{
          width: '100%', padding: '6px 0', borderRadius: 8,
          fontSize: 11, fontWeight: 700, fontFamily: SANS,
          background: isActive ? C.teal : 'transparent',
          color: isActive ? '#fff' : C.teal,
          border: `1px solid ${isActive ? C.teal : C.border}`,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.tealSoft; e.currentTarget.style.borderColor = C.teal; } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; } }}
      >
        {isActive ? 'Tracking ✓' : 'Track Status'}
      </button>
    </div>
  );
};

export default ScheduledAssignmentsPanel;
