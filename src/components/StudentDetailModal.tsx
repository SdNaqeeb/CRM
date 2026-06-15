import React, { useEffect, useRef, useState } from 'react';
import { LineChart, StackedBarChart } from './AnalyticsCharts';
import { dashboardAPI } from '../services/api';
import { EngagementStatus, TestPrepItem } from '../types';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

interface GapAnalysisEntry {
  id: number;
  subject: string | null;
  chapter_number: string | null;
  student_score: number | null;
  max_marks: number | null;
  percentage: number | null;
  date: string | null;
}

interface ExamResultEntry {
  id: number;
  exam_id: number;
  total_marks_obtained: number | null;
  total_max_marks: number | null;
  overall_percentage: number | null;
  grade: string | null;
}

interface StudentDetail {
  student_id: number;
  full_name: string;
  username?: string;
  grade?: string;
  section?: string;
  last_login?: string;
  days_since_login?: number;
  total_sessions: number;
  sessions_this_week: number;
  engagement_status: EngagementStatus;
  is_currently_active: boolean;
  recent_gap_analysis: GapAnalysisEntry[];
  exam_results: ExamResultEntry[];
  test_prep_results?: TestPrepItem[];
}

interface StudentDetailModalProps {
  studentId: number;
  onClose: () => void;
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ studentId, onClose }) => {
  const lastStudentSummaryRequestRef = useRef<number | null>(null);
  const [data, setData] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [selectedPrepClass, setSelectedPrepClass] = useState('All');
  const [selectedPrepSubject, setSelectedPrepSubject] = useState('All');
  const [selectedPrepChapter, setSelectedPrepChapter] = useState('All');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (lastStudentSummaryRequestRef.current === studentId) return;
    lastStudentSummaryRequestRef.current = studentId;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await dashboardAPI.getStudentSummary(studentId);
        setData(result);
      } catch (err) {
        setError('Failed to load student details');
        console.error(err);
        lastStudentSummaryRequestRef.current = null;
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  const getStatusConfig = (status: EngagementStatus) => {
    switch (status) {
      case EngagementStatus.ACTIVE:
        return { color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', label: 'Active' };
      case EngagementStatus.AT_RISK:
        return { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', label: 'At Risk' };
      case EngagementStatus.LOW_ENGAGEMENT:
        return { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', label: 'Low Engagement' };
      case EngagementStatus.INACTIVE:
        return { color: '#F43F5E', bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', label: 'Inactive' };
      default:
        return { color: '#64748B', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', label: 'Unknown' };
    }
  };

  const getScoreColor = (percentage: number | null) => {
    if (percentage === null) return '#64748B';
    if (percentage >= 80) return '#10B981';
    if (percentage >= 60) return '#3B82F6';
    if (percentage >= 40) return '#F59E0B';
    return '#F43F5E';
  };

  const getScoreBg = (percentage: number | null) => {
    if (percentage === null) return 'rgba(100,116,139,0.15)';
    if (percentage >= 80) return 'rgba(16,185,129,0.15)';
    if (percentage >= 60) return 'rgba(59,130,246,0.15)';
    if (percentage >= 40) return 'rgba(245,158,11,0.15)';
    return 'rgba(244,63,94,0.15)';
  };

  const formatPrepDate = (value?: string | null, includeTime = false) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  };

  const getPrepScore = (item: TestPrepItem) =>
    Number(item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? item.analysis?.prediction?.score_pct ?? 0);

  const getPrepTotal = (item: TestPrepItem) =>
    Number(item.graph_data?.total ?? item.analysis?.analysis?.total ?? item.questions?.length ?? 0);

  const getPrepCorrect = (item: TestPrepItem) =>
    Number(item.graph_data?.correct ?? item.analysis?.analysis?.correct ?? 0);

  const getPrepSkipped = (item: TestPrepItem) =>
    Number(item.graph_data?.skipped ?? item.analysis?.analysis?.skipped ?? 0);

  const getPrepIncorrect = (item: TestPrepItem) =>
    Math.max(getPrepTotal(item) - getPrepCorrect(item) - getPrepSkipped(item), 0);

  const getPrepClass = (item: TestPrepItem) =>
    String(item.graph_data?.class_num ?? item.graph_data?.class ?? data?.grade ?? 'Unknown');

  const getPrepSubject = (item: TestPrepItem) =>
    String(item.graph_data?.subject ?? item.analysis?.analysis?.subject ?? 'Unknown');

  const getPrepPrimaryChapter = (item: TestPrepItem) =>
    item.graph_data?.chapter_breakdown?.[0]?.chapter ||
    item.questions?.[0]?.chapter ||
    item.name ||
    formatPrepDate(item.created_at, true);

  const getPrepLabel = (item: TestPrepItem) =>
    item.graph_data?.chapter_breakdown?.[0]?.chapter ||
    item.questions?.[0]?.chapter ||
    item.name ||
    formatPrepDate(item.created_at, true);

  const getPrepChartKey = (item: TestPrepItem, index: number) =>
    `${item.id}-${new Date(item.created_at).getTime()}-${index}`;

  const getPrepTimeSpent = (item: TestPrepItem) => {
    const candidates = [
      item.graph_data?.time_spent_sec,
      item.analysis?.analysis?.time_spent_sec,
      item.analysis?.prediction?.time_spent_sec,
      item.prediction?.time_spent_sec,
    ];

    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    const minutes = seconds / 60;
    return minutes < 10 ? `${minutes.toFixed(1)} min` : `${Math.round(minutes)} min`;
  };

  const computePearsonCorrelation = (points: Array<{ x: number; y: number }>) => {
    const validPoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    const n = validPoints.length;

    if (n < 2) return null;

    const sumX = validPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = validPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = validPoints.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumX2 = validPoints.reduce((sum, point) => sum + point.x * point.x, 0);
    const sumY2 = validPoints.reduce((sum, point) => sum + point.y * point.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return null;

    return numerator / denominator;
  };

  const allPrepItems = data?.test_prep_results ?? [];

  const prepClassOptions = React.useMemo(() => {
    const classes = Array.from(new Set(allPrepItems.map(getPrepClass)));
    return ['All', ...classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [allPrepItems]);

  const prepItemsForSelectedClass = React.useMemo(() => {
    return selectedPrepClass === 'All'
      ? allPrepItems
      : allPrepItems.filter((item) => getPrepClass(item) === selectedPrepClass);
  }, [allPrepItems, selectedPrepClass]);

  const prepSubjectOptions = React.useMemo(() => {
    const subjects = Array.from(new Set(prepItemsForSelectedClass.map(getPrepSubject)));
    return ['All', ...subjects.sort((a, b) => a.localeCompare(b))];
  }, [prepItemsForSelectedClass]);

  const prepItemsForSelectedSubject = React.useMemo(() => {
    return selectedPrepSubject === 'All'
      ? prepItemsForSelectedClass
      : prepItemsForSelectedClass.filter((item) => getPrepSubject(item) === selectedPrepSubject);
  }, [prepItemsForSelectedClass, selectedPrepSubject]);

  const prepChapterOptions = React.useMemo(() => {
    const chapters = Array.from(new Set(prepItemsForSelectedSubject.map(getPrepPrimaryChapter)));
    return ['All', ...chapters.sort((a, b) => a.localeCompare(b))];
  }, [prepItemsForSelectedSubject]);

  const filteredPrepItems = React.useMemo(() => {
    return selectedPrepChapter === 'All'
      ? prepItemsForSelectedSubject
      : prepItemsForSelectedSubject.filter((item) => getPrepPrimaryChapter(item) === selectedPrepChapter);
  }, [prepItemsForSelectedSubject, selectedPrepChapter]);

  useEffect(() => {
    setSelectedPrepSubject('All');
    setSelectedPrepChapter('All');
  }, [selectedPrepClass]);

  useEffect(() => {
    setSelectedPrepChapter('All');
  }, [selectedPrepSubject]);

  const prepSummary = React.useMemo(() => {
    if (!filteredPrepItems.length) {
      return { attempts: 0, avgScore: 0, latestScore: null as number | null, avgAccuracy: 0 };
    }

    const avgScore = Math.round(
      filteredPrepItems.reduce((sum, item) => sum + getPrepScore(item), 0) / filteredPrepItems.length
    );
    const latest = [...filteredPrepItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const avgAccuracy = Math.round(
      filteredPrepItems.reduce((sum, item) => {
        const total = getPrepTotal(item);
        return sum + (total > 0 ? (getPrepCorrect(item) / total) * 100 : 0);
      }, 0) / filteredPrepItems.length
    );

    return {
      attempts: filteredPrepItems.length,
      avgScore,
      latestScore: latest ? getPrepScore(latest) : null,
      avgAccuracy,
    };
  }, [filteredPrepItems]);

  const studentPrepTrendData = React.useMemo(() => {
    return filteredPrepItems
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((item, index) => ({
        label: getPrepLabel(item),
        chartKey: getPrepChartKey(item, index),
        value: getPrepScore(item),
      }));
  }, [filteredPrepItems]);

  const studentPrepStackedData = React.useMemo(() => {
    return filteredPrepItems
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((item, index) => ({
        label: getPrepLabel(item),
        chartKey: getPrepChartKey(item, index),
        Correct: getPrepCorrect(item),
        Incorrect: getPrepIncorrect(item),
        Skipped: getPrepSkipped(item),
      }));
  }, [filteredPrepItems]);

  const prepTableRows = React.useMemo(() => {
    return filteredPrepItems
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((item) => {
        const weakChapters = (item.graph_data?.chapter_breakdown ?? [])
          .filter((chapter: any) => {
            const total = Number(chapter.total ?? 0);
            const correct = Number(chapter.correct ?? 0);
            return total > 0 && correct < total;
          })
          .map((chapter: any) => `${chapter.chapter} (${Number(chapter.correct ?? 0)}/${Number(chapter.total ?? 0)})`)
          .slice(0, 3);

        return {
          id: item.id,
          date: formatPrepDate(item.created_at, true),
          className: getPrepClass(item),
          subject: getPrepSubject(item),
          chapter: getPrepPrimaryChapter(item),
          testName: item.name || '-',
          score: getPrepScore(item),
          correct: getPrepCorrect(item),
          total: getPrepTotal(item),
          incorrect: getPrepIncorrect(item),
          skipped: getPrepSkipped(item),
          timeSpent: formatDuration(getPrepTimeSpent(item)),
          gaps: weakChapters.length ? weakChapters.join(', ') : 'No visible gaps',
        };
      });
  }, [filteredPrepItems]);

  const prepTimeScoreCorrelation = React.useMemo(() => {
    const points = filteredPrepItems
      .slice()
      .sort((a, b) => {
        const timeA = getPrepTimeSpent(a) ?? 0;
        const timeB = getPrepTimeSpent(b) ?? 0;
        if (timeA !== timeB) return timeA - timeB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .map((item, index) => {
        const timeSpentSec = getPrepTimeSpent(item) ?? 0;
        return {
          label: getPrepLabel(item),
          chartKey: getPrepChartKey(item, index),
          takenOn: formatPrepDate(item.created_at, true),
          timeSpentSec,
          timeLabel: formatDuration(timeSpentSec),
          value: getPrepScore(item),
        };
      });

    return {
      points,
      correlation: computePearsonCorrelation(
        points.map((point) => ({
          x: point.timeSpentSec,
          y: point.value,
        }))
      ),
    };
  }, [filteredPrepItems]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        fontFamily: FONT,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.25s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#111827',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px #1E293B',
          border: '1px solid #1E293B',
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: '#111827',
            borderRadius: '20px 20px 0 0',
            zIndex: 1,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            Student Profile
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              color: '#64748B',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.background = '#1E293B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'none'; }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#14B8A6',
                      animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite`,
                    }}
                  />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748B', fontWeight: 500 }}>
                Loading student details...
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 0',
                color: '#F43F5E',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Student Data */}
          {data && !loading && (
            <>
              {/* Student Info Card */}
              <div
                style={{
                  marginBottom: '24px',
                  borderRadius: '14px',
                  border: '1px solid #1E293B',
                  overflow: 'hidden',
                }}
              >
                {/* Name & Status */}
                <div
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #0F172A, #1E293B)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #334155, #475569)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#F1F5F9',
                        fontFamily: FONT_SERIF,
                      }}
                    >
                      {data.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '18px',
                          fontWeight: 700,
                          color: '#F1F5F9',
                          fontFamily: FONT_SERIF,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {data.full_name}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                        {data.grade || '-'} {data.section || ''} &middot; ID: {data.student_id}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const s = getStatusConfig(data.engagement_status);
                    return (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '99px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: s.color,
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: s.color,
                          }}
                        />
                        {s.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Stats Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    borderTop: '1px solid #1E293B',
                    background: '#0F172A',
                  }}
                >
                  {[
                    {
                      label: 'Last Login',
                      value: data.last_login ? new Date(data.last_login).toLocaleDateString() : 'Never',
                      sub: data.days_since_login != null
                        ? (data.days_since_login === 0 ? 'Today' : `${data.days_since_login}d ago`)
                        : undefined,
                    },
                    {
                      label: 'Sessions/Week',
                      value: String(data.sessions_this_week),
                    },
                    {
                      label: 'Total Sessions',
                      value: String(data.total_sessions),
                    },
                    {
                      label: 'Status',
                      value: data.is_currently_active ? 'Online' : 'Offline',
                      valueColor: data.is_currently_active ? '#10B981' : '#64748B',
                    },
                  ].map((stat, i) => (
                    <div
                      key={stat.label}
                      style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        borderLeft: i > 0 ? '1px solid #1E293B' : undefined,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: '6px',
                        }}
                      >
                        {stat.label}
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: (stat as any).valueColor || '#F1F5F9',
                        }}
                      >
                        {stat.value}
                      </div>
                      {stat.sub && (
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {stat.sub}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gap Analysis */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <svg width="18" height="18" fill="none" stroke="#8B5CF6" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#F1F5F9',
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    Gap Analysis
                  </h4>
                  <span
                    style={{
                      padding: '1px 8px',
                      borderRadius: '99px',
                      background: 'rgba(139,92,246,0.15)',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#8B5CF6',
                    }}
                  >
                    {data.recent_gap_analysis.length}
                  </span>
                </div>

                {data.recent_gap_analysis.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      borderRadius: '12px',
                      background: '#0F172A',
                      border: '1px solid #1E293B',
                      color: '#64748B',
                      fontSize: '13px',
                    }}
                  >
                    No gap analysis records found
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #1E293B',
                      overflow: 'hidden',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#0F172A' }}>
                          {['Date', 'Subject', 'Chapter', 'Score', '%'].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: '10px 16px',
                                textAlign: h === 'Score' || h === '%' ? 'right' : 'left',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#64748B',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontFamily: FONT,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent_gap_analysis.map((ga) => (
                          <tr
                            key={ga.id}
                            style={{
                              borderTop: '1px solid #1E293B',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '10px 16px', color: '#94A3B8' }}>
                              {ga.date ? new Date(ga.date).toLocaleDateString() : '-'}
                            </td>
                            <td style={{ padding: '10px 16px', color: '#F1F5F9', fontWeight: 600 }}>
                              {ga.subject || '-'}
                            </td>
                            <td style={{ padding: '10px 16px', color: '#94A3B8' }}>
                              {ga.chapter_number || '-'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#F1F5F9' }}>
                              {ga.student_score ?? '-'} / {ga.max_marks ?? '-'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              {ga.percentage !== null ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 10px',
                                    borderRadius: '99px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: getScoreColor(ga.percentage),
                                    background: getScoreBg(ga.percentage),
                                  }}
                                >
                                  {Math.round(ga.percentage)}%
                                </span>
                              ) : (
                                <span style={{ color: '#64748B' }}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Exam Results */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <svg width="18" height="18" fill="none" stroke="#14B8A6" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#F1F5F9',
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    Exam Results
                  </h4>
                  <span
                    style={{
                      padding: '1px 8px',
                      borderRadius: '99px',
                      background: 'rgba(20,184,166,0.15)',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#14B8A6',
                    }}
                  >
                    {data.exam_results.length}
                  </span>
                </div>

                {data.exam_results.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      borderRadius: '12px',
                      background: '#0F172A',
                      border: '1px solid #1E293B',
                      color: '#64748B',
                      fontSize: '13px',
                    }}
                  >
                    No exam results found
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #1E293B',
                      overflow: 'hidden',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#0F172A' }}>
                          {['Exam', 'Marks', '%', 'Grade'].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: '10px 16px',
                                textAlign: h === 'Marks' || h === '%' || h === 'Grade' ? 'right' : 'left',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#64748B',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontFamily: FONT,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.exam_results.map((exam) => (
                          <tr
                            key={exam.id}
                            style={{
                              borderTop: '1px solid #1E293B',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '10px 16px', color: '#94A3B8' }}>
                              <span style={{ fontWeight: 600, color: '#F1F5F9' }}>#{exam.exam_id}</span>
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#F1F5F9' }}>
                              {exam.total_marks_obtained ?? '-'} / {exam.total_max_marks ?? '-'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              {exam.overall_percentage !== null ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 10px',
                                    borderRadius: '99px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: getScoreColor(exam.overall_percentage),
                                    background: getScoreBg(exam.overall_percentage),
                                  }}
                                >
                                  {Math.round(exam.overall_percentage)}%
                                </span>
                              ) : (
                                <span style={{ color: '#64748B' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  background: 'rgba(100,116,139,0.15)',
                                  color: '#94A3B8',
                                  border: '1px solid #334155',
                                }}
                              >
                                {exam.grade || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Test Prep Analysis */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <svg width="18" height="18" fill="none" stroke="#8B5CF6" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M10 4h10M10 12h10M10 20h10M4 4h2M4 12h2M4 20h2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#F1F5F9',
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    Spotcheck Analysis
                  </h4>
                </div>

                {allPrepItems.length ? (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {[
                        { label: 'Attempts', value: String(prepSummary.attempts), color: '#8B5CF6' },
                        { label: 'Average Score', value: `${prepSummary.avgScore}%`, color: '#14B8A6' },
                        { label: 'Latest Score', value: prepSummary.latestScore !== null ? `${prepSummary.latestScore}%` : '-', color: '#F59E0B' },
                        { label: 'Average Accuracy', value: `${prepSummary.avgAccuracy}%`, color: '#10B981' },
                      ].map((card) => (
                        <div
                          key={card.label}
                          style={{
                            borderRadius: '12px',
                            border: '1px solid #1E293B',
                            background: '#0F172A',
                            padding: '14px 16px',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            {card.label}
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: card.color, fontFamily: FONT_SERIF }}>
                            {card.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #1E293B',
                        background: '#0F172A',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                          Class
                        </label>
                        <select
                          value={selectedPrepClass}
                          onChange={(e) => setSelectedPrepClass(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #334155',
                            background: '#111827',
                            color: '#F1F5F9',
                            fontSize: 13,
                          }}
                        >
                          {prepClassOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                          Subject
                        </label>
                        <select
                          value={selectedPrepSubject}
                          onChange={(e) => setSelectedPrepSubject(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #334155',
                            background: '#111827',
                            color: '#F1F5F9',
                            fontSize: 13,
                          }}
                        >
                          {prepSubjectOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                          Chapter
                        </label>
                        <select
                          value={selectedPrepChapter}
                          onChange={(e) => setSelectedPrepChapter(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #334155',
                            background: '#111827',
                            color: '#F1F5F9',
                            fontSize: 13,
                          }}
                        >
                          {prepChapterOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {filteredPrepItems.length ? (
                      <>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                            gap: 14,
                          }}
                        >
                          {/* <LineChart
                            title="Filtered Score Improvement Trend"
                            data={studentPrepTrendData}
                            color="#8B5CF6"
                            xDataKey="chartKey"
                            tooltipLabelFormatter={(value) => {
                              const match = studentPrepTrendData.find((item) => item.chartKey === value);
                              return match?.label ?? String(value);
                            }}
                          /> */}
                          <StackedBarChart
                            title="Attempt Outcome"
                            data={studentPrepStackedData}
                            xDataKey="chartKey"
                            xTickFormatter={(value) => {
                              const match = studentPrepStackedData.find((item) => item.chartKey === value);
                              return match?.label ?? String(value);
                            }}
                            tooltipLabelFormatter={(value) => {
                              const match = studentPrepStackedData.find((item) => item.chartKey === value);
                              return match?.label ?? String(value);
                            }}
                            segments={[
                              { key: 'Correct', label: 'Correct', color: '#10B981' },
                              { key: 'Incorrect', label: 'Incorrect', color: '#e11d48' },
                              { key: 'Skipped', label: 'Skipped', color: '#f59e0b' },
                            ]}
                          />
                          <LineChart
                            title={`Time Spent vs Score`}
                            data={prepTimeScoreCorrelation.points}
                            color="#F59E0B"
                            xDataKey="chartKey"
                            showXAxisTicks
                            xTickFormatter={(value) => {
                              const match = prepTimeScoreCorrelation.points.find((item) => item.chartKey === value);
                              return match?.timeLabel ?? String(value);
                            }}
                            tooltipLabelFormatter={(value) => {
                              const match = prepTimeScoreCorrelation.points.find((item) => item.chartKey === value);
                              return match
                                ? `${match.label} • ${match.takenOn} • Time ${match.timeLabel}`
                                : String(value);
                            }}
                            tooltipValueFormatter={(value) => [String(value), 'Score %']}
                          />
                        </div>

                        <div
                          style={{
                            borderRadius: '12px',
                            border: '1px solid #1E293B',
                            overflowX: 'auto',
                            overflowY: 'hidden',
                          }}
                        >
                          <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#0F172A' }}>
                                {['Date', 'Class', 'Subject', 'Chapter', 'Score', 'Outcome', 'Time'].map((h) => (
                                  <th
                                    key={h}
                                    style={{
                                      padding: '10px 16px',
                                      textAlign: h === 'Score' || h === 'Outcome' || h === 'Time' ? 'right' : 'left',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: '#64748B',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                      fontFamily: FONT,
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {prepTableRows.map((row) => (
                                <tr
                                  key={row.id}
                                  style={{ borderTop: '1px solid #1E293B', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <td style={{ padding: '10px 16px', color: '#94A3B8' }}>{row.date}</td>
                                  <td style={{ padding: '10px 16px', color: '#F1F5F9', fontWeight: 600 }}>{row.className}</td>
                                  <td style={{ padding: '10px 16px', color: '#94A3B8' }}>{row.subject}</td>
                                  <td style={{ padding: '10px 16px', color: '#F1F5F9' }}>{row.chapter}</td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 10px',
                                        borderRadius: '99px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        color: getScoreColor(row.score),
                                        background: getScoreBg(row.score),
                                      }}
                                    >
                                      {row.score}%
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#F1F5F9' }}>
                                    {row.correct}/{row.total}
                                  </td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#94A3B8' }}>
                                    {row.timeSpent}
                                  </td>
                                  {/* <td style={{ padding: '10px 16px', color: '#94A3B8', minWidth: 220 }}>
                                    {row.gaps}
                                  </td> */}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '32px',
                          borderRadius: '12px',
                          background: '#0F172A',
                          border: '1px solid #1E293B',
                          color: '#94A3B8',
                          fontSize: '13px',
                        }}
                      >
                        No spotcheck records match the current filters.
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      borderRadius: '12px',
                      background: '#0F172A',
                      border: '1px solid #1E293B',
                      color: '#94A3B8',
                      fontSize: '13px',
                    }}
                  >
                    No spotcheck records found for this student.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1E293B',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1.5px solid #334155',
              background: '#0F172A',
              color: '#94A3B8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0F172A'; e.currentTarget.style.color = '#94A3B8'; }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;
