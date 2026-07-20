import React from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

interface DailyRecord {
  date: string;
  day: string;
  time_spent_minutes: number;
  target_met: boolean;
  sessions: number;
}

interface EngagementData {
  student_id: number;
  student_name: string;
  grade: string;
  section: string;
  current_week: DailyRecord[];
  weekly_total_minutes: number;
  target_hours: number;
  achieved_hours: number;
  target_met: boolean;
  streak_days: number;
  compliance_percent: number;
}

interface EngagementTrackingProps {
  students: EngagementData[];
}

const EngagementTracking: React.FC<EngagementTrackingProps> = ({ students }) => {
  const getStreakColor = (streak: number) => streak >= 5 ? '#10B981' : streak >= 3 ? '#F59E0B' : '#F43F5E';
  const getComplianceColor = (pct: number) => pct >= 85 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#F43F5E';

  return (
    <div style={{ fontFamily: FONT }}>
      {students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>
          No engagement data available.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '16px' }}>
          {students.map((student) => (
            <div
              key={student.student_id}
              style={{
                background: '#111827',
                border: '1px solid #1E293B',
                borderRadius: '14px',
                padding: '18px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1E293B';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 700, color: '#F1F5F9', fontFamily: FONT_SERIF }}>
                    {student.student_name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                    {student.grade} {student.section}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#14B8A6', fontFamily: FONT_SERIF }}>
                    {student.achieved_hours.toFixed(1)}h
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                    / {student.target_hours}h target
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
                {/* Compliance */}
                <div style={{
                  background: '#0B1120',
                  borderRadius: '10px',
                  padding: '10px',
                  textAlign: 'center',
                  border: `1px solid ${getComplianceColor(student.compliance_percent)}33`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: getComplianceColor(student.compliance_percent) }}>
                    {student.compliance_percent.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Compliance</div>
                </div>

                {/* Target Status */}
                <div style={{
                  background: '#0B1120',
                  borderRadius: '10px',
                  padding: '10px',
                  textAlign: 'center',
                  border: student.target_met ? '1px solid #10B98133' : '1px solid #F43F5E33'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: student.target_met ? '#10B981' : '#F43F5E' }}>
                    {student.target_met ? '✓ Met' : '✗ Below'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Weekly Target</div>
                </div>

                {/* Streak */}
                <div style={{
                  background: '#0B1120',
                  borderRadius: '10px',
                  padding: '10px',
                  textAlign: 'center',
                  border: `1px solid ${getStreakColor(student.streak_days)}33`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: getStreakColor(student.streak_days) }}>
                    {student.streak_days}d
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Streak</div>
                </div>
              </div>

              {/* Daily Breakdown */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Daily Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {student.current_week.map((day) => {
                    const metTarget = day.target_met;
                    const bgColor = metTarget ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)';
                    const borderColor = metTarget ? '#10B981' : '#F43F5E';

                    return (
                      <div
                        key={day.date}
                        style={{
                          background: bgColor,
                          border: `1.5px solid ${borderColor}`,
                          borderRadius: '8px',
                          padding: '8px',
                          textAlign: 'center',
                          cursor: 'default'
                        }}
                        title={`${day.day}: ${day.time_spent_minutes}m (${day.sessions} sessions)`}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#F1F5F9' }}>
                          {day.day.slice(0, 3)}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: borderColor, marginTop: '2px' }}>
                          {day.time_spent_minutes}m
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '8px', borderRadius: '99px', background: '#1E293B', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (student.achieved_hours / student.target_hours) * 100)}%`,
                      height: '100%',
                      borderRadius: '99px',
                      background: getComplianceColor(student.compliance_percent),
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', minWidth: '35px' }}>
                  {((student.achieved_hours / student.target_hours) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EngagementTracking;
