import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { EngagementStatus } from '../types';

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
}

interface StudentDetailModalProps {
  studentId: number;
  onClose: () => void;
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ studentId, onClose }) => {
  const [data, setData] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await dashboardAPI.getStudentSummary(studentId);
        setData(result);
      } catch (err) {
        setError('Failed to load student details');
        console.error(err);
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
