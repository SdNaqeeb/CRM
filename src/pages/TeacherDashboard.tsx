import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dashboardAPI, alertAPI, activityAPI, challengeAPI, quizAPI, examAPI, ScheduledAssignmentItem, QuizHomeworkItem, QuizSubmissionItem, TeacherExamItem, ExamAttemptItem, MockExamItem, MockExamResultItem } from '../services/api';
import { TeacherDashboardData, ActivityOverview, TestPrepItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import StudentTable from '../components/StudentTable';
import SendAlertModal from '../components/SendAlertModal';
import SendChallengeModal from '../components/SendChallengeModal';
import StudentDetailModal from '../components/StudentDetailModal';
import ActivityFeed from '../components/ActivityFeed';
import WeeklyExamResults from '../components/WeeklyExamResults';
import MockExamResults from '../components/MockExamResults';
import MockExamAnalysis from '../components/MockExamAnalysis';
import StudentTrackGrid, { TrackPreloadData } from '../components/StudentTrackGrid';
import ScheduledAssignmentsPanel from '../components/ScheduledAssignmentsPanel';
import DashboardIcon from '../components/DashboardIcon';
import PageHelpBar, { HelpItem } from '../components/PageHelpBar';

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
const FONT_SERIF = '"Source Serif 4", Georgia, serif';

const C = {
  bg: '#EDE9FE', cardBg: '#FFFFFF', cardAlt: '#F5F3FF',
  border: '#E2E8F0', borderLight: '#CBD5E1',
  text: '#0F172A', textSecondary: '#475569', textMuted: '#64748B',
  teal: '#7C3AED', tealDark: '#6D28D9', tealSoft: 'rgba(124,58,237,0.10)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B', amberSoft: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.10)',
  red: '#F43F5E', redSoft: 'rgba(244,63,94,0.12)',
  card: '#FFFFFF',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
  shadowLg: '0 4px 6px rgba(0,0,0,0.04), 0 10px 24px rgba(0,0,0,0.08)',
};


const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const { setDashboardData: shareDashboardData } = useDashboard();

  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGreeting, setShowGreeting] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'track-status' | 'assignments' | 'students' | 'daily-quizzes' | 'weekly-exams' | 'mock-exams' | 'mock-exam-analysis' | 'jee-exams' | 'pre-assessment' | 'activity'>('overview');
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

  const [mockExams, setMockExams] = useState<MockExamItem[] | null>(null);
  const [mockExamsLoading, setMockExamsLoading] = useState(false);
  const [selectedMockExamId, setSelectedMockExamId] = useState<number | null>(null);
  const [mockExamResults, setMockExamResults] = useState<MockExamResultItem[] | null>(null);
  const [mockExamResultsLoading, setMockExamResultsLoading] = useState(false);
  const [mockExamClassFilter, setMockExamClassFilter] = useState('All');
  const [mockExamSectionFilter, setMockExamSectionFilter] = useState('All');

  const [analysisExamId, setAnalysisExamId] = useState<number | null>(null);
  const [analysisResults, setAnalysisResults] = useState<MockExamResultItem[] | null>(null);
  const [analysisResultsLoading, setAnalysisResultsLoading] = useState(false);

  const [compareExamIds, setCompareExamIds] = useState<[number, number] | null>(null);
  const [compareResults, setCompareResults] = useState<{ exam1: MockExamResultItem[]; exam2: MockExamResultItem[] } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [prepChapterFilter, setPrepChapterFilter] = useState<string>('All');
  const [prepClassFilter, setPrepClassFilter] = useState<string>('All');
  const [prepSectionFilter, setPrepSectionFilter] = useState<string>('All');
  const [prepMinAttempts, setPrepMinAttempts] = useState<number>(1);
  const [prepMinScore, setPrepMinScore] = useState<number>(0);

  const [trackPreload, setTrackPreload] = useState<TrackPreloadData | undefined>(undefined);
  const [scheduledAssignments, setScheduledAssignments] = useState<ScheduledAssignmentItem[] | null>(null);

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

  const getMockExamClassCode = (value?: string | null) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    const numberMatch = trimmed.match(/\d+/);
    return numberMatch ? numberMatch[0] : trimmed.replace(/^class\s+/i, '');
  };

  const getMockExamSectionName = (value?: string | null) => {
    if (!value) return '';
    return String(value).trim().replace(/^section\s+/i, '');
  };

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
      const data = await quizAPI.getHomeworks(teacherUsername, 500);
      const items = (data.items ?? []).map((item) => ({
        assignment_id: String(item.id),
        assignment_code: item.homework_code ?? null,
        title: item.title ?? null,
        status: null,
        scheduled_date: item.date_assigned ?? null,
        due_date: item.due_date ?? null,
        class_id: null,
        class_name: item.description_data?.class_name ?? null,
        section_id: null,
        section_name: null,
        subject_id: null,
        subject_name: item.description_data?.subject_name ?? item.description_data?.subject ?? null,
        topic_id: null,
        topic_name: item.description_data?.chapters?.[0]?.replace(/_/g, ' ') ?? null,
        subtopic_code: null,
        question_count: item.description_data?.questions_per_chapter ?? 0,
        assigned_count: 0,
        viewed_count: 0,
        submitted_count: item.total_submissions ?? 0,
        missed_count: 0,
        cancelled_count: 0,
      }));
      setScheduledAssignments(items);
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

  const loadMockExams = async (classFilter = mockExamClassFilter, sectionFilter = mockExamSectionFilter, force = false) => {
    if (mockExams && !force && classFilter === mockExamClassFilter && sectionFilter === mockExamSectionFilter) return;
    if (!teacherUsername) return;
    try {
      setMockExamsLoading(true);
      const schoolCode = user?.school_code || 'ELP';
      let items: MockExamItem[];
      if (classFilter !== 'All') {
        const data = await examAPI.getMockExamsByClassSection({
          school_code: schoolCode,
          class_code: classFilter,
          ...(sectionFilter !== 'All' ? { section_name: sectionFilter } : {}),
          limit: 100,
        });
        items = data.items ?? [];
      } else {
        // Fetch by-class-section for each known class (preserves chapters field)
        const classes = Array.from(new Set((dashboardData?.students ?? []).map(s => getMockExamClassCode(s.grade)).filter(Boolean)));
        if (classes.length > 0) {
          const responses = await Promise.all(
            classes.map(cls =>
              examAPI.getMockExamsByClassSection({ school_code: schoolCode, class_code: cls, limit: 100 })
                .then(d => d.items ?? [])
                .catch(() => [] as MockExamItem[])
            )
          );
          // Deduplicate by homework_id
          const seen = new Map<number, MockExamItem>();
          for (const batch of responses) {
            for (const exam of batch) {
              if (!seen.has(exam.homework_id)) seen.set(exam.homework_id, exam);
            }
          }
          items = Array.from(seen.values()).sort((a, b) =>
            (b.date_assigned ?? '').localeCompare(a.date_assigned ?? '')
          );
        } else {
          items = [];
        }
      }
      setMockExams(items);
      setSelectedMockExamId(null);
      setMockExamResults(null);
    } catch (err) {
      console.error('Failed to load mock exams:', err);
      setMockExams([]);
    } finally {
      setMockExamsLoading(false);
    }
  };

  const handleMockExamFiltersChange = (classFilter: string, sectionFilter: string) => {
    setMockExamClassFilter(classFilter);
    setMockExamSectionFilter(sectionFilter);
    loadMockExams(classFilter, sectionFilter, true);
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

  const handleSelectMockExam = async (homeworkId: number) => {
    if (homeworkId === 0) {
      setSelectedMockExamId(null);
      setMockExamResults(null);
      return;
    }
    setSelectedMockExamId(homeworkId);
    setMockExamResults(null);
    try {
      setMockExamResultsLoading(true);
      const data = await examAPI.getMockExamResults(homeworkId);
      setMockExamResults(data.items ?? []);
    } catch (err) {
      console.error('Failed to load mock exam results:', err);
      setMockExamResults([]);
    } finally {
      setMockExamResultsLoading(false);
    }
  };

  const handleCompareExams = async (id1: number, id2: number, _cls?: string, _sec?: string) => {
    setCompareExamIds([id1, id2]);
    setCompareResults(null);
    try {
      setCompareLoading(true);
      const [r1, r2] = await Promise.all([
        examAPI.getMockExamResults(id1, 500),
        examAPI.getMockExamResults(id2, 500),
      ]);
      setCompareResults({ exam1: r1.items ?? [], exam2: r2.items ?? [] });
    } catch (err) {
      console.error('Failed to load compare results:', err);
      setCompareResults({ exam1: [], exam2: [] });
    } finally {
      setCompareLoading(false);
    }
  };

  const handleSelectAnalysisExam = async (id: number | null) => {
    if (id === null || id === analysisExamId) {
      setAnalysisExamId(null);
      setAnalysisResults(null);
      return;
    }
    setAnalysisExamId(id);
    setAnalysisResults(null);
    try {
      setAnalysisResultsLoading(true);
      const data = await examAPI.getMockExamResults(id);
      setAnalysisResults(data.items ?? []);
    } catch {
      setAnalysisResults([]);
    } finally {
      setAnalysisResultsLoading(false);
    }
  };

  const handleExitCompare = () => {
    setCompareExamIds(null);
    setCompareResults(null);
  };

  const fetchMockExamsForSection = async (classCode: string, sectionName?: string): Promise<MockExamItem[]> => {
    const schoolCode = user?.school_code || 'ELP';
    try {
      const data = await examAPI.getMockExamsByClassSection({
        school_code: schoolCode,
        class_code: classCode,
        ...(sectionName ? { section_name: sectionName } : {}),
        limit: 200,
      });
      return data.items ?? [];
    } catch {
      return [];
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

  // Pre-fetch StudentTrackGrid Wave 1 data during the greeting screen so the
  // skeleton resolves faster once the main dashboard is ready.
  useEffect(() => {
    if (!teacherUsername || !user?.school_code) return;
    const sc = user.school_code;
    const base = process.env.REACT_APP_API_URL || 'https://crm.smartlearners.ai/backend-api/';
    Promise.all([
      fetch(`${base}api/external-data/user-sessions/by-school-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_code: sc, limit: 5000 }),
      }),
      fetch(`${base}api/external-data/quiz-homework/by-username`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: teacherUsername, limit: 500 }),
      }),
      fetch(`${base}api/external-data/teacher-exams/by-username`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: teacherUsername, limit: 5 }),
      }),
    ])
      .then(([r1, r2, r3]) => Promise.all([r1.json(), r2.json(), r3.json()]))
      .then(([sessionData, homeworkData, examData]) => {
        setTrackPreload({
          sessions: sessionData.items ?? [],
          homeworks: homeworkData.items ?? [],
          exams: examData.items ?? [],
          resolvedSchoolCode: homeworkData.school_code || sc,
        });
      })
      .catch(() => { /* silent — StudentTrackGrid falls back to its own fetch */ });
  }, [teacherUsername, user?.school_code]);

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
      <div style={{ minHeight: 'calc(100vh - 64px)', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '80px', fontFamily: FONT }}>
        <div style={{
          background: C.card, borderRadius: '24px', border: `1px solid ${C.border}`,
          boxShadow: C.shadowLg, padding: '48px 64px', textAlign: 'center',
          maxWidth: '480px', width: '100%',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 28px',
            background: `linear-gradient(135deg, ${C.tealDark}, ${C.teal})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
            boxShadow: `0 0 0 8px rgba(124,58,237,0.12)`,
          }}>
            {initials}
          </div>
          <div style={{ fontSize: '14px', color: C.textMuted, fontWeight: 500, marginBottom: '8px', letterSpacing: '0.01em' }}>
            {greeting},
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: C.text, fontFamily: FONT_SERIF, lineHeight: 1.15, marginBottom: '14px' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '14px', color: C.textSecondary, fontWeight: 500, lineHeight: 1.6 }}>
            Hope you are having a good day! 🌟
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

  const mockExamClassOptions = ['All', ...Array.from(new Set(dashboardData.students.map((student) => getMockExamClassCode(student.grade)).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  const mockExamSectionOptions = [
    'All',
    ...Array.from(new Set(
      dashboardData.students
        .filter((student) => mockExamClassFilter === 'All' || getMockExamClassCode(student.grade) === mockExamClassFilter)
        .map((student) => getMockExamSectionName(student.section))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  ];

  const scoreColor = (s: number) => s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#F43F5E';


  const navItems = [
    { key: 'overview'      as const, label: 'Overview',              icon: 'home'     },
    { key: 'students'      as const, label: 'Students',              icon: 'users',   count: filteredStudents.length },
    { key: 'track-status'  as const, label: 'Track Status',          icon: 'grid'     },
    { key: 'assignments'   as const, label: 'Assignments',           icon: 'calendar' },
    { key: 'daily-quizzes' as const, label: 'Daily Quizzes',         icon: 'file'     },
    { key: 'weekly-exams'  as const, label: 'Exams',                 icon: 'monitor'  },
    { key: 'mock-exams'          as const, label: 'Mock Exams',     icon: 'target'  },
    { key: 'mock-exam-analysis'  as const, label: 'Exam Analysis',  icon: 'monitor' },
  ];

  const handleNavClick = (key: typeof activeTab) => {
    setActiveTab(key);
    if (key === 'activity') loadActivity();
    if (key === 'pre-assessment') loadTestPrep();
    if (key === 'daily-quizzes') loadQuizHomeworks();
    if (key === 'weekly-exams') loadTeacherExams();
    if (key === 'mock-exams') loadMockExams();
    if (key === 'mock-exam-analysis') loadMockExams();
  };

  const sectionTitles: Record<typeof activeTab, string> = {
    'overview': 'Overview', 'track-status': 'Track Status',
    'assignments': 'Scheduled Assignments',
    'students': 'Students', 'daily-quizzes': 'Daily Quizzes',
    'weekly-exams': 'Exams', 'mock-exams': 'Mock Exams', 'mock-exam-analysis': 'Mock Exam Analysis', 'jee-exams': 'JEE Format',
    'pre-assessment': 'Pre-Assessment', 'activity': 'Activity',
  };

  const TAB_HELP: Record<typeof activeTab, HelpItem[]> = {
    overview: [
      { icon: '📊', title: 'Stat Cards',   description: 'Total, active, inactive, and at-risk student counts for your class.' },
      { icon: '🍩', title: 'Donut Chart',  description: 'Visual breakdown of active vs inactive students at a glance.' },
    ],
    students: [
      { icon: '🔍', title: 'Filters',      description: 'Filter students by engagement status, section, or search by name.' },
      { icon: '👥', title: 'Student Table',description: 'Full list of your students with activity status, last seen, and quiz stats.' },
      { icon: '🔔', title: 'Bulk Alert',   description: 'Select students and send a WhatsApp alert to all of them at once.' },
    ],
    'track-status': [
      { icon: '🧩', title: 'Status Overview', description: 'Bar chart showing how many students are On Track, Slightly Off, or Completely Off.' },
      { icon: '📚', title: 'Topic Filter',    description: 'Filter by topic to see per-student performance on a specific assignment.' },
      { icon: '👤', title: 'Student Cards',   description: 'Click a bar to expand student cards. Tap a card for topic-level breakdown.' },
    ],
    assignments: [
      { icon: '📅', title: 'Assignments Calendar', description: 'Calendar view of all scheduled assignments. Click a date to filter.' },
      { icon: '📋', title: 'Assignment Cards',     description: 'Each card shows assigned-to, viewed-by, and submitted-by counts for that task.' },
      { icon: '🔗', title: 'Track Button',         description: 'Click "Track Status" on a card to jump to Track Status filtered by that topic.' },
    ],
    'daily-quizzes': [
      { icon: '📝', title: 'Quiz List',    description: 'All daily quizzes you have assigned, with submission and view counts.' },
      { icon: '📈', title: 'Submission Stats', description: 'See how many students have attempted or skipped each quiz.' },
    ],
    'weekly-exams': [
      { icon: '🎯', title: 'Exam List',    description: 'All exams you have set, sorted by most recent.' },
      { icon: '📉', title: 'Score Breakdown', description: 'Select an exam to see each student\'s score and attempt details.' },
    ],
    'mock-exams': [],
    'mock-exam-analysis': [
      { icon: '📊', title: 'Programme KPIs', description: 'Total exams, submissions, and weighted average score across all mock exams.' },
      { icon: '📋', title: 'Exam List',      description: 'Full table of all mock exams with subject, date, submissions, and average.' },
    ],
    activity: [
      { icon: '🕒', title: 'Activity Feed', description: 'Chronological log of student logins, quiz attempts, and exam submissions.' },
    ],
    'pre-assessment': [
      { icon: '🧪', title: 'Test Prep Cards', description: 'Analytics on pre-assessment performance per student and topic.' },
    ],
    'jee-exams': [
      { icon: '📐', title: 'JEE Exams', description: 'JEE-format exam results and performance breakdown for your students.' },
    ],
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', fontFamily: FONT, background: C.bg }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: '220px', flexShrink: 0, background: C.cardBg,
        borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: 'calc(100vh - 64px)', overflowY: 'auto',
      }}>
        {/* Nav items */}
        <nav style={{ padding: '16px 10px', flex: 1 }}>
          {navItems.map((item, i) => {
            if (item === null) return <div key={`div-${i}`} style={{ height: '1px', background: C.border, margin: '12px 6px' }} />;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px', borderRadius: '10px', border: 'none',
                  background: isActive ? C.tealSoft : 'transparent',
                  color: isActive ? C.teal : C.textSecondary,
                  fontSize: '13px', fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                  marginBottom: '6px', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.cardAlt; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <DashboardIcon name={item.icon} size={17} color={isActive ? C.teal : C.textMuted} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {'count' in item && item.count !== undefined && (
                  <span style={{
                    padding: '1px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                    background: isActive ? C.tealSoft : C.cardAlt,
                    color: isActive ? C.teal : C.textMuted,
                  }}>{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Teacher info at bottom */}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.tealDark}, ${C.teal})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 800, color: '#fff',
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacherLabel}</div>
              {user?.school_code && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: C.teal, background: C.tealSoft, padding: '1px 7px', borderRadius: '99px' }}>
                  {user.school_code.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Slim top bar */}
        <div style={{ background: C.cardBg, borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{sectionTitles[activeTab]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedIds.size > 0 && activeTab === 'students' && (
              <button onClick={handleSendBulkAlert} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: C.green, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer', fontFamily: FONT, opacity: refreshing ? 0.6 : 1 }}>
                <DashboardIcon name="bell" size={12} color="#fff" />
                {refreshing ? 'Sending…' : `Alert ${selectedIds.size} students`}
              </button>
            )}
            <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px 28px', flex: 1 }}>

        <PageHelpBar items={TAB_HELP[activeTab]} />

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (() => {
          const tot = dashboardData.total_students || 1;
          const act = dashboardData.active_students;
          const inact = tot - act;
          const R = 90, SW = 16, CX = 108, CY = 108, SZ = 216;
          const circ = 2 * Math.PI * R;
          const segs = [{ v: act, color: C.teal }, { v: inact, color: C.amber }];
          let acc = 0;
          return (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, fontFamily: FONT_SERIF }}>{greeting}, {teacherLabel}!</div>
                <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
              {/* Two-column layout: stat cards left, donut right */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>

                {/* Left: 2x2 stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
                  {[
                    { label: 'Total Students',  value: dashboardData.total_students,                                  color: C.teal,  bg: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(124,58,237,0.06))' },
                    { label: 'Active This Week', value: dashboardData.active_students,                                color: C.green, bg: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.06))' },
                    { label: 'Inactive',         value: dashboardData.total_students - dashboardData.active_students, color: C.amber, bg: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.06))' },
                    { label: 'At Risk',          value: dashboardData.at_risk_students,                              color: C.red,   bg: 'linear-gradient(135deg,rgba(244,63,94,0.12),rgba(244,63,94,0.06))' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '32px 28px', boxShadow: C.shadow, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '52px', fontWeight: 800, color: s.color, fontFamily: FONT_SERIF, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: '14px', color: s.color, fontWeight: 700, marginTop: '12px', opacity: 0.8 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Right: Donut chart */}
                <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '32px 40px', boxShadow: C.shadowLg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px' }}>
                  <div style={{ position: 'relative', width: SZ, height: SZ, flexShrink: 0 }}>
                    <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`}>
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.border} strokeWidth={SW} />
                      {segs.map((seg, i) => {
                        const frac = Math.min(seg.v / tot, 1);
                        const dash = frac * circ;
                        const off = -acc;
                        acc += dash;
                        return <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={seg.color} strokeWidth={SW} strokeDasharray={`${dash} ${circ}`} strokeDashoffset={off} transform={`rotate(-90 ${CX} ${CY})`} />;
                      })}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 600, letterSpacing: '0.04em' }}>TOTAL</span>
                      <span style={{ fontSize: '44px', fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: FONT_SERIF }}>{tot}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Student Activity</div>
                    {[
                      { label: 'Active (This Week)', color: C.teal,  v: act,   pct: Math.round(act / tot * 100) },
                      { label: 'Inactive',           color: C.amber, v: inact, pct: Math.round(inact / tot * 100) },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '3px', background: l.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '13px', color: C.textSecondary, fontWeight: 500 }}>{l.label}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '28px', color: C.text, fontWeight: 800, fontFamily: FONT_SERIF }}>{l.v}</span>
                            <span style={{ fontSize: '13px', color: C.textMuted, fontWeight: 600 }}>{l.pct}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ── Track Status — always mounted to prevent reload on tab switch ── */}
        <div style={{ display: activeTab === 'track-status' ? 'block' : 'none' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: C.text, fontFamily: FONT_SERIF, lineHeight: 1.2 }}>
              Track status of students in a topic
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: C.textMuted, fontWeight: 500 }}>
              Select an assignment topic below to see how each student is performing.
            </p>
          </div>
          <div ref={trackGridRef}>
            <StudentTrackGrid
              students={dashboardData.students}
              schoolCode={user?.school_code ?? ''}
              teacherUsername={teacherUsername ?? ''}
              externalTopic={trackTopic}
              onExternalTopicChange={setTrackTopic}
              scheduledAssignments={scheduledAssignments ?? []}
              preload={trackPreload}
            />
          </div>
        </div>

        {/* ── Scheduled Assignments ─────────────────────────────────────────── */}
        {activeTab === 'assignments' && (
          <ScheduledAssignmentsPanel
            assignments={scheduledAssignments ?? []}
            loading={scheduledAssignments === null}
            activeTopic={trackTopic}
            onTopicClick={(topic: string) => {
              setTrackTopic(topic);
              setActiveTab('track-status');
            }}
          />
        )}

        {/* ── Students ─────────────────────────────────────────────────────── */}
        {activeTab === 'students' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '4px' }}>Last active</span>
              {dayFilterOptions.map((opt) => (
                <button key={String(opt.value)} onClick={() => setDayFilter(opt.value)} style={{ padding: '5px 14px', borderRadius: '8px', border: dayFilter === opt.value ? `1.5px solid ${C.teal}` : `1.5px solid ${C.border}`, background: dayFilter === opt.value ? C.tealSoft : 'transparent', color: dayFilter === opt.value ? C.teal : C.textSecondary, fontSize: '13px', fontWeight: dayFilter === opt.value ? 700 : 500, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s' }}>{opt.label}</button>
              ))}
            </div>
            <StudentTable students={filteredStudents} onSendAlert={handleSendAlert} onSendChallenge={handleSendChallenge} onViewDetails={(studentId) => setViewStudentId(studentId)} selectedIds={selectedIds} onSelectionChange={setSelectedIds} />
          </div>
        )}

        {/* ── Daily Quizzes ─────────────────────────────────────────────────── */}
        {activeTab === 'daily-quizzes' && (
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
          )}

        {/* ── Exams ────────────────────────────────────────────────────────── */}
        {activeTab === 'weekly-exams' && (
          <WeeklyExamResults exams={teacherExams ?? []} loading={teacherExamsLoading} onSelectExam={handleSelectExam} selectedExamId={selectedExamId} attempts={examAttempts} attemptsLoading={examAttemptsLoading} />
        )}

        {activeTab === 'mock-exams' && (
          <MockExamResults
            exams={mockExams ?? []}
            loading={mockExamsLoading}
            examClassOptions={mockExamClassOptions}
            examSectionOptions={mockExamSectionOptions}
            examClassFilter={mockExamClassFilter}
            examSectionFilter={mockExamSectionFilter}
            onExamFiltersChange={handleMockExamFiltersChange}
            selectedHomeworkId={selectedMockExamId}
            onSelectExam={handleSelectMockExam}
            results={mockExamResults}
            resultsLoading={mockExamResultsLoading}
            compareExamIds={compareExamIds}
            compareResults={compareResults}
            compareLoading={compareLoading}
            onCompare={handleCompareExams}
            onExitCompare={handleExitCompare}
            onFetchExamsForSection={fetchMockExamsForSection}
          />
        )}


        {/* ── Mock Exam Analysis ───────────────────────────────────────────── */}
        {activeTab === 'mock-exam-analysis' && (
          <MockExamAnalysis
            exams={mockExams ?? []}
            loading={mockExamsLoading}
            selectedExamId={analysisExamId}
            onSelectExam={handleSelectAnalysisExam}
            examResults={analysisResults}
            resultsLoading={analysisResultsLoading}
          />
        )}

        {/* ── Activity ─────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          activityLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                {[0, 1, 2].map((i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.green, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />)}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: C.textMuted }}>Loading activity...</p>
            </div>
          ) : activityData ? <ActivityFeed data={activityData} /> : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: '14px' }}>No activity data available.</div>
          )
        )}

        {/* ── Pre-Assessment ───────────────────────────────────────────────── */}
        {activeTab === 'pre-assessment' && (
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
          )}

        </div>{/* end page content */}
      </div>{/* end main area */}

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
