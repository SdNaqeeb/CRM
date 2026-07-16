import React from 'react';
import { TeacherExamItem, ExamAttemptItem } from '../services/api';

const FONT = "'Plus Jakarta Sans', sans-serif";

interface WeeklyExamResultsProps {
  exams: TeacherExamItem[];
  loading: boolean;
  onSelectExam: (examId: number) => void;
  selectedExamId: number | null;
  attempts: ExamAttemptItem[] | null;
  attemptsLoading: boolean;
}

const scoreColor = (pct?: number | null) => pct == null ? '#94A3B8' : pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F43F5E';

const WeeklyExamResults: React.FC<WeeklyExamResultsProps> = ({
  exams, loading, onSelectExam, selectedExamId, attempts, attemptsLoading,
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
          ))}
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8', fontFamily: FONT }}>Loading exams...</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px', fontFamily: FONT }}>
        No exams found.
      </div>
    );
  }

  // Ranked attempts (sorted by percentage desc)
  const rankedAttempts = attempts
    ? [...attempts]
        .sort((a, b) => b.percentage - a.percentage)
        .map((a, i) => ({ ...a, rank: i + 1 }))
    : null;

  const selectedExam = exams.find(e => e.exam_id === selectedExamId);
  const classAvg = rankedAttempts && rankedAttempts.length > 0
    ? Math.round((rankedAttempts.reduce((s, r) => s + r.percentage, 0) / rankedAttempts.length) * 10) / 10
    : null;

  return (
    <div style={{ fontFamily: FONT }}>

      {/* Exam list */}
      {!selectedExamId ? (
        <div style={{ background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>Exams</span>
            <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>
              {exams.length}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', background: '#0B1120' }}>
                {['Exam Name', 'Type', 'Students', 'Attempted', 'Avg Score'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exams.map((exam, i) => (
                <tr
                  key={exam.exam_id}
                  onClick={() => onSelectExam(exam.exam_id)}
                  style={{ borderBottom: i < exams.length - 1 ? '1px solid #1E293B' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#F1F5F9' }}>{exam.name ?? exam.exam_name ?? `Exam #${exam.exam_id}`}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
                      {exam.exam_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{exam.total_students}</td>
                  <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{exam.attempted_count ?? '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, color: scoreColor(exam.average_score), fontSize: '14px' }}>
                      {exam.average_score == null ? '-' : `${exam.average_score.toFixed(1)}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Drill-down: student attempts */
        <div>
          <button
            onClick={() => onSelectExam(0)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94A3B8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Exams
          </button>

          {attemptsLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>Loading results...</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {rankedAttempts && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#F1F5F9' }}>{selectedExam?.attempted_count ?? rankedAttempts.length}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Attempted</div>
                  </div>
                  <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: classAvg != null ? scoreColor(classAvg) : '#F1F5F9' }}>{classAvg ?? '—'}%</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Class Avg</div>
                  </div>
                  <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#10B981' }}>
                      {rankedAttempts.filter(r => r.percentage >= 40).length}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Passed</div>
                  </div>
                  <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#F43F5E' }}>
                      {rankedAttempts.filter(r => r.percentage < 40).length}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Failed</div>
                  </div>
                </div>
              )}

              {!rankedAttempts || rankedAttempts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>No attempts found for this exam.</div>
              ) : (
                <div style={{ background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>{selectedExam?.name ?? selectedExam?.exam_name ?? 'Exam'}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>
                      {rankedAttempts.length} students
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: FONT }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1E293B', background: '#0B1120' }}>
                        {['Rank', 'Student', 'Class', 'Section', 'Score', '%', 'Grade', 'Status'].map(h => (
                          <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rankedAttempts.map((s, i) => {
                        const pass = s.percentage >= 40;
                        return (
                          <tr key={s.student_id} style={{ borderBottom: i < rankedAttempts.length - 1 ? '1px solid #1E293B' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#F1F5F9' }}>#{s.rank}</td>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#F1F5F9' }}>{s.student_name}</td>
                            <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{s.class_name ?? '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{s.section_name ?? '—'}</td>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#F1F5F9' }}>{s.score_obtained}/{s.max_score}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontWeight: 700, color: scoreColor(s.percentage), fontSize: '14px' }}>{s.percentage}%</span>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#94A3B8' }}>{s.grade}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: pass ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: pass ? '#10B981' : '#F43F5E' }}>
                                {pass ? 'Pass' : 'Fail'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyExamResults;
