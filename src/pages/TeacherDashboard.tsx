import React, { useState, useEffect } from 'react';
import { dashboardAPI, alertAPI, engagementAPI, challengeAPI } from '../services/api';
import { TeacherDashboardData } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import MetricsCards from '../components/MetricsCards';
import StudentTable from '../components/StudentTable';
import SendAlertModal from '../components/SendAlertModal';
import SendChallengeModal from '../components/SendChallengeModal';
import StudentDetailModal from '../components/StudentDetailModal';
import { TeacherAnalytics } from '../components/AnalyticsSections';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setDashboardData: shareDashboardData } = useDashboard();
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeStudentId, setChallengeStudentId] = useState<number | null>(null);
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const teacherUsername = user?.username;

  const loadDashboard = async () => {
    if (!teacherUsername) {
      setError('No teacher username provided. Please log in again.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await dashboardAPI.getTeacherDashboardByUsername(teacherUsername);
      setDashboardData(data);
      shareDashboardData(data);
      setError('');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError(`Teacher username "${teacherUsername}" not found in the database.`);
      } else {
        setError('Failed to load dashboard. Please check if the API is running.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [teacherUsername]);

  const handleSendAlert = (studentId: number) => {
    setSelectedStudentId(studentId);
    setShowAlertModal(true);
  };

  const handleSendAlertSubmit = async (studentId: number) => {
    await alertAPI.sendAlert({ student_id: studentId });
    await loadDashboard();
  };

  const handleSendChallenge = (studentId: number) => {
    setChallengeStudentId(studentId);
    setShowChallengeModal(true);
  };

  const handleSendChallengeSubmit = async (studentId: number, subject: string, numQuestions: number, concept?: string) => {
    await challengeAPI.sendChallenge(studentId, subject, numQuestions, concept);
  };

  const handleSendBulkAlert = async () => {
    if (selectedIds.size === 0) {
      alert('No students selected.');
      return;
    }
    const confirmed = window.confirm(`Send WhatsApp alerts to ${selectedIds.size} selected students?`);
    if (!confirmed) return;
    try {
      setRefreshing(true);
      const results = await alertAPI.sendBulkAlert({ student_ids: Array.from(selectedIds) });
      const sent = results.filter((r) => r.success).length;
      setSelectedIds(new Set());
      await loadDashboard();
      alert(`Alerts sent: ${sent}/${selectedIds.size} students.`);
    } catch (err) {
      alert('Failed to send bulk alerts');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#14B8A6', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#94A3B8' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px', background: '#111827', borderRadius: '20px', border: '1px solid #1E293B' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>Connection Error</h2>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748B', lineHeight: 1.5 }}>{error}</p>
          <button onClick={loadDashboard} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0d9488, #14B8A6)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const dayFilterOptions = [
    { label: 'All', value: null },
    { label: 'Today', value: 0 },
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '7 Days', value: 7 },
  ] as const;

  const filteredStudents = dayFilter === null
    ? dashboardData.students
    : dashboardData.students.filter((u) => {
        if (u.auth_provider === 'google') return true;
        if (u.days_since_login === null || u.days_since_login === undefined) return false;
        return u.days_since_login <= dayFilter;
      });

  const teacherLabel = dashboardData.teacher_name || teacherUsername || 'Teacher';

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1a2332 100%)', borderBottom: '1px solid #1E293B' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left - Teacher name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#F1F5F9', fontFamily: FONT_SERIF }}>
              {teacherLabel}
            </h1>
            <span style={{ padding: '4px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '15px', fontWeight: 700, color: '#3B82F6', fontFamily: FONT_SERIF }}>
              {dashboardData.total_students} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8' }}>Students</span>
            </span>
          </div>
          {/* Right - Refresh */}
          <button onClick={loadDashboard} disabled={refreshing} style={{
            padding: '7px 16px', borderRadius: '8px', border: 'none',
            background: 'linear-gradient(135deg, #0d9488, #14B8A6)', color: '#fff',
            fontSize: '12px', fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer',
            fontFamily: FONT, boxShadow: '0 2px 8px rgba(20,184,166,0.25)',
            opacity: refreshing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px' }}>
        {/* Metrics */}
        <MetricsCards
          totalStudents={dashboardData.total_students}
          activeStudents={dashboardData.active_students}
          activeSessions={dashboardData.active_sessions}
          atRiskStudents={dashboardData.at_risk_students}
          inactiveStudents={dashboardData.inactive_students}
          students={dashboardData.students}
        />

        {/* Analytics Section */}
        <div style={{ marginTop: '16px' }}>
          <TeacherAnalytics students={dashboardData.students} />
        </div>

        {/* Student Table Section */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#F1F5F9', fontFamily: FONT_SERIF }}>My Students</h2>
              <span style={{ padding: '2px 10px', borderRadius: '99px', background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', fontSize: '12px', fontWeight: 700, color: '#14B8A6' }}>
                {filteredStudents.length}
              </span>
              {selectedIds.size > 0 && (
                <button onClick={handleSendBulkAlert} disabled={refreshing} style={{ padding: '5px 14px', borderRadius: '8px', border: 'none', background: '#10B981', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer', fontFamily: FONT, opacity: refreshing ? 0.6 : 1 }}>
                  {refreshing ? 'Sending...' : `Alert Selected (${selectedIds.size})`}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {dayFilterOptions.map((opt) => (
                <button key={String(opt.value)} onClick={() => setDayFilter(opt.value)} style={{
                  padding: '4px 10px', borderRadius: '6px',
                  border: dayFilter === opt.value ? '1.5px solid #14B8A6' : '1.5px solid transparent',
                  background: dayFilter === opt.value ? 'rgba(20,184,166,0.15)' : '#111827',
                  color: dayFilter === opt.value ? '#14B8A6' : '#64748B',
                  fontSize: '11px', fontWeight: dayFilter === opt.value ? 700 : 500,
                  cursor: 'pointer', fontFamily: FONT,
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
          <StudentTable
            students={filteredStudents}
            onSendAlert={handleSendAlert}
            onSendChallenge={handleSendChallenge}
            onViewDetails={(studentId) => setViewStudentId(studentId)}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>

        {/* Recent Alerts - AFTER student table */}
        {dashboardData.recent_alerts.length > 0 && (
          <div style={{ marginTop: '16px', background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" fill="none" stroke="#F59E0B" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>Recent Alerts</h2>
              <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>
                {dashboardData.recent_alerts.length}
              </span>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dashboardData.recent_alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: '#0B1120', border: '1px solid #1E293B' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>Student ID: {alert.student_id}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>{alert.reason}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748B' }}>{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => handleSendAlert(alert.student_id)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                      Alert
                    </button>
                    <button onClick={() => handleSendChallenge(alert.student_id)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'rgba(20,184,166,0.15)', color: '#14B8A6', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                      Challenge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewStudentId !== null && (
        <StudentDetailModal studentId={viewStudentId} onClose={() => setViewStudentId(null)} />
      )}
      {showAlertModal && selectedStudentId && (
        <SendAlertModal
          studentId={selectedStudentId}
          studentName={dashboardData.students.find((s) => s.student_id === selectedStudentId)?.full_name}
          onClose={() => { setShowAlertModal(false); setSelectedStudentId(null); }}
          onSend={handleSendAlertSubmit}
        />
      )}
      {showChallengeModal && challengeStudentId && (
        <SendChallengeModal
          studentId={challengeStudentId}
          studentName={dashboardData.students.find((s) => s.student_id === challengeStudentId)?.full_name}
          studentGrade={dashboardData.students.find((s) => s.student_id === challengeStudentId)?.grade || undefined}
          onClose={() => { setShowChallengeModal(false); setChallengeStudentId(null); }}
          onSend={handleSendChallengeSubmit}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;
