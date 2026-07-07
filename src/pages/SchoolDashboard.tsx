import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dashboardAPI, alertAPI, activityAPI } from '../services/api';
import { SchoolDashboardData, ActivityOverview, StudentEngagementSummary, TestPrepItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import MetricsCards from '../components/MetricsCards';
import StudentTable from '../components/StudentTable';
import SendAlertModal from '../components/SendAlertModal';
import ActivityFeed from '../components/ActivityFeed';
import StudentDetailModal from '../components/StudentDetailModal';
import { SchoolAnalytics } from '../components/AnalyticsSections';
import TimelineUpload from '../components/TimelineUpload';

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
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'activity' | 'pre-assessment' | 'timeline'>('students');
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

  const loadTestPrep = async () => {
    if (testPrepData || !schoolCode) return;
    try {
      setTestPrepLoading(true);
      const result = await dashboardAPI.getTestPrepBySchoolCode(schoolCode);
      setTestPrepData(result.items ?? []);
    } catch (err) {
      console.error('Failed to load test prep:', err);
      setTestPrepData([]);
    } finally {
      setTestPrepLoading(false);
    }
  };

  const testPrepByStudentId = useMemo(() => {
    const map = new Map<number, TestPrepItem[]>();
    if (!testPrepData) return map;
    for (const item of testPrepData) {
      if (!item.student_id) continue;
      const list = map.get(item.student_id) ?? [];
      list.push(item);
      map.set(item.student_id, list);
    }
    return map;
  }, [testPrepData]);

  const getPrepItemScore = (item: TestPrepItem) =>
    Number(item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? item.analysis?.prediction?.score_pct ?? 0);

  const getItemChapters = (item: TestPrepItem): string[] => {
    const breakdown: any[] = item.graph_data?.chapter_breakdown ?? [];
    if (breakdown.length > 0) {
      const chapters = breakdown.map((e: any) => String(e.chapter || '')).filter(Boolean);
      if (chapters.length > 0) return chapters;
    }
    const qChapters = (item.questions ?? [])
      .map((q: any) => String(q.chapter || ''))
      .filter(Boolean);
    if (qChapters.length > 0) return [...new Set(qChapters)];
    return [];
  };

  const prepChapterOptions = useMemo(() => {
    if (!testPrepData) return ['All'];
    const chapters = new Set<string>();
    for (const item of testPrepData) {
      for (const ch of getItemChapters(item)) chapters.add(ch);
    }
    return ['All', ...Array.from(chapters).sort((a, b) => a.localeCompare(b))];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testPrepData]);

  const prepClassOptions = useMemo(() => {
    if (!testPrepData) return ['All'];
    const classes = new Set<string>();
    for (const item of testPrepData) {
      if (item.class_name) classes.add(String(item.class_name));
    }
    return ['All', ...Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [testPrepData]);

  const prepSectionOptions = useMemo(() => {
    if (!testPrepData) return ['All'];
    const sections = new Set<string>();
    for (const item of testPrepData) {
      if (prepClassFilter !== 'All' && String(item.class_name) !== prepClassFilter) continue;
      if (item.section_name) sections.add(String(item.section_name));
    }
    return ['All', ...Array.from(sections).sort()];
  }, [testPrepData, prepClassFilter]);

  const prepFilteredStudents = useMemo(() => {
    if (!testPrepData || !schoolData) return [];
    return schoolData.students.filter((student) => {
      if (!student.student_id) return false;
      let items = testPrepByStudentId.get(student.student_id) ?? [];
      if (prepChapterFilter !== 'All') {
        items = items.filter((item) => getItemChapters(item).includes(prepChapterFilter));
      }
      if (prepClassFilter !== 'All') {
        items = items.filter((item) => String(item.class_name) === prepClassFilter);
      }
      if (prepSectionFilter !== 'All') {
        items = items.filter((item) => String(item.section_name) === prepSectionFilter);
      }
      if (items.length < prepMinAttempts) return false;
      if (prepMinScore > 0) {
        const hasPassingScore = items.some((item) => getPrepItemScore(item) >= prepMinScore);
        if (!hasPassingScore) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testPrepData, schoolData, testPrepByStudentId, prepChapterFilter, prepClassFilter, prepSectionFilter, prepMinAttempts, prepMinScore]);

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


  const tabs = [
    { key: 'students' as const, label: 'Students', count: filteredStudentsList.length, color: '#3B82F6' },
    // { key: 'teachers' as const, label: 'Teachers', count: filteredTeachersList.length, color: '#8B5CF6' },
    { key: 'pre-assessment' as const, label: 'Spot Check', count: testPrepData ? prepFilteredStudents.length : null, color: '#8B5CF6' },
    { key: 'activity' as const, label: 'Activity', count: null, color: '#10B981' },
    { key: 'timeline' as const, label: 'Timeline', count: null, color: '#A78BFA' },
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
                  onClick={() => { setActiveTab(t.key); if (t.key === 'activity') loadActivity(); if (t.key === 'pre-assessment') loadTestPrep(); }}
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

            {activeTab !== 'activity' && activeTab !== 'pre-assessment' && (
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
          ) : activeTab === 'pre-assessment' ? (
            testPrepLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8B5CF6', animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>Loading spot check data...</p>
              </div>
            ) : (
              <div>
                {/* Filter bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between', padding: '16px 20px', background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', marginBottom: '16px' }}>
                  {/* Left: Chapter, Attempts, Score */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                    {([
                      { label: 'Chapter', value: prepChapterFilter, set: setPrepChapterFilter, options: prepChapterOptions, minWidth: '160px' },
                    ] as any[]).map(({ label, value, set, options, minWidth }: any) => (
                      <div key={label}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</div>
                        <select value={value} onChange={(e) => set(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth }}>
                          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
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

                  {/* Right: Class, Section + match count + reset */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                    {([
                      { label: 'Class', value: prepClassFilter, set: (v: string) => { setPrepClassFilter(v); setPrepSectionFilter('All'); }, options: prepClassOptions },
                      { label: 'Section', value: prepSectionFilter, set: setPrepSectionFilter, options: prepSectionOptions },
                    ] as any[]).map(({ label, value, set, options }: any) => (
                      <div key={label}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</div>
                        <select value={value} onChange={(e) => set(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '100px' }}>
                          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
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

                {/* Pre-Assessment Results Table */}
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
                          if (prepChapterFilter !== 'All') {
                            items = items.filter((item) => getItemChapters(item).includes(prepChapterFilter));
                          }
                          const scores = items.map((item) => getPrepItemScore(item));
                          const bestScore = scores.length ? Math.max(...scores) : 0;
                          const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                          const chapters = [...new Set(items.flatMap((item) => getItemChapters(item)))];
                          const lastAttempt = items.length ? items.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at : null;
                          const classLabel = items[0]?.class_name ?? student.grade ?? '—';

                          const scoreColor = (s: number) => s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#F43F5E';

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
          ) : activeTab === 'timeline' ? (
            <TimelineUpload schoolCode={schoolCode} />
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
