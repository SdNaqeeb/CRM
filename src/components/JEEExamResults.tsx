import React, { useState } from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";

interface SubjectScore {
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  max_score: number;
}

interface StudentJEEResult {
  student_id: number;
  student_name: string;
  grade: string;
  section: string;
  total_score: number;
  max_score: number;
  score_percent: number;
  rank: number;
  physics: SubjectScore;
  chemistry: SubjectScore;
  mathematics: SubjectScore;
  time_spent_sec: number;
  accuracy_percent: number;
}

interface JEEExam {
  exam_id: number;
  exam_date: string;
  week: number;
  total_marks: number;
  duration_minutes: number;
  total_students: number;
  students_appeared: number;
  results: StudentJEEResult[];
}

interface JEEExamResultsProps {
  exams: JEEExam[];
}

const JEEExamResults: React.FC<JEEExamResultsProps> = ({ exams }) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(exams.length > 0 ? exams[0].week : 0);
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);

  const currentExam = exams.find((e) => e.week === selectedWeek);

  if (!currentExam) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px', fontFamily: FONT }}>
        No JEE exam data available.
      </div>
    );
  }

  const scoreColor = (pct: number) => pct >= 75 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#F43F5E';
  const classAvg = currentExam.results.length > 0
    ? Math.round((currentExam.results.reduce((s, r) => s + r.score_percent, 0) / currentExam.results.length) * 10) / 10
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Week Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {exams.map((exam) => (
          <button
            key={exam.week}
            onClick={() => setSelectedWeek(exam.week)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: selectedWeek === exam.week ? '1.5px solid #8B5CF6' : '1.5px solid #334155',
              background: selectedWeek === exam.week ? 'rgba(139,92,246,0.15)' : '#111827',
              color: selectedWeek === exam.week ? '#8B5CF6' : '#64748B',
              fontSize: '13px',
              fontWeight: selectedWeek === exam.week ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Week {exam.week}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>{currentExam.students_appeared}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Appeared</div>
        </div>
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: scoreColor(classAvg) }}>{classAvg}%</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Class Avg</div>
        </div>
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1E293B', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>{currentExam.duration_minutes}m</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Duration</div>
        </div>
      </div>

      {/* Results Table */}
      <div style={{ background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1E293B', background: '#0B1120' }}>
              {['Rank', 'Student', 'Score', '%', 'Physics', 'Chem', 'Maths', 'Accuracy', 'Time'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 14px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentExam.results.map((student, i) => (
              <React.Fragment key={student.student_id}>
                <tr
                  style={{
                    borderBottom: expandedStudent === student.student_id ? 'none' : i < currentExam.results.length - 1 ? '1px solid #1E293B' : 'none',
                    background: expandedStudent === student.student_id ? 'rgba(139,92,246,0.1)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onClick={() => setExpandedStudent(expandedStudent === student.student_id ? null : student.student_id)}
                  onMouseEnter={(e) => {
                    if (expandedStudent !== student.student_id) {
                      e.currentTarget.style.background = 'rgba(139,92,246,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (expandedStudent !== student.student_id) {
                      e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                    }
                  }}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#F1F5F9' }}>#{student.rank}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{student.student_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{student.section}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#F1F5F9' }}>
                    {student.total_score}/{student.max_score}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontWeight: 700, color: scoreColor(student.score_percent), fontSize: '14px' }}>
                      {student.score_percent.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: scoreColor((student.physics.score / 120) * 100) }}>
                    {student.physics.score}/120
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: scoreColor((student.chemistry.score / 120) * 100) }}>
                    {student.chemistry.score}/120
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: scoreColor((student.mathematics.score / 120) * 100) }}>
                    {student.mathematics.score}/120
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                    {student.accuracy_percent.toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94A3B8' }}>
                    {formatTime(student.time_spent_sec)}
                  </td>
                </tr>

                {/* Expanded Detail Row */}
                {expandedStudent === student.student_id && (
                  <tr style={{ background: 'rgba(139,92,246,0.08)', borderBottom: i < currentExam.results.length - 1 ? '1px solid #1E293B' : 'none' }}>
                    <td colSpan={9} style={{ padding: '16px 14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        {/* Physics Detail */}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>Physics</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <div style={{ color: '#94A3B8' }}>Score: <span style={{ color: '#10B981', fontWeight: 700 }}>{student.physics.score}/120</span></div>
                            <div style={{ color: '#94A3B8' }}>Correct: <span style={{ color: '#10B981', fontWeight: 700 }}>{student.physics.correct}</span></div>
                            <div style={{ color: '#94A3B8' }}>Wrong: <span style={{ color: '#F43F5E', fontWeight: 700 }}>{student.physics.incorrect}</span></div>
                            <div style={{ color: '#94A3B8' }}>Skipped: <span style={{ color: '#F59E0B', fontWeight: 700 }}>{student.physics.skipped}</span></div>
                          </div>
                        </div>

                        {/* Chemistry Detail */}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>Chemistry</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <div style={{ color: '#94A3B8' }}>Score: <span style={{ color: '#10B981', fontWeight: 700 }}>{student.chemistry.score}/120</span></div>
                            <div style={{ color: '#94A3B8' }}>Correct: <span style={{ color: '#10B981', fontWeight: 700 }}>{student.chemistry.correct}</span></div>
                            <div style={{ color: '#94A3B8' }}>Wrong: <span style={{ color: '#F43F5E', fontWeight: 700 }}>{student.chemistry.incorrect}</span></div>
                            <div style={{ color: '#94A3B8' }}>Skipped: <span style={{ color: '#F59E0B', fontWeight: 700 }}>{student.chemistry.skipped}</span></div>
                          </div>
                        </div>

                        {/* Mathematics Detail */}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px' }}>Mathematics</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <div style={{ color: '#94A3B8' }}>Score: <span style={{ color: '#10B981', fontWeight: 700 }}>{student.mathematics.score}/120</span></div>
                            <div style={{ color: '#94A3B8' }}>Correct: <span style={{ color: '#10B981', fontWeight: 700 }}>{student.mathematics.correct}</span></div>
                            <div style={{ color: '#94A3B8' }}>Wrong: <span style={{ color: '#F43F5E', fontWeight: 700 }}>{student.mathematics.incorrect}</span></div>
                            <div style={{ color: '#94A3B8' }}>Skipped: <span style={{ color: '#F59E0B', fontWeight: 700 }}>{student.mathematics.skipped}</span></div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JEEExamResults;
