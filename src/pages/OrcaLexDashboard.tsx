import React, { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { dashboardAPI, activityAPI } from '../services/api';
import { OrcaLexDashboardData, ActivityOverview, EngagementStatus } from '../types';
import StudentTable from '../components/StudentTable';
import ActivityFeed from '../components/ActivityFeed';
import StudentDetailModal from '../components/StudentDetailModal';
import { AdminAnalytics } from '../components/AnalyticsSections';
import MockExamEngagementScatter from '../components/MockExamEngagementScatter';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const OrcaLexDashboard: React.FC = () => {
  const { setDashboardData } = useDashboard();
  const [data, setData] = useState<OrcaLexDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'activity'>('students');
  const [activityData, setActivityData] = useState<ActivityOverview | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);

  const loadSchoolActivity = async (schoolId: number) => {
    try {
      setActivityLoading(true);
      const result = await activityAPI.getSchoolActivity(schoolId);
      setActivityData(result);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result = await dashboardAPI.getOrcaLexDashboard();
      setData(result);
      setDashboardData(result);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  // When school filter changes, load activity for that school
  useEffect(() => {
    if (!data || schoolFilter === 'all') {
      setActivityData(null);
      return;
    }
    const school = data.schools.find(s => String(s.school_id) === schoolFilter);
    if (school) {
      loadSchoolActivity(school.school_id);
    }
  }, [schoolFilter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8B5CF6', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#94A3B8' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px', background: '#111827', borderRadius: '20px', border: '1px solid #1E293B' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>Connection Error</h2>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748B', lineHeight: 1.5 }}>{error}</p>
          <button onClick={loadDashboard} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #7c3aed, #8B5CF6)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const dayFilterOptions = [
    { label: 'All', value: null },
    { label: 'Today', value: 0 },
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '7 Days', value: 7 },
  ] as const;

  const filterByDays = (users: typeof data.all_students) => {
    if (dayFilter === null) return users;
    return users.filter((u) => {
      if (u.auth_provider === 'google') return true;
      if (u.days_since_login === null || u.days_since_login === undefined) return false;
      return u.days_since_login <= dayFilter;
    });
  };

  // Filter by school using school_id on each student/teacher
  const filterBySchool = (users: typeof data.all_students) => {
    if (schoolFilter === 'all') return users;
    const sid = parseInt(schoolFilter);
    return users.filter(u => u.school_id === sid);
  };

  const filteredStudents = filterBySchool(filterByDays(data.all_students));
  const filteredTeachers = filterBySchool(filterByDays(data.all_teachers));

  // Compute counts based on filtered data
  const activeCount = filteredStudents.filter(s => s.engagement_status === EngagementStatus.ACTIVE).length
    + filteredTeachers.filter(s => s.engagement_status === EngagementStatus.ACTIVE).length;
  const atRiskCount = filteredStudents.filter(s => s.engagement_status === EngagementStatus.AT_RISK).length
    + filteredTeachers.filter(s => s.engagement_status === EngagementStatus.AT_RISK).length;
  const inactiveCount = filteredStudents.filter(s => s.engagement_status === EngagementStatus.INACTIVE).length
    + filteredTeachers.filter(s => s.engagement_status === EngagementStatus.INACTIVE).length;
  const totalFiltered = filteredStudents.length + filteredTeachers.length;
  const activePct = totalFiltered > 0 ? Math.round((activeCount / totalFiltered) * 100) : 0;
  const atRiskPct = totalFiltered > 0 ? Math.round((atRiskCount / totalFiltered) * 100) : 0;
  const inactivePct = totalFiltered > 0 ? Math.round((inactiveCount / totalFiltered) * 100) : 0;

  const topMetrics = [
    { label: 'Schools', value: data.total_schools, color: '#14B8A6' },
    { label: 'Students', value: filteredStudents.length, color: '#3B82F6' },
    { label: 'Teachers', value: filteredTeachers.length, color: '#8B5CF6' },
    { label: 'Sessions', value: data.active_sessions, color: '#06B6D4', sub: 'Live' },
  ];

  const statusCards = [
    { label: 'Active', value: activeCount, pct: activePct, color: '#10B981' },
    { label: 'At-Risk', value: atRiskCount, pct: atRiskPct, color: '#F59E0B' },
    { label: 'Inactive', value: inactiveCount, pct: inactivePct, color: '#F43F5E' },
  ];

  const tabs = [
    { key: 'students' as const, label: 'Students', count: filteredStudents.length, color: '#3B82F6' },
    { key: 'teachers' as const, label: 'Teachers', count: filteredTeachers.length, color: '#8B5CF6' },
    { key: 'activity' as const, label: 'Activity', count: null, color: '#10B981' },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E1B4B, #312E81)', borderBottom: '1px solid #3730a3' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff', fontFamily: FONT_SERIF }}>OrcaLex Admin</h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#a5b4fc' }}>Smartlearners.ai Platform Overview</p>
          </div>
          <button onClick={loadDashboard} style={{ padding: '7px 14px', borderRadius: '8px', border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '5px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px' }}>
        {/* Top row: metric cards + status cards */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {/* Metric cards */}
          {topMetrics.map((m, i) => (
            <div key={m.label} style={{
              flex: '1 1 120px', background: '#111827', borderRadius: '12px',
              border: `1px solid ${m.color}33`, borderTop: `3px solid ${m.color}`,
              padding: '14px 12px', textAlign: 'center', transition: 'all 0.2s',
              animation: `entrance-stagger 0.3s ease-out ${i * 0.05}s both`,
            }}>
              <p style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: m.color, fontFamily: FONT_SERIF, lineHeight: 1 }}>{m.value}</p>
              <p style={{ margin: '4px 0 0', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</p>
              {m.sub && <p style={{ margin: '2px 0 0', fontSize: '10px', color: m.color, fontWeight: 600 }}>{m.sub}</p>}
            </div>
          ))}

          {/* Divider */}
          <div style={{ width: '1px', background: '#1E293B', alignSelf: 'stretch', margin: '0 4px' }} />

          {/* Status cards - Active, At-Risk, Inactive side by side with percentage */}
          {statusCards.map((s, i) => (
            <div key={s.label} style={{
              flex: '1 1 120px', background: '#111827', borderRadius: '12px',
              border: `1px solid ${s.color}33`, borderTop: `3px solid ${s.color}`,
              padding: '14px 12px', textAlign: 'center', transition: 'all 0.2s',
              animation: `entrance-stagger 0.3s ease-out ${(i + 4) * 0.05}s both`,
            }}>
              <p style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: s.color, fontFamily: FONT_SERIF, lineHeight: 1 }}>{s.value}</p>
              <p style={{ margin: '4px 0 0', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: s.color, fontWeight: 700 }}>{s.pct}%</p>
            </div>
          ))}
        </div>

        {/* Analytics Section - School Donut Charts */}
        <div style={{ marginBottom: '16px' }}>
          <AdminAnalytics schools={data.schools} allStudents={data.all_students} />
        </div>

        {/* Mock Exam: Student Engagement vs Improvement Scatter */}
        <MockExamEngagementScatter />

        {/* Tabs with School Filter */}
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  padding: '6px 14px', borderRadius: '99px',
                  border: activeTab === t.key ? `1.5px solid ${t.color}` : '1.5px solid transparent',
                  background: activeTab === t.key ? `${t.color}1A` : '#111827',
                  color: activeTab === t.key ? t.color : '#64748B',
                  fontSize: '12px', fontWeight: activeTab === t.key ? 700 : 500,
                  cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                }}>
                  {t.label}
                  {t.count !== null && <span style={{ marginLeft: '5px', fontSize: '11px', fontWeight: 700, opacity: 0.7 }}>{t.count}</span>}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* School Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>School</span>
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  style={{
                    padding: '5px 10px', borderRadius: '6px',
                    border: '1.5px solid #334155', background: '#0F172A',
                    fontSize: '12px', fontWeight: 500, color: '#94A3B8',
                    cursor: 'pointer', outline: 'none', fontFamily: FONT,
                  }}
                >
                  <option value="all">All Schools</option>
                  {data.schools.map(s => (
                    <option key={s.school_id} value={String(s.school_id)}>{s.school_name}</option>
                  ))}
                </select>
              </div>

              {/* Day Filter */}
              {activeTab !== 'activity' && (
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {dayFilterOptions.map((opt) => (
                    <button key={String(opt.value)} onClick={() => setDayFilter(opt.value)} style={{
                      padding: '4px 8px', borderRadius: '6px',
                      border: dayFilter === opt.value ? '1.5px solid #8B5CF6' : '1.5px solid transparent',
                      background: dayFilter === opt.value ? 'rgba(139,92,246,0.15)' : '#111827',
                      color: dayFilter === opt.value ? '#8B5CF6' : '#64748B',
                      fontSize: '11px', fontWeight: dayFilter === opt.value ? 700 : 500,
                      cursor: 'pointer', fontFamily: FONT,
                    }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {activeTab === 'activity' ? (
            activityLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>Loading activity...</p>
              </div>
            ) : activityData ? (
              <ActivityFeed data={activityData} />
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>
                {schoolFilter === 'all' ? 'Select a school from the filter to view activity.' : 'No activity data available.'}
              </div>
            )
          ) : (
            <StudentTable
              students={activeTab === 'students' ? filteredStudents : filteredTeachers}
              onSendAlert={() => {}}
              onViewDetails={(studentId) => setViewStudentId(studentId)}
            />
          )}
        </div>
      </div>

      {/* Student Detail Modal */}
      {viewStudentId !== null && (
        <StudentDetailModal
          studentId={viewStudentId}
          onClose={() => setViewStudentId(null)}
        />
      )}
    </div>
  );
};

export default OrcaLexDashboard;
