import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { MockExamItem, MockExamResultItem, dashboardAPI } from '../services/api';
import sectionSummerComparison from '../data/sectionSummerComparison.json';
import { downloadSummerComparisonExcel, getSummerComparisonData, subjectStats, SummerComparisonData, StudentRow as SummerStudentRow } from '../utils/buildClass10SummerExcel';

const FONT = "'Plus Jakarta Sans', sans-serif";

interface MockExamResultsProps {
  exams: MockExamItem[];
  loading: boolean;
  examClassOptions: string[];
  examSectionOptions: string[];
  examClassFilter: string;
  examSectionFilter: string;
  onExamFiltersChange: (classFilter: string, sectionFilter: string) => void;
  selectedHomeworkId: number | null;
  onSelectExam: (homeworkId: number) => void;
  results: MockExamResultItem[] | null;
  resultsLoading: boolean;
  onFetchExamsForSection: (classCode: string, sectionName?: string) => Promise<MockExamItem[]>;
}

const C = {
  card: '#FFFFFF',
  cardAlt: '#F5F3FF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  purple: '#7C3AED',
  purpleDark: '#6D28D9',
  purpleSoft: 'rgba(124,58,237,0.10)',
  blue: '#3B82F6',
  green: '#10B981',
  greenSoft: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.12)',
  red: '#F43F5E',
  redSoft: 'rgba(244,63,94,0.12)',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
  shadowLg: '0 8px 32px rgba(0,0,0,0.14)',
};

const scoreColor = (s: number) => s >= 70 ? C.green : s >= 50 ? C.amber : C.red;
const scoreBg   = (s: number) => s >= 70 ? C.greenSoft : s >= 50 ? C.amberSoft : C.redSoft;

const formatChapter = (raw: string) =>
  raw
    .replace(/^CHAPTER[_\s]*\d*[_\s]*/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

// Shifts a 'YYYY-MM-DD' date string by `days`, staying in local time (avoids UTC day-shift bugs).
const shiftDate = (dateStr: string, days: number) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD
};

const fmtDur = (sec: number | null | undefined) => {
  const s = Number(sec ?? 0);
  if (s <= 0) return '-';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// ── Shared small components ─────────────────────────────────────────────────

const Dots: React.FC<{ color?: string }> = ({ color = C.purple }) => (
  <div style={{ textAlign: 'center', padding: '40px 0' }}>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: color, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />)}
    </div>
  </div>
);

const BackBtn: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, padding: '9px 16px',
      borderRadius: 10, border: `1.5px solid ${C.purple}`, background: C.purpleSoft,
      color: C.purpleDark, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
      boxShadow: '0 1px 2px rgba(124,58,237,0.08)', transition: 'background 0.12s, transform 0.12s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = C.purple; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = C.purpleSoft; e.currentTarget.style.color = C.purpleDark; e.currentTarget.style.transform = 'none'; }}
  >
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    {label}
  </button>
);

// ── Compare selection modal ─────────────────────────────────────────────────

interface CompareModalProps {
  classOptions: string[];
  sectionOptions: (cls: string) => string[];
  onFetchExams: (classCode: string, sectionName?: string) => Promise<MockExamItem[]>;
  onConfirm: (id1: number, id2: number, cls: string, sec: string) => void;
  onClose: () => void;
}

const CompareModal: React.FC<CompareModalProps> = ({ classOptions, sectionOptions, onFetchExams, onConfirm, onClose }) => {
  const [cls, setCls]         = useState('');
  const [sec, setSec]         = useState('');
  const [exams, setExams]     = useState<MockExamItem[] | null>(null);
  const [fetching, setFetch]  = useState(false);
  const [exam1, setExam1]     = useState<MockExamItem | null>(null);
  const [exam2, setExam2]     = useState<MockExamItem | null>(null);
  const scrollRef             = useRef<HTMLDivElement>(null);

  const nonAllClasses = classOptions.filter(o => o !== 'All');

  const fetchExams = async (classCode: string, sectionName: string) => {
    setExams(null);
    setExam1(null);
    setExam2(null);
    setFetch(true);
    const items = await onFetchExams(classCode, sectionName === 'All' ? undefined : sectionName);
    setExams(items);
    setFetch(false);
  };

  const handleClassChange = (val: string) => {
    setCls(val);
    setSec('All');
    setExams(null);
    setExam1(null);
    setExam2(null);
  };

  const handleSectionChange = (val: string) => {
    setSec(val);
    if (cls) fetchExams(cls, val);
  };

  const handleClassConfirm = () => {
    if (cls) fetchExams(cls, sec);
  };

  const toggleExam = (exam: MockExamItem) => {
    if (exam1?.homework_id === exam.homework_id) { setExam1(exam2); setExam2(null); return; }
    if (exam2?.homework_id === exam.homework_id) { setExam2(null); return; }
    if (!exam1) { setExam1(exam); return; }
    if (!exam2) {
      // Auto-arrange: older date → Before, newer date → After
      const t1 = exam1.date_assigned ? new Date(exam1.date_assigned).getTime() : exam1.homework_id;
      const t2 = exam.date_assigned   ? new Date(exam.date_assigned).getTime()  : exam.homework_id;
      if (t2 < t1) { setExam1(exam); setExam2(exam1); } else { setExam2(exam); }
      return;
    }
  };

  const secs = sectionOptions(cls);
  const canFetch = !!cls;
  const canCompare = !!exam1 && !!exam2;

  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Compare Exams</div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>Select a class and section, then pick two exams to compare</div>
      </div>

      <div style={{ padding: '20px 24px' }} ref={scrollRef}>

          {/* Class + Section selectors */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Class</div>
              <select
                value={cls}
                onChange={e => handleClassChange(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${cls ? C.purple : C.border}`, background: C.card, color: cls ? C.text : C.textMuted, fontSize: 13, fontFamily: FONT, cursor: 'pointer', outline: 'none' }}
              >
                <option value="">Select class…</option>
                {nonAllClasses.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Section</div>
              <select
                value={sec}
                onChange={e => handleSectionChange(e.target.value)}
                disabled={!cls}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${sec && sec !== 'All' ? C.purple : C.border}`, background: !cls ? '#F8FAFC' : C.card, color: !cls ? C.textMuted : C.text, fontSize: 13, fontFamily: FONT, cursor: cls ? 'pointer' : 'not-allowed', outline: 'none' }}
              >
                <option value="All">All sections</option>
                {secs.filter(s => s !== 'All').map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {cls && !exams && !fetching && (
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }}>
                <button
                  onClick={handleClassConfirm}
                  style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: C.purple, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginTop: 'auto', height: 38 }}
                >
                  Load
                </button>
              </div>
            )}
          </div>

          {/* Exam 1 / Exam 2 boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {(['exam1', 'exam2'] as const).map((slot, si) => {
              const selected = si === 0 ? exam1 : exam2;
              return (
                <div key={slot} style={{ borderRadius: 12, border: `2px dashed ${selected ? C.purple : C.border}`, background: selected ? C.purpleSoft : '#F8FAFC', padding: '14px 16px', minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: selected ? C.purple : C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    {si === 0 ? 'Previous Exam' : 'New Exam'}
                  </div>
                  {selected ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{selected.title ?? selected.homework_code ?? `#${selected.homework_id}`}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{fmt(selected.date_assigned)} · {selected.total_submissions} submissions</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: C.textSecondary }}>Select from list below</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Exam list */}
          {fetching && <Dots />}
          {!fetching && exams === null && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
              {cls ? 'Click Load to fetch exams for this class.' : 'Select a class to see available exams.'}
            </div>
          )}
          {!fetching && exams !== null && exams.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>No exams found for this class / section.</div>
          )}
          {!fetching && exams !== null && exams.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {exams.length} exam{exams.length !== 1 ? 's' : ''} found — click to select
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {exams.map(exam => {
                  const isE1 = exam1?.homework_id === exam.homework_id;
                  const isE2 = exam2?.homework_id === exam.homework_id;
                  const slot = isE1 ? 1 : isE2 ? 2 : null;
                  const disabled = !isE1 && !isE2 && !!exam1 && !!exam2;
                  return (
                    <label
                      key={exam.homework_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${slot ? C.purple : C.border}`, background: slot ? C.purpleSoft : C.card, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, transition: 'all 0.12s' }}
                    >
                      <input
                        type="checkbox"
                        checked={!!slot}
                        disabled={disabled}
                        onChange={() => !disabled && toggleExam(exam)}
                        style={{ width: 16, height: 16, accentColor: C.purple, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                        onClick={e => e.stopPropagation()}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exam.title ?? exam.homework_code ?? `Mock Exam #${exam.homework_id}`}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {fmt(exam.date_assigned)} · {exam.total_submissions} submissions
                          {exam.average_score != null && ` · avg ${Number(exam.average_score).toFixed(1)}%`}
                        </div>
                        {exam.chapters && exam.chapters.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                            {exam.chapters.map(ch => (
                              <span key={ch} style={{ fontSize: 10, fontWeight: 600, color: C.purple, background: C.purpleSoft, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                                {formatChapter(ch)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {slot && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: C.purple, background: C.purpleSoft, border: `1px solid ${C.purple}`, borderRadius: 6, padding: '2px 8px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {slot === 1 ? 'Previous Exam' : 'New Exam'}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: C.card }}>
        <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>
          {canCompare ? `${exam1!.title ?? `#${exam1!.homework_id}`} vs ${exam2!.title ?? `#${exam2!.homework_id}`}` : 'Select 2 exams to compare'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
            Reset
          </button>
          <button
            onClick={() => canCompare && onConfirm(exam1!.homework_id, exam2!.homework_id, cls, sec)}
            disabled={!canCompare}
            style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: canCompare ? C.purple : C.border, color: canCompare ? '#fff' : C.textMuted, fontSize: 13, fontWeight: 700, cursor: canCompare ? 'pointer' : 'not-allowed', fontFamily: FONT, transition: 'background 0.15s' }}
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Compare results view ────────────────────────────────────────────────────

type SortKey = 'exam2' | 'exam1' | 'delta' | 'deltaAsc';

interface CompareViewProps {
  exams: MockExamItem[];
  compareExamIds: [number, number];
  compareResults: { exam1: MockExamResultItem[]; exam2: MockExamResultItem[] } | null;
  compareLoading: boolean;
  compareClass: string;
  compareSection: string;
  onExit: () => void;
}

const ScoreBar: React.FC<{ s1: number; s2: number }> = ({ s1, s2 }) => {
  const improved = s2 > s1;
  const dropped = s2 < s1;
  const barColor = improved ? C.green : dropped ? C.red : C.textMuted;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
      {/* Exam 1 bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 28, fontSize: 10, fontWeight: 600, color: C.textMuted, textAlign: 'right', flexShrink: 0 }}>{s1}%</div>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(s1, 100)}%`, height: '100%', borderRadius: 99, background: '#CBD5E1' }} />
        </div>
      </div>
      {/* Exam 2 bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 28, fontSize: 10, fontWeight: 700, color: scoreColor(s2), textAlign: 'right', flexShrink: 0 }}>{s2}%</div>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(s2, 100)}%`, height: '100%', borderRadius: 99, background: barColor }} />
        </div>
      </div>
    </div>
  );
};


// ── Student Story Modal ─────────────────────────────────────────────────────

interface StoryStudentInfo {
  student_id: number;
  username: string | null;
  name: string;
  cls: string | null;
  sec: string | null;
  s1: number;
  s2: number;
  delta: number;
  rank1: number;
  rank2: number;
  rankDelta: number;
  label1: string;
  label2: string;
  examDate1: string | null;
  examDate2: string | null;
}

const VERDICT_CONFIG = {
  'app-drove':      { label: 'App Drove This',     color: '#10B981', bg: 'rgba(16,185,129,0.10)', desc: 'Strong engagement and spotchecks translated directly into results.' },
  'needs-attention':{ label: 'Needs Intervention', color: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  desc: 'Score dropped with low in-app activity. Teacher follow-up needed.' },
  'external-study': { label: 'External Study',     color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', desc: 'Improved without significant app usage — likely studying outside.' },
  'review-content': { label: 'Review Content',     color: '#F97316', bg: 'rgba(249,115,22,0.10)', desc: 'Active on the app but score dropped — content may need revisiting.' },
} as const;
type VerdictKey = keyof typeof VERDICT_CONFIG;

function getVerdict(delta: number, sessionsPerWeek: number, totalSessions: number, spotcheckCount: number): VerdictKey {
  const improved = delta > 0;
  const engaged  = sessionsPerWeek >= 3 || totalSessions >= 10;
  const practiced = spotcheckCount > 0;
  if (improved && (practiced || engaged)) return 'app-drove';
  if (!improved && practiced && engaged)  return 'review-content';
  if (improved && !practiced && !engaged) return 'external-study';
  return 'needs-attention';
}

const StudentStoryModal: React.FC<{ info: StoryStudentInfo; onClose: () => void }> = ({ info, onClose }) => {
  const [loginLogs, setLoginLogs] = useState<any>(null);
  const [summary,   setSummary]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      info.username
        ? dashboardAPI.getUserLoginLogs(info.username, 500).catch(() => null)
        : Promise.resolve(null),
      dashboardAPI.getStudentSummary(info.student_id).catch(() => null),
    ]).then(([logs, sum]) => {
      setLoginLogs(logs);
      setSummary(sum);
      setLoading(false);
    });
  }, [info.student_id, info.username]);

  // ── Date window between the two exams ───────────────────────────────────
  const d1 = info.examDate1 ? new Date(info.examDate1) : null;
  const d2 = info.examDate2 ? new Date(info.examDate2) : null;

  const allDayItems: any[] = loginLogs?.items ?? [];

  const windowDays = allDayItems.filter((item: any) => {
    const d = new Date(item.date);
    if (d1 && d < d1) return false;
    if (d2 && d > d2) return false;
    return true;
  });

  const windowTimeSec     = windowDays.reduce((s: number, d: any) => s + Number(d.total_time_seconds ?? 0), 0);
  const windowSessionCount= windowDays.reduce((s: number, d: any) => s + Number(d.total_sessions ?? 0), 0);
  const daysActive        = windowDays.filter((d: any) => Number(d.total_time_seconds) > 60).length;

  const windowMs    = d1 && d2 ? d2.getTime() - d1.getTime() : 0;
  const windowWeeks = windowMs > 0 ? windowMs / (7 * 24 * 3600 * 1000) : 1;
  const sessionsPerWeek = windowWeeks > 0
    ? Math.round(windowSessionCount / windowWeeks * 10) / 10
    : windowSessionCount;

  // ── Spotcheck data from summary ──────────────────────────────────────────
  const prepItems: any[]  = summary?.test_prep_results ?? [];
  const spotcheckCount    = prepItems.length;
  const spotcheckTimeSec  = prepItems.reduce((s: number, item: any) =>
    s + Number(item.graph_data?.time_spent_sec ?? item.analysis?.analysis?.time_spent_sec ?? 0), 0);

  // ── Verdict ──────────────────────────────────────────────────────────────
  const verdict = loading ? null : getVerdict(info.delta, sessionsPerWeek, windowSessionCount, spotcheckCount);
  const vcfg = verdict ? VERDICT_CONFIG[verdict] : null;

  // ── Activity calendar: day strip from d1 → d2 ────────────────────────────
  const calDays: Array<{ date: string; timeSec: number }> = [];
  if (d1 && d2) {
    const dayMap = new Map(windowDays.map((d: any) => [d.date, d]));
    const cur = new Date(d1); cur.setHours(0, 0, 0, 0);
    const end = new Date(d2); end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      const day = dayMap.get(ds);
      calDays.push({ date: ds, timeSec: Number(day?.total_time_seconds ?? 0) });
      cur.setDate(cur.getDate() + 1);
    }
  }

  const calColor = (timeSec: number) => {
    if (timeSec <= 0)    return '#E2E8F0';
    if (timeSec < 300)   return 'rgba(124,58,237,0.25)';
    if (timeSec < 1800)  return 'rgba(124,58,237,0.60)';
    return C.purple;
  };

  const sc = (s: number) => s >= 70 ? C.green : s >= 50 ? C.amber : C.red;

  const fmtTime = (sec: number) => {
    if (sec <= 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(sec % 60)}s`;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
      <style>{`@keyframes dot-pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: C.shadowLg, border: `1px solid ${C.border}` }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{info.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {[info.cls, info.sec].filter(Boolean).join(' / ') || '—'}
              {info.username && <span style={{ marginLeft: 8, color: C.purple, fontWeight: 600 }}>@{info.username}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Score comparison */}
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Exam Result</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>{info.label1}</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: sc(info.s1), lineHeight: 1 }}>{info.s1}%</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Rank #{info.rank1}</div>
              {info.examDate1 && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{new Date(info.examDate1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <svg width="20" height="20" fill="none" stroke={C.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 16, fontWeight: 800, color: info.delta > 0 ? C.green : info.delta < 0 ? C.red : C.textMuted }}>
                {info.delta > 0 ? '+' : ''}{info.delta}%
              </span>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>{info.label2}</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: sc(info.s2), lineHeight: 1 }}>{info.s2}%</div>
              <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: info.rankDelta > 0 ? C.green : info.rankDelta < 0 ? C.red : C.textMuted }}>
                Rank #{info.rank2}{info.rankDelta !== 0 ? (info.rankDelta > 0 ? ` ↑${info.rankDelta}` : ` ↓${Math.abs(info.rankDelta)}`) : ''}
              </div>
              {info.examDate2 && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{new Date(info.examDate2).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i*0.16}s infinite` }} />)}
          </div>
        ) : (
          <>
            {/* Verdict */}
            {vcfg && (
              <div style={{ padding: '16px 22px', background: vcfg.bg, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Verdict</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: vcfg.color, marginBottom: 4 }}>{vcfg.label}</div>
                <div style={{ fontSize: 12, color: C.textSecondary }}>{vcfg.desc}</div>
              </div>
            )}

            {/* Activity stats */}
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                In-App Activity
                {d1 && d2 && <span style={{ fontWeight: 500, textTransform: 'none', marginLeft: 6, color: C.textMuted }}>
                  (between exams)
                </span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { label: 'Days Active',        value: loginLogs ? String(daysActive) : (summary?.total_sessions != null ? String(summary.total_sessions) : '—') },
                  { label: 'Sessions',           value: loginLogs ? String(windowSessionCount) : '—' },
                  { label: 'Total Time on App',  value: loginLogs ? fmtTime(windowTimeSec) : '—' },
                  { label: 'Spotcheck Attempts', value: String(spotcheckCount) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: C.cardAlt, borderRadius: 10, padding: '10px 14px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity calendar */}
            {calDays.length > 0 && (
              <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Login Activity — {calDays.length} days
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.textMuted }}>
                    <span>Less</span>
                    {[0, 60, 300, 1800].map(t => (
                      <div key={t} style={{ width: 10, height: 10, borderRadius: 2, background: calColor(t > 0 ? t + 1 : 0) }} />
                    ))}
                    <span>More</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {calDays.map(({ date, timeSec }) => {
                    const tip = timeSec > 0 ? `${date}: ${fmtTime(timeSec)}` : date;
                    return (
                      <div
                        key={date}
                        title={tip}
                        style={{
                          width: 14, height: 14, borderRadius: 3,
                          background: calColor(timeSec),
                          cursor: timeSec > 0 ? 'default' : 'default',
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
                {daysActive > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.textSecondary }}>
                    <span style={{ fontWeight: 700, color: C.purple }}>{daysActive}</span> active day{daysActive !== 1 ? 's' : ''} · avg <span style={{ fontWeight: 700, color: C.purple }}>{fmtTime(Math.round(windowTimeSec / daysActive))}</span>/day · <span style={{ fontWeight: 700, color: C.purple }}>{sessionsPerWeek}</span> sessions/week
                  </div>
                )}
              </div>
            )}

            {/* Spotcheck history */}
            {spotcheckCount > 0 && (
              <div style={{ padding: '16px 22px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Spotcheck History
                  {spotcheckTimeSec > 0 && <span style={{ fontWeight: 500, textTransform: 'none', marginLeft: 6 }}>· {fmtTime(spotcheckTimeSec)} total</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {prepItems
                    .slice()
                    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((item: any, i: number) => {
                      const score   = Number(item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? 0);
                      const chapter = item.graph_data?.chapter_breakdown?.[0]?.chapter ?? item.name ?? '—';
                      const date    = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
                      const timeSec = Number(item.graph_data?.time_spent_sec ?? item.analysis?.analysis?.time_spent_sec ?? 0);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: C.cardAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapter}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{date}{timeSec > 0 ? ` · ${fmtDur(timeSec)}` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: sc(score) }}>{score}%</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {spotcheckCount === 0 && (
              <div style={{ padding: '20px 22px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                No spotcheck activity found for this student.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Scatter quadrant config ──────────────────────────────────────────────────

// Temporarily disabled in the UI — kept in code for later re-enabling.
// (Typed as `boolean`, not the literal `false`, so TS doesn't treat the
// gated JSX below as unreachable and skip narrowing checks inside it.)
const SHOW_SCATTER_FEATURE: boolean = false;

type QKey = 'app-drove' | 'review-content' | 'external-study' | 'needs-attention';
const QCFG: Record<QKey, { label: string; color: string; bg: string; short: string }> = {
  'app-drove':       { label: 'App Drove This',     color: '#10B981', bg: 'rgba(16,185,129,0.11)',  short: 'Using app · Improving'      },
  'review-content':  { label: 'Review Content',     color: '#F97316', bg: 'rgba(249,115,22,0.11)',  short: 'Using app · Decreasing'     },
  'external-study':  { label: 'External Study',     color: '#F59E0B', bg: 'rgba(245,158,11,0.11)',  short: 'Not using app · Improving'  },
  'needs-attention': { label: 'Needs Intervention', color: '#F43F5E', bg: 'rgba(244,63,94,0.11)',   short: 'Not using app · Decreasing' },
};
const getQ = (delta: number, sessions: number, thr: number): QKey => {
  const up = delta >= 0, using = sessions >= thr;
  if (up && using) return 'app-drove';
  if (!up && using) return 'review-content';
  if (up && !using) return 'external-study';
  return 'needs-attention';
};

// ── CompareView ──────────────────────────────────────────────────────────────

const CompareView: React.FC<CompareViewProps> = ({ exams, compareExamIds, compareResults, compareLoading, compareClass, compareSection, onExit }) => {
  const [classFilter, setCls]       = useState(compareClass || 'All');
  const [secFilter, setSec]         = useState(compareSection || 'All');
  const [sortBy, setSort]           = useState<SortKey>('delta');
  const [showRemaining, setShowRem] = useState(false);
  const [storyInfo, setStoryInfo]   = useState<StoryStudentInfo | null>(null);
  const [showScatter, setShowSc]    = useState(false);
  const [scatterSess, setScatterSess] = useState<Map<number, { sessions: number; timeSec: number }>>(new Map());
  const [scatterLoading, setScL]    = useState(false);
  const [hoveredDot, setHovDot]     = useState<number | null>(null);

  useEffect(() => { setCls(compareClass || 'All'); setSec(compareSection || 'All'); }, [compareExamIds]);
  useEffect(() => { setSec(compareSection || 'All'); }, [classFilter]);
  useEffect(() => { setShowSc(false); setScatterSess(new Map()); }, [compareExamIds[0], compareExamIds[1]]);

  const meta1 = exams.find(e => e.homework_id === compareExamIds[0]);
  const meta2 = exams.find(e => e.homework_id === compareExamIds[1]);
  const label1 = meta1?.title ?? meta1?.homework_code ?? `Exam #${compareExamIds[0]}`;
  const label2 = meta2?.title ?? meta2?.homework_code ?? `Exam #${compareExamIds[1]}`;

  if (compareLoading) return <><BackBtn onClick={onExit} label="Compare Other Exams" /><Dots /></>;
  if (!compareResults) return <BackBtn onClick={onExit} label="Compare Other Exams" />;

  const { exam1: raw1, exam2: raw2 } = compareResults;
  const map1 = new Map(raw1.map(r => [r.student_id, r]));
  const map2 = new Map(raw2.map(r => [r.student_id, r]));

  const secs2 = new Set(raw2.map(r => `${r.class_name ?? ''}||${r.section_name ?? ''}`));

  const intersect = new Map<string, Set<string>>();
  for (const r of raw1) {
    const key = `${r.class_name ?? ''}||${r.section_name ?? ''}`;
    if (!secs2.has(key)) continue;
    const c = r.class_name ?? 'Unknown', s = r.section_name ?? 'Unknown';
    if (!intersect.has(c)) intersect.set(c, new Set());
    intersect.get(c)!.add(s);
  }
  const classOpts = ['All', ...Array.from(intersect.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  const secOpts: string[] = ['All', ...Array.from<string>(classFilter === 'All'
    ? new Set<string>([...intersect.values()].flatMap(s => [...s]))
    : (intersect.get(classFilter) ?? new Set<string>())
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];

  const matched = raw2.filter(r2 => {
    if (!map1.has(r2.student_id)) return false;
    if (classFilter !== 'All' && (r2.class_name ?? 'Unknown') !== classFilter) return false;
    if (secFilter !== 'All' && (r2.section_name ?? 'Unknown') !== secFilter) return false;
    return true;
  });

  const rows = matched.map(r2 => {
    const r1 = map1.get(r2.student_id)!;
    return {
      student_id: r2.student_id,
      username: r2.username ?? null,
      name: r2.student_name || r2.username || `#${r2.student_id}`,
      cls: r2.class_name,
      sec: r2.section_name,
      s1: Number(r1.score),
      s2: Number(r2.score),
      delta: Number(r2.score) - Number(r1.score),
    };
  });

  // ── Scatter data loader ───────────────────────────────────────────────────
  const loadScatterData = async () => {
    const missing = rows.filter(r => !scatterSess.has(r.student_id));
    if (!missing.length || scatterLoading) return;
    setScL(true);
    const d1 = meta1?.date_assigned ? new Date(meta1.date_assigned) : null;
    const d2 = meta2?.date_assigned ? new Date(meta2.date_assigned) : null;
    const logsArr = await Promise.all(
      missing.map(r =>
        r.username ? dashboardAPI.getUserLoginLogs(r.username, 200).catch(() => null) : Promise.resolve(null)
      )
    );
    setScatterSess(prev => {
      const next = new Map(prev);
      missing.forEach((r, i) => {
        const windowDays: any[] = (logsArr[i]?.items ?? []).filter((d: any) => {
          const date = new Date(d.date);
          if (d1 && date < d1) return false;
          if (d2 && date > d2) return false;
          return true;
        });
        next.set(r.student_id, {
          sessions: windowDays.reduce((s: number, d: any) => s + Number(d.total_sessions ?? 0), 0),
          timeSec:  windowDays.reduce((s: number, d: any) => s + Number(d.total_time_seconds ?? 0), 0),
        });
      });
      return next;
    });
    setScL(false);
  };

  // ── Scatter chart math ────────────────────────────────────────────────────
  const scPts = rows.map(r => ({ ...r, ...(scatterSess.get(r.student_id) ?? { sessions: 0, timeSec: 0 }) }));
  const SVG_W = 580, SVG_H = 420, ML = 56, MR = 16, MT = 16, MB = 52;
  const PW = SVG_W - ML - MR, PH = SVG_H - MT - MB;
  // X axis: 0 → maxSess; divider ALWAYS at visual center (= maxSess/2 in data space)
  const maxSess  = Math.max(...scPts.map(p => p.sessions), 8);
  const maxDelta = Math.max(...scPts.map(p => Math.abs(p.delta)), 15);
  const yRange   = maxDelta + 5;
  const xS = (s: number) => ML + (s / maxSess) * PW;
  const yS = (d: number) => MT + PH / 2 - (d / yRange) * (PH / 2);
  const xTh  = ML + PW / 2;          // always the visual center
  const yMid = MT + PH / 2;          // always Y=0 (center of symmetric Y axis)
  const thr  = maxSess / 2;          // session threshold = midpoint of X range
  const qCounts = { 'app-drove': 0, 'review-content': 0, 'external-study': 0, 'needs-attention': 0 } as Record<QKey, number>;
  scPts.forEach(p => qCounts[getQ(p.delta, p.sessions, thr)]++);
  const yStep = maxDelta <= 15 ? 5 : maxDelta <= 30 ? 10 : 20;
  const yTicks: number[] = [];
  for (let d = -Math.ceil(yRange / yStep) * yStep; d <= yRange; d += yStep) yTicks.push(d);
  const xStep = maxSess <= 10 ? 2 : maxSess <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let s = 0; s <= maxSess; s += xStep) xTicks.push(s);

  const byRank1 = [...rows].sort((a, b) => b.s1 - a.s1);
  const byRank2 = [...rows].sort((a, b) => b.s2 - a.s2);
  const rank1 = new Map(byRank1.map((r, i) => [r.student_id, i + 1]));
  const rank2 = new Map(byRank2.map((r, i) => [r.student_id, i + 1]));

  const sorted = [...rows].sort((a, b) =>
    sortBy === 'exam1' ? b.s1 - a.s1 :
    sortBy === 'exam2' ? b.s2 - a.s2 :
    sortBy === 'deltaAsc' ? a.delta - b.delta :
    b.delta - a.delta
  );

  const avgDelta = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.delta, 0) / rows.length * 10) / 10
    : null;

  // Students who submitted only one exam, filtered to the modal-selected class/section
  const inSection = (r: MockExamResultItem) => {
    if (compareClass && compareClass !== 'All' && (r.class_name ?? '') !== compareClass) return false;
    if (compareSection && compareSection !== 'All' && (r.section_name ?? '') !== compareSection) return false;
    return true;
  };
  const remaining = [
    ...raw1.filter(r => !map2.has(r.student_id) && inSection(r)).map(r => ({ ...r, submittedIn: 'Previous Exam' as const })),
    ...raw2.filter(r => !map1.has(r.student_id) && inSection(r)).map(r => ({ ...r, submittedIn: 'New Exam' as const })),
  ].sort((a, b) => a.student_name.localeCompare(b.student_name));

  return (
    <div style={{ fontFamily: FONT }}>
      <BackBtn onClick={onExit} label="Compare Other Exams" />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {/* Students count */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: C.shadow }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.purpleSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" stroke={C.purple} strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1 }}>{rows.length} students</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 3 }}>
              from {compareClass && compareSection && compareSection !== 'All'
                ? `${compareClass} / ${compareSection}`
                : compareClass
                ? compareClass
                : 'all sections'} submitted both exams
            </div>
          </div>
        </div>

        {/* Avg change */}
        {avgDelta != null && (() => {
          const up = avgDelta > 0;
          const neutral = avgDelta === 0;
          const color = neutral ? C.textSecondary : up ? C.green : C.red;
          const bg = neutral ? C.cardAlt : up ? C.greenSoft : C.redSoft;
          const icon = up
            ? <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            : <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>;
          return (
            <div style={{ background: bg, border: `1.5px solid ${color}33`, borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: C.shadow }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <svg width="18" height="18" fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">{icon}</svg>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{up ? '+' : ''}{avgDelta}%</div>
                <div style={{ fontSize: 12, color, opacity: 0.8, marginTop: 3, fontWeight: 500 }}>Avg score change</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Scatter Plot toggle button — disabled in UI for now */}
      {SHOW_SCATTER_FEATURE && (
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => { setShowSc(v => { if (!v) loadScatterData(); return !v; }); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 18px', borderRadius: 9,
            border: `1.5px solid ${showScatter ? C.purple : C.border}`,
            background: showScatter ? C.purpleSoft : C.card,
            color: showScatter ? C.purple : C.textSecondary,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            boxShadow: C.shadow, transition: 'all 0.15s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="17" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><circle cx="7" cy="7" r="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
          Scatter Plot
        </button>
        {showScatter && scatterLoading && (
          <span style={{ fontSize: 12, color: C.textMuted }}>
            Fetching app activity for {rows.length} students…
          </span>
        )}
      </div>
      )}

      {/* Scatter Plot section — disabled in UI for now */}
      {SHOW_SCATTER_FEATURE && showScatter && (
        <div style={{ marginBottom: 20 }}>
          {/* Legend row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
              Divides at <strong style={{ color: C.text }}>{Math.round(thr)} sessions</strong> (midpoint) · <strong style={{ color: C.text }}>0%</strong> score change
            </span>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {(Object.entries(QCFG) as [QKey, typeof QCFG[QKey]][]).map(([, cfg]) => (
                <span key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSecondary }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
                  {cfg.label}
                </span>
              ))}
            </div>
          </div>

          {/* Chart + quadrant counts */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* The scatter chart box */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, flex: 1, minWidth: 0, padding: '20px 20px 12px', position: 'relative' }}>
              {scatterLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.85)', borderRadius: 14, zIndex: 5 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i*0.16}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  style={{ width: '100%', maxWidth: SVG_W, display: 'block', margin: '0 auto', overflow: 'visible', fontFamily: FONT }}
                >
                  <defs><clipPath id="sc-clip2"><rect x={ML} y={MT} width={PW} height={PH} /></clipPath></defs>

                  {/* Quadrant backgrounds — equal halves, dividers at center */}
                  <rect x={ML}  y={MT}   width={PW / 2} height={PH / 2} fill={QCFG['external-study'].bg} />
                  <rect x={xTh} y={MT}   width={PW / 2} height={PH / 2} fill={QCFG['app-drove'].bg} />
                  <rect x={ML}  y={yMid} width={PW / 2} height={PH / 2} fill={QCFG['needs-attention'].bg} />
                  <rect x={xTh} y={yMid} width={PW / 2} height={PH / 2} fill={QCFG['review-content'].bg} />

                  {/* Plot box border */}
                  <rect x={ML} y={MT} width={PW} height={PH} fill="none" stroke="#CBD5E1" strokeWidth="1.5" />

                  {/* Subtle axis grid */}
                  {yTicks.filter(d => d !== 0).map(d => (
                    <line key={d} x1={ML} x2={ML + PW} y1={yS(d)} y2={yS(d)} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
                  ))}
                  {xTicks.filter(s => xS(s) !== xTh).map(s => (
                    <line key={s} x1={xS(s)} x2={xS(s)} y1={MT} y2={MT + PH} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
                  ))}

                  {/* Axis tick labels */}
                  {yTicks.map(d => (
                    <text key={d} x={ML - 7} y={yS(d) + 4} textAnchor="end" fontSize={10} fill={C.textMuted}>{d > 0 ? `+${d}` : d}%</text>
                  ))}
                  {xTicks.map(s => (
                    <text key={s} x={xS(s)} y={MT + PH + 17} textAnchor="middle" fontSize={10} fill={C.textMuted}>{s}</text>
                  ))}

                  {/* Bold center dividers */}
                  <line x1={ML} x2={ML + PW} y1={yMid} y2={yMid} stroke="#334155" strokeWidth="2" />
                  <line x1={xTh} x2={xTh} y1={MT} y2={MT + PH} stroke="#334155" strokeWidth="2" />

                  {/* Quadrant labels — center of each quadrant */}
                  {([
                    { key: 'external-study',  cx: ML + PW / 4,     cy: MT + PH / 4     },
                    { key: 'app-drove',       cx: ML + 3 * PW / 4, cy: MT + PH / 4     },
                    { key: 'needs-attention', cx: ML + PW / 4,     cy: MT + 3 * PH / 4 },
                    { key: 'review-content',  cx: ML + 3 * PW / 4, cy: MT + 3 * PH / 4 },
                  ] as { key: QKey; cx: number; cy: number }[]).map(({ key, cx, cy }) => {
                    const cfg = QCFG[key];
                    return (
                      <g key={key}>
                        <text x={cx} y={cy - 6}  textAnchor="middle" fontSize={13} fontWeight="700" fill={cfg.color} fontFamily={FONT} fillOpacity={0.75}>{cfg.label}</text>
                        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={10} fontWeight="500" fill={cfg.color} fontFamily={FONT} fillOpacity={0.55}>{cfg.short}</text>
                      </g>
                    );
                  })}

                  {/* Axis labels */}
                  <text x={ML + PW / 2} y={SVG_H - 6} textAnchor="middle" fontSize={11} fill={C.textSecondary} fontWeight="600" fontFamily={FONT}>Sessions on App (between exams)</text>
                  <text transform={`translate(11,${MT + PH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={C.textSecondary} fontWeight="600" fontFamily={FONT}>Score Change (%)</text>

                  {/* Student dots */}
                  <g clipPath="url(#sc-clip2)">
                    {scPts.map(p => {
                      const q   = getQ(p.delta, p.sessions, thr);
                      const col = QCFG[q].color;
                      const cx  = xS(p.sessions);
                      const cy  = yS(p.delta);
                      const isH = hoveredDot === p.student_id;
                      return (
                        <g key={p.student_id}>
                          {isH && <circle cx={cx} cy={cy} r={13} fill={col} fillOpacity={0.13} />}
                          <circle
                            cx={cx} cy={cy} r={isH ? 9 : 7}
                            fill={col} fillOpacity={0.88}
                            stroke="#fff" strokeWidth={isH ? 2 : 1.5}
                            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                            onMouseEnter={() => setHovDot(p.student_id)}
                            onMouseLeave={() => setHovDot(null)}
                          />
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Tooltip */}
                {hoveredDot !== null && (() => {
                  const found = scPts.find(pt => pt.student_id === hoveredDot);
                  if (!found) return null;
                  const p    = found;
                  const q    = getQ(p.delta, p.sessions, thr);
                  const qcfg = QCFG[q];
                  const cx   = xS(p.sessions);
                  const cy   = yS(p.delta);
                  // scale to actual rendered px (viewBox 560 → container width)
                  const tipLeft = cx < SVG_W / 2 ? cx + 20 : cx - 210;
                  const tipTop  = cy < SVG_H / 2 ? cy + 18 : cy - 118;
                  return (
                    <div style={{ position: 'absolute', left: tipLeft, top: tipTop, background: C.card, border: `1.5px solid ${qcfg.color}`, borderRadius: 10, padding: '10px 14px', boxShadow: C.shadowLg, minWidth: 190, pointerEvents: 'none', zIndex: 100 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{[p.cls, p.sec].filter(Boolean).join(' / ') || '—'}</div>
                      {[
                        ['Score change',  `${p.delta > 0 ? '+' : ''}${p.delta}%`,  p.delta > 0 ? '#10B981' : p.delta < 0 ? '#F43F5E' : C.textMuted],
                        ['Sessions',      String(p.sessions), C.text],
                        p.timeSec > 0 ? ['Time on app', (() => { const h = Math.floor(p.timeSec/3600), m = Math.floor((p.timeSec%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; })(), C.text] : null,
                        ['Scores', `${p.s1}% → ${p.s2}%`, C.textSecondary],
                      ].filter(Boolean).map(([lbl, val, col]: any) => (
                        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: C.textSecondary }}>{lbl}</span>
                          <span style={{ fontWeight: 700, color: col }}>{val}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: qcfg.color, background: qcfg.bg, borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>{qcfg.label}</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Quadrant count cards */}
            <div style={{ width: 178, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.entries(QCFG) as [QKey, typeof QCFG[QKey]][]).map(([key, cfg]) => (
                <div key={key} style={{ background: cfg.bg, border: `1px solid ${cfg.color}28`, borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{qCounts[key]}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, marginTop: 3 }}>{cfg.label}</div>
                  <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{cfg.short}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: C.cardAlt, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label1}</span>
            <svg width="14" height="14" fill="none" stroke={C.purple} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label2}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select value={classFilter} onChange={e => setCls(e.target.value)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${classFilter !== 'All' ? C.purple : C.border}`, background: C.card, color: C.text, fontSize: 12, fontFamily: FONT, cursor: 'pointer' }}>
              {classOpts.map(o => <option key={o} value={o}>{o === 'All' ? 'All Classes' : o}</option>)}
            </select>
            <select value={secFilter} onChange={e => setSec(e.target.value)} disabled={classFilter === 'All'} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${secFilter !== 'All' ? C.purple : C.border}`, background: classFilter === 'All' ? C.cardAlt : C.card, color: classFilter === 'All' ? C.textMuted : C.text, fontSize: 12, fontFamily: FONT, cursor: classFilter === 'All' ? 'not-allowed' : 'pointer' }}>
              {secOpts.map(o => <option key={o} value={o}>{o === 'All' ? 'All Sections' : o}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSort(e.target.value as SortKey)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 12, fontFamily: FONT, cursor: 'pointer' }}>
              <option value="delta">Most Improved</option>
              <option value="deltaAsc">Most Dropped</option>
              <option value="exam2">New Exam Score</option>
              <option value="exam1">Previous Exam Score</option>
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: 14 }}>No students submitted both exams for the selected filters.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
                    {['Student', 'Score Comparison', 'Change', 'Rank'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => {
                    const r1v = rank1.get(row.student_id) ?? 0;
                    const r2v = rank2.get(row.student_id) ?? 0;
                    const rd = r1v - r2v;
                    return (
                      <tr
                        key={row.student_id}
                        onClick={() => setStoryInfo({ ...row, rank1: r1v, rank2: r2v, rankDelta: rd, label1, label2, examDate1: meta1?.date_assigned ?? null, examDate2: meta2?.date_assigned ?? null })}
                        style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.cardAlt)}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: C.text, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.name}
                            <svg width="12" height="12" fill="none" stroke={C.purple} strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.5 }}><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{[row.cls, row.sec].filter(Boolean).join(' / ') || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <ScoreBar s1={row.s1} s2={row.s2} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {row.delta === 0 ? (
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>—</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 800, color: row.delta > 0 ? C.green : C.red, background: row.delta > 0 ? C.greenSoft : C.redSoft, borderRadius: 8, padding: '4px 10px' }}>
                              {row.delta > 0 ? '↑' : '↓'} {row.delta > 0 ? `+${row.delta}` : row.delta}%
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12, color: C.textMuted }}>#{r2v}</div>
                          {rd !== 0 && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: rd > 0 ? C.green : C.red, marginTop: 2 }}>
                              {rd > 0 ? `↑ ${rd}` : `↓ ${Math.abs(rd)}`}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </>
        )}
      </div>

      {/* Remaining students */}
      {remaining.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowRem(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 18px', borderRadius: showRemaining ? '12px 12px 0 0' : 12,
              border: `1px solid ${C.border}`, background: C.card,
              cursor: 'pointer', fontFamily: FONT, transition: 'border-radius 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: C.amberSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" fill="none" stroke={C.amber} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/></svg>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Remaining students</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, background: C.amberSoft, borderRadius: 99, padding: '2px 8px' }}>{remaining.length}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>submitted only one exam</span>
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, transform: showRemaining ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
          </button>

          {showRemaining && (
            <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 12px 12px', background: C.card, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    {['Student', 'Class / Section', 'Submitted In', 'Score'].map(h => (
                      <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {remaining.map((r, i) => (
                    <tr key={`${r.student_id}-${r.submittedIn}`} style={{ borderBottom: i < remaining.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: C.text }}>{r.student_name || r.username || `#${r.student_id}`}</td>
                      <td style={{ padding: '11px 16px', color: C.textSecondary, fontSize: 12 }}>{[r.class_name, r.section_name].filter(Boolean).join(' / ') || '-'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 9px',
                          background: r.submittedIn === 'Previous Exam' ? C.purpleSoft : C.greenSoft,
                          color: r.submittedIn === 'Previous Exam' ? C.purple : C.green,
                        }}>{r.submittedIn} only</span>
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: scoreColor(r.score), fontSize: 13 }}>{r.score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {storyInfo && (
        <StudentStoryModal info={storyInfo} onClose={() => setStoryInfo(null)} />
      )}
    </div>
  );
};

// ── Compare Mock Exams (standalone tab) ─────────────────────────────────────

interface CompareMockExamsProps {
  exams: MockExamItem[];
  examClassOptions: string[];
  examSectionOptions: string[];
  onFetchExamsForSection: (classCode: string, sectionName?: string) => Promise<MockExamItem[]>;
  compareExamIds: [number, number] | null;
  compareResults: { exam1: MockExamResultItem[]; exam2: MockExamResultItem[] } | null;
  compareLoading: boolean;
  onCompare: (id1: number, id2: number, cls: string, sec: string) => void;
  onExitCompare: () => void;
  teacherUsername: string;
}

const SummerComparisonChart: React.FC = () => {
  const [subject, setSubject] = useState<'maths' | 'science'>('maths');

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Before vs After Summer — Section-wise
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {(['maths', 'science'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              style={{
                padding: '4px 14px', borderRadius: 99,
                border: `1.5px solid ${subject === s ? C.purple : C.border}`,
                background: subject === s ? C.purpleSoft : C.card,
                color: subject === s ? C.purple : C.textMuted,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize',
              }}
            >
              {s === 'maths' ? 'Math' : 'Science'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        Class 10 sections · average score, April (before summer) vs June (after summer)
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ width: Math.max(sectionSummerComparison.sections.length * 90, 700), height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sectionSummerComparison.sections.map(s => ({
                section: s.section,
                before: s[subject].before,
                beforeN: s[subject].beforeN,
                after: s[subject].after,
                afterN: s[subject].afterN,
              }))}
              margin={{ top: 20, right: 16, left: 0, bottom: 8 }}
              barGap={4}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="section" tick={{ fontSize: 12, fontFamily: FONT, fill: C.textMuted }} tickLine={false} axisLine={{ stroke: C.border }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} width={36} />
              <Tooltip
                contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
                formatter={(value: any, name: any, props: any) => {
                  const n = name === 'before' ? props.payload.beforeN : props.payload.afterN;
                  return [value !== null ? `${Number(value).toFixed(1)}% (n=${n})` : '—', name === 'before' ? 'Before Summer' : 'After Summer'];
                }}
              />
              <Bar dataKey="before" fill={C.blue} radius={[4, 4, 0, 0]} barSize={28}>
                <LabelList dataKey="before" position="top" style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT, fill: C.blue }} formatter={(v: any) => v !== null ? Math.round(Number(v)) : ''} />
              </Bar>
              <Bar dataKey="after" fill={C.purple} radius={[4, 4, 0, 0]} barSize={28}>
                <LabelList dataKey="after" position="top" style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT, fill: C.purple }} formatter={(v: any) => v !== null ? Math.round(Number(v)) : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
        {[{ label: 'Before Summer (Apr)', color: C.blue }, { label: 'After Summer (Jun)', color: C.purple }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSecondary }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const score = (v: number | null) => v === null ? '—' : String(Math.round(v * 10) / 10);
const pct = (v: number | null) => v === null ? '—' : `${Math.round(v * 10) / 10}%`;

const formatDuration = (totalSeconds: number | null) => {
  if (totalSeconds === null) return '—';
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

const fmtActivityTime = (sec: number) => {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(sec % 60)}s`;
};

const activityCalColor = (timeSec: number) => {
  if (timeSec <= 0)   return '#E2E8F0';
  if (timeSec < 300)  return 'rgba(124,58,237,0.25)';
  if (timeSec < 1800) return 'rgba(124,58,237,0.60)';
  return C.purple;
};

interface StudentActivityModalStudent {
  name: string;
  username: string | null;
  rollNumber: string | null;
  section: string;
}

const StudentActivityModal: React.FC<{ student: StudentActivityModalStudent; onClose: () => void }> = ({ student, onClose }) => {
  const [loginLogs, setLoginLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student.username) {
      setLoading(false);
      setError('No username on record for this student — activity cannot be looked up.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    dashboardAPI.getUserLoginLogs(student.username, 500)
      .then(logs => { if (!cancelled) setLoginLogs(logs); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load activity.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student.username]);

  const days: any[] = loginLogs?.items ?? [];
  const recentDays = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
  const daysActive = days.filter((d: any) => Number(d.total_time_seconds) > 60).length;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
      <style>{`@keyframes dot-pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: C.shadowLg, border: `1px solid ${C.border}` }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{student.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {`Sec ${student.section}`}{student.rollNumber ? ` · Roll ${student.rollNumber}` : ''}
              {student.username && <span style={{ marginLeft: 8, color: C.purple, fontWeight: 600 }}>@{student.username}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />)}
          </div>
        ) : error ? (
          <div style={{ padding: '24px 22px', fontSize: 13, color: '#DC2626' }}>{error}</div>
        ) : (
          <>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                In-App Activity (all-time)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { label: 'Days Active', value: String(daysActive) },
                  { label: 'Sessions', value: String(loginLogs?.total_sessions ?? 0) },
                  { label: 'Total Time on App', value: fmtActivityTime(loginLogs?.total_time_seconds ?? 0) },
                  { label: 'Total Days Logged', value: String(loginLogs?.total_days ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: C.cardAlt, borderRadius: 10, padding: '10px 14px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {recentDays.length > 0 && (
              <div style={{ padding: '16px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Login Activity — last {recentDays.length} days
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.textMuted }}>
                    <span>Less</span>
                    {[0, 60, 300, 1800].map(t => (
                      <div key={t} style={{ width: 10, height: 10, borderRadius: 2, background: activityCalColor(t > 0 ? t + 1 : 0) }} />
                    ))}
                    <span>More</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {recentDays.map((d: any) => {
                    const timeSec = Number(d.total_time_seconds ?? 0);
                    const tip = timeSec > 0 ? `${d.date}: ${fmtActivityTime(timeSec)}` : d.date;
                    return <div key={d.date} title={tip} style={{ width: 14, height: 14, borderRadius: 3, background: activityCalColor(timeSec), flexShrink: 0 }} />;
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface SummerComparisonTableProps {
  teacherUsername: string;
  examClassOptions: string[];
  examSectionOptions: string[];
}

const SummerComparisonTable: React.FC<SummerComparisonTableProps> = ({ teacherUsername, examSectionOptions }) => {
  const sectionChoices = examSectionOptions.filter(o => o !== 'All');

  const classFilter = '10';
  const [sectionFilter, setSectionFilter] = useState('All');
  const [view, setView] = useState<'summary' | 'students'>('summary');
  const [data, setData] = useState<SummerComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showHours, setShowHours] = useState(false);
  const [hoursMap, setHoursMap] = useState<Record<string, number | null>>({});
  const [hoursLoading, setHoursLoading] = useState(false);
  const [activityStudent, setActivityStudent] = useState<SummerStudentRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = () => setRefreshToken(t => t + 1);

  // Auto-refresh every 4 hours if user hasn't manually refreshed
  useEffect(() => {
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const timer = setInterval(() => setRefreshToken(t => t + 1), FOUR_HOURS);
    return () => clearInterval(timer);
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadSummerComparisonExcel(teacherUsername, classFilter, sectionFilter);
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed to generate the Excel file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSummerComparisonData(teacherUsername, classFilter, 'All', refreshToken > 0)
      .then(d => { if (!cancelled) { setData(d); setLastRefreshed(new Date()); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load comparison data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teacherUsername, classFilter, refreshToken]);

  useEffect(() => {
    if (!showHours || !data) return;
    const usernames = Array.from(new Set(
      data.allStudents.map(s => s.username).filter((u): u is string => !!u && hoursMap[u] === undefined)
    ));
    if (usernames.length === 0) return;

    let cancelled = false;
    setHoursLoading(true);
    const CHUNK_SIZE = 6;
    (async () => {
      const results: Record<string, number | null> = {};
      for (let i = 0; i < usernames.length && !cancelled; i += CHUNK_SIZE) {
        const chunk = usernames.slice(i, i + CHUNK_SIZE);
        const settled = await Promise.allSettled(chunk.map(u => dashboardAPI.getUserLoginLogs(u, 500)));
        settled.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            results[chunk[idx]] = res.value.total_time_seconds;
          } else {
            console.error(`getUserLoginLogs failed for username "${chunk[idx]}":`, res.reason);
            results[chunk[idx]] = null;
          }
        });
      }
      if (!cancelled) {
        setHoursMap(prev => ({ ...prev, ...results }));
        setHoursLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showHours, data]);

  const selectStyle = { padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', minWidth: 90 };
  const thStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#FFFFFF', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.03em' };
  const tdStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: C.text, textAlign: 'center', borderBottom: `1px solid ${C.border}` };

  const classLabel = `Class ${classFilter}`;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 10px -2px ${C.purple}66`,
          }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 3v18h18M7 14l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 800, letterSpacing: '0.01em',
            background: `linear-gradient(90deg, ${C.purple}, ${C.blue})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {classLabel} — Summer Diagnostic
          </span>
        </div>

        <div style={{ display: 'flex', gap: 3, background: C.cardAlt, padding: 4, borderRadius: 99, border: `1.5px solid ${C.border}` }}>
          {([
            { key: 'summary' as const, label: 'Summary', icon: 'M3 13h4v8H3v-8Zm7-6h4v14h-4V7Zm7-4h4v18h-4V3Z' },
            { key: 'students' as const, label: 'Student Data', icon: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h10v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05.97.7 1.97 1.85 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z' },
          ]).map(({ key, label, icon }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 18px', borderRadius: 99, border: 'none',
                  background: active ? `linear-gradient(135deg, ${C.purple}, ${C.blue})` : 'transparent',
                  color: active ? '#FFFFFF' : C.textMuted,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
                  boxShadow: active ? `0 4px 14px -3px ${C.purple}90` : 'none',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                  transition: 'all 0.18s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={icon} /></svg>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', background: C.cardAlt, padding: '6px 12px', borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Section</span>
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={selectStyle}>
              <option value="All">All</option>
              {sectionChoices.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {view === 'students' && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            padding: '8px 14px', borderRadius: 12,
            border: `1.5px solid ${showHours ? C.purple : C.border}`,
            background: showHours ? `linear-gradient(135deg, ${C.purpleSoft}, ${C.card})` : C.cardAlt,
            color: showHours ? C.purple : C.textMuted,
            boxShadow: showHours ? `0 2px 8px -3px ${C.purple}55` : 'none',
            transition: 'all 0.15s',
          }}>
            <input
              type="checkbox"
              checked={showHours}
              onChange={e => setShowHours(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: C.purple, cursor: 'pointer' }}
            />
            ⏱ Show total hours of student
            {showHours && hoursLoading && (
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite`, display: 'inline-block' }} />
                ))}
              </span>
            )}
          </label>
        )}

        <button
          onClick={handleRefresh}
          disabled={loading}
          title="Force refresh data"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 12, border: `1.5px solid ${C.border}`,
            background: C.card, color: C.textMuted,
            fontSize: 12.5, fontWeight: 700, fontFamily: FONT,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"
            style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: loading ? 'transform 0.8s linear' : 'none' }}>
            <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Refresh
        </button>

        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 12, border: 'none',
            background: downloading ? C.purpleSoft : `linear-gradient(135deg, ${C.purple}, ${C.blue})`,
            color: downloading ? C.purple : '#FFFFFF',
            fontSize: 12.5, fontWeight: 700, fontFamily: FONT,
            cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: downloading ? 'none' : `0 3px 10px -2px ${C.purple}66`,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {downloading ? 'Generating…' : 'Download Report'}
        </button>
      </div>
      <style>{`@keyframes dot-pulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        {view === 'summary'
          ? 'April diagnostic vs June re-test · Averages and % Gain are calculated only for students with both scores.'
          : 'April diagnostic vs June re-test · Student-by-student Maths & Science scores. Click a row to view that student\'s activity.'}
        {lastRefreshed && <span style={{ marginLeft: 12 }}>· Last refreshed: {lastRefreshed.toLocaleTimeString()}</span>}
        {downloadError && <span style={{ color: '#DC2626', marginLeft: 8 }}>{downloadError}</span>}
      </div>

      {loading && <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>Loading comparison data…</div>}
      {error && <div style={{ fontSize: 13, color: '#DC2626', padding: '12px 0' }}>{error}</div>}

      {!loading && !error && data && (() => {
        const filteredSections = sectionFilter === 'All' ? data.sections : data.sections.filter(s => s === sectionFilter);
        const filteredBySection: typeof data.bySection = {};
        for (const s of filteredSections) filteredBySection[s] = data.bySection[s];
        const filteredStudents = sectionFilter === 'All' ? data.allStudents : data.allStudents.filter(s => s.section === sectionFilter);
        return (
        filteredSections.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>No matching Maths/Science results found for April or June with the selected filters.</div>
        ) : view === 'summary' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, background: C.purple, textAlign: 'left' }}>Section</th>
                  <th style={{ ...thStyle, background: C.purple }}>Students</th>
                  <th style={{ ...thStyle, background: C.blue }} colSpan={3}>Maths</th>
                  <th style={{ ...thStyle, background: C.purple }} colSpan={3}>Science</th>
                </tr>
                <tr>
                  <th style={{ ...thStyle, background: C.purpleSoft, color: C.purple }} />
                  <th style={{ ...thStyle, background: C.purpleSoft, color: C.purple }} />
                  {['Before', 'After', '% Gain', 'Before', 'After', '% Gain'].map((h, i) => (
                    <th key={i} style={{ ...thStyle, background: C.purpleSoft, color: C.purple }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSections.map(section => {
                  const rows = filteredBySection[section];
                  const maths = subjectStats(rows, 'maths');
                  const science = subjectStats(rows, 'science');
                  return (
                    <tr key={section}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>Sec {section}</td>
                      <td style={tdStyle}>{rows.length}</td>
                      <td style={tdStyle}>{score(maths.avgBefore)}</td>
                      <td style={tdStyle}>{score(maths.avgAfter)}</td>
                      <td style={tdStyle}>{pct(maths.gain)}</td>
                      <td style={tdStyle}>{score(science.avgBefore)}</td>
                      <td style={tdStyle}>{score(science.avgAfter)}</td>
                      <td style={tdStyle}>{pct(science.gain)}</td>
                    </tr>
                  );
                })}
                {(() => {
                  const allMaths = subjectStats(filteredStudents, 'maths');
                  const allScience = subjectStats(filteredStudents, 'science');
                  return (
                    <tr style={{ background: C.purpleSoft, fontWeight: 700 }}>
                      <td style={{ ...tdStyle, textAlign: 'left', borderBottom: 'none' }}>{classLabel.toUpperCase()} — ALL</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{filteredStudents.length}</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{score(allMaths.avgBefore)}</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{score(allMaths.avgAfter)}</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{pct(allMaths.gain)}</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{score(allScience.avgBefore)}</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{score(allScience.avgAfter)}</td>
                      <td style={{ ...tdStyle, borderBottom: 'none' }}>{pct(allScience.gain)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, minWidth: showHours ? 800 : 700 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, background: C.purple }}>S.No</th>
                  <th style={{ ...thStyle, background: C.purple, textAlign: 'left' }}>Section</th>
                  <th style={{ ...thStyle, background: C.purple, textAlign: 'left' }}>Student Name</th>
                  <th style={{ ...thStyle, background: C.blue }} colSpan={3}>Maths</th>
                  <th style={{ ...thStyle, background: C.purple }} colSpan={3}>Science</th>
                  {showHours && <th style={{ ...thStyle, background: C.purple }}>Total Hours</th>}
                </tr>
                <tr>
                  <th style={{ ...thStyle, background: C.purpleSoft, color: C.purple }} />
                  <th style={{ ...thStyle, background: C.purpleSoft, color: C.purple }} />
                  <th style={{ ...thStyle, background: C.purpleSoft, color: C.purple }} />
                  {['Before', 'After', '% Gain', 'Before', 'After', '% Gain'].map((h, i) => (
                    <th key={i} style={{ ...thStyle, background: C.purpleSoft, color: C.purple }}>{h}</th>
                  ))}
                  {showHours && <th style={{ ...thStyle, background: C.purpleSoft, color: C.purple }} />}
                </tr>
              </thead>
              <tbody>
                {(() => { let sNo = 0; return filteredSections.flatMap(section => {
                  const sorted = [...filteredBySection[section]].sort(
                    (a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name)
                  );
                  return sorted.map(s => {
                    sNo += 1;
                    const mathsGain = s.maths.before !== null && s.maths.after !== null && s.maths.before !== 0 ? ((s.maths.after - s.maths.before) / s.maths.before) * 100 : null;
                    const scienceGain = s.science.before !== null && s.science.after !== null && s.science.before !== 0 ? ((s.science.after - s.science.before) / s.science.before) * 100 : null;
                    const hoursSecs = s.username ? hoursMap[s.username] : null;
                    return (
                      <tr
                        key={`${section}-${s.rollNumber}-${s.name}`}
                        onClick={() => setActivityStudent(s)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.purpleSoft; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                      >
                        <td style={tdStyle}>{sNo}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>Sec {section}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{s.name}</td>
                        <td style={tdStyle}>{score(s.maths.before)}</td>
                        <td style={tdStyle}>{score(s.maths.after)}</td>
                        <td style={tdStyle}>{pct(mathsGain)}</td>
                        <td style={tdStyle}>{score(s.science.before)}</td>
                        <td style={tdStyle}>{score(s.science.after)}</td>
                        <td style={tdStyle}>{pct(scienceGain)}</td>
                        {showHours && (
                          <td style={tdStyle}>
                            {!s.username ? '—' : hoursSecs === undefined ? '…' : formatDuration(hoursSecs)}
                          </td>
                        )}
                      </tr>
                    );
                  });
                }); })()}
              </tbody>
            </table>
          </div>
        )
        );
      })()}

      {activityStudent && (
        <StudentActivityModal student={activityStudent} onClose={() => setActivityStudent(null)} />
      )}
    </div>
  );
};

export const CompareMockExams: React.FC<CompareMockExamsProps> = ({
  exams, examClassOptions, examSectionOptions, onFetchExamsForSection,
  compareExamIds, compareResults, compareLoading, onCompare, onExitCompare, teacherUsername,
}) => {
  const [resetKey, setResetKey] = useState(0);
  const [modalCls, setModalCls] = useState('');
  const [modalSec, setModalSec] = useState('');

  if (compareExamIds) {
    return (
      <div>
        <SummerComparisonChart />
        <SummerComparisonTable teacherUsername={teacherUsername} examClassOptions={examClassOptions} examSectionOptions={examSectionOptions} />
        <CompareView
          exams={exams}
          compareExamIds={compareExamIds}
          compareResults={compareResults}
          compareLoading={compareLoading}
          compareClass={modalCls}
          compareSection={modalSec}
          onExit={() => { onExitCompare(); setResetKey(k => k + 1); }}
        />
      </div>
    );
  }

  return (
    <div>
      <SummerComparisonChart />
      <SummerComparisonTable teacherUsername={teacherUsername} examClassOptions={examClassOptions} examSectionOptions={examSectionOptions} />
      <CompareModal
        key={resetKey}
        classOptions={examClassOptions}
        sectionOptions={() => examSectionOptions}
        onFetchExams={onFetchExamsForSection}
        onConfirm={(id1, id2, cls, sec) => { setModalCls(cls); setModalSec(sec); onCompare(id1, id2, cls, sec); }}
        onClose={() => setResetKey(k => k + 1)}
      />
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

const MockExamResults: React.FC<MockExamResultsProps> = ({
  exams, loading,
  examClassOptions, examSectionOptions, examClassFilter, examSectionFilter, onExamFiltersChange,
  selectedHomeworkId, onSelectExam,
  results, resultsLoading,
  onFetchExamsForSection,
}) => {
  const [classFilter, setCls]         = useState('All');
  const [secFilter, setSec]           = useState('All');
  const [dateFilter, setDateFilter]   = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => { setCls('All'); setSec('All'); }, [selectedHomeworkId]);
  useEffect(() => { setSec('All'); }, [classFilter]);
  useEffect(() => { setSelectedMonth(null); setDateFilter(''); }, [examClassFilter, examSectionFilter]);

  if (loading) return <Dots />;

  // Detail view: single exam results
  if (selectedHomeworkId) {
    const selExam = exams.find(e => e.homework_id === selectedHomeworkId);
    const ranked = results ? [...results].sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 })) : null;
    const classOpts = ranked ? ['All', ...Array.from(new Set(ranked.map(r => r.class_name || 'Unassigned'))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))] : ['All'];
    const secOpts   = ranked ? ['All', ...Array.from(new Set(ranked.filter(r => classFilter === 'All' || (r.class_name || 'Unassigned') === classFilter).map(r => r.section_name || 'Unassigned'))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))] : ['All'];
    const visible   = ranked ? ranked.filter(r => (classFilter === 'All' || (r.class_name || 'Unassigned') === classFilter) && (secFilter === 'All' || (r.section_name || 'Unassigned') === secFilter)) : [];
    const avg = visible.length ? Math.round(visible.reduce((s, r) => s + Number(r.score ?? 0), 0) / visible.length * 10) / 10 : null;

    return (
      <div style={{ fontFamily: FONT }}>
        <BackBtn onClick={() => onSelectExam(0)} label="Back to Mock Exams" />
        {resultsLoading ? <Dots /> : (
          <>
            {ranked && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Submissions', value: visible.length, color: C.text },
                  { label: 'Class Avg', value: avg != null ? `${avg}%` : '-', color: avg != null ? scoreColor(avg) : C.text },
                  { label: 'Passed', value: visible.filter(r => r.score >= 40).length, color: C.green },
                  { label: 'Needs Review', value: visible.filter(r => r.score < 40).length, color: C.red },
                ].map(c => (
                  <div key={c.label} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 14, textAlign: 'center', boxShadow: C.shadow }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            )}
            {!ranked || ranked.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: 14 }}>No results found for this mock exam.</div>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: C.cardAlt, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selExam?.title ?? 'Mock Exam Results'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>{visible.length}{classFilter !== 'All' || secFilter !== 'All' ? `/${ranked.length}` : ''} students</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class</span>
                      <select value={classFilter} onChange={e => setCls(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, cursor: 'pointer' }}>
                        {classOpts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</span>
                      <select value={secFilter} onChange={e => setSec(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, cursor: 'pointer' }}>
                        {secOpts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {visible.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: 14 }}>No students found for this filter.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
                          {['Rank', 'Student', 'Roll No.', 'Class', 'Score', 'Correct', 'Incorrect', 'Unanswered', 'Time', 'Submitted'].map(h => (
                            <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r, i) => (
                          <tr key={`${r.student_id}-${r.submitted_at ?? i}`} style={{ borderBottom: i < visible.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                            <td style={{ padding: '11px 14px', fontWeight: 700, color: C.text }}>#{r.rank}</td>
                            <td style={{ padding: '11px 14px' }}>
                              <div style={{ fontWeight: 600, color: C.text }}>{r.student_name || r.username || `#${r.student_id}`}</div>
                              {r.username && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{r.username}</div>}
                            </td>
                            <td style={{ padding: '11px 14px', color: C.textSecondary }}>{r.roll_number ?? '-'}</td>
                            <td style={{ padding: '11px 14px', color: C.textSecondary }}>{[r.class_name, r.section_name].filter(Boolean).join(' / ') || '-'}</td>
                            <td style={{ padding: '11px 14px' }}><span style={{ fontWeight: 700, color: scoreColor(Number(r.score)), fontSize: 14 }}>{r.score}%</span></td>
                            <td style={{ padding: '11px 14px', color: C.green, fontWeight: 700 }}>{r.correct}/{r.total}</td>
                            <td style={{ padding: '11px 14px', color: C.red, fontWeight: 700 }}>{r.incorrect}</td>
                            <td style={{ padding: '11px 14px', color: C.amber, fontWeight: 700 }}>{r.unanswered}</td>
                            <td style={{ padding: '11px 14px', color: C.textSecondary, whiteSpace: 'nowrap' }}>{fmtDur(r.time_spent_seconds)}</td>
                            <td style={{ padding: '11px 14px', color: C.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(r.submitted_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // List view — month picker
  if (!selectedMonth) {
    const monthMap = new Map<string, MockExamItem[]>();
    for (const exam of exams) {
      const key = exam.date_assigned ? exam.date_assigned.slice(0, 7) : 'unscheduled';
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(exam);
    }
    const months = Array.from(monthMap.keys()).sort();

    return (
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow, fontFamily: FONT }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: C.cardAlt, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Mock Exams</span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>{exams.length}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class</span>
              <select value={examClassFilter} onChange={e => onExamFiltersChange(e.target.value, 'All')} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, cursor: 'pointer', minWidth: 110 }}>
                {examClassOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</span>
              <select value={examSectionFilter} onChange={e => onExamFiltersChange(examClassFilter, e.target.value)} disabled={examClassFilter === 'All'} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: examClassFilter === 'All' ? C.cardAlt : C.card, color: examClassFilter === 'All' ? C.textMuted : C.text, fontSize: 13, fontFamily: FONT, cursor: examClassFilter === 'All' ? 'not-allowed' : 'pointer', minWidth: 110 }}>
                {examSectionOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        {months.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: 14 }}>No mock exams found.</div>
        ) : (
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
            {months.map(monthKey => {
              const monthExams = monthMap.get(monthKey)!;
              const isUnscheduled = monthKey === 'unscheduled';
              const monthDate = isUnscheduled ? null : new Date(monthKey + '-01T00:00:00');
              const monthName = monthDate ? monthDate.toLocaleDateString('en-GB', { month: 'long' }) : 'Unscheduled';
              const yearLabel = monthDate ? monthDate.getFullYear() : '';
              const totalSubs = monthExams.reduce((s, e) => s + (e.total_submissions || 0), 0);
              const scoredExams = monthExams.filter(e => e.average_score != null);
              const avgScore = scoredExams.length
                ? scoredExams.reduce((s, e) => s + Number(e.average_score), 0) / scoredExams.length
                : null;
              const palette = [
                { grad: 'linear-gradient(135deg, #7C3AED, #A78BFA)', soft: C.purpleSoft, text: C.purpleDark },
                { grad: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', soft: 'rgba(14,165,233,0.10)', text: '#0369A1' },
                { grad: 'linear-gradient(135deg, #10B981, #34D399)', soft: C.greenSoft, text: '#047857' },
                { grad: 'linear-gradient(135deg, #F59E0B, #FBBF24)', soft: C.amberSoft, text: '#B45309' },
              ];
              const colors = isUnscheduled ? { grad: 'linear-gradient(135deg, #94A3B8, #CBD5E1)', soft: C.cardAlt, text: C.textSecondary } : palette[months.indexOf(monthKey) % palette.length];
              return (
                <button
                  key={monthKey}
                  onClick={() => setSelectedMonth(monthKey)}
                  style={{
                    textAlign: 'left', borderRadius: 16, border: 'none', cursor: 'pointer',
                    fontFamily: FONT, overflow: 'hidden', background: C.card,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'; }}
                >
                  <div style={{ background: colors.grad, padding: '20px 18px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.14)' }} />
                    <div style={{ position: 'absolute', bottom: -30, right: 10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
                    <div style={{ fontSize: 22, marginBottom: 6 }}>📅</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{monthName}</div>
                    {yearLabel && <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{yearLabel}</div>}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>Exams</span>
                      <span style={{ padding: '2px 9px', borderRadius: 99, background: colors.soft, color: colors.text, fontSize: 12, fontWeight: 700 }}>{monthExams.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>Submissions</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{totalSubs}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>Avg Score</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: avgScore != null ? scoreColor(avgScore) : C.textMuted }}>
                        {avgScore != null ? `${avgScore.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // List view — exams within the selected month
  const monthLabel = selectedMonth === 'unscheduled'
    ? 'Unscheduled'
    : new Date(selectedMonth + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthExams = exams.filter(e => (e.date_assigned ? e.date_assigned.slice(0, 7) : 'unscheduled') === selectedMonth);

  return (
    <>
      <BackBtn onClick={() => { setSelectedMonth(null); setDateFilter(''); }} label="Back to Months" />
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow, fontFamily: FONT }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: C.cardAlt, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{monthLabel}</span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>{monthExams.length}</span>

          {/* Date filter — centred */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</span>
              {dateFilter && (
                <button
                  onClick={() => setDateFilter(shiftDate(dateFilter, -1))}
                  title="Previous day"
                  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.textSecondary, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                >‹</button>
              )}
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${dateFilter ? C.purple : C.border}`, background: C.card, color: dateFilter ? C.text : C.textMuted, fontSize: 13, fontFamily: FONT, cursor: 'pointer', minWidth: 140, outline: 'none' }}
              />
              {dateFilter && (
                <>
                  <button
                    onClick={() => setDateFilter(shiftDate(dateFilter, 1))}
                    title="Next day"
                    style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.textSecondary, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                  >›</button>
                  <button
                    onClick={() => setDateFilter('')}
                    title="Clear date"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, lineHeight: 1, padding: 0 }}
                  >×</button>
                </>
              )}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class</span>
              <select value={examClassFilter} onChange={e => onExamFiltersChange(e.target.value, 'All')} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, cursor: 'pointer', minWidth: 110 }}>
                {examClassOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</span>
              <select value={examSectionFilter} onChange={e => onExamFiltersChange(examClassFilter, e.target.value)} disabled={examClassFilter === 'All'} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: examClassFilter === 'All' ? C.cardAlt : C.card, color: examClassFilter === 'All' ? C.textMuted : C.text, fontSize: 13, fontFamily: FONT, cursor: examClassFilter === 'All' ? 'not-allowed' : 'pointer', minWidth: 110 }}>
                {examSectionOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        {(() => {
          const visibleExams = dateFilter
            ? monthExams.filter(e => e.date_assigned && e.date_assigned.slice(0, 10) === dateFilter)
            : monthExams;
          return visibleExams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: 14 }}>
            {dateFilter ? `No mock exams assigned on ${new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.` : 'No mock exams found.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
                {['Title', 'Code', 'Chapters', 'Submissions', 'Avg Score'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleExams.map((exam, i) => (
                <tr
                  key={exam.homework_id}
                  onClick={() => onSelectExam(exam.homework_id)}
                  style={{ borderBottom: i < visibleExams.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.purpleSoft)}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : C.cardAlt)}
                >
                  <td style={{ padding: '11px 16px', fontWeight: 600, color: C.text }}>{exam.title ?? exam.homework_code ?? `Mock Exam #${exam.homework_id}`}</td>
                  <td style={{ padding: '11px 16px', color: C.textSecondary }}>{exam.homework_code ?? '-'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    {!exam.chapters || exam.chapters.length === 0 ? (
                      <span style={{ color: C.textMuted, fontSize: 12 }}>-</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {exam.chapters.map(ch => (
                          <span key={ch} style={{ fontSize: 11, fontWeight: 600, color: C.purple, background: C.purpleSoft, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                            {formatChapter(ch)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: C.purple }}>{exam.total_submissions}</td>
                  <td style={{ padding: '11px 16px' }}>
                    {exam.average_score == null
                      ? <span style={{ color: C.textMuted, fontSize: 12 }}>-</span>
                      : <span style={{ fontWeight: 700, color: scoreColor(Number(exam.average_score)), fontSize: 14 }}>{Number(exam.average_score).toFixed(1)}%</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
        })()}
      </div>
    </>
  );
};

export default MockExamResults;
