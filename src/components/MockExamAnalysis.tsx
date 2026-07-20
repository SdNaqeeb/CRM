import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, LabelList,
  ScatterChart, Scatter,
} from 'recharts';
import { MockExamItem, MockExamResultItem, examAPI } from '../services/api';
import { StudentEngagementSummary } from '../types';
import {
  computeProgrammeKPIs,
  computeSubjectBreakdown,
  computeExamSummaryStats,
  computeScoreBands,
  computeSectionAverages,
  computeCrossExamScores,
  computeSectionSubjectAverages,
  computeTimeScoreData,
  flagFastPerfect,
  flagRushedAbandoned,
  computeNeedsReview,
  computeStudentsAppeared,
  computeNeverAppeared,
  inferSubject,
  fmtPct,
  fmtTimeMins,
} from '../utils/mockExamAnalytics';

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
const FONT_SERIF = '"Source Serif 4", Georgia, serif';

const C = {
  card: '#FFFFFF', cardAlt: '#F5F3FF', border: '#E2E8F0',
  text: '#0F172A', textSecondary: '#475569', textMuted: '#64748B',
  purple: '#7C3AED', purpleDark: '#6D28D9', purpleSoft: 'rgba(124,58,237,0.10)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B', amberSoft: 'rgba(245,158,11,0.12)',
  red: '#F43F5E', redSoft: 'rgba(244,63,94,0.12)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.10)',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
};

const SUBJECT_COLOR: Record<string, { text: string; bg: string; bar: string }> = {
  Maths:   { text: C.purple, bg: C.purpleSoft, bar: C.purple },
  Science: { text: C.green,  bg: C.greenSoft,  bar: C.green  },
  Physics: { text: C.blue,   bg: C.blueSoft,   bar: C.blue   },
};

const BAND_COLORS = ['#10B981', '#34D399', '#F59E0B', '#FB923C', '#F43F5E'];

function scoreColor(pct: number) {
  if (pct >= 70) return C.green;
  if (pct >= 50) return C.amber;
  return C.red;
}

function Loader() {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '64px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%', background: C.purple,
          animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite`,
        }} />
      ))}
    </div>
  );
}

interface Props {
  exams: MockExamItem[];
  loading: boolean;
  selectedExamId: number | null;
  onSelectExam: (id: number | null) => void;
  examResults: MockExamResultItem[] | null;
  resultsLoading: boolean;
  roster?: StudentEngagementSummary[];
  onRefreshExams?: () => void;
}

const MockExamAnalysis: React.FC<Props> = ({
  exams, loading, selectedExamId, onSelectExam, examResults, resultsLoading, roster, onRefreshExams,
}) => {
  const [neverAppearedClassFilter, setNeverAppearedClassFilter] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [compareExamId, setCompareExamId]     = useState<number | null>(null);
  const [compareResults, setCompareResults]   = useState<MockExamResultItem[] | null>(null);
  const [compareLoading, setCompareLoading]   = useState(false);
  const [modalOpen, setModalOpen]             = useState(false);
  const [dateFrom, setDateFrom]               = useState('');
  const [dateTo, setDateTo]                   = useState('');
  const [subjectFilter, setSubjectFilter]     = useState('');

  // Reset compare whenever primary exam changes
  useEffect(() => {
    setCompareExamId(null);
    setCompareResults(null);
  }, [selectedExamId]);

  useEffect(() => {
    if (!compareExamId) { setCompareResults(null); return; }
    setCompareLoading(true);
    examAPI.getMockExamResults(compareExamId)
      .then(d => setCompareResults(d.items ?? []))
      .catch(() => setCompareResults([]))
      .finally(() => setCompareLoading(false));
  }, [compareExamId]);

  // All active exams, loaded in parallel — feeds both the "recent" deep-dive
  // (top 5) and the cross-exam unique-students-appeared summary (all of them).
  const activeExams = useMemo(() =>
    [...exams]
      .filter(e => e.total_submissions > 0)
      .sort((a, b) => (b.date_assigned ?? '').localeCompare(a.date_assigned ?? '')),
  [exams]);
  const recentExams = useMemo(() => activeExams.slice(0, 5), [activeExams]);
  const activeKey = activeExams.map(e => e.homework_id).join(',');
  const [allResultsMap, setAllResultsMap] = useState<Map<number, MockExamResultItem[]>>(new Map());
  const [allLoading, setAllLoading] = useState(false);
  useEffect(() => {
    if (!activeExams.length) return;
    setAllLoading(true);
    Promise.all(activeExams.map(e =>
      examAPI.getMockExamResults(e.homework_id)
        .then(d => [e.homework_id, d.items ?? []] as [number, MockExamResultItem[]])
        .catch(() => [e.homework_id, []] as [number, MockExamResultItem[]])
    ))
      .then(pairs => setAllResultsMap(new Map(pairs)))
      .finally(() => setAllLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, refreshNonce]);
  const recentResultsMap = allResultsMap;
  const recentLoading = allLoading;

  // Manual refresh: re-pull the exam list from the parent (picks up brand-new
  // exams) and force a re-fetch of all exam results (picks up new submissions
  // on exams we already know about, which activeKey alone wouldn't catch).
  const handleRefresh = () => {
    onRefreshExams?.();
    setRefreshNonce(n => n + 1);
  };

  // Unique subjects across all exams (for filter dropdown) — must be before early return
  const allSubjects = useMemo(() =>
    [...new Set(exams.map(e => inferSubject(e)))].sort(),
  [exams]);

  if (loading) return <Loader />;

  const kpis        = computeProgrammeKPIs(exams);
  const subjects    = computeSubjectBreakdown(exams);
  const appeared    = computeStudentsAppeared(activeExams, allResultsMap);
  const neverAppeared = computeNeverAppeared(roster ?? [], activeExams, allResultsMap);
  const filteredNeverAppeared = neverAppearedClassFilter
    ? neverAppeared.students.filter(s => s.className === neverAppearedClassFilter)
    : neverAppeared.students;
  const sortedExams = [...exams].sort((a, b) =>
    (b.date_assigned ?? '').localeCompare(a.date_assigned ?? '')
  );

  // Bar chart: up to 15 most recent active exams, oldest-first so newest is rightmost
  const chartData = sortedExams
    .filter(e => e.total_submissions > 0 && e.average_score !== null)
    .slice(0, 15)
    .reverse()
    .map(e => ({
      label: `${inferSubject(e)} ${e.date_assigned
        ? new Date(e.date_assigned).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : ''}`,
      avg: Math.round((e.average_score ?? 0) * 10) / 10,
      subject: inferSubject(e),
      code: e.homework_code ?? `#${e.homework_id}`,
      homeworkId: e.homework_id,
    }));

  // Selected exam data
  const selectedExam    = exams.find(e => e.homework_id === selectedExamId) ?? null;
  const compareExam     = exams.find(e => e.homework_id === compareExamId) ?? null;
  const stats           = examResults ? computeExamSummaryStats(examResults) : null;
  const bands           = examResults ? computeScoreBands(examResults) : null;

  // Item 7: section averages (merge both exams when compare is loaded)
  const sectionAvgs1    = examResults ? computeSectionAverages(examResults) : [];
  const sectionAvgs2    = compareResults ? computeSectionAverages(compareResults) : [];
  const allSections     = [...new Set([...sectionAvgs1.map(s => s.section), ...sectionAvgs2.map(s => s.section)])].sort();
  const exam1Label      = selectedExam ? inferSubject(selectedExam) : 'Exam 1';
  const exam2Label      = compareExam  ? inferSubject(compareExam)  : 'Exam 2';
  const sectionChartData = allSections.map(sec => ({
    section: `Sec ${sec}`,
    [exam1Label]: sectionAvgs1.find(s => s.section === sec)?.avg ?? undefined,
    ...(compareResults ? { [exam2Label]: sectionAvgs2.find(s => s.section === sec)?.avg ?? undefined } : {}),
  }));

  // Item 8: cross-exam scatter
  const crossScores     = (examResults && compareResults)
    ? computeCrossExamScores(examResults, compareResults)
    : null;
  const scatterData     = crossScores?.map(s => ({ x: s.score1Pct, y: s.score2Pct, name: s.studentName })) ?? [];

  // Items 9–12: engagement, integrity, watch-list
  const timeScoreRaw    = examResults ? computeTimeScoreData(examResults) : [];
  const fastPerfect     = examResults ? flagFastPerfect(examResults) : [];
  const rushed          = examResults ? flagRushedAbandoned(examResults) : [];
  const needsReview     = examResults ? computeNeedsReview(examResults) : [];

  // Split time-score points into three series for distinct colouring
  const tsNormal        = timeScoreRaw.filter(d => !(d.timeMins <= 2.5 && d.scorePercent >= 97) && !(d.timeMins <= 1.2 && d.scorePercent < 50));
  const tsFastPerfect   = timeScoreRaw.filter(d => d.timeMins <= 2.5 && d.scorePercent >= 97);
  const tsRushed        = timeScoreRaw.filter(d => d.timeMins <= 1.2 && d.scorePercent < 50);

  // Exams available for compare (active, not the selected one)
  const compareOptions  = sortedExams.filter(e => e.total_submissions > 0 && e.homework_id !== selectedExamId);

  // Date + subject filtered exam list for "All Mock Exams"
  const filteredExams = sortedExams.filter(e => {
    if (!e.date_assigned) return !dateFrom && !dateTo;
    if (dateFrom && e.date_assigned < dateFrom) return false;
    if (dateTo   && e.date_assigned > dateTo)   return false;
    if (subjectFilter && inferSubject(e) !== subjectFilter) return false;
    return true;
  });

  const subjectColor1   = SUBJECT_COLOR[exam1Label]?.bar ?? C.purple;
  const subjectColor2   = SUBJECT_COLOR[exam2Label]?.bar ?? C.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: FONT }}>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {[
          { label: 'Mock Exams Assigned',    value: kpis.totalExams,                      color: C.purple, bg: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(124,58,237,0.05))' },
          { label: 'Exams with Submissions', value: kpis.examsWithSubmissions,             color: C.green,  bg: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05))' },
          { label: 'Total Submissions',      value: kpis.totalSubmissions.toLocaleString(), color: C.blue,   bg: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.05))' },
          {
            label: 'Weighted Avg Score',
            value: kpis.weightedAvgScore !== null ? fmtPct(kpis.weightedAvgScore) : '—',
            color: kpis.weightedAvgScore !== null ? scoreColor(kpis.weightedAvgScore) : C.textMuted,
            bg: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(245,158,11,0.08))',
          },
          {
            label: 'Zero Submissions',
            value: kpis.zeroSubExamCodes.length,
            color: kpis.zeroSubExamCodes.length > 0 ? C.red : C.textMuted,
            bg: kpis.zeroSubExamCodes.length > 0
              ? 'linear-gradient(135deg,rgba(244,63,94,0.10),rgba(244,63,94,0.04))'
              : 'linear-gradient(135deg,rgba(100,116,139,0.08),rgba(100,116,139,0.03))',
          },
        ].map(card => (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '22px 20px', boxShadow: C.shadow,
          }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: card.color, fontFamily: FONT_SERIF, lineHeight: 1, marginBottom: 10 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: card.color, opacity: 0.8 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Subject Breakdown ─────────────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Subject Breakdown</span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>active exams only</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              {['Subject', 'Exams', 'Submissions', 'Weighted Avg'].map(h => (
                <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((row, i) => {
              const sc = SUBJECT_COLOR[row.subject] ?? { text: C.textSecondary, bg: C.cardAlt };
              return (
                <tr key={row.subject} style={{ borderBottom: i < subjects.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 99, background: sc.bg, color: sc.text, fontSize: 12, fontWeight: 700 }}>{row.subject}</span>
                  </td>
                  <td style={{ padding: '12px 18px', fontWeight: 700, color: C.text }}>{row.examCount}</td>
                  <td style={{ padding: '12px 18px', color: C.textSecondary }}>{row.submissions.toLocaleString()}</td>
                  <td style={{ padding: '12px 18px' }}>
                    {row.weightedAvg !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 80, height: 5, borderRadius: 99, background: C.border }}>
                          <div style={{ width: `${Math.min(row.weightedAvg, 100)}%`, height: '100%', borderRadius: 99, background: scoreColor(row.weightedAvg) }} />
                        </div>
                        <span style={{ fontWeight: 700, color: scoreColor(row.weightedAvg), minWidth: 44 }}>{fmtPct(row.weightedAvg)}</span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `2px solid ${C.border}`, background: C.cardAlt }}>
              <td style={{ padding: '12px 18px', fontWeight: 700, color: C.text }}>All active</td>
              <td style={{ padding: '12px 18px', fontWeight: 700, color: C.text }}>{kpis.examsWithSubmissions}</td>
              <td style={{ padding: '12px 18px', fontWeight: 700, color: C.text }}>{kpis.totalSubmissions.toLocaleString()}</td>
              <td style={{ padding: '12px 18px' }}>
                {kpis.weightedAvgScore !== null
                  ? <span style={{ fontWeight: 800, color: scoreColor(kpis.weightedAvgScore), fontSize: 14 }}>{fmtPct(kpis.weightedAvgScore)}</span>
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Students Appeared — Unique ──────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Students Appeared — Unique</span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>
            {appeared.totalUnique.toLocaleString()} total
          </span>
          <span style={{ fontSize: 12, color: C.textMuted }}>deduped across all active exams — not submission counts</span>
          {allLoading && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>Loading…</span>}
          <button
            onClick={handleRefresh}
            disabled={allLoading}
            style={{
              marginLeft: allLoading ? undefined : 'auto', padding: '5px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.card, color: allLoading ? C.textMuted : C.purple,
              fontSize: 12, fontWeight: 700, cursor: allLoading ? 'wait' : 'pointer', fontFamily: FONT,
            }}
          >
            {allLoading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {allLoading ? (
          <Loader />
        ) : (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Subject stat chips */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', minWidth: 120 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text, fontFamily: FONT_SERIF, lineHeight: 1, marginBottom: 6 }}>{appeared.totalUnique}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Total Unique</div>
              </div>
              {appeared.bySubject.map(s => {
                const sc = SUBJECT_COLOR[s.key] ?? { text: C.textSecondary, bg: C.cardAlt };
                return (
                  <div key={s.key} style={{ background: sc.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', minWidth: 120 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: sc.text, fontFamily: FONT_SERIF, lineHeight: 1, marginBottom: 6 }}>{s.count}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: sc.text }}>{s.key}</div>
                  </div>
                );
              })}
            </div>

            {/* Class × Subject matrix */}
            {appeared.byClass.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                      {['Class', ...appeared.bySubject.map(s => s.key), 'Unique (any subject)'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Class' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appeared.byClass.map((c, i) => (
                      <tr key={c.key} style={{ borderBottom: i < appeared.byClass.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                        <td style={{ padding: '11px 16px', fontWeight: 600, color: C.text }}>{c.key}</td>
                        {appeared.bySubject.map(s => {
                          const cell = appeared.byClassSubject.find(cs => cs.className === c.key && cs.subject === s.key);
                          return (
                            <td key={s.key} style={{ padding: '11px 16px', textAlign: 'center', color: cell ? C.text : C.textMuted, fontWeight: cell ? 700 : 400 }}>
                              {cell ? cell.count : '—'}
                            </td>
                          );
                        })}
                        <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 800, color: C.purple }}>{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Students Never Appeared ─────────────────────────────────────────── */}
      {roster && roster.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Students Never Appeared</span>
            <span style={{ padding: '2px 8px', borderRadius: 99, background: neverAppeared.total > 0 ? C.redSoft : C.greenSoft, fontSize: 11, fontWeight: 700, color: neverAppeared.total > 0 ? C.red : C.green }}>
              {neverAppeared.total.toLocaleString()} of {neverAppeared.consideredTotal.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>students in classes/sections with active exams, but zero submissions</span>
            {allLoading && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>Loading…</span>}
            <div style={{ marginLeft: allLoading ? undefined : 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={neverAppearedClassFilter}
                onChange={e => setNeverAppearedClassFilter(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${neverAppearedClassFilter ? C.purple : C.border}`, background: C.card, color: neverAppearedClassFilter ? C.purple : C.textMuted, fontSize: 12, fontFamily: FONT, cursor: 'pointer', fontWeight: neverAppearedClassFilter ? 700 : 400 }}
              >
                <option value="">All classes</option>
                {neverAppeared.byClass.map(c => <option key={c.key} value={c.key}>Class {c.key} ({c.count})</option>)}
              </select>
            </div>
          </div>

          {allLoading ? (
            <Loader />
          ) : neverAppeared.total === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: C.green, fontWeight: 600, fontSize: 13 }}>
              Every student on the roster has appeared in at least one active exam.
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {neverAppeared.byClass.map(c => (
                  <span key={c.key} style={{ padding: '4px 10px', borderRadius: 99, background: C.redSoft, color: C.red, fontSize: 12, fontWeight: 700 }}>
                    Class {c.key}: {c.count}
                  </span>
                ))}
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                      {['#', 'Student', 'Class', 'Section'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: C.cardAlt }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNeverAppeared.map((s, i) => (
                      <tr key={s.studentId} style={{ borderBottom: i < filteredNeverAppeared.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                        <td style={{ padding: '10px 16px', color: C.textMuted, fontSize: 12, fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: C.text }}>{s.name}</td>
                        <td style={{ padding: '10px 16px', color: C.textSecondary }}>{s.className}</td>
                        <td style={{ padding: '10px 16px', color: C.textSecondary }}>{s.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Section 02: Recent Exams Deep-Dive ────────────────────────────── */}
      {recentExams.length > 0 && (() => {
        const rows = recentExams.map(e => {
          const res = recentResultsMap.get(e.homework_id) ?? [];
          const s   = computeExamSummaryStats(res);
          const sub = inferSubject(e);
          const dateLabel = e.date_assigned
            ? new Date(e.date_assigned).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            : '—';
          return { e, res, s, sub, dateLabel, shortName: `${sub} ${dateLabel}` };
        });

        const fig2Data = rows.map(r => ({
          name: r.shortName,
          avg: Math.round(r.s.avg * 10) / 10,
          passRate: Math.round(r.s.passRate),
          n: r.s.n,
          subject: r.sub,
        }));

        const bandDefs = [
          { key: '90–100', color: '#10B981' },
          { key: '75–89',  color: '#34D399' },
          { key: '60–74',  color: '#F59E0B' },
          { key: '40–59',  color: '#FB923C' },
          { key: '<40',    color: '#F43F5E' },
        ];

        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(135deg,rgba(124,58,237,0.10),rgba(124,58,237,0.04))', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: C.purple }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: FONT_SERIF }}>Recent Exams — Deep Dive</span>
              <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>last 5 active</span>
              {recentLoading && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>Loading…</span>}
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* Table 3 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 12 }}>Exam Comparison</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                        {['Exam', 'N', 'Avg', 'Median', 'Pass%', 'Needs rev', '100%', 'Med. time'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Exam' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const sc = SUBJECT_COLOR[r.sub] ?? { text: C.textSecondary, bg: C.cardAlt };
                        return (
                          <tr key={r.e.homework_id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.text, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.e.title ?? r.shortName}</span>
                                <span style={{ fontSize: 11, color: C.textMuted }}>{r.dateLabel}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: C.text }}>{r.s.n || (recentLoading ? '…' : '—')}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: r.s.n ? scoreColor(r.s.avg) : C.textMuted }}>{r.s.n ? fmtPct(r.s.avg) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: r.s.n ? scoreColor(r.s.median) : C.textMuted }}>{r.s.n ? fmtPct(r.s.median) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: r.s.n ? scoreColor(r.s.passRate) : C.textMuted }}>{r.s.n ? fmtPct(r.s.passRate, 0) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: r.s.needsReviewCount > 0 ? C.red : C.textMuted }}>{r.s.n ? r.s.needsReviewCount : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: C.green, fontWeight: 700 }}>{r.s.n ? r.s.perfectCount : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: C.textSecondary }}>{r.s.n ? fmtTimeMins(r.s.medianTimeMins * 60) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Figure 2: Avg score bar chart with pass% labeled inside bars */}
              {!recentLoading && fig2Data.some(d => d.n > 0) && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 16 }}>Average Score by Exam</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={fig2Data} margin={{ top: 24, right: 16, left: 0, bottom: 40 }} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                        angle={-22} textAnchor="end" interval={0} height={56}
                        axisLine={{ stroke: C.border }} tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                        tickFormatter={(v: number) => `${v}%`}
                        width={36} axisLine={false} tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 10, border: `1px solid ${C.border}`, boxShadow: C.shadow }}
                        formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, 'Avg Score']}
                        labelStyle={{ fontWeight: 700, color: C.text, marginBottom: 4 }}
                      />
                      <ReferenceLine y={40} stroke={C.red} strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: '40% pass', position: 'insideTopRight', fill: C.red, fontSize: 10, fontFamily: FONT, fontWeight: 700 }}
                      />
                      <Bar dataKey="avg" radius={[8, 8, 0, 0]} maxBarSize={100}>
                        {fig2Data.map((d, i) => (
                          <Cell key={i} fill={SUBJECT_COLOR[d.subject]?.bar ?? C.purple} />
                        ))}
                        <LabelList
                          content={(props: any) => {
                            const { x, y, width, height, index } = props;
                            const d = fig2Data[index];
                            if (!d || d.n === 0) return null;
                            const cx = x + width / 2;
                            const barColor = SUBJECT_COLOR[d.subject]?.bar ?? C.purple;
                            if (height >= 36) {
                              const clipId = `bc-${index}`;
                              return (
                                <g>
                                  <defs>
                                    <clipPath id={clipId}>
                                      <rect x={x} y={y} width={width} height={height} rx={8} />
                                    </clipPath>
                                  </defs>
                                  <text x={cx} y={y + height / 2 - 9} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={12} fontWeight={800} fontFamily={FONT} clipPath={`url(#${clipId})`}>
                                    {fmtPct(d.avg, 1)}
                                  </text>
                                  <text x={cx} y={y + height / 2 + 9} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.82)" fontSize={9} fontWeight={600} fontFamily={FONT} clipPath={`url(#${clipId})`}>
                                    {`pass ${d.passRate}% · n=${d.n}`}
                                  </text>
                                </g>
                              );
                            }
                            return (
                              <text x={cx} y={y - 7} textAnchor="middle" dominantBaseline="auto" fill={barColor} fontSize={10} fontWeight={700} fontFamily={FONT}>
                                {fmtPct(d.avg, 0)}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Figure 3: Score-band stacked horizontal bars */}
              {!recentLoading && rows.some(r => r.s.n > 0) && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 12 }}>Score-band Distribution</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    {bandDefs.map(b => (
                      <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: b.color }} />
                        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{b.key}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rows.map(r => {
                      const bands = computeScoreBands(r.res);
                      if (r.s.n === 0) return null;
                      const totalPct = bands.reduce((s, b) => s + b.pct, 0);
                      return (
                        <div key={r.e.homework_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 130, flexShrink: 0, fontSize: 11, color: C.textSecondary, fontWeight: 600, textAlign: 'right', paddingRight: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.shortName}
                          </div>
                          <div style={{ flex: 1, height: 28, display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
                            {bands.map((b, bi) => {
                              if (b.pct < 1) return null;
                              const w = totalPct > 0 ? (b.pct / totalPct) * 100 : b.pct;
                              return (
                                <div
                                  key={bi}
                                  title={`${b.label}: ${b.pct.toFixed(0)}% (${b.count} students)`}
                                  style={{ width: `${w}%`, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  {w > 9 && (
                                    <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{Math.round(b.pct)}%</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ width: 36, fontSize: 11, color: C.textMuted, flexShrink: 0 }}>n={r.s.n}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* ── Section 03: Section & Cohort Patterns ────────────────────────── */}
      {(() => {
        if (recentLoading || !recentExams.length) return null;

        // Find most recent date that has ≥2 paired exams
        const byDate = new Map<string, MockExamItem[]>();
        for (const exam of recentExams) {
          const date = exam.date_assigned ?? 'unknown';
          if (!byDate.has(date)) byDate.set(date, []);
          byDate.get(date)!.push(exam);
        }
        const pairedDates = Array.from(byDate.entries())
          .filter(([, es]) => es.length >= 2)
          .sort(([a], [b]) => b.localeCompare(a));
        if (!pairedDates.length) return null;

        const [pairedDate, pairedExamsArr] = pairedDates[0];
        const exam1 = pairedExamsArr[0];
        const exam2 = pairedExamsArr[1];
        const sub1 = inferSubject(exam1);
        const sub2 = inferSubject(exam2);
        const label1 = sub1 !== sub2 ? sub1 : `${sub1} (${exam1.homework_code ?? exam1.homework_id})`;
        const label2 = sub1 !== sub2 ? sub2 : `${sub2} (${exam2.homework_code ?? exam2.homework_id})`;
        const res1 = recentResultsMap.get(exam1.homework_id) ?? [];
        const res2 = recentResultsMap.get(exam2.homework_id) ?? [];

        const sectionData = computeSectionSubjectAverages([
          { results: res1, subject: label1 },
          { results: res2, subject: label2 },
        ]);

        // Figure 5: Class 12 students who sat both exams
        const cls12res1 = res1.filter(r => (r.class_name ?? '').includes('12'));
        const cls12res2 = res2.filter(r => (r.class_name ?? '').includes('12'));
        const cross12   = computeCrossExamScores(cls12res1, cls12res2);
        const scatter12 = cross12.map(s => ({
          x: s.score1Pct, y: s.score2Pct,
          name: s.studentName.split(' ')[0],
        }));

        const dateStr = pairedDate !== 'unknown'
          ? new Date(pairedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '';
        const sc1 = SUBJECT_COLOR[sub1] ?? { bar: C.purple };
        const sc2 = SUBJECT_COLOR[sub2] ?? { bar: C.green };

        if (sectionData.length === 0 && scatter12.length === 0) return null;

        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.06))', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: C.green }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: FONT_SERIF }}>Section & Cohort Patterns</span>
              <span style={{ padding: '2px 8px', borderRadius: 99, background: C.greenSoft, fontSize: 11, fontWeight: 700, color: C.green }}>{dateStr} · paired exams</span>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* Figure 4: Section-wise grouped bar chart */}
              {sectionData.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Figure 4 — Section-wise average · {dateStr} ({label1} vs {label2})
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    {[{ label: label1, color: sc1.bar }, { label: label2, color: sc2.bar }].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={sectionData} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                      <XAxis
                        dataKey="section"
                        tick={{ fontSize: 12, fontFamily: FONT, fill: C.textMuted }}
                        tickFormatter={(v: string) => `Sec ${v}`}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                        tickFormatter={(v: number) => `${v}%`}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 10, border: `1px solid ${C.border}` }}
                        formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
                      />
                      <Bar dataKey={label1} fill={sc1.bar} radius={[4, 4, 0, 0]} maxBarSize={32}>
                        <LabelList dataKey={label1} position="top" style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT, fill: sc1.bar }} formatter={(v: any) => Math.round(Number(v))} />
                      </Bar>
                      <Bar dataKey={label2} fill={sc2.bar} radius={[4, 4, 0, 0]} maxBarSize={32}>
                        <LabelList dataKey={label2} position="top" style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT, fill: sc2.bar }} formatter={(v: any) => Math.round(Number(v))} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Figure 5: Class 12 cross-subject scatter */}
              {scatter12.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Figure 5 — Class 12 · same students, {label1} vs {label2}
                  </div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 12 }}>
                    Each dot = one student · above dashed line = scored higher in {label2}
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 8, right: 32, left: 0, bottom: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis
                        type="number" dataKey="x" domain={[0, 100]}
                        tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                        tickFormatter={(v: number) => `${v}%`}
                        label={{ value: `${label1} score (%)`, position: 'insideBottom', offset: -14, fontSize: 11, fill: C.textMuted, fontFamily: FONT }}
                      />
                      <YAxis
                        type="number" dataKey="y" domain={[0, 100]}
                        tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                        tickFormatter={(v: number) => `${v}%`}
                        label={{ value: `${label2} score (%)`, angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: C.textMuted, fontFamily: FONT }}
                        width={44}
                      />
                      <Tooltip
                        contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 10, border: `1px solid ${C.border}` }}
                        formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name === 'x' ? label1 : label2]}
                        labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.name ?? ''}
                      />
                      {/* y=x diagonal reference line */}
                      <Scatter
                        data={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                        line={{ stroke: C.textMuted, strokeDasharray: '5 5', strokeWidth: 1 }}
                        shape={() => null as any}
                        legendType="none"
                      />
                      <Scatter data={scatter12} fill={C.blue} opacity={0.8} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* ── Item 5: Average Score Bar Chart ───────────────────────────────── */}
      {chartData.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', boxShadow: C.shadow }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Average Score — Recent Exams</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: C.textMuted }}>most recent {chartData.length} active exams · dashed line = 40% pass threshold</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                angle={-35}
                textAnchor="end"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: C.border }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
                formatter={(value: any, _: any, props: any) => [
                  `${value}%`,
                  props.payload?.code ?? 'Avg Score',
                ]}
              />
              <ReferenceLine y={40} stroke={C.red} strokeDasharray="4 3" strokeWidth={1.5} label="40% pass" />
              <Bar dataKey="avg" radius={[5, 5, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, i) => {
                  const sc = SUBJECT_COLOR[entry.subject];
                  return <Cell key={i} fill={sc?.bar ?? C.purple} opacity={entry.homeworkId === selectedExamId ? 1 : 0.75} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 8 }}>
            {Object.entries(SUBJECT_COLOR).map(([subj, sc]) => (
              <div key={subj} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSecondary }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: sc.bar }} />
                {subj}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full Exam List (clickable) ─────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: C.shadow }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>All Mock Exams</span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: C.purpleSoft, fontSize: 11, fontWeight: 700, color: C.purple }}>
            {filteredExams.length}{filteredExams.length !== exams.length ? ` of ${exams.length}` : ' total'}
          </span>
          {kpis.zeroSubExamCodes.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 99, background: C.redSoft, fontSize: 11, fontWeight: 700, color: C.red }}>{kpis.zeroSubExamCodes.length} no submissions</span>
          )}
          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${subjectFilter ? C.purple : C.border}`, background: C.card, color: subjectFilter ? C.purple : C.textMuted, fontSize: 12, fontFamily: FONT, cursor: 'pointer', fontWeight: subjectFilter ? 700 : 400 }}
            >
              <option value="">All subjects</option>
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${dateFrom ? C.purple : C.border}`, background: C.card, color: C.text, fontSize: 12, fontFamily: FONT, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${dateTo ? C.purple : C.border}`, background: C.card, color: C.text, fontSize: 12, fontFamily: FONT, cursor: 'pointer' }}
            />
            {(dateFrom || dateTo || subjectFilter) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setSubjectFilter(''); }}
                style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
              >
                Clear
              </button>
            )}
          </div>
          <span style={{ fontSize: 12, color: C.textMuted }}>Click a row to deep-dive</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                {['Date', 'Code', 'Subject', 'Chapters', 'Submissions', 'Avg Score'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam, i) => {
                const subject = inferSubject(exam);
                const sc = SUBJECT_COLOR[subject] ?? { text: C.textSecondary, bg: C.cardAlt };
                const noSubs = exam.total_submissions === 0;
                const isSelected = exam.homework_id === selectedExamId;
                return (
                  <tr
                    key={exam.homework_id}
                    onClick={() => { if (!noSubs) { onSelectExam(exam.homework_id); setModalOpen(true); } }}
                    style={{
                      borderBottom: i < filteredExams.length - 1 ? `1px solid ${C.border}` : 'none',
                      background: isSelected ? C.purpleSoft : noSubs ? 'rgba(244,63,94,0.03)' : i % 2 === 0 ? 'transparent' : C.cardAlt,
                      cursor: noSubs ? 'default' : 'pointer',
                      opacity: noSubs ? 0.6 : 1,
                      outline: isSelected ? `2px solid ${C.purple}` : 'none',
                      outlineOffset: -2,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!noSubs && !isSelected) e.currentTarget.style.background = C.purpleSoft; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = noSubs ? 'rgba(244,63,94,0.03)' : i % 2 === 0 ? 'transparent' : C.cardAlt; }}
                  >
                    <td style={{ padding: '11px 16px', color: C.textSecondary, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {exam.date_assigned ? new Date(exam.date_assigned).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontWeight: 600, color: isSelected ? C.purple : C.text, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {exam.homework_code ?? `#${exam.homework_id}`}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.text, fontSize: 11, fontWeight: 700 }}>{subject}</span>
                    </td>
                    <td style={{ padding: '11px 16px', maxWidth: 260 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {exam.chapters.slice(0, 2).map(ch => (
                          <span key={ch} style={{ padding: '2px 7px', borderRadius: 99, background: C.cardAlt, color: C.textSecondary, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', border: `1px solid ${C.border}` }}>
                            {ch.length > 28 ? ch.slice(0, 28) + '…' : ch}
                          </span>
                        ))}
                        {exam.chapters.length > 2 && <span style={{ padding: '2px 7px', borderRadius: 99, background: C.cardAlt, color: C.textMuted, fontSize: 11, border: `1px solid ${C.border}` }}>+{exam.chapters.length - 2}</span>}
                        {exam.chapters.length === 0 && <span style={{ color: C.textMuted }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {noSubs
                        ? <span style={{ padding: '2px 8px', borderRadius: 99, background: C.redSoft, color: C.red, fontSize: 11, fontWeight: 700 }}>No submissions</span>
                        : <span style={{ fontWeight: 700, color: C.text }}>{exam.total_submissions}</span>}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {exam.average_score !== null && !noSubs ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 52, height: 4, borderRadius: 99, background: C.border }}>
                            <div style={{ width: `${Math.min(exam.average_score, 100)}%`, height: '100%', borderRadius: 99, background: scoreColor(exam.average_score) }} />
                          </div>
                          <span style={{ fontWeight: 700, color: scoreColor(exam.average_score), minWidth: 38, fontSize: 13 }}>{fmtPct(exam.average_score)}</span>
                        </div>
                      ) : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Selected Exam Deep-dive ────────────────────────────────── */}
      {selectedExamId !== null && modalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { onSelectExam(null); setModalOpen(false); } }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px', overflowY: 'auto' }}
        >
        <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>

        {/* ── Items 4 & 6 ── */}
        <div style={{ background: C.card, border: `2px solid ${C.purple}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.purpleSoft, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>
              {selectedExam?.homework_code ?? `Exam #${selectedExamId}`}
            </span>
            {selectedExam && (
              <>
                <span style={{ padding: '2px 8px', borderRadius: 99, background: C.card, fontSize: 11, fontWeight: 700, color: C.purple }}>{inferSubject(selectedExam)}</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  {selectedExam.date_assigned ? new Date(selectedExam.date_assigned).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                </span>
              </>
            )}
            <button
              onClick={() => { onSelectExam(null); setModalOpen(false); }}
              style={{ marginLeft: 'auto', padding: '4px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
            >
              Close ✕
            </button>
          </div>

          {resultsLoading ? (
            <Loader />
          ) : stats && bands ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Item 4: Summary stats chips */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Exam Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Students',     value: stats.n,                              color: C.text     },
                    { label: 'Average',      value: fmtPct(stats.avg),                   color: scoreColor(stats.avg)    },
                    { label: 'Median',       value: fmtPct(stats.median),                color: scoreColor(stats.median) },
                    { label: 'Pass Rate',    value: fmtPct(stats.passRate),              color: stats.passRate >= 80 ? C.green : stats.passRate >= 60 ? C.amber : C.red },
                    { label: 'Needs Review', value: stats.needsReviewCount,              color: stats.needsReviewCount > 0 ? C.red : C.green    },
                    { label: '100% Scores',  value: stats.perfectCount,                  color: stats.perfectCount > 0 ? C.purple : C.textMuted },
                    { label: 'Median Time',  value: fmtTimeMins(stats.medianTimeMins * 60), color: C.blue  },
                  ].map(s => (
                    <div key={s.label} style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: FONT_SERIF, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item 6: Score-band distribution */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Score Distribution</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {bands.map((band, i) => (
                    <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 52, fontSize: 12, fontWeight: 600, color: C.textSecondary, textAlign: 'right', flexShrink: 0 }}>{band.label}</div>
                      <div style={{ flex: 1, height: 26, borderRadius: 6, background: C.cardAlt, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                        <div style={{
                          width: `${band.pct}%`, height: '100%',
                          background: BAND_COLORS[i],
                          borderRadius: 6,
                          minWidth: band.count > 0 ? 8 : 0,
                          display: 'flex', alignItems: 'center',
                          transition: 'width 0.4s ease',
                        }}>
                          {band.pct >= 8 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', paddingLeft: 8 }}>{Math.round(band.pct)}%</span>
                          )}
                        </div>
                      </div>
                      <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: C.textSecondary, flexShrink: 0 }}>{band.count}</div>
                    </div>
                  ))}
                </div>
                {/* Band legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                  {bands.map((band, i) => (
                    <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: BAND_COLORS[i] }} />
                      {band.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Item 7: Section-wise averages ─────────────────────────────── */}
              {sectionChartData.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                    Section Averages {compareResults ? `— ${exam1Label} vs ${exam2Label}` : ''}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={sectionChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                      <XAxis dataKey="section" tick={{ fontSize: 12, fontFamily: FONT, fill: C.textMuted }} tickLine={false} axisLine={{ stroke: C.border }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ fontFamily: FONT, fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
                        formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}%`, name]}
                      />
                      <ReferenceLine y={40} stroke={C.red} strokeDasharray="4 3" strokeWidth={1.5} label="40%" />
                      <Bar dataKey={exam1Label} fill={subjectColor1} radius={[4, 4, 0, 0]} maxBarSize={32} />
                      {compareResults && (
                        <Bar dataKey={exam2Label} fill={subjectColor2} radius={[4, 4, 0, 0]} maxBarSize={32} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                  {compareResults && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
                      {[{ label: exam1Label, color: subjectColor1 }, { label: exam2Label, color: subjectColor2 }].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSecondary }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                          {l.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Item 8: Cross-subject scatter ──────────────────────────────── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Compare Across Subjects
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>Compare with:</span>
                  <select
                    value={compareExamId ?? ''}
                    onChange={e => setCompareExamId(e.target.value ? Number(e.target.value) : null)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, cursor: 'pointer', minWidth: 220 }}
                  >
                    <option value="">— pick an exam —</option>
                    {compareOptions.map(e => (
                      <option key={e.homework_id} value={e.homework_id}>
                        {e.homework_code ?? `#${e.homework_id}`} · {inferSubject(e)} · {e.date_assigned ? new Date(e.date_assigned).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                      </option>
                    ))}
                  </select>
                  {compareExamId && (
                    <button onClick={() => setCompareExamId(null)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                      Clear
                    </button>
                  )}
                </div>

                {compareLoading && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '24px 0' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i*0.16}s infinite` }} />)}
                  </div>
                )}

                {!compareLoading && crossScores && (
                  crossScores!.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: C.textMuted, fontSize: 13 }}>No students found in both exams.</div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                        {crossScores!.length} students sat both exams · points above the diagonal scored higher in {exam2Label}
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis
                            dataKey="x" type="number" domain={[0, 100]} name={exam1Label}
                            tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                            tickLine={false} axisLine={{ stroke: C.border }}
                            label={{ value: `${exam1Label} score (%)`, position: 'insideBottom', offset: -12, fontSize: 12, fill: C.textMuted, fontFamily: FONT }}
                          />
                          <YAxis
                            dataKey="y" type="number" domain={[0, 100]} name={exam2Label}
                            tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                            tickLine={false} axisLine={false}
                            label={{ value: `${exam2Label} score (%)`, angle: -90, position: 'insideLeft', offset: 12, fontSize: 12, fill: C.textMuted, fontFamily: FONT }}
                          />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontFamily: FONT, fontSize: 12, boxShadow: C.shadow }}>
                                  <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{d.name}</div>
                                  <div style={{ color: subjectColor1 }}>{exam1Label}: {fmtPct(d.x)}</div>
                                  <div style={{ color: subjectColor2 }}>{exam2Label}: {fmtPct(d.y)}</div>
                                </div>
                              );
                            }}
                          />
                          {/* Diagonal reference line (equal performance) */}
                          <Scatter
                            data={[{ x: 0, y: 0, name: '' }, { x: 100, y: 100, name: '' }]}
                            line={{ stroke: C.border, strokeDasharray: '5 4', strokeWidth: 1.5 }}
                            shape={() => null as any}
                            legendType="none"
                          />
                          <Scatter data={scatterData} fill={C.purple} fillOpacity={0.75} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )
                )}

                {!compareExamId && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: C.textMuted, fontSize: 13 }}>
                    Pick an exam above to compare the same students across two subjects.
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>No results available for this exam.</div>
          )}
        </div>

        {/* ── Items 9–11: Engagement & Integrity ── */}
        {examResults && !resultsLoading && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Engagement & Integrity</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: C.textMuted }}>time taken vs score · flagged attempts highlighted</span>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Item 9: Time vs Score scatter */}
            {timeScoreRaw.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Time Taken vs Score
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 8, right: 24, bottom: 28, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="timeMins" type="number" name="Time"
                      tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                      tickLine={false} axisLine={{ stroke: C.border }}
                      tickFormatter={v => `${v}m`}
                      label={{ value: 'Time taken (minutes)', position: 'insideBottom', offset: -14, fontSize: 12, fill: C.textMuted, fontFamily: FONT }}
                    />
                    <YAxis
                      dataKey="scorePercent" type="number" domain={[0, 100]} name="Score"
                      tick={{ fontSize: 11, fontFamily: FONT, fill: C.textMuted }}
                      tickLine={false} axisLine={false}
                      tickFormatter={v => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontFamily: FONT, fontSize: 12, boxShadow: C.shadow }}>
                            <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{d.studentName}</div>
                            <div style={{ color: C.textSecondary }}>Section: {d.section}</div>
                            <div style={{ color: C.purple }}>Score: {fmtPct(d.scorePercent)}</div>
                            <div style={{ color: C.blue }}>Time: {fmtTimeMins(d.timeMins * 60)}</div>
                            {d.unanswered > 0 && <div style={{ color: C.amber }}>Unanswered: {d.unanswered}</div>}
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={2.5} stroke={C.amber} strokeDasharray="4 3" strokeWidth={1.5} label="2.5 min" />
                    <ReferenceLine y={40} stroke={C.red}   strokeDasharray="4 3" strokeWidth={1.5} label="40%" />
                    <Scatter data={tsNormal}      fill={C.blue}   fillOpacity={0.55} name="Normal" />
                    <Scatter data={tsFastPerfect} fill={C.purple} fillOpacity={0.85} name="Fast & perfect" />
                    <Scatter data={tsRushed}      fill={C.red}    fillOpacity={0.85} name="Rushed" />
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                  {[
                    { label: 'Normal', color: C.blue },
                    { label: `Fast & perfect (≤2.5 min, ≥97%)`, color: C.purple },
                    { label: `Rushed / abandoned (≤1.2 min, <50%)`, color: C.red },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items 10 & 11: Flag tables side by side */}
            {(fastPerfect.length > 0 || rushed.length > 0) ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Item 10: Fast & near-perfect */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Fast & Near-Perfect — ≤2.5 min, ≥97%
                    <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 99, background: C.purpleSoft, color: C.purple, fontSize: 11, fontWeight: 700, textTransform: 'none' }}>{fastPerfect.length}</span>
                  </div>
                  {fastPerfect.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>None in this exam.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                          {['Student', 'Sec', 'Score', 'Time'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fastPerfect.map((s, i) => (
                          <tr key={i} style={{ borderBottom: i < fastPerfect.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: C.text }}>{s.studentName}</td>
                            <td style={{ padding: '8px 10px', color: C.textSecondary }}>{s.section}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: C.purple }}>{fmtPct(s.scorePercent)}</td>
                            <td style={{ padding: '8px 10px', color: C.textMuted }}>{fmtTimeMins(s.timeMins * 60)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Item 11: Rushed / abandoned */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Rushed / Abandoned — ≤72 s, &lt;50%
                    <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 99, background: C.redSoft, color: C.red, fontSize: 11, fontWeight: 700, textTransform: 'none' }}>{rushed.length}</span>
                  </div>
                  {rushed.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>None in this exam.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                          {['Student', 'Sec', 'Score', 'Time', 'Blank'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rushed.map((s, i) => (
                          <tr key={i} style={{ borderBottom: i < rushed.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: C.text }}>{s.studentName}</td>
                            <td style={{ padding: '8px 10px', color: C.textSecondary }}>{s.section}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: C.red }}>{fmtPct(s.scorePercent)}</td>
                            <td style={{ padding: '8px 10px', color: C.textMuted }}>{fmtTimeMins(s.timeMins * 60)}</td>
                            <td style={{ padding: '8px 10px', color: C.amber, fontWeight: 700 }}>{s.unanswered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.green, fontWeight: 600, padding: '4px 0' }}>No suspicious attempts flagged in this exam.</div>
            )}

          </div>
        </div>
        )}

        {/* ── Item 12: Watch-list / Needs Review ── */}
        {examResults && !resultsLoading && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.cardAlt, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Needs Review</span>
            <span style={{ padding: '2px 8px', borderRadius: 99, background: needsReview.length > 0 ? C.redSoft : C.greenSoft, fontSize: 11, fontWeight: 700, color: needsReview.length > 0 ? C.red : C.green }}>
              {needsReview.length > 0 ? `${needsReview.length} students below 40%` : 'All students passed'}
            </span>
          </div>
          {needsReview.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: C.green, fontWeight: 600, fontSize: 13 }}>
              All students scored above the 40% pass line.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
              <thead>
                <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  {['#', 'Student', 'Section', 'Score', 'Gap to Pass'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {needsReview.map((s, i) => {
                  const gap = 40 - s.scorePercent;
                  return (
                    <tr key={i} style={{ borderBottom: i < needsReview.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                      <td style={{ padding: '10px 16px', color: C.textMuted, fontSize: 12, fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: C.text }}>{s.studentName}</td>
                      <td style={{ padding: '10px 16px', color: C.textSecondary }}>{s.section}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontWeight: 800, color: C.red, fontSize: 14 }}>{fmtPct(s.scorePercent)}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 5, borderRadius: 99, background: C.border }}>
                            <div style={{ width: `${Math.min((gap / 40) * 100, 100)}%`, height: '100%', borderRadius: 99, background: C.red }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.red }}>–{fmtPct(gap, 0)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        )}

        </div>
        </div>
      )}

    </div>
  );
};

export default MockExamAnalysis;
