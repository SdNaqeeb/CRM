import React, { useState, useEffect, useRef } from 'react';
import { dashboardAPI, alertAPI, activityAPI } from '../services/api';
import { SchoolDashboardData, ActivityOverview, StudentEngagementSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import MetricsCards from '../components/MetricsCards';
import StudentTable from '../components/StudentTable';
import SendAlertModal from '../components/SendAlertModal';
import ActivityFeed from '../components/ActivityFeed';
import StudentDetailModal from '../components/StudentDetailModal';
import { SchoolAnalytics } from '../components/AnalyticsSections';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const SchoolDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setDashboardData } = useDashboard();
  const lastSchoolDashboardRequestRef = useRef<string | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'activity'>('students');
  const [activityData, setActivityData] = useState<ActivityOverview | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  const schoolCode = user?.school_code || '';

  const dayFilterOptions = [
    { label: 'All', value: null },
    { label: 'Today', value: 0 },
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '7 Days', value: 7 },
  ] as const;

  const filterByDays = (users: StudentEngagementSummary[]) => {
    if (dayFilter === null) return users;
    return users.filter((u) => {
      if (u.auth_provider === 'google') return true;
      if (u.days_since_login === null || u.days_since_login === undefined) return false;
      return u.days_since_login <= dayFilter;
    });
  };

  const loadDashboard = async () => {
    if (!schoolCode) {
      setError('No school code provided. Please log in again with a valid school code.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await dashboardAPI.getSchoolDashboardByCode(schoolCode);
      setSchoolData(data);
      setDashboardData(data);
      setError('');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError(`School code "${schoolCode}" not found. Please check your school code and try again.`);
      } else {
        setError('Failed to load dashboard. Please check if the API is running.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    if (activityData || !schoolData) return;
    try {
      setActivityLoading(true);
      const data = await activityAPI.getSchoolActivity(schoolData.school_id);
      setActivityData(data);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!schoolCode) return;
    if (lastSchoolDashboardRequestRef.current === schoolCode) return;
    lastSchoolDashboardRequestRef.current = schoolCode;
    loadDashboard();
  }, [schoolCode]);

  const handleSendAlert = (studentId: number) => {
    setSelectedStudentId(studentId);
    setShowAlertModal(true);
  };

  const handleSendAlertSubmit = async (studentId: number) => {
    await alertAPI.sendAlert({ student_id: studentId });
    await loadDashboard();
  };

  const handleSendBulkAlert = async () => {
    if (selectedIds.size === 0) {
      alert('No students selected. Use the checkboxes to select students.');
      return;
    }
    const confirmed = window.confirm(`Send WhatsApp alerts to ${selectedIds.size} selected students?`);
    if (!confirmed) return;
    try {
      setBulkSending(true);
      const results = await alertAPI.sendBulkAlert({ student_ids: Array.from(selectedIds) });
      const sent = results.filter((r) => r.success).length;
      setSelectedIds(new Set());
      await loadDashboard();
      alert(`Alerts sent: ${sent}/${selectedIds.size} students.`);
    } catch (err) {
      alert('Failed to send bulk alerts');
      console.error(err);
    } finally {
      setBulkSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: 'transparent' }}>
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

  if (error || !schoolData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: 'transparent' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px', background: '#111827', borderRadius: '20px', border: '1px solid #1E293B' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(244,63,94,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="28" height="28" fill="none" stroke="#F43F5E" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" /><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" /></svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>Connection Error</h2>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748B', lineHeight: 1.5 }}>{error}</p>
          <button onClick={loadDashboard} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #7c3aed, #8B5CF6)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredStudentsList = filterByDays(schoolData.students);
  const filteredTeachersList = filterByDays(schoolData.teachers);
  const allUsers = [...schoolData.students, ...schoolData.teachers];
  const displayUsers = activeTab === 'students' ? filteredStudentsList : filteredTeachersList;

  const ProgressBar: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
        <span style={{ color: '#94A3B8', fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value} / {total}</span>
      </div>
      <div style={{ width: '100%', height: '6px', borderRadius: '99px', background: '#1E293B' }}>
        <div style={{ width: `${total > 0 ? (value / total) * 100 : 0}%`, height: '100%', borderRadius: '99px', background: color, transition: 'width 0.6s ease-out' }} />
      </div>
    </div>
  );

  const tabs = [
    { key: 'students' as const, label: 'Students', count: filteredStudentsList.length, color: '#3B82F6' },
    // { key: 'teachers' as const, label: 'Teachers', count: filteredTeachersList.length, color: '#8B5CF6' },
    { key: 'activity' as const, label: 'Activity', count: null, color: '#10B981' },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1a1f3d 100%)', borderBottom: '1px solid #1E293B' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left - School name + trend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.03em', fontFamily: FONT_SERIF }}>
              {schoolData.school_name}
            </h1>
            {/* <span style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
              background: schoolData.engagement_trend === 'up' ? 'rgba(16,185,129,0.15)' : schoolData.engagement_trend === 'down' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: schoolData.engagement_trend === 'up' ? '#10B981' : schoolData.engagement_trend === 'down' ? '#F43F5E' : '#F59E0B',
            }}>
              {schoolData.engagement_trend === 'up' ? '\u2191 Improving' : schoolData.engagement_trend === 'down' ? '\u2193 Declining' : '\u2192 Stable'}
            </span> */}
          </div>
          {/* Middle - Students & Teachers */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ padding: '4px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '14px', fontWeight: 700, color: '#3B82F6', fontFamily: FONT_SERIF }}>
              {schoolData.students.length} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8' }}>Students</span>
            </span>
            {/* <span style={{ padding: '4px 14px', borderRadius: '8px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '14px', fontWeight: 700, color: '#8B5CF6', fontFamily: FONT_SERIF }}>
              {schoolData.teachers.length} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8' }}>Teachers</span>
            </span> */}
          </div>
          {/* Right - Refresh */}
          <button onClick={loadDashboard} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #7c3aed, #8B5CF6)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 8px rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        <MetricsCards
          totalStudents={schoolData.total_students}
          activeStudents={schoolData.active_this_week}
          activeSessions={schoolData.active_sessions}
          atRiskStudents={schoolData.at_risk_count}
          inactiveStudents={schoolData.inactive_count}
          totalSessions={schoolData.total_sessions_this_week}
          trend={schoolData.engagement_trend}
          students={schoolData.students}
        />

        {/* nothing here — trend shown in header */}

        {/* Analytics Section */}
        <div style={{ marginTop: '24px' }}>
          <SchoolAnalytics students={schoolData.students} trend={schoolData.engagement_trend} />
        </div>

        {/* Tabs */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); if (t.key === 'activity') loadActivity(); }}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '99px',
                    border: activeTab === t.key ? `1.5px solid ${t.color}` : '1.5px solid transparent',
                    background: activeTab === t.key ? `${t.color}1A` : '#111827',
                    color: activeTab === t.key ? t.color : '#64748B',
                    fontSize: '13px',
                    fontWeight: activeTab === t.key ? 700 : 500,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    transition: 'all 0.15s',
                  }}
                >
                  {t.label}
                  {t.count !== null && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, opacity: 0.7 }}>{t.count}</span>}
                </button>
              ))}
              {selectedIds.size > 0 && activeTab === 'students' && (
                <button onClick={handleSendBulkAlert} disabled={bulkSending} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: '#10B981', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: bulkSending ? 'wait' : 'pointer', fontFamily: FONT, opacity: bulkSending ? 0.6 : 1 }}>
                  {bulkSending ? 'Sending...' : `Alert Selected (${selectedIds.size})`}
                </button>
              )}
            </div>

            {activeTab !== 'activity' && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginRight: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Filter</span>
                {dayFilterOptions.map((opt) => (
                  <button key={String(opt.value)} onClick={() => setDayFilter(opt.value)} style={{ padding: '5px 12px', borderRadius: '8px', border: dayFilter === opt.value ? '1.5px solid #8B5CF6' : '1.5px solid transparent', background: dayFilter === opt.value ? 'rgba(139,92,246,0.15)' : '#111827', color: dayFilter === opt.value ? '#8B5CF6' : '#64748B', fontSize: '12px', fontWeight: dayFilter === opt.value ? 700 : 500, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
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
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>No activity data available.</div>
            )
          ) : (
            <StudentTable
              students={displayUsers}
              onSendAlert={handleSendAlert}
              onViewDetails={(studentId) => setViewStudentId(studentId)}
              selectedIds={activeTab === 'students' ? selectedIds : undefined}
              onSelectionChange={activeTab === 'students' ? setSelectedIds : undefined}
            />
          )}
        </div>

        {/* Recent Alerts */}
        {schoolData.recent_alerts.length > 0 && (
          <div style={{ marginTop: '24px', background: '#111827', borderRadius: '16px', border: '1px solid #1E293B', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" fill="none" stroke="#F59E0B" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#F1F5F9' }}>Recent Alerts</h2>
              <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', fontSize: '12px', fontWeight: 700, color: '#F59E0B' }}>{schoolData.recent_alerts.length}</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {schoolData.recent_alerts.slice(0, 10).map((alert) => (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', background: '#0B1120', border: '1px solid #1E293B' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F1F5F9' }}>ID: {alert.student_id}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94A3B8' }}>{alert.reason}</p>
                  </div>
                  <button onClick={() => handleSendAlert(alert.student_id)} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; }}
                  >
                    Send Alert
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {viewStudentId !== null && (
        <StudentDetailModal studentId={viewStudentId} onClose={() => setViewStudentId(null)} />
      )}
      {showAlertModal && selectedStudentId && (
        <SendAlertModal
          studentId={selectedStudentId}
          studentName={allUsers.find((s) => s.student_id === selectedStudentId)?.full_name}
          onClose={() => { setShowAlertModal(false); setSelectedStudentId(null); }}
          onSend={handleSendAlertSubmit}
        />
      )}
    </div>
  );
};

export default SchoolDashboard;
