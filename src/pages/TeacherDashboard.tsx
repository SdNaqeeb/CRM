import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dashboardAPI, alertAPI, activityAPI, challengeAPI, quizAPI, examAPI, scheduledAssignmentAPI, ScheduledAssignmentItem, QuizHomeworkItem, QuizSubmissionItem, TeacherExamItem, ExamAttemptItem } from '../services/api';
import { TeacherDashboardData, ActivityOverview, TestPrepItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import StudentTable from '../components/StudentTable';
import SendAlertModal from '../components/SendAlertModal';
import SendChallengeModal from '../components/SendChallengeModal';
import StudentDetailModal from '../components/StudentDetailModal';
import ActivityFeed from '../components/ActivityFeed';
import WeeklyExamResults from '../components/WeeklyExamResults';
import JEEExamResults from '../components/JEEExamResults';
import StudentTrackGrid from '../components/StudentTrackGrid';
import mockData from '../mock_data.json';
import TimelineStrip from '../components/TimelineStrip';
import { TimelineEntry } from '../components/TeacherTimeline';
import DashboardIcon from '../components/DashboardIcon';

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
const FONT_SERIF = '"Source Serif 4", Georgia, serif';

const C = {
  bg: '#0B1120', cardBg: '#111827', cardAlt: '#1a2332',
  border: '#1E293B', borderLight: '#334155',
  text: '#F1F5F9', textSecondary: '#64748B', textMuted: '#94A3B8',
  teal: '#14B8A6', tealDark: '#0d9488', tealSoft: 'rgba(20,184,166,0.15)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.15)',
  amber: '#F59E0B', amberSoft: 'rgba(245,158,11,0.15)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.12)',
  red: '#F43F5E', redSoft: 'rgba(244,63,94,0.15)',
  card: '#111827',
  shadow: '0 4px 12px rgba(0,0,0,0.15)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.2)',
};

function formatDateShort(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function transformAssignmentsToTimeline(items: ScheduledAssignmentItem[]): TimelineEntry[] {
  const byTopic = new Map<string, ScheduledAssignmentItem[]>();
  for (const item of items) {
    const key = item.topic_name ?? 'Unknown';
    const list = byTopic.get(key) ?? [];
    list.push(item);
    byTopic.set(key, list);
  }

  const today = new Date().toISOString().split('T')[0];
  let weekNum = 1;

  return Array.from(byTopic.entries())
    .sort(([, a], [, b]) => {
      const da = a.find(x => x.scheduled_date)?.scheduled_date ?? '';
      const db = b.find(x => x.scheduled_date)?.scheduled_date ?? '';
      return da.localeCompare(db);
    })
    .map(([topic, assignments]) => {
      const dates = assignments.map(a => a.scheduled_date).filter(Boolean) as string[];
      const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
      const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

      const totalAssigned = assignments.reduce((s, a) => s + a.assigned_count, 0);
      const totalSubmitted = assignments.reduce((s, a) => s + a.submitted_count, 0);
      const ratio = totalAssigned > 0 ? totalSubmitted / totalAssigned : 0;

      let status: TimelineEntry['status'];
      if (maxDate && maxDate < today && ratio >= 0.7) status = 'completed';
      else if (minDate && minDate <= today) status = 'in-progress';
      else status = 'upcoming';

      const subtopics = [...new Set(assignments.map(a => a.subtopic_code).filter(Boolean) as string[])];
      const subject = assignments[0]?.subject_name ?? '';

      const dateRange = minDate && maxDate && minDate !== maxDate
        ? `${formatDateShort(minDate)} – ${formatDateShort(maxDate)}`
        : minDate ? formatDateShort(minDate) : '—';

      return {
        week: `Week ${weekNum++}`,
        date_range: dateRange,
        subject,
        topic,
        subtopics,
        learning_objectives: '',
        resources: '',
        status,
      } as TimelineEntry;
    });
}

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setDashboardData: shareDashboardData } = useDashboard();

  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGreeting, setShowGreeting] = useState(true);

  const [activeTab, setActiveTab] = useState<'students' | 'daily-quizzes' | 'weekly-exams' | 'jee-exams' | 'pre-assessment' | 'activity'>('students');
  const [activityData, setActivityData] = useState<ActivityOverview | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [testPrepData, setTestPrepData] = useState<TestPrepItem[] | null>(null);
  const [testPrepLoading, setTestPrepLoading] = useState(false);

  const [quizHomeworks, setQuizHomeworks] = useState<QuizHomeworkItem[] | null>(null);
  const [quizHomeworksLoading, setQuizHomeworksLoading] = useState(false);
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<number | null>(null);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<QuizSubmissionItem[] | null>(null);
  const [homeworkSubmissionsLoading, setHomeworkSubmissionsLoading] = useState(false);

  const [teacherExams, setTeacherExams] = useState<TeacherExamItem[] | null>(null);
  const [teacherExamsLoading, setTeacherExamsLoading] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [examAttempts, setExamAttempts] = useState<ExamAttemptItem[] | null>(null);
  const [examAttemptsLoading, setExamAttemptsLoading] = useState(false);

  const [prepChapterFilter, setPrepChapterFilter] = useState<string>('All');
  const [prepClassFilter, setPrepClassFilter] = useState<string>('All');
  const [prepSectionFilter, setPrepSectionFilter] = useState<string>('All');
  const [prepMinAttempts, setPrepMinAttempts] = useState<number>(1);
  const [prepMinScore, setPrepMinScore] = useState<number>(0);

  const [scheduledAssignments, setScheduledAssignments] = useState<ScheduledAssignmentItem[] | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);

  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [trackTopic, setTrackTopic] = useState<string>('All');
  const trackGridRef = useRef<HTMLDivElement>(null);

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
      const message = err?.response?.data?.detail ?? err?.message ?? 'Unknown error';
      setError(`Failed to load dashboard: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadScheduledAssignments = async () => {
    if (!teacherUsername) return;
    try {
      const data = await scheduledAssignmentAPI.getByUsername(teacherUsername, 500);
      const items = data.items ?? [];
      setScheduledAssignments(items);
      setTimelineEntries(transformAssignmentsToTimeline(items));
    } catch (err) {
      console.error('Failed to load scheduled assignments:', err);
      setScheduledAssignments([]);
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

  const loadQuizHomeworks = async () => {
    if (quizHomeworks || !teacherUsername) return;
    try {
      setQuizHomeworksLoading(true);
      const data = await quizAPI.getHomeworks(teacherUsername);
      setQuizHomeworks(data.items);
    } catch (err) {
      console.error('Failed to load quiz homeworks:', err);
      setQuizHomeworks([]);
    } finally {
      setQuizHomeworksLoading(false);
    }
  };

  const loadTeacherExams = async () => {
    if (teacherExams || !teacherUsername) return;
    try {
      setTeacherExamsLoading(true);
      const data = await examAPI.getTeacherExams(teacherUsername);
      setTeacherExams(data.items ?? []);
    } catch (err) {
      console.error('Failed to load teacher exams:', err);
      setTeacherExams([]);
    } finally {
      setTeacherExamsLoading(false);
    }
  };

  const handleSelectExam = async (examId: number) => {
    if (examId === 0) { setSelectedExamId(null); setExamAttempts(null); return; }
    setSelectedExamId(examId);
    setExamAttempts(null);
    try {
      setExamAttemptsLoading(true);
      const data = await examAPI.getExamAttempts(examId);
      setExamAttempts(data.items ?? []);
    } catch (err) {
      console.error('Failed to load exam attempts:', err);
      setExamAttempts([]);
    } finally {
      setExamAttemptsLoading(false);
    }
  };

  const loadHomeworkSubmissions = async (homeworkId: number) => {
    setSelectedHomeworkId(homeworkId);
    setHomeworkSubmissions(null);
    try {
      setHomeworkSubmissionsLoading(true);
      const data = await quizAPI.getSubmissions(homeworkId);
      setHomeworkSubmissions(data.items);
    } catch (err) {
      console.error('Failed to load submissions:', err);
      setHomeworkSubmissions([]);
    } finally {
      setHomeworkSubmissionsLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); loadScheduledAssignments(); }, [teacherUsername]);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.full_name || user?.username || 'Teacher';
  const initials = displayName.split(/\s+|@/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('');

  useEffect(() => {
    if (!showGreeting) return;
    const t = setTimeout(() => setShowGreeting(false), 2000);
    return () => clearTimeout(t);
  }, [showGreeting]);

  if (showGreeting) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{
          background: C.card, borderRadius: '24px', border: `1px solid ${C.border}`,
          boxShadow: C.shadowLg, padding: '56px 64px', textAlign: 'center',
          maxWidth: '480px', width: '100%',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 28px',
            background: `linear-gradient(135deg, ${C.tealDark}, ${C.teal})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
            boxShadow: `0 0 0 6px rgba(20,184,166,0.15)`,
          }}>
            {initials}
          </div>
          <div style={{ fontSize: '15px', color: C.textMuted, fontWeight: 600, marginBottom: '10px', letterSpacing: '0.02em' }}>
            {greeting},
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800, color: C.text, fontFamily: FONT_SERIF, lineHeight: 1.15 }}>
            {displayName}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: C.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: C.teal, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.textMuted, fontFamily: FONT }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: C.bg }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 40, background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadowLg }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT_SERIF }}>Connection Error</h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: C.textSecondary, lineHeight: 1.5 }}>{error}</p>
          <button onClick={loadDashboard} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
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
    { key: 'students' as const,       label: 'Students',       count: filteredStudents.length,                              icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { key: 'daily-quizzes' as const,  label: 'Daily Quizzes',  count: null,                                                 icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round"/><line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round"/></svg> },
    { key: 'weekly-exams' as const,   label: 'Weekly Exams',   count: null,                                                 icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round"/></svg> },
    { key: 'jee-exams' as const,      label: 'JEE Format',     count: null,                                                 icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { key: 'pre-assessment' as const, label: 'Pre-Assessment', count: testPrepData ? prepFilteredStudents.length : null,    icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { key: 'activity' as const,       label: 'Activity',       count: null,                                                 icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 20V10" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 20V4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ];

  const scoreColor = (s: number) => s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#F43F5E';


  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: C.bg }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: C.cardBg, borderBottom: `1px solid ${C.border}`, boxShadow: C.shadow }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '18px 28px' }}>
          {/* ── Header row: Greeting + Donut card + Actions ─────────────────── */}
          {(() => {
            const tot = dashboardData.total_students || 1;
            const act = dashboardData.active_students;
            const inact = tot - act;
            const R = 52, SW = 11, CX = 64, CY = 64, SZ = 128;
            const circ = 2 * Math.PI * R;
            const segs = [{ v: act, color: C.teal }, { v: inact, color: C.amber }];
            let acc = 0;
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>

                {/* Left: Avatar + greeting */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '16px', flexShrink: 0,
                    background: `linear-gradient(135deg, ${C.tealDark}, ${C.teal})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
                    boxShadow: `0 0 0 3px rgba(20,184,166,0.2)`,
                  }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', color: C.textMuted, fontWeight: 600, marginBottom: '2px' }}>{greeting}</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: C.text, fontFamily: FONT_SERIF, lineHeight: 1.1 }}>{teacherLabel}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                      <span style={{ fontSize: '13px', color: C.textSecondary, fontWeight: 500 }}>Teacher Dashboard</span>
                      {user?.school_code && (
                        <span style={{ padding: '2px 9px', borderRadius: '99px', background: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontSize: '12px', fontWeight: 700 }}>
                          {user.school_code.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: single donut card */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '24px',
                  background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: '20px',
                  padding: '16px 28px', boxShadow: C.shadow,
                }}>
                  {/* Donut */}
                  <div style={{ position: 'relative', width: SZ, height: SZ, flexShrink: 0 }}>
                    <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`}>
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.border} strokeWidth={SW} />
                      {segs.map((seg, i) => {
                        const frac = Math.min(seg.v / tot, 1);
                        const dash = frac * circ;
                        const off = -acc;
                        acc += dash;
                        return (
                          <circle key={i} cx={CX} cy={CY} r={R}
                            fill="none" stroke={seg.color} strokeWidth={SW}
                            strokeDasharray={`${dash} ${circ}`}
                            strokeDashoffset={off}
                            transform={`rotate(-90 ${CX} ${CY})`}
                          />
                        );
                      })}
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600, letterSpacing: '0.02em' }}>Total</span>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: FONT_SERIF }}>{tot}</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.textSecondary }}>Students</div>
                    {[
                      { label: 'Active (This Week)', color: C.teal, v: act },
                      { label: 'Inactive', color: C.amber, v: inact },
                    ].map((l) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 500, minWidth: 120 }}>{l.label}</span>
                        <span style={{ fontSize: '15px', color: C.text, fontWeight: 800, fontFamily: FONT_SERIF }}>{l.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 28px' }}>

        {/* Timeline Strip */}
        <TimelineStrip
          entries={timelineEntries}
          loadingEntries={scheduledAssignments === null}
          activeTopic={trackTopic}
          onTopicClick={(topic: string) => {
            setTrackTopic(topic);
            setTimeout(() => trackGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          }}
        />

        {/* Track Status Grid */}
        <div ref={trackGridRef}>
          <StudentTrackGrid
            students={dashboardData.students}
            schoolCode={user?.school_code ?? ''}
            teacherUsername={teacherUsername ?? ''}
            externalTopic={trackTopic}
            onExternalTopicChange={setTrackTopic}
            scheduledAssignments={scheduledAssignments ?? []}
          />
        </div>

        {/* ── Two-column: Tabs (left) + Sidebar (right) ────────────────────── */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '28px', alignItems: 'flex-start' }}>

          {/* LEFT: Tab section */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Tab bar */}
            <div style={{ borderBottom: `2px solid ${C.border}`, marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '0', alignItems: 'flex-end', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {tabs.map((t) => {
                  const isActive = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        setActiveTab(t.key);
                        if (t.key === 'activity') loadActivity();
                        if (t.key === 'pre-assessment') loadTestPrep();
                        if (t.key === 'daily-quizzes') loadQuizHomeworks();
                        if (t.key === 'weekly-exams') loadTeacherExams();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '10px 18px', background: 'transparent', border: 'none',
                        borderBottom: isActive ? `2px solid ${C.teal}` : '2px solid transparent',
                        marginBottom: '-2px',
                        color: isActive ? C.teal : C.textSecondary,
                        fontSize: '14px', fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer', fontFamily: FONT,
                        transition: 'color 0.15s', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = C.text; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = C.textSecondary; }}
                    >
                      <span style={{ opacity: isActive ? 1 : 0.6 }}>{t.icon}</span>
                      {t.label}
                      {t.count !== null && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                          background: isActive ? C.tealSoft : C.cardAlt,
                          color: isActive ? C.teal : C.textMuted,
                        }}>{t.count}</span>
                      )}
                    </button>
                  );
                })}

                {/* Bulk alert button */}
                {selectedIds.size > 0 && activeTab === 'students' && (
                  <button
                    onClick={handleSendBulkAlert}
                    disabled={refreshing}
                    style={{
                      marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px', border: 'none',
                      background: C.green, color: '#fff', fontSize: '13px', fontWeight: 700,
                      cursor: refreshing ? 'wait' : 'pointer', fontFamily: FONT,
                      opacity: refreshing ? 0.6 : 1, marginBottom: '6px',
                    }}
                  >
                    <DashboardIcon name="bell" size={12} color="#fff" />
                    {refreshing ? 'Sending…' : `Alert ${selectedIds.size} students`}
                  </button>
                )}
              </div>
            </div>

            {/* Day filter (students tab only) */}
            {activeTab === 'students' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '4px' }}>Last active</span>
                {dayFilterOptions.map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setDayFilter(opt.value)}
                    style={{
                      padding: '5px 14px', borderRadius: '8px',
                      border: dayFilter === opt.value ? `1.5px solid ${C.teal}` : `1.5px solid ${C.border}`,
                      background: dayFilter === opt.value ? C.tealSoft : 'transparent',
                      color: dayFilter === opt.value ? C.teal : C.textSecondary,
                      fontSize: '13px', fontWeight: dayFilter === opt.value ? 700 : 500,
                      cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            )}

          {/* Tab Content */}
          {activeTab === 'daily-quizzes' ? (
            quizHomeworksLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.teal, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: C.textMuted }}>Loading quizzes...</p>
              </div>
            ) : selectedHomeworkId !== null ? (
              <div>
                <button
                  onClick={() => { setSelectedHomeworkId(null); setHomeworkSubmissions(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Back to Quizzes
                </button>
                {homeworkSubmissionsLoading ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.teal, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: C.textMuted }}>Loading submissions...</p>
                  </div>
                ) : !homeworkSubmissions || homeworkSubmissions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: '14px' }}>No submissions found for this quiz.</div>
                ) : (
                  <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px', background: C.cardAlt }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
                        {quizHomeworks?.find((h) => h.id === selectedHomeworkId)?.title ?? 'Quiz Submissions'}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '99px', background: C.tealSoft, fontSize: '11px', fontWeight: 700, color: C.teal }}>
                        {homeworkSubmissions.length} submissions
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: FONT }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
                          {['Student', 'Class', 'Section', 'Submitted At'].map((h) => (
                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {homeworkSubmissions.map((sub, i) => (
                          <tr key={sub.id} style={{ borderBottom: i < homeworkSubmissions.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: C.text }}>{sub.student_name}</td>
                            <td style={{ padding: '12px 16px', color: C.textSecondary }}>{sub.class_name ?? '—'}</td>
                            <td style={{ padding: '12px 16px', color: C.textSecondary }}>{sub.section_name ?? '—'}</td>
                            <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: '12px' }}>
                              {sub.created_at ? new Date(sub.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : !quizHomeworks || quizHomeworks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: '14px' }}>No quizzes found.</div>
            ) : (
              <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px', background: C.cardAlt }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Daily MCQ Quizzes</span>
                  <span style={{ padding: '2px 8px', borderRadius: '99px', background: C.tealSoft, fontSize: '11px', fontWeight: 700, color: C.teal }}>{quizHomeworks.length}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
                      {['Title', 'Subject', 'Chapters', 'Assigned', 'Due', 'Submissions'].map((h) => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quizHomeworks.map((hw, i) => {
                      const dd = hw.description_data;
                      const subject = dd?.subject_name ?? dd?.subject ?? '—';
                      const chapters = dd?.chapters ?? [];
                      return (
                        <tr
                          key={hw.id}
                          onClick={() => loadHomeworkSubmissions(hw.id)}
                          style={{ borderBottom: i < quizHomeworks.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt, cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = C.tealSoft)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : C.cardAlt)}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: C.text }}>{hw.title ?? hw.homework_code ?? `Quiz #${hw.id}`}</td>
                          <td style={{ padding: '12px 16px', color: C.textSecondary }}>{subject}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {chapters.slice(0, 2).map((ch) => (
                                <span key={ch} style={{ padding: '2px 8px', borderRadius: '99px', background: C.tealSoft, color: C.teal, fontSize: '11px', fontWeight: 600 }}>
                                  {ch.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {chapters.length > 2 && <span style={{ padding: '2px 8px', borderRadius: '99px', background: C.cardAlt, color: C.textMuted, fontSize: '11px' }}>+{chapters.length - 2}</span>}
                              {chapters.length === 0 && <span style={{ color: C.textMuted }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: C.textSecondary, fontSize: '12px' }}>
                            {hw.date_assigned ? new Date(hw.date_assigned).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: C.textSecondary, fontSize: '12px' }}>
                            {hw.due_date ? new Date(hw.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 700, color: C.teal, fontSize: '14px' }}>{hw.total_submissions}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'weekly-exams' ? (
            <WeeklyExamResults
              exams={teacherExams ?? []}
              loading={teacherExamsLoading}
              onSelectExam={handleSelectExam}
              selectedExamId={selectedExamId}
              attempts={examAttempts}
              attemptsLoading={examAttemptsLoading}
            />
          ) : activeTab === 'jee-exams' ? (
            <JEEExamResults exams={mockData.mockData.weeklyJEEExams} />
          ) : activeTab === 'activity' ? (
            activityLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.green, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: C.textMuted }}>Loading activity...</p>
              </div>
            ) : activityData ? (
              <ActivityFeed data={activityData} />
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: '14px' }}>No activity data available.</div>
            )
          ) : activeTab === 'pre-assessment' ? (
            testPrepLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.teal, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: C.textMuted }}>Loading pre-assessment data...</p>
              </div>
            ) : (
              <div>
                {/* Filter bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between', padding: '16px 20px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, marginBottom: '16px', boxShadow: C.shadow }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Chapter</div>
                      <select value={prepChapterFilter} onChange={(e) => setPrepChapterFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '160px' }}>
                        {prepChapterOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Min Attempts</div>
                      <select value={prepMinAttempts} onChange={(e) => setPrepMinAttempts(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                        {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}+</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Score Greater Than</div>
                      <select value={prepMinScore} onChange={(e) => setPrepMinScore(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                        <option value={0}>Any score</option>
                        {[40, 50, 60, 70, 80, 90].map((n) => <option key={n} value={n}>{n}%</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Class</div>
                      <select value={prepClassFilter} onChange={(e) => { setPrepClassFilter(e.target.value); setPrepSectionFilter('All'); }} style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '100px' }}>
                        {prepClassOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Section</div>
                      <select value={prepSectionFilter} onChange={(e) => setPrepSectionFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer', minWidth: '100px' }}>
                        {prepSectionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: C.textSecondary }}>
                        <span style={{ fontWeight: 700, color: C.teal, fontSize: '16px' }}>{prepFilteredStudents.length}</span> match
                      </span>
                      <button
                        onClick={() => { setPrepChapterFilter('All'); setPrepClassFilter('All'); setPrepSectionFilter('All'); setPrepMinAttempts(1); setPrepMinScore(0); }}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pre-Assessment Table */}
                {prepFilteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: '14px' }}>No students match the selected filters.</div>
                ) : (
                  <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: C.shadow }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: FONT }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
                          {['Student', 'Class', 'Chapters', 'Attempts', 'Best Score', 'Avg Score', 'Last Attempt'].map((h) => (
                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
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
                            <tr key={student.student_id} style={{ borderBottom: i < prepFilteredStudents.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : C.cardAlt }}>
                              <td style={{ padding: '12px 16px' }}>
                                <button onClick={() => setViewStudentId(student.student_id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                  <div style={{ fontWeight: 600, color: C.text }}>{student.full_name}</div>
                                  <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>{student.section ?? ''}</div>
                                </button>
                              </td>
                              <td style={{ padding: '12px 16px', color: C.textSecondary }}>{classLabel}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {chapters.slice(0, 3).map((ch) => (
                                    <span key={ch} style={{ padding: '2px 8px', borderRadius: '99px', background: C.tealSoft, color: C.teal, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{ch}</span>
                                  ))}
                                  {chapters.length > 3 && <span style={{ padding: '2px 8px', borderRadius: '99px', background: C.cardAlt, color: C.textMuted, fontSize: '11px' }}>+{chapters.length - 3}</span>}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: C.text }}>{items.length}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{ fontWeight: 700, color: scoreColor(bestScore), fontSize: '14px' }}>{bestScore}%</span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ flex: 1, height: '5px', borderRadius: '99px', background: C.cardAlt, minWidth: '60px' }}>
                                    <div style={{ width: `${avgScore}%`, height: '100%', borderRadius: '99px', background: scoreColor(avgScore) }} />
                                  </div>
                                  <span style={{ fontWeight: 600, color: scoreColor(avgScore), minWidth: '32px' }}>{avgScore}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: '12px' }}>
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
          </div>{/* end left col */}

          {/* RIGHT: Sidebar */}
          <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '24px', alignSelf: 'flex-start' }}>

            {/* Quick actions */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: C.shadow }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Quick Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Send Bulk Alert', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: <DashboardIcon name="bell" size={13} color="#10B981" />, action: () => { setActiveTab('students'); } },
                  { label: 'View Activity', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', icon: <DashboardIcon name="bar" size={13} color="#3B82F6" />, action: () => { setActiveTab('activity'); loadActivity(); } },
                  { label: 'Daily Quizzes', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', icon: <DashboardIcon name="file" size={13} color="#A78BFA" />, action: () => { setActiveTab('daily-quizzes'); loadQuizHomeworks(); } },
                ].map((qa) => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '10px',
                      background: qa.bg, border: 'none',
                      color: qa.color, fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                      transition: 'filter 0.15s', width: '100%',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    {qa.icon}
                    {qa.label}
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 'auto' }}>
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Alerts panel */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden', boxShadow: C.shadow }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px', background: C.cardAlt }}>
                <DashboardIcon name="bell" size={15} color={C.amber} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Recent Alerts</span>
                {dashboardData.recent_alerts.length > 0 && (
                  <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '99px', background: C.amberSoft, fontSize: '12px', fontWeight: 700, color: C.amber }}>
                    {dashboardData.recent_alerts.length}
                  </span>
                )}
              </div>

              {dashboardData.recent_alerts.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '14px', color: C.textSecondary }}>No recent alerts</div>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
                  {dashboardData.recent_alerts.slice(0, 8).map((alert) => {
                    const studentName = dashboardData.students.find((s) => s.student_id === alert.student_id)?.full_name ?? `Student #${alert.student_id}`;
                    const alertInitials = studentName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                    return (
                      <div key={alert.id} style={{
                        background: C.cardAlt, border: `1px solid ${C.border}`,
                        borderRadius: '12px', padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                            background: C.redSoft, color: C.red,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 800,
                          }}>{alertInitials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentName}</div>
                            <div style={{ fontSize: '11px', color: C.textMuted }}>{new Date(alert.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>{alert.reason}</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleSendAlert(alert.student_id)} style={{ flex: 1, padding: '7px 0', borderRadius: '8px', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                            Alert
                          </button>
                          <button onClick={() => handleSendChallenge(alert.student_id)} style={{ flex: 1, padding: '7px 0', borderRadius: '8px', border: 'none', background: 'rgba(20,184,166,0.15)', color: '#14B8A6', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                            Challenge
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end right sidebar */}
        </div>{/* end two-column */}
      </div>{/* end main content */}

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
