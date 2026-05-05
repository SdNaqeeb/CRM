import React, { useState, useEffect, useMemo } from 'react';
import { dashboardAPI, alertAPI, activityAPI, challengeAPI } from '../services/api';
import { TeacherDashboardData, ActivityOverview, TestPrepItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import MetricsCards from '../components/MetricsCards';
import StudentTable from '../components/StudentTable';
import SendAlertModal from '../components/SendAlertModal';
import SendChallengeModal from '../components/SendChallengeModal';
import StudentDetailModal from '../components/StudentDetailModal';
import ActivityFeed from '../components/ActivityFeed';
import { SchoolAnalytics } from '../components/AnalyticsSections';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setDashboardData: shareDashboardData } = useDashboard();

  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'students' | 'pre-assessment' | 'activity'>('students');
  const [activityData, setActivityData] = useState<ActivityOverview | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [testPrepData, setTestPrepData] = useState<TestPrepItem[] | null>(null);
  const [testPrepLoading, setTestPrepLoading] = useState(false);

  const [prepChapterFilter, setPrepChapterFilter] = useState<string>('All');
  const [prepClassFilter, setPrepClassFilter] = useState<string>('All');
  const [prepSectionFilter, setPrepSectionFilter] = useState<string>('All');
  const [prepMinAttempts, setPrepMinAttempts] = useState<number>(1);
  const [prepMinScore, setPrepMinScore] = useState<number>(0);

  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeStudentId, setChallengeStudentId] = useState<number | null>(null);
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);

  const teacherUsername = user?.username;

  const dayFilterOptions = [
    { label: 'All', value: null },
    { label: 'Today', value: 0 },
    { label: '1 Day', value: 1 },
    { label: '2 Days', value: 2 },
    { label: '7 Days', value: 7 },
  ] as const;

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

  const loadActivity = async () => {
    if (activityData || !user?.school_id) return;
    try {
      setActivityLoading(true);
      const data = await activityAPI.getSchoolActivity(user.school_id);
      setActivityData(data);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const loadTestPrep = async () => {
    if (testPrepData || !user?.school_code) return;
    try {
      setTestPrepLoading(true);
      const result = await dashboardAPI.getTestPrepBySchoolCode(user.school_code);
      setTestPrepData(result.items ?? []);
    } catch (err) {
      console.error('Failed to load test prep:', err);
      setTestPrepData([]);
    } finally {
      setTestPrepLoading(false);
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
    if (selectedIds.size === 0) { alert('No students selected.'); return; }
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

  // ── Test prep helpers ──────────────────────────────────────────────────────

  const getPrepItemScore = (item: TestPrepItem) =>
    Number(item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? item.analysis?.prediction?.score_pct ?? 0);

  const getItemChapters = (item: TestPrepItem): string[] => {
    const breakdown: any[] = item.graph_data?.chapter_breakdown ?? [];
    if (breakdown.length > 0) {
      const chapters = breakdown.map((e: any) => String(e.chapter || '')).filter(Boolean);
      if (chapters.length > 0) return chapters;
    }
    return (item.questions ?? []).map((q: any) => String(q.chapter || '')).filter(Boolean);
  };

  const testPrepByStudentId = useMemo(() => {
    const map = new Map<number, TestPrepItem[]>();
    if (!testPrepData || !dashboardData) return map;
    const teacherStudentIds = new Set(dashboardData.students.map((s) => s.student_id));
    for (const item of testPrepData) {
      if (!item.student_id || !teacherStudentIds.has(item.student_id)) continue;
      const list = map.get(item.student_id) ?? [];
      list.push(item);
      map.set(item.student_id, list);
    }
    return map;
  }, [testPrepData, dashboardData]);

  const prepChapterOptions = useMemo(() => {
    if (!testPrepData) return ['All'];
    const chapters = new Set<string>();
    testPrepByStudentId.forEach((items) => items.forEach((item) => getItemChapters(item).forEach((ch) => chapters.add(ch))));
    return ['All', ...Array.from(chapters).sort((a, b) => a.localeCompare(b))];
  }, [testPrepByStudentId]);

  const prepClassOptions = useMemo(() => {
    if (!testPrepData) return ['All'];
    const classes = new Set<string>();
    testPrepByStudentId.forEach((items) => items.forEach((item) => { if (item.class_name) classes.add(String(item.class_name)); }));
    return ['All', ...Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [testPrepByStudentId]);

  const prepSectionOptions = useMemo(() => {
    const sections = new Set<string>();
    testPrepByStudentId.forEach((items) => items.forEach((item) => {
      if (prepClassFilter !== 'All' && String(item.class_name) !== prepClassFilter) return;
      if (item.section_name) sections.add(String(item.section_name));
    }));
    return ['All', ...Array.from(sections).sort()];
  }, [testPrepByStudentId, prepClassFilter]);

  const prepFilteredStudents = useMemo(() => {
    if (!dashboardData) return [];
    return dashboardData.students.filter((student) => {
      let items = testPrepByStudentId.get(student.student_id) ?? [];
      if (prepChapterFilter !== 'All') items = items.filter((item) => getItemChapters(item).includes(prepChapterFilter));
      if (prepClassFilter !== 'All') items = items.filter((item) => String(item.class_name) === prepClassFilter);
      if (prepSectionFilter !== 'All') items = items.filter((item) => String(item.section_name) === prepSectionFilter);
      if (items.length < prepMinAttempts) return false;
      if (prepMinScore > 0 && !items.some((item) => getPrepItemScore(item) >= prepMinScore)) return false;
      return true;
    });
  }, [dashboardData, testPrepByStudentId, prepChapterFilter, prepClassFilter, prepSectionFilter, prepMinAttempts, prepMinScore]);

  // ── Loading / error states ─────────────────────────────────────────────────

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

  const teacherLabel = dashboardData.teacher_name || teacherUsername || 'Teacher';

  const filteredStudents = dayFilter === null
    ? dashboardData.students
    : dashboardData.students.filter((u) => {
        if (u.auth_provider === 'google') return true;
        if (u.days_since_login === null || u.days_since_login === undefined) return false;
        return u.days_since_login <= dayFilter;
      });

  const tabs = [
    { key: 'students' as const, label: 'Students', count: filteredStudents.length, color: '#3B82F6' },
    { key: 'pre-assessment' as const, label: 'Pre-Assessment', count: testPrepData ? prepFilteredStudents.length : null, color: '#8B5CF6' },
    { key: 'activity' as const, label: 'Activity', count: null, color: '#10B981' },
  ];

  const scoreColor = (s: number) => s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#F43F5E';

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1a2332 100%)', borderBottom: '1px solid #1E293B' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#F1F5F9', fontFamily: FONT_SERIF }}>
              {teacherLabel}
            </h1>
            <span style={{ padding: '4px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '15px', fontWeight: 700, color: '#3B82F6', fontFamily: FONT_SERIF }}>
              {dashboardData.total_students} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8' }}>Students</span>
            </span>
          </div>
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
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {/* Metrics */}
        <MetricsCards
          totalStudents={dashboardData.total_students}
          activeStudents={dashboardData.active_students}
          activeSessions={dashboardData.active_sessions}
          atRiskStudents={dashboardData.at_risk_students}
          inactiveStudents={dashboardData.inactive_students}
          students={dashboardData.students}
        />

        {/* Test Prep Analytics */}
        <div style={{ marginTop: '24px' }}>
          <SchoolAnalytics students={dashboardData.students} />
        </div>

        {/* Tabs */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key);
                    if (t.key === 'activity') loadActivity();
                    if (t.key === 'pre-assessment') loadTestPrep();
                  }}
                  style={{
                    padding: '7px 16px', borderRadius: '99px',
                    border: activeTab === t.key ? `1.5px solid ${t.color}` : '1.5px solid transparent',
                    background: activeTab === t.key ? `${t.color}1A` : '#111827',
                    color: activeTab === t.key ? t.color : '#64748B',
                    fontSize: '13px', fontWeight: activeTab === t.key ? 700 : 500,
                    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                  }}
                >
                  {t.label}
                  {t.count !== null && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, opacity: 0.7 }}>{t.count}</span>}
                </button>
              ))}
              {selectedIds.size > 0 && activeTab === 'students' && (
                <button onClick={handleSendBulkAlert} disabled={refreshing} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: '#10B981', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer', fontFamily: FONT, opacity: refreshing ? 0.6 : 1 }}>
                  {refreshing ? 'Sending...' : `Alert Selected (${selectedIds.size})`}
                </button>
              )}
            </div>

            {activeTab === 'students' && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter</span>
                {dayFilterOptions.map((opt) => (
                  <button key={String(opt.value)} onClick={() => setDayFilter(opt.value)} style={{
                    padding: '5px 12px', borderRadius: '8px',
                    border: dayFilter === opt.value ? '1.5px solid #14B8A6' : '1.5px solid transparent',
                    background: dayFilter === opt.value ? 'rgba(20,184,166,0.15)' : '#111827',
                    color: dayFilter === opt.value ? '#14B8A6' : '#64748B',
                    fontSize: '12px', fontWeight: dayFilter === opt.value ? 700 : 500,
                    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                  }}>{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Tab Content */}
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
          ) : activeTab === 'pre-assessment' ? (
            testPrepLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8B5CF6', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>Loading pre-assessment data...</p>
              </div>
            ) : (
              <div>
                {/* Filter bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between', padding: '16px 20px', background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Chapter</div>
                      <select value={prepChapterFilter} onChange={(e) => setPrepChapterFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '160px' }}>
                        {prepChapterOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Min Attempts</div>
                      <select value={prepMinAttempts} onChange={(e) => setPrepMinAttempts(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                        {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}+</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Score Greater Than</div>
                      <select value={prepMinScore} onChange={(e) => setPrepMinScore(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                        <option value={0}>Any score</option>
                        {[40, 50, 60, 70, 80, 90].map((n) => <option key={n} value={n}>{n}%</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Class</div>
                      <select value={prepClassFilter} onChange={(e) => { setPrepClassFilter(e.target.value); setPrepSectionFilter('All'); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '100px' }}>
                        {prepClassOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Section</div>
                      <select value={prepSectionFilter} onChange={(e) => setPrepSectionFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '100px' }}>
                        {prepSectionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                        <span style={{ fontWeight: 700, color: '#8B5CF6', fontSize: '16px' }}>{prepFilteredStudents.length}</span> match
                      </span>
                      <button
                        onClick={() => { setPrepChapterFilter('All'); setPrepClassFilter('All'); setPrepSectionFilter('All'); setPrepMinAttempts(1); setPrepMinScore(0); }}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pre-Assessment Table */}
                {prepFilteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>No students match the selected filters.</div>
                ) : (
                  <div style={{ background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: FONT }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1E293B', background: '#0B1120' }}>
                          {['Student', 'Class', 'Chapters', 'Attempts', 'Best Score', 'Avg Score', 'Last Attempt'].map((h) => (
                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prepFilteredStudents.map((student, i) => {
                          let items = testPrepByStudentId.get(student.student_id) ?? [];
                          if (prepChapterFilter !== 'All') items = items.filter((item) => getItemChapters(item).includes(prepChapterFilter));
                          const scores = items.map(getPrepItemScore);
                          const bestScore = scores.length ? Math.max(...scores) : 0;
                          const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                          const chapters = [...new Set(items.flatMap(getItemChapters))];
                          const lastAttempt = items.length
                            ? items.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
                            : null;
                          const classLabel = items[0]?.class_name ?? student.grade ?? '—';

                          return (
                            <tr key={student.student_id} style={{ borderBottom: i < prepFilteredStudents.length - 1 ? '1px solid #1E293B' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                              <td style={{ padding: '12px 16px' }}>
                                <button onClick={() => setViewStudentId(student.student_id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                  <div style={{ fontWeight: 600, color: '#F1F5F9' }}>{student.full_name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{student.section ?? ''}</div>
                                </button>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{classLabel}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {chapters.slice(0, 3).map((ch) => (
                                    <span key={ch} style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{ch}</span>
                                  ))}
                                  {chapters.length > 3 && <span style={{ padding: '2px 8px', borderRadius: '99px', background: '#1E293B', color: '#64748B', fontSize: '11px' }}>+{chapters.length - 3}</span>}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: '#F1F5F9' }}>{items.length}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ fontWeight: 700, color: scoreColor(bestScore), fontSize: '14px' }}>{bestScore}%</span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ flex: 1, height: '5px', borderRadius: '99px', background: '#1E293B', minWidth: '60px' }}>
                                    <div style={{ width: `${avgScore}%`, height: '100%', borderRadius: '99px', background: scoreColor(avgScore) }} />
                                  </div>
                                  <span style={{ fontWeight: 600, color: scoreColor(avgScore), minWidth: '32px' }}>{avgScore}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>
                                {lastAttempt ? new Date(lastAttempt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          ) : (
            <StudentTable
              students={filteredStudents}
              onSendAlert={handleSendAlert}
              onSendChallenge={handleSendChallenge}
              onViewDetails={(studentId) => setViewStudentId(studentId)}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </div>

        {/* Recent Alerts */}
        {dashboardData.recent_alerts.length > 0 && (
          <div style={{ marginTop: '24px', background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden' }}>
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
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>
                      {dashboardData.students.find((s) => s.student_id === alert.student_id)?.full_name ?? `Student #${alert.student_id}`}
                    </p>
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
