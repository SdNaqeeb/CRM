import React, { useEffect, useRef, useState } from 'react';
import { BarChart, GroupedBarChart, LineChart } from './AnalyticsCharts';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import { StudentEngagementSummary, OrcaLexSchoolSummary, EngagementStatus, TestPrepSchoolResponse, TestPrepItem } from '../types';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

// ─── Helper: simulate an 8-week trend from current snapshot ───────────────────
function simulateWeeklyTrend(
  currentWeekValue: number,
  totalValue: number,
  weeks: number = 8
): { label: string; value: number }[] {
  // Derive a weekly average from total_sessions assuming ~12 weeks of history
  const estimatedWeeklyAvg = totalValue / 12;
  const points: { label: string; value: number }[] = [];

  for (let i = weeks; i >= 1; i--) {
    let value: number;
    if (i === 1) {
      // Most recent week uses actual data
      value = currentWeekValue;
    } else {
      // Older weeks: interpolate between the estimated average and current week
      const progress = (weeks - i) / (weeks - 1);
      const base = estimatedWeeklyAvg + (currentWeekValue - estimatedWeeklyAvg) * progress;
      // Add slight deterministic variance so the line isn't perfectly straight
      const variance = 1 + 0.08 * Math.sin(i * 2.5);
      value = Math.max(0, Math.round(base * variance));
    }
    points.push({ label: `Week ${weeks - i + 1}`, value });
  }
  return points;
}

// ─── Test helpers ────────────────────────────────────────────────────────────

function getTestPrepScore(item: TestPrepItem): number {
  return Number(
    item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? item.analysis?.prediction?.score_pct ?? 0
  );
}

function getTestPrepTimeSpentSec(item: TestPrepItem): number | null {
  const candidates = [
    item.graph_data?.time_spent_sec,
    item.analysis?.analysis?.time_spent_sec,
    item.analysis?.prediction?.time_spent_sec,
    item.prediction?.time_spent_sec,
  ];
  for (const c of candidates) {
    const v = Number(c);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

function getTestPrepClass(item: TestPrepItem): string {
  return String(item.class_name ?? item.graph_data?.class_num ?? item.graph_data?.class ?? 'Unknown');
}

function getTestPrepSection(item: TestPrepItem): string {
  return String(item.section_name ?? item.graph_data?.section_name ?? item.graph_data?.section ?? 'Unknown');
}

function getTestPrepSubject(item: TestPrepItem): string {
  return String(item.graph_data?.subject ?? item.name ?? 'Unknown').toUpperCase();
}

interface ElproStudentSummary {
  username: string;
  className: string;
  section: string;
  subject: string;
  firstScore: number;
  bestScore: number;
  improvement: number;
  firstTime: number | null;
  bestTime: number | null;
  attempts: number;
}

function buildElproSummaries(items: TestPrepItem[]): ElproStudentSummary[] {
  const grouped = new Map<string, {
    className: string;
    section: string;
    subject: string;
    attempts: { score: number; time: number | null; date: number }[];
  }>();

  items.forEach((item) => {
    const subject = getTestPrepSubject(item);
    const key = `${item.username}|${subject}`;
    if (!grouped.has(key)) {
      grouped.set(key, { className: getTestPrepClass(item), section: getTestPrepSection(item), subject, attempts: [] });
    }
    grouped.get(key)!.attempts.push({
      score: getTestPrepScore(item),
      time: getTestPrepTimeSpentSec(item),
      date: new Date(item.created_at).getTime(),
    });
  });

  const summaries: ElproStudentSummary[] = [];
  grouped.forEach((record, key) => {
    record.attempts.sort((a, b) => a.date - b.date);
    const first = record.attempts[0];
    const bestScoreAttempt = record.attempts.reduce((b, a) => (a.score > b.score ? a : b), first);
    const validTimes = record.attempts.map((a) => a.time).filter((t): t is number => t !== null);
    const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;
    summaries.push({
      username: key.split('|')[0],
      className: record.className,
      section: record.section,
      subject: record.subject,
      firstScore: first.score,
      bestScore: bestScoreAttempt.score,
      improvement: bestScoreAttempt.score - first.score,
      firstTime: first.time,
      bestTime,
      attempts: record.attempts.length,
    });
  });
  return summaries;
}

function avg(values: number[]): number {
  return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : 0;
}

function toLabel(subject: string): string {
  return subject.charAt(0) + subject.slice(1).toLowerCase();
}

function buildSubjectScoreData(summaries: ElproStudentSummary[]) {
  const map = new Map<string, { first: number[]; best: number[] }>();
  summaries.forEach((s) => {
    if (s.subject === 'UNKNOWN') return;
    if (!map.has(s.subject)) map.set(s.subject, { first: [], best: [] });
    map.get(s.subject)!.first.push(s.firstScore);
    map.get(s.subject)!.best.push(s.bestScore);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subject, d]) => ({ label: toLabel(subject), value1: avg(d.first), value2: avg(d.best) }));
}

function buildSubjectTimeData(summaries: ElproStudentSummary[]) {
  const map = new Map<string, { first: number[]; best: number[] }>();
  summaries.forEach((s) => {
    if (s.subject === 'UNKNOWN' || s.firstTime === null || s.bestTime === null) return;
    if (!map.has(s.subject)) map.set(s.subject, { first: [], best: [] });
    map.get(s.subject)!.first.push(s.firstTime!);
    map.get(s.subject)!.best.push(s.bestTime!);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subject, d]) => ({ label: toLabel(subject), value1: avg(d.first), value2: avg(d.best) }));
}

function buildStudentScoreData(summaries: ElproStudentSummary[], username: string) {
  return summaries
    .filter((s) => s.username === username && s.subject !== 'UNKNOWN')
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .map((s) => ({ label: toLabel(s.subject), value1: s.firstScore, value2: s.bestScore }));
}

function buildStudentTimeData(summaries: ElproStudentSummary[], username: string) {
  return summaries
    .filter((s) => s.username === username && s.subject !== 'UNKNOWN' && s.firstTime !== null && s.bestTime !== null)
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .map((s) => ({ label: toLabel(s.subject), value1: s.firstTime as number, value2: s.bestTime as number }));
}

// ─── Shared section wrapper (dark theme) ─────────────────────────────────────
const SectionWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT }}>
    <h2
      style={{
        fontFamily: FONT_SERIF,
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 14,
        color: '#F1F5F9',
      }}
    >
    
    </h2>
    {children}
  </div>
);

const ChartGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: 14,
    }}
  >
    {children}
  </div>
);

const FullWidthRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ gridColumn: '1 / -1', marginBottom: 10 }}>{children}</div>
);

// ─── Loading skeleton component ──────────────────────────────────────────────
const ChartLoadingSkeleton: React.FC<{ height?: number }> = ({ height = 240 }) => (
  <div
    style={{
      background: '#111827',
      borderRadius: 14,
      border: '1px solid #1E293B',
      padding: '16px 18px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        height: 20,
        background: '#1E293B',
        borderRadius: 4,
        marginBottom: 16,
        width: '60%',
      }}
    />
    <div
      style={{
        height: height - 60,
        background: '#1E293B',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
    <style>
      {`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}
    </style>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. TeacherAnalytics
// ─────────────────────────────────────────────────────────────────────────────
interface TeacherAnalyticsProps {
  students: StudentEngagementSummary[];
}

export const TeacherAnalytics: React.FC<TeacherAnalyticsProps> = ({ students }) => {
  // Weekly engagement trend (simulated 8 weeks)
  const totalSessionsAll = students.reduce((sum, s) => sum + s.total_sessions, 0);
  const sessionsThisWeekAll = students.reduce((sum, s) => sum + s.sessions_this_week, 0);
  const trendData = simulateWeeklyTrend(sessionsThisWeekAll, totalSessionsAll);

  // Determine trend direction
  const lastVal = trendData.length > 0 ? trendData[trendData.length - 1].value : 0;
  const prevVal = trendData.length > 1 ? trendData[trendData.length - 2].value : lastVal;
  const trendLabel = lastVal > prevVal ? 'Improving' : lastVal < prevVal ? 'Declining' : 'Stable';
  const trendColor = lastVal > prevVal ? '#10B981' : lastVal < prevVal ? '#F43F5E' : '#F59E0B';

  // Sessions by class
  const gradeSessionMap: Record<string, { total: number; count: number }> = {};
  students.forEach((s) => {
    const grade = s.grade || 'Unknown';
    if (!gradeSessionMap[grade]) gradeSessionMap[grade] = { total: 0, count: 0 };
    gradeSessionMap[grade].total += s.sessions_this_week;
    gradeSessionMap[grade].count++;
  });
  const sessionsByClass = Object.entries(gradeSessionMap)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([grade, d]) => ({ label: `Class ${grade}`, value: Math.round(d.total / d.count) }));

  return (
    <SectionWrapper>
      <ChartGrid>
        <BarChart title="Avg Sessions per Class" data={sessionsByClass} />
        <LineChart title={`Engagement Trend `} data={trendData} color={trendColor} />
      </ChartGrid>
    </SectionWrapper>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. SchoolAnalytics
// ─────────────────────────────────────────────────────────────────────────────
interface SchoolAnalyticsProps {
  students: StudentEngagementSummary[];
  trend?: 'up' | 'down' | 'stable';
}

export const SchoolAnalytics: React.FC<SchoolAnalyticsProps> = ({ students, trend }) => {
  const { user } = useAuth();
  const schoolCode = user?.school_code;
  const lastSchoolPrepRequestRef = useRef<string | null>(null);
  const [schoolPrepData, setSchoolPrepData] = useState<TestPrepSchoolResponse | null>(null);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [prepError, setPrepError] = useState('');
  // Avg chart filters (top 2 graphs)
  const [avgClass, setAvgClass] = useState<string>('All');
  const [avgSection, setAvgSection] = useState<string>('All');

  // Individual student filters (bottom 2 graphs)
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  // Fetch school data only when schoolCode changes
  useEffect(() => {
    if (!schoolCode) return;
    if (lastSchoolPrepRequestRef.current === schoolCode) return;
    lastSchoolPrepRequestRef.current = schoolCode;

    const fetchSchoolPrepData = async () => {
      try {
        setSchoolLoading(true);
        setPrepError('');
        const schoolResponse = await dashboardAPI.getTestPrepBySchoolCode(schoolCode, 500);
        setSchoolPrepData(schoolResponse);
      } catch (err) {
        console.error('Failed to load test prep analytics:', err);
        setPrepError('Unable to load test prep analytics at this time.');
        setSchoolPrepData(null);
        lastSchoolPrepRequestRef.current = null;
      } finally {
        setSchoolLoading(false);
      }
    };

    fetchSchoolPrepData();
  }, [schoolCode]);

  const summaries = React.useMemo(
    () => (schoolPrepData?.items ? buildElproSummaries(schoolPrepData.items) : []),
    [schoolPrepData]
  );

  // Shared class list (used by both filter sets)
  const allClassOptions = React.useMemo(() => {
    const classes = new Set(summaries.map((s) => s.className).filter((c) => c !== 'Unknown'));
    return ['All', ...Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [summaries]);

  // Avg chart filter options
  const avgSectionOptions = React.useMemo(() => {
    const base = avgClass === 'All' ? summaries : summaries.filter((s) => s.className === avgClass);
    const sections = new Set(base.map((s) => s.section).filter((s) => s !== 'Unknown'));
    return ['All', ...Array.from(sections).sort()];
  }, [summaries, avgClass]);

  // Individual student filter options
  const classOptions = allClassOptions;
  const sectionOptions = React.useMemo(() => {
    const base = selectedClass === 'All' ? summaries : summaries.filter((s) => s.className === selectedClass);
    const sections = new Set(base.map((s) => s.section).filter((s) => s !== 'Unknown'));
    return ['All', ...Array.from(sections).sort()];
  }, [summaries, selectedClass]);

  // Reset avg section when avg class changes
  useEffect(() => { setAvgSection('All'); }, [avgClass]);

  // Reset student section when student class changes
  useEffect(() => { setSelectedSection('All'); }, [selectedClass]);

  // Avg chart data: filtered by avgClass + avgSection (independent)
  const avgFilteredSummaries = React.useMemo(() => {
    let s = summaries;
    if (avgClass !== 'All') s = s.filter((x) => x.className === avgClass);
    if (avgSection !== 'All') s = s.filter((x) => x.section === avgSection);
    return s;
  }, [summaries, avgClass, avgSection]);

  // Student dropdown scope: filtered by selectedClass + selectedSection
  const filteredSummaries = React.useMemo(() => {
    let s = summaries;
    if (selectedClass !== 'All') s = s.filter((x) => x.className === selectedClass);
    if (selectedSection !== 'All') s = s.filter((x) => x.section === selectedSection);
    return s;
  }, [summaries, selectedClass, selectedSection]);

  const studentOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const opts: { label: string; value: string }[] = [];
    filteredSummaries.forEach((s) => {
      if (!seen.has(s.username)) {
        seen.add(s.username);
        const item = schoolPrepData?.items.find((i) => i.username === s.username);
        opts.push({ label: item?.student_name || s.username, value: s.username });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredSummaries, schoolPrepData]);

  // Auto-select first student when options change
  useEffect(() => {
    if (studentOptions.length && !studentOptions.find((o) => o.value === selectedStudent)) {
      setSelectedStudent(studentOptions[0].value);
    }
  }, [studentOptions, selectedStudent]);

  const subjectScoreData  = React.useMemo(() => buildSubjectScoreData(avgFilteredSummaries), [avgFilteredSummaries]);
  const subjectTimeData   = React.useMemo(() => buildSubjectTimeData(avgFilteredSummaries),  [avgFilteredSummaries]);
  const studentScoreData      = React.useMemo(() => buildStudentScoreData(summaries, selectedStudent),  [summaries, selectedStudent]);
  const studentTimeData       = React.useMemo(() => buildStudentTimeData(summaries, selectedStudent),   [summaries, selectedStudent]);
  const selectedStudentName   = studentOptions.find((o) => o.value === selectedStudent)?.label ?? '';

  return (
    <SectionWrapper>
      <FullWidthRow>
        <div
          style={{
            border: '1px solid #1E293B',
            borderRadius: 16,
            padding: 24,
            marginTop: 24,
            background: '#111827',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <svg width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#F1F5F9', fontFamily: FONT_SERIF }}>
              Test Prep Analysis
            </h3>
          </div>

          {prepError ? (
            <div style={{ color: '#F43F5E', fontSize: 14 }}>{prepError}</div>
          ) : schoolLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => <ChartLoadingSkeleton key={i} />)}
            </div>
          ) : (
            <>
              {/* Avg chart filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Class', value: avgClass, onChange: setAvgClass, options: allClassOptions, fmt: (c: string) => c === 'All' ? 'All Classes' : `Class ${c}` },
                  { label: 'Section', value: avgSection, onChange: setAvgSection, options: avgSectionOptions, fmt: (s: string) => s === 'All' ? 'All Sections' : `Section ${s}` },
                ].map(({ label, value, onChange, options, fmt }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#94A3B8' }}>{label}</span>
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: 14 }}
                    >
                      {options.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Avg charts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, marginBottom: 28 }}>
                <GroupedBarChart
                  title="Avg 1st Test vs Best Score by Subject"
                  data={subjectScoreData}
                  legend1="Avg 1st Test Score (%)"
                  legend2="Avg Best Score (%)"
                  color1="#93C5FD"
                  color2="#1E3A5F"
                   
                />
                <GroupedBarChart
                  title="Avg 1st Test vs Best Time by Subject (sec)"
                  data={subjectTimeData}
                  legend1="Avg 1st Test Time (sec)"
                  legend2="Avg Best Time (sec)"
                  color1="#f97316"
                  color2="#EAB308"
                   
                />
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid #1E293B', marginBottom: 20 }} />

              {/* 3 filters above student charts */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Class', value: selectedClass, onChange: (v: string) => setSelectedClass(v), options: classOptions, fmt: (c: string) => c === 'All' ? 'All Classes' : `Class ${c}` },
                  { label: 'Section', value: selectedSection, onChange: (v: string) => setSelectedSection(v), options: sectionOptions, fmt: (s: string) => s === 'All' ? 'All Sections' : `Section ${s}` },
                ].map(({ label, value, onChange, options, fmt }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#94A3B8' }}>{label}</span>
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: 14 }}
                    >
                      {options.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#94A3B8' }}>Student</span>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: 14, maxWidth: 220 }}
                  >
                    {studentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Per-student charts */}
              {selectedStudent && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
                  <GroupedBarChart
                    title={`Score: 1st Test vs Best Score — ${selectedStudentName}`}
                    data={studentScoreData}
                    legend1="1st Test Score (%)"
                    legend2="Best Score (%)"
                    color1="#3b82f6"
                    color2="#4CAF50"
                     
                  />
                  <GroupedBarChart
                    title={`Speed: 1st Test vs Best Time — ${selectedStudentName}`}
                    data={studentTimeData}
                    legend1="1st Test Time (sec)"
                    legend2="Best Time (sec)"
                    color1="#f97316"
                    color2="#EAB308"
                     
                  />
                </div>
              )}
            </>
          )}
        </div>
      </FullWidthRow>
    </SectionWrapper>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Donut Chart for a single school (dark theme)
// ─────────────────────────────────────────────────────────────────────────────

const DonutChart: React.FC<{
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
  size?: number;
}> = ({ segments, centerLabel, centerSub, size = 160 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="60" fill="none" stroke="#1E293B" strokeWidth="20" />
        <text x="80" y="76" textAnchor="middle" fontSize="28" fontWeight="800" fill="#94A3B8" fontFamily={FONT_SERIF}>0%</text>
        <text x="80" y="96" textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8" letterSpacing="0.08em">{centerSub}</text>
      </svg>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      {/* Background ring */}
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#1E293B" strokeWidth="20" />

      {/* Segments */}
      {segments.map((seg, i) => {
        if (seg.value === 0) return null;
        const segLen = (seg.value / total) * circumference;
        const offset = circumference - accumulated + circumference * 0.25; // start from top
        accumulated += segLen;
        return (
          <circle
            key={i}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="20"
            strokeDasharray={`${segLen} ${circumference - segLen}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{
              animation: `fade-in-up 0.5s ease ${i * 0.08}s both`,
            }}
          />
        );
      })}

      {/* Center text */}
      <text
        x="80"
        y="76"
        textAnchor="middle"
        fontSize="28"
        fontWeight="800"
        fill="#F1F5F9"
        fontFamily={FONT_SERIF}
      >
        {centerLabel}
      </text>
      <text
        x="80"
        y="96"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#94A3B8"
        letterSpacing="0.08em"
      >
        {centerSub}
      </text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// School-wise Donut Grid (dark theme)
// ─────────────────────────────────────────────────────────────────────────────

const SchoolWiseDonutGrid: React.FC<{ schools: OrcaLexSchoolSummary[] }> = ({ schools }) => {
  return (
    <div style={{ marginBottom: 24, fontFamily: FONT }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <svg width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 21H3V3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 9l-5 5-2-2-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: '#F1F5F9',
            fontFamily: FONT_SERIF,
          }}
        >
          School-wise Analytics
        </h3>
        <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>
          Engagement breakdown per school
        </span>
      </div>

      {/* Grid of school cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 16,
        }}
      >
        {schools.map((school) => {
          const active = school.active_this_week;
          const atRisk = school.at_risk_count;
          const inactive = school.inactive_count;
          const other = Math.max(0, school.total_students - active - atRisk - inactive);
          const total = Math.max(school.total_students, 1);
          const engagedPct = Math.round((active / total) * 100);

          const segments = [
            { label: 'Active', value: active, color: '#059669' },
            { label: 'At-Risk', value: atRisk, color: '#d97706' },
            { label: 'Inactive', value: inactive, color: '#e11d48' },
            { label: 'Other', value: other, color: '#94A3B8' },
          ];

          return (
            <div
              key={school.school_id}
              style={{
                background: '#111827',
                borderRadius: 16,
                border: '1px solid #1E293B',
                padding: '20px 24px',
                transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
                e.currentTarget.style.borderColor = '#334155';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#1E293B';
              }}
            >
              {/* School name & subtitle */}
              <h4
                style={{
                  margin: '0 0 4px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#F1F5F9',
                  fontFamily: FONT,
                }}
              >
                {school.school_name}
              </h4>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 13,
                  color: '#94A3B8',
                  fontWeight: 500,
                }}
              >
                {school.total_students} students &middot;  {school.total_sessions_this_week} sessions/wk
              </p>

              {/* Donut + Legend row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* Donut */}
                <div style={{ flexShrink: 0 }}>
                  <DonutChart
                    segments={segments}
                    centerLabel={`${engagedPct}%`}
                    centerSub="ENGAGED"
                  />
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                  {segments.map((seg) => {
                    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
                    return (
                      <div
                        key={seg.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: seg.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            color: '#94A3B8',
                            fontWeight: 500,
                            minWidth: 70,
                          }}
                        >
                          {seg.label}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#F1F5F9',
                            fontFamily: FONT_SERIF,
                          }}
                        >
                          {seg.value}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: '#94A3B8',
                            fontWeight: 500,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. AdminAnalytics
// ─────────────────────────────────────────────────────────────────────────────
interface AdminAnalyticsProps {
  schools: OrcaLexSchoolSummary[];
  allStudents?: StudentEngagementSummary[];
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ schools }) => {
  return (
    <div style={{ fontFamily: FONT }}>
      <SchoolWiseDonutGrid schools={schools} />
    </div>
  );
};
