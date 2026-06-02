import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudentEngagementSummary } from '../types';
import { StackedBarChart } from './AnalyticsCharts';
import { ScheduledAssignmentItem } from '../services/api';

const FONT = "'Plus Jakarta Sans', sans-serif";
const API_BASE = process.env.REACT_APP_API_URL || 'https://crm.smartlearners.ai/backend-api/';

const C = {
  bg: '#EDE9FE', card: '#FFFFFF', cardAlt: '#F5F3FF',
  border: '#E2E8F0', borderStrong: '#CBD5E1',
  text: '#0F172A', textSecondary: '#475569', textMuted: '#64748B',
  teal: '#7C3AED', tealSoft: 'rgba(124,58,237,0.10)',
  blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.10)',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
  shadowLg: '0 4px 6px rgba(0,0,0,0.04), 0 10px 24px rgba(0,0,0,0.08)',
};

interface SessionItem {
  username: string;
  login_time: string | null;
  logout_time: string | null;
  session_duration_seconds: number | null;
}

export interface TrackPreloadData {
  sessions: SessionItem[];
  homeworks: { id: number }[];
  exams: { exam_id: number }[];
  resolvedSchoolCode: string;
}

interface StudentTrackGridProps {
  students: StudentEngagementSummary[];
  schoolCode: string;
  teacherUsername: string;
  externalTopic?: string;
  onExternalTopicChange?: (topic: string) => void;
  scheduledAssignments?: ScheduledAssignmentItem[];
  preload?: TrackPreloadData;
}

type TrackStatus = 'completely-off' | 'slightly-off' | 'on-track';

interface Thresholds {
  loginSlightlyOff: number;
  loginCompletelyOff: number;
  quizSlightlyOff: number;
  quizCompletelyOff: number;
  examSlightlyOff: number;
  examCompletelyOff: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  loginSlightlyOff: 3,
  loginCompletelyOff: 5,
  quizSlightlyOff: 60,
  quizCompletelyOff: 40,
  examSlightlyOff: 60,
  examCompletelyOff: 40,
};

interface StudentStatus {
  student: StudentEngagementSummary;
  status: TrackStatus;
  minutesAvg: number;
  daysActive: number;
  quizAvgScore: number | null;
  examAvg: number | null;
  totalExams: number;
}

const STATUS_CONFIG: Record<TrackStatus, { label: string; color: string; bg: string; border: string }> = {
  'completely-off': { label: 'Completely Off', color: '#F43F5E', bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.25)' },
  'slightly-off':   { label: 'Slightly Off',   color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  'on-track':       { label: 'On Track',       color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
};

const BAR_ORDER: TrackStatus[] = ['completely-off', 'slightly-off', 'on-track'];

function computeStatus(
  daysOff: number | undefined | null,
  quizAvgScore: number | null,
  hasQuizData: boolean,
  examAvg: number | null,
  totalExams: number,
  t: Thresholds,
): TrackStatus {
  const days = daysOff ?? 99;

  const loginStatus: 'on-track' | 'slightly-off' | 'completely-off' =
    days >= t.loginCompletelyOff ? 'completely-off' :
    days >= t.loginSlightlyOff   ? 'slightly-off' : 'on-track';

  let quizStatus: TrackStatus = 'on-track';
  if (hasQuizData) {
    if (quizAvgScore === null)                     quizStatus = 'completely-off';
    else if (quizAvgScore < t.quizCompletelyOff)   quizStatus = 'completely-off';
    else if (quizAvgScore < t.quizSlightlyOff)     quizStatus = 'slightly-off';
    else                                            quizStatus = 'on-track';
  }

  let examStatus: TrackStatus = 'on-track';
  if (totalExams >= 1) {
    if (examAvg === null)                          examStatus = 'completely-off';
    else if (examAvg < t.examCompletelyOff)        examStatus = 'completely-off';
    else if (examAvg < t.examSlightlyOff)          examStatus = 'slightly-off';
    else                                            examStatus = 'on-track';
  }

  if (loginStatus === 'completely-off' || quizStatus === 'completely-off' || examStatus === 'completely-off') return 'completely-off';
  if (loginStatus === 'slightly-off'   || quizStatus === 'slightly-off'   || examStatus === 'slightly-off')   return 'slightly-off';
  return 'on-track';
}

const StudentTrackGrid: React.FC<StudentTrackGridProps> = ({ students, schoolCode, teacherUsername, externalTopic, onExternalTopicChange, scheduledAssignments, preload }) => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [quizScoreMap, setQuizScoreMap] = useState<Map<number, { total: number; count: number }>>(new Map());
  const [quizTopicMap, setQuizTopicMap] = useState<Map<number, Map<string, { correct: number; total: number }>>>(new Map());
  const [hasQuizData, setHasQuizData] = useState(false);
  const [prepTopicMap, setPrepTopicMap] = useState<Map<number, Map<string, { correct: number; total: number }>>>(new Map());
  const [topicAttemptMap, setTopicAttemptMap] = useState<Map<number, Map<string, Array<{ correct: number; incorrect: number; date: string }>>>>(new Map());
  const [selectedStudentStatus, setSelectedStudentStatus] = useState<StudentStatus | null>(null);
  const [topicModalStudent, setTopicModalStudent] = useState<StudentStatus | null>(null);
  const [classFilter, setClassFilter] = useState<string>('All');
  const [selectedTopic, setSelectedTopicInternal] = useState<string>('All');

  const setSelectedTopic = (t: string) => {
    setSelectedTopicInternal(t);
    onExternalTopicChange?.(t);
  };

  useEffect(() => {
    if (externalTopic !== undefined && externalTopic !== selectedTopic) {
      setSelectedTopicInternal(externalTopic);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTopic]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(e.target as Node)) {
        setTopicDropdownOpen(false);
        setTopicSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [assignmentScoreMap, setAssignmentScoreMap] = useState<Map<number, number>>(new Map());
  const [examScoreMap, setExamScoreMap] = useState<Map<number, { total: number; count: number }>>(new Map());
  const [totalExams, setTotalExams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [draftThresholds, setDraftThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [selectedBarStatus, setSelectedBarStatus] = useState<TrackStatus | null>(null);
  const [cardPage, setCardPage] = useState(0);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const studentCardsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Wave 1: use preloaded data if available (fetched during greeting screen),
        // otherwise fetch now.
        let wave1Sessions: SessionItem[];
        let homeworks: { id: number }[];
        let exams: { exam_id: number }[];
        let resolvedSchoolCode: string;

        if (preload) {
          wave1Sessions    = preload.sessions;
          homeworks        = preload.homeworks;
          exams            = preload.exams;
          resolvedSchoolCode = preload.resolvedSchoolCode;
        } else {
          const [sessionRes, homeworkRes, examRes] = await Promise.all([
            fetch(`${API_BASE}api/external-data/user-sessions/by-school-code`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ school_code: schoolCode, limit: 5000 }),
            }),
            fetch(`${API_BASE}api/external-data/quiz-homework/by-username`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: teacherUsername, limit: 7 }),
            }),
            fetch(`${API_BASE}api/external-data/teacher-exams/by-username`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: teacherUsername, limit: 5 }),
            }),
          ]);
          const sessionData  = await sessionRes.json();
          const homeworkData = await homeworkRes.json();
          const examData     = await examRes.json();
          wave1Sessions      = sessionData.items ?? [];
          homeworks          = homeworkData.items ?? [];
          exams              = examData.items ?? [];
          resolvedSchoolCode = homeworkData.school_code || schoolCode || '';
        }

        setSessions(wave1Sessions);
        setHasQuizData(homeworks.length > 0);
        setTotalExams(exams.length);

        const [submissionResults, attemptResults] = await Promise.all([
          homeworks.length > 0
            ? Promise.all(
                homeworks.map(hw =>
                  fetch(`${API_BASE}api/external-data/quiz-homework/submissions/by-homework-id`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ homework_id: hw.id, limit: 1000 }),
                  })
                    .then(r => r.json())
                    .catch(() => ({ items: [] }))
                )
              )
            : Promise.resolve([]),
          exams.length > 0
            ? Promise.all(
                exams.map(exam =>
                  fetch(`${API_BASE}api/external-data/teacher-exams/attempts/by-exam-id`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exam_id: exam.exam_id, limit: 1000 }),
                  })
                    .then(r => r.json())
                    .catch(() => ({ items: [] }))
                )
              )
            : Promise.resolve([]),
        ]);

        const qMap = new Map<number, { total: number; count: number }>();
        const tMap = new Map<number, Map<string, { correct: number; total: number }>>();
        for (const result of submissionResults) {
          for (const sub of (result.items ?? [])) {
            if (sub.student_id == null) continue;
            const score = Number(sub.graph_data?.score_pct ?? sub.analysis?.analysis?.score_pct ?? sub.analysis?.prediction?.score_pct ?? NaN);
            if (!isNaN(score)) {
              const existing = qMap.get(sub.student_id) ?? { total: 0, count: 0 };
              qMap.set(sub.student_id, { total: existing.total + score, count: existing.count + 1 });
            }
            const breakdown: any[] = sub.graph_data?.chapter_breakdown ?? [];
            if (breakdown.length > 0) {
              const studentTopics = tMap.get(sub.student_id) ?? new Map<string, { correct: number; total: number }>();
              for (const ch of breakdown) {
                const name = String(ch.chapter || '').trim();
                const chTotal = Number(ch.total ?? 0);
                const chCorrect = Number(ch.correct ?? 0);
                if (!name || chTotal === 0) continue;
                const prev = studentTopics.get(name) ?? { correct: 0, total: 0 };
                studentTopics.set(name, { correct: prev.correct + chCorrect, total: prev.total + chTotal });
              }
              tMap.set(sub.student_id, studentTopics);
            }
          }
        }
        setQuizScoreMap(qMap);
        setQuizTopicMap(tMap);

        // Build per-attempt topic data (quiz)
        const aMap = new Map<number, Map<string, Array<{ correct: number; incorrect: number; date: string }>>>();
        for (const result of submissionResults) {
          for (const sub of (result.items ?? [])) {
            if (sub.student_id == null) continue;
            const breakdown: any[] = sub.graph_data?.chapter_breakdown ?? [];
            for (const ch of breakdown) {
              const name = String(ch.chapter || '').trim();
              const chTotal = Number(ch.total ?? 0);
              const chCorrect = Number(ch.correct ?? 0);
              if (!name || chTotal === 0) continue;
              const studentAttempts = aMap.get(sub.student_id) ?? new Map();
              const attempts = studentAttempts.get(name) ?? [];
              attempts.push({ correct: chCorrect, incorrect: chTotal - chCorrect, date: sub.created_at ?? '' });
              studentAttempts.set(name, attempts);
              aMap.set(sub.student_id, studentAttempts);
            }
          }
        }

        const eMap = new Map<number, { total: number; count: number }>();
        for (const result of attemptResults) {
          for (const attempt of (result.items ?? [])) {
            if (attempt.student_id != null && attempt.percentage != null) {
              const existing = eMap.get(attempt.student_id) ?? { total: 0, count: 0 };
              eMap.set(attempt.student_id, { total: existing.total + attempt.percentage, count: existing.count + 1 });
            }
          }
        }
        setExamScoreMap(eMap);

        const prepRes = resolvedSchoolCode
          ? await fetch(`${API_BASE}api/external-data/test-prep/by-school-code`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ school_code: resolvedSchoolCode, limit: 2000 }),
            })
          : null;
        const prepData = prepRes ? await prepRes.json() : { items: [] };
        const pMap = new Map<number, Map<string, { correct: number; total: number }>>();
        const teacherStudentIds = new Set(students.map(s => s.student_id));
        for (const item of (prepData.items ?? [])) {
          if (!item.student_id || !teacherStudentIds.has(item.student_id)) continue;
          const breakdown: any[] = item.graph_data?.chapter_breakdown ?? [];
          if (breakdown.length === 0) continue;
          const studentTopics = pMap.get(item.student_id) ?? new Map<string, { correct: number; total: number }>();
          for (const ch of breakdown) {
            const name = String(ch.chapter || '').trim().replace(/_/g, ' ');
            const chTotal = Number(ch.total ?? 0);
            const chCorrect = Number(ch.correct ?? 0);
            if (!name || chTotal === 0) continue;
            const prev = studentTopics.get(name) ?? { correct: 0, total: 0 };
            studentTopics.set(name, { correct: prev.correct + chCorrect, total: prev.total + chTotal });
            // per-attempt for prep
            const sid = item.student_id;
            const studentAttempts = aMap.get(sid) ?? new Map();
            const attempts = studentAttempts.get(name) ?? [];
            attempts.push({ correct: chCorrect, incorrect: chTotal - chCorrect, date: item.created_at ?? '' });
            studentAttempts.set(name, attempts);
            aMap.set(sid, studentAttempts);
          }
          pMap.set(item.student_id, studentTopics);
        }
        setPrepTopicMap(pMap);
        setTopicAttemptMap(aMap);

      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [schoolCode, teacherUsername]);

  useEffect(() => {
    if (selectedTopic === 'All' || !scheduledAssignments?.length) {
      setAssignmentScoreMap(new Map());
      return;
    }
    const codes = scheduledAssignments
      .filter(a => a.topic_name === selectedTopic && a.assignment_code)
      .map(a => a.assignment_code!);
    if (codes.length === 0) { setAssignmentScoreMap(new Map()); return; }

    Promise.all(
      codes.map(code =>
        fetch(`${API_BASE}api/external-data/scheduled-assignments/results/by-assignment-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_code: code, limit: 1000 }),
        }).then(r => r.json()).catch(() => ({ items: [] }))
      )
    ).then(results => {
      const raw = new Map<number, { total: number; count: number }>();
      for (const result of results) {
        for (const item of (result.items ?? [])) {
          if (item.student_id == null || item.percentage == null) continue;
          const prev = raw.get(item.student_id) ?? { total: 0, count: 0 };
          raw.set(item.student_id, { total: prev.total + item.percentage, count: prev.count + 1 });
        }
      }
      const avg = new Map<number, number>();
      raw.forEach(({ total, count }, sid) => avg.set(sid, Math.round(total / count)));
      setAssignmentScoreMap(avg);
    });
  }, [selectedTopic, scheduledAssignments]);

  const sessionsByUsername = useMemo(() => {
    const map = new Map<string, { minutesPerDay: Map<string, number> }>();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const s of sessions) {
      if (!s.username || !s.login_time) continue;
      const day = s.login_time.split('T')[0];
      if (new Date(day).getTime() < cutoff) continue;
      let durationSec = s.session_duration_seconds;
      if (durationSec == null && s.logout_time) {
        const diff = new Date(s.logout_time).getTime() - new Date(s.login_time).getTime();
        if (diff > 0) durationSec = diff / 1000;
      }
      if (durationSec == null) continue;
      const entry = map.get(s.username) ?? { minutesPerDay: new Map() };
      const mins = durationSec / 60;
      entry.minutesPerDay.set(day, (entry.minutesPerDay.get(day) ?? 0) + mins);
      map.set(s.username, entry);
    }
    return map;
  }, [sessions]);

  const allTopics = useMemo(() => {
    const topics = new Set<string>();
    quizTopicMap.forEach(tMap => tMap.forEach((_, t) => topics.add(t)));
    prepTopicMap.forEach(tMap => tMap.forEach((_, t) => topics.add(t)));
    scheduledAssignments?.forEach(a => { if (a.topic_name) topics.add(a.topic_name); });
    return ['All', ...Array.from(topics).sort((a, b) => a.localeCompare(b))];
  }, [quizTopicMap, prepTopicMap, scheduledAssignments]);

  const studentStatuses: StudentStatus[] = useMemo(() => {
    return students.map(student => {
      const sid = student.student_id;
      const data = sessionsByUsername.get(student.username ?? '');
      const daysActive = data?.minutesPerDay.size ?? 0;
      const minutesAvg = data && daysActive > 0
        ? Math.round(Array.from(data.minutesPerDay.values()).reduce((a, b) => a + b, 0) / daysActive)
        : 0;

      let quizAvgScore: number | null;
      let effectiveHasQuizData: boolean;

      if (selectedTopic !== 'All') {
        const assignmentScore = assignmentScoreMap.get(sid);
        if (assignmentScore !== undefined) {
          quizAvgScore = assignmentScore;
        } else {
          const qEntry = quizTopicMap.get(sid)?.get(selectedTopic);
          const pEntry = prepTopicMap.get(sid)?.get(selectedTopic);
          const correct = (qEntry?.correct ?? 0) + (pEntry?.correct ?? 0);
          const total = (qEntry?.total ?? 0) + (pEntry?.total ?? 0);
          quizAvgScore = total > 0 ? Math.round((correct / total) * 100) : null;
        }
        effectiveHasQuizData = assignmentScoreMap.size > 0 || quizTopicMap.size > 0 || prepTopicMap.size > 0;
      } else {
        const quizEntry = quizScoreMap.get(sid);
        if (quizEntry && quizEntry.count > 0) {
          quizAvgScore = Math.round(quizEntry.total / quizEntry.count);
        } else {
          // score_pct missing — compute from chapter breakdown data across all topics
          let correct = 0, total = 0;
          quizTopicMap.get(sid)?.forEach(v => { correct += v.correct; total += v.total; });
          prepTopicMap.get(sid)?.forEach(v => { correct += v.correct; total += v.total; });
          quizAvgScore = total > 0 ? Math.round((correct / total) * 100) : null;
        }
        effectiveHasQuizData = hasQuizData || quizTopicMap.has(sid) || prepTopicMap.has(sid);
      }

      const examEntry = examScoreMap.get(sid);
      const examAvg = examEntry && examEntry.count > 0 ? Math.round(examEntry.total / examEntry.count) : null;
      const effectiveExamAvg = selectedTopic !== 'All' ? null : examAvg;
      const effectiveTotalExams = selectedTopic !== 'All' ? 0 : totalExams;
      return {
        student,
        status: computeStatus(selectedTopic !== 'All' ? 0 : student.days_since_login, quizAvgScore, effectiveHasQuizData, effectiveExamAvg, effectiveTotalExams, thresholds),
        minutesAvg,
        daysActive,
        quizAvgScore,
        examAvg,
        totalExams,
      };
    });
  }, [students, sessionsByUsername, quizScoreMap, hasQuizData, examScoreMap, totalExams, thresholds, selectedTopic, quizTopicMap, prepTopicMap, assignmentScoreMap]);

  const classOptions = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => { if (s.grade) grades.add(s.grade); });
    return ['All', ...Array.from(grades).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [students]);

  // Per-class counts for the bar chart
  const barCounts = useMemo(() => {
    const base = classFilter === 'All' ? studentStatuses : studentStatuses.filter(s => s.student.grade === classFilter);
    return {
      'completely-off': base.filter(s => s.status === 'completely-off').length,
      'slightly-off':   base.filter(s => s.status === 'slightly-off').length,
      'on-track':       base.filter(s => s.status === 'on-track').length,
    };
  }, [studentStatuses, classFilter]);

  // ── Graph 3: Class-wise track status breakdown ─────────────────────────────
  const classwiseBreakdown = useMemo(() => {
    const byClass = new Map<string, { 'On Track': number; 'Slightly Off': number; 'Completely Off': number }>();
    studentStatuses.forEach(({ student, status }) => {
      const grade = student.grade ?? 'N/A';
      const prev = byClass.get(grade) ?? { 'On Track': 0, 'Slightly Off': 0, 'Completely Off': 0 };
      if (status === 'on-track') prev['On Track']++;
      else if (status === 'slightly-off') prev['Slightly Off']++;
      else prev['Completely Off']++;
      byClass.set(grade, prev);
    });
    return Array.from(byClass.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([label, counts]) => ({ label, ...counts }));
  }, [studentStatuses]);

  // Students shown when a bar is clicked
  const selectedBarStudents = useMemo(() => {
    if (!selectedBarStatus) return [];
    return studentStatuses.filter(s => {
      if (s.status !== selectedBarStatus) return false;
      if (classFilter !== 'All' && s.student.grade !== classFilter) return false;
      return true;
    });
  }, [studentStatuses, selectedBarStatus, classFilter]);

  if (loading) {
    const sk: React.CSSProperties = {
      background: 'linear-gradient(90deg, #F5F3FF 25%, #EDE9FE 50%, #F5F3FF 75%)',
      backgroundSize: '200% 100%',
      animation: 'sk-shimmer 1.5s infinite linear',
      borderRadius: 6,
    };
    return (
      <div>
        <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

        {/* Bar chart skeleton */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: '20px 24px 16px', marginBottom: 20, boxShadow: C.shadow }}>
          <div style={{ ...sk, height: 11, width: '28%', margin: '0 auto 24px' }} />
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', justifyContent: 'center', height: 140 }}>
            {[110, 160, 80].map((h, i) => (
              <div key={i} style={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ ...sk, width: 56, height: h, borderRadius: '8px 8px 4px 4px' }} />
                <div style={{ ...sk, width: 42, height: 10 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            {[64, 52, 56].map((w, i) => <div key={i} style={{ ...sk, height: 10, width: w }} />)}
          </div>
        </div>

        {/* Student card skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, boxShadow: C.shadow, overflow: 'hidden' }}>
              {/* top accent */}
              <div style={{ ...sk, height: 4, borderRadius: 4, marginBottom: 14, width: '100%' }} />
              {/* name */}
              <div style={{ ...sk, height: 13, width: '72%', marginBottom: 6 }} />
              {/* section */}
              <div style={{ ...sk, height: 10, width: '40%', marginBottom: 18 }} />
              {/* stat rows */}
              {[100, 100, 80].map((w, j) => (
                <div key={j} style={{ ...sk, height: 8, width: `${w}%`, marginBottom: 8 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxBarCount = Math.max(...Object.values(barCounts), 1);
  const CHART_HEIGHT = 200; // px, available for bar growth

  return (
    <div style={{ fontFamily: FONT }}>

      {/* ── Top row: class filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '2px' }}>
          Class
        </span>
        {classOptions.map(cls => (
          <button
            key={cls}
            onClick={() => { setClassFilter(cls); setSelectedBarStatus(null); }}
            style={{
              padding: '5px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: FONT,
              border: classFilter === cls ? `1.5px solid ${C.blue}` : `1.5px solid ${C.border}`,
              background: classFilter === cls ? C.blueSoft : 'transparent',
              color: classFilter === cls ? C.blue : C.textSecondary,
              fontSize: '12px', fontWeight: classFilter === cls ? 700 : 500,
              transition: 'all 0.15s',
            }}
          >
            {cls}
          </button>
        ))}
      </div>

      {/* ── Bar Charts row ── */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'stretch' }}>
      <div style={{ flex: 1, background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px 24px 16px', boxShadow: C.shadowLg }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px', textAlign: 'center' }}>
          Track Status Overview
          {selectedTopic !== 'All' && (
            <span style={{ marginLeft: '8px', color: C.teal, fontWeight: 600, textTransform: 'none', fontSize: '12px' }}>· {selectedTopic}</span>
          )}
          {classFilter !== 'All' && (
            <span style={{ marginLeft: '8px', color: C.blue, fontWeight: 600 }}>· Class {classFilter}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', justifyContent: 'center', margin: '0 auto' }}>
          {BAR_ORDER.map(status => {
            const cfg = STATUS_CONFIG[status];
            const count = barCounts[status];
            const barHeightPx = count > 0 ? Math.max((count / maxBarCount) * CHART_HEIGHT, 16) : 4;
            const isSelected = selectedBarStatus === status;

            return (
              <div
                key={status}
                onClick={() => {
                  const next = isSelected ? null : status;
                  setSelectedBarStatus(next);
                  setCardPage(0);
                  if (next) setTimeout(() => studentCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }}
                style={{ width: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
                title=""
                onMouseEnter={e => {
                  const tip = e.currentTarget.querySelector<HTMLElement>('.bar-tooltip');
                  if (tip) tip.style.opacity = '1';
                }}
                onMouseLeave={e => {
                  const tip = e.currentTarget.querySelector<HTMLElement>('.bar-tooltip');
                  if (tip) tip.style.opacity = '0';
                }}
              >
                {/* Tooltip */}
                <div
                  className="bar-tooltip"
                  style={{
                    position: 'absolute', bottom: `${barHeightPx + 54}px`, left: '50%',
                    transform: 'translateX(-50%)',
                    background: C.text, border: `1px solid ${C.border}`,
                    borderRadius: '8px', padding: '6px 10px',
                    fontSize: '11px', fontWeight: 600, color: '#fff',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                    opacity: 0, transition: 'opacity 0.15s ease',
                    zIndex: 10,
                    boxShadow: C.shadowLg,
                  }}
                >
                  {count === 0 ? 'No students in this category' : count === 1 ? 'Click to view student' : 'Click to view students'}
                  <div style={{
                    position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
                    width: '8px', height: '8px', background: C.text,
                    border: `1px solid ${C.border}`, borderTop: 'none', borderLeft: 'none',
                    rotate: '45deg',
                  }} />
                </div>

                {/* Count + bar (bottom-aligned) */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'flex-end', width: '100%',
                  height: `${CHART_HEIGHT + 30}px`,
                }}>
                  <div style={{
                    fontSize: '26px', fontWeight: 800, lineHeight: 1,
                    color: cfg.color, marginBottom: '8px', transition: 'all 0.2s',
                  }}>
                    {count}
                  </div>
                  <div style={{
                    width: '100%', height: `${barHeightPx}px`,
                    background: isSelected ? cfg.color : `${cfg.color}CC`,
                    borderRadius: '8px 8px 4px 4px',
                    border: `1px solid ${cfg.color}`,
                    transition: 'all 0.25s ease',
                    boxShadow: isSelected ? `0 4px 16px ${cfg.color}55` : `0 2px 8px ${cfg.color}33`,
                  }} />
                </div>

                {/* Label */}
                <div style={{
                  marginTop: '10px', fontSize: '11px', fontWeight: 700,
                  color: cfg.color, textAlign: 'center', lineHeight: 1.3,
                }}>
                  {cfg.label}
                </div>

                {/* Selected indicator dot */}
                <div style={{
                  marginTop: '6px', width: '6px', height: '6px', borderRadius: '50%',
                  background: isSelected ? cfg.color : 'transparent',
                  transition: 'background 0.2s',
                }} />
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${C.border}`, justifyContent: 'center' }}>
          {BAR_ORDER.map(status => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.color }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              </div>
            );
          })}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: C.textMuted }}>
            Click a bar to see students
          </span>
        </div>
      </div>

        {/* Class-wise Tracking — horizontal bars, right column */}
        {classwiseBreakdown.length > 0 && (
          <div style={{ flex: 1 }}>
            <StackedBarChart
              title="Class-wise Tracking"
              data={classwiseBreakdown}
              height={340}
              showXAxisLabels
              horizontal
              maxBarSize={18}
              barCategoryGap="30%"
              segments={[
                { key: 'On Track',       label: 'On Track',       color: '#10B981' },
                { key: 'Slightly Off',   label: 'Slightly Off',   color: '#F59E0B' },
                { key: 'Completely Off', label: 'Completely Off', color: '#F43F5E' },
              ]}
            />
          </div>
        )}
      </div>{/* end flex row */}

      {/* ── Topic filter dropdown ── */}
      {allTopics.length > 1 && (
        <div style={{ marginBottom: '16px', background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '14px 18px', boxShadow: C.shadow }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
            Filter students by topic
          </div>
          <div ref={topicDropdownRef} style={{ position: 'relative' }}>
            {/* Trigger */}
            <button
              onClick={() => { setTopicDropdownOpen(o => !o); setTopicSearch(''); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontFamily: FONT,
                border: `1.5px solid ${topicDropdownOpen ? C.teal : C.border}`,
                background: topicDropdownOpen ? C.tealSoft : C.cardAlt,
                color: selectedTopic === 'All' ? C.textMuted : C.teal,
                fontSize: '13px', fontWeight: selectedTopic === 'All' ? 500 : 700,
                transition: 'all 0.15s', textAlign: 'left',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedTopic === 'All' ? 'All topics' : selectedTopic}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {selectedTopic !== 'All' && (
                  <span
                    onClick={e => { e.stopPropagation(); setSelectedTopic('All'); setSelectedBarStatus(null); setTopicDropdownOpen(false); }}
                    style={{ fontSize: '14px', color: C.textMuted, lineHeight: 1, cursor: 'pointer' }}
                  >✕</span>
                )}
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ transform: topicDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s', color: C.textMuted }}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            {/* Dropdown panel */}
            {topicDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                background: C.card, border: `1.5px solid ${C.teal}`, borderRadius: '12px',
                boxShadow: C.shadowLg, overflow: 'hidden',
              }}>
                {/* Search input */}
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.cardAlt, borderRadius: '8px', padding: '7px 12px' }}>
                    <svg width="13" height="13" fill="none" stroke={C.textMuted} strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                    </svg>
                    <input
                      autoFocus
                      value={topicSearch}
                      onChange={e => setTopicSearch(e.target.value)}
                      placeholder="Search topics…"
                      style={{
                        border: 'none', background: 'transparent', outline: 'none',
                        fontSize: '13px', fontFamily: FONT, color: C.text, width: '100%',
                      }}
                    />
                    {topicSearch && (
                      <span onClick={() => setTopicSearch('')} style={{ cursor: 'pointer', color: C.textMuted, fontSize: '13px' }}>✕</span>
                    )}
                  </div>
                </div>

                {/* Options list */}
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {allTopics
                    .filter(t => t.toLowerCase().includes(topicSearch.toLowerCase()))
                    .map(topic => {
                      const isActive = selectedTopic === topic;
                      return (
                        <div
                          key={topic}
                          onClick={() => { setSelectedTopic(topic); setSelectedBarStatus(null); setTopicDropdownOpen(false); setTopicSearch(''); }}
                          style={{
                            padding: '9px 14px', cursor: 'pointer', fontFamily: FONT,
                            fontSize: '13px', fontWeight: isActive ? 700 : 400,
                            color: isActive ? C.teal : C.text,
                            background: isActive ? C.tealSoft : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.cardAlt; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {topic}
                          {isActive && (
                            <svg width="14" height="14" fill="none" stroke={C.teal} strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  {allTopics.filter(t => t.toLowerCase().includes(topicSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>No topics match</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Inline threshold slider (topic mode only) ── */}
      {selectedTopic !== 'All' && (
        <div style={{ marginBottom: '16px' }}>
          <DualRangeSlider
            title={`Threshold for "${selectedTopic}"`}
            min={0} max={100} unit="%"
            low={draftThresholds.quizCompletelyOff}
            high={draftThresholds.quizSlightlyOff}
            onLow={v => { const t = { ...draftThresholds, quizCompletelyOff: v }; setDraftThresholds(t); setThresholds(t); }}
            onHigh={v => { const t = { ...draftThresholds, quizSlightlyOff: v }; setDraftThresholds(t); setThresholds(t); }}
          />
        </div>
      )}

      {/* ── Student cards (shown when a bar is clicked) ── */}
      {selectedBarStatus && (() => {
        const cfg = STATUS_CONFIG[selectedBarStatus];
        return (
          <div ref={studentCardsRef}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '14px', padding: '12px 16px',
              background: cfg.bg, borderRadius: '12px',
              border: `1px solid ${cfg.border}`,
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: cfg.color }}>
                {cfg.label} Students
              </span>
              <span style={{
                padding: '2px 10px', borderRadius: '99px',
                background: C.card, fontSize: '12px', fontWeight: 700, color: cfg.color,
              }}>
                {selectedBarStudents.length}
              </span>
              {classFilter !== 'All' && (
                <span style={{ fontSize: '12px', color: C.textSecondary }}>· Class {classFilter}</span>
              )}
              <button
                onClick={() => setSelectedBarStatus(null)}
                style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '8px',
                  border: `1px solid ${C.border}`, background: C.card,
                  color: C.textSecondary, fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: FONT,
                }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
                Close
              </button>
            </div>

            {selectedBarStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: C.textMuted, fontSize: '14px' }}>
                No students in this category{classFilter !== 'All' ? ` for class ${classFilter}` : ''}.
              </div>
            ) : (() => {
              const PAGE_SIZE = 24;
              const totalPages = Math.ceil(selectedBarStudents.length / PAGE_SIZE);
              const paged = selectedBarStudents.slice(cardPage * PAGE_SIZE, (cardPage + 1) * PAGE_SIZE);
              return (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {paged.map(({ student, status, minutesAvg, quizAvgScore, examAvg, totalExams: te }) => {
                  const scfg = STATUS_CONFIG[status];

                  const quizBarColor = quizAvgScore == null ? '#F43F5E'
                    : quizAvgScore >= thresholds.quizSlightlyOff  ? '#10B981'
                    : quizAvgScore >= thresholds.quizCompletelyOff ? '#F59E0B'
                    : '#F43F5E';

                  const examBarColor = examAvg == null ? '#F43F5E'
                    : examAvg >= thresholds.examSlightlyOff  ? '#10B981'
                    : examAvg >= thresholds.examCompletelyOff ? '#F59E0B'
                    : '#F43F5E';

                  return (
                    <div
                      key={student.student_id}
                      onClick={() => {
                        const ss = { student, status, minutesAvg, daysActive: 0, quizAvgScore, examAvg, totalExams: te };
                        if (selectedTopic !== 'All') setTopicModalStudent(ss);
                        else setSelectedStudentStatus(ss);
                      }}
                      style={{
                        background: C.card, border: `1.5px solid ${scfg.border}`,
                        borderRadius: '14px', padding: '16px', position: 'relative',
                        overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s',
                        boxShadow: C.shadow,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = C.shadowLg)}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = C.shadow)}
                    >
                      {/* Top accent */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: scfg.color }} />

                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text, marginBottom: '2px', lineHeight: 1.3 }}>
                        {student.full_name}
                      </div>
                      <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '10px' }}>
                        {[student.grade, student.section].filter(Boolean).join(' · ') || '—'}
                      </div>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '99px', background: scfg.bg, marginBottom: '12px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: scfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: scfg.color }}>{scfg.label}</span>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <ScoreRow
                          label={selectedTopic !== 'All' ? selectedTopic : 'Quiz avg'}
                          value={hasQuizData || selectedTopic !== 'All' ? (quizAvgScore != null ? `${quizAvgScore}%` : 'No attempt') : '—'}
                          pct={quizAvgScore != null ? Math.min(100, quizAvgScore) : 0}
                          barColor={quizBarColor}
                          showBar={(hasQuizData || selectedTopic !== 'All') && quizAvgScore != null}
                          valueColor={hasQuizData || selectedTopic !== 'All' ? (quizAvgScore != null ? quizBarColor : '#F43F5E') : C.textMuted}
                        />
                        {selectedTopic === 'All' && (
                          <ScoreRow
                            label="Exam avg"
                            value={te > 0 ? (examAvg != null ? `${examAvg}%` : 'No attempt') : '—'}
                            pct={examAvg != null ? Math.min(100, examAvg) : 0}
                            barColor={examBarColor}
                            showBar={te > 0 && examAvg != null}
                            valueColor={te > 0 ? (examAvg != null ? examBarColor : '#F43F5E') : C.textMuted}
                          />
                        )}
                      </div>

                      {/* View details hint */}
                      <div style={{ marginTop: '10px', fontSize: '10px', color: C.textMuted, textAlign: 'right' }}>
                        {selectedTopic !== 'All' ? 'Tap for attempts →' : 'Tap for topics →'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => { setCardPage(p => p - 1); studentCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    disabled={cardPage === 0}
                    style={{
                      padding: '7px 16px', borderRadius: '8px', border: `1px solid ${C.border}`,
                      background: cardPage === 0 ? C.cardAlt : C.card,
                      color: cardPage === 0 ? C.textMuted : C.text,
                      fontSize: '13px', fontWeight: 600, cursor: cardPage === 0 ? 'not-allowed' : 'pointer',
                      fontFamily: FONT, transition: 'all 0.15s',
                    }}
                  >← Prev</button>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => { setCardPage(i); studentCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                        style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${i === cardPage ? C.teal : C.border}`,
                          background: i === cardPage ? C.tealSoft : 'transparent',
                          color: i === cardPage ? C.teal : C.textSecondary,
                          fontSize: '13px', fontWeight: i === cardPage ? 700 : 500,
                          cursor: 'pointer', fontFamily: FONT,
                        }}
                      >{i + 1}</button>
                    ))}
                  </div>

                  <button
                    onClick={() => { setCardPage(p => p + 1); studentCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    disabled={cardPage === totalPages - 1}
                    style={{
                      padding: '7px 16px', borderRadius: '8px', border: `1px solid ${C.border}`,
                      background: cardPage === totalPages - 1 ? C.cardAlt : C.card,
                      color: cardPage === totalPages - 1 ? C.textMuted : C.text,
                      fontSize: '13px', fontWeight: 600, cursor: cardPage === totalPages - 1 ? 'not-allowed' : 'pointer',
                      fontFamily: FONT, transition: 'all 0.15s',
                    }}
                  >Next →</button>

                  <span style={{ fontSize: '12px', color: C.textMuted, marginLeft: '4px' }}>
                    {cardPage * PAGE_SIZE + 1}–{Math.min((cardPage + 1) * PAGE_SIZE, selectedBarStudents.length)} of {selectedBarStudents.length}
                  </span>
                </div>
              )}
              </>
              );
            })()}
          </div>
        );
      })()}

      {/* ── Topic Breakdown Modal ── */}
      {selectedStudentStatus && (() => {
        const sid = selectedStudentStatus.student.student_id;
        const merged = new Map<string, { correct: number; total: number; sources: string[] }>();
        const addSource = (src: Map<string, { correct: number; total: number }> | undefined, label: string) => {
          src?.forEach(({ correct, total }, topic) => {
            const prev = merged.get(topic) ?? { correct: 0, total: 0, sources: [] };
            merged.set(topic, { correct: prev.correct + correct, total: prev.total + total, sources: prev.sources.includes(label) ? prev.sources : [...prev.sources, label] });
          });
        };
        addSource(quizTopicMap.get(sid), 'Quiz');
        addSource(prepTopicMap.get(sid), 'Pre-assessment');
        return (
          <TopicBreakdownModal
            studentStatus={selectedStudentStatus}
            topicMap={merged}
            thresholds={thresholds}
            onClose={() => setSelectedStudentStatus(null)}
          />
        );
      })()}

      {/* ── Topic Attempt Modal ── */}
      {topicModalStudent && selectedTopic !== 'All' && (() => {
        const sid = topicModalStudent.student.student_id;
        const attempts = (topicAttemptMap.get(sid)?.get(selectedTopic) ?? [])
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const chartData = attempts.map((a, i) => ({
          label: `${i + 1}`,
          chartKey: `${i + 1}`,
          Correct: a.correct,
          Incorrect: a.incorrect,
        }));
        const cfg = STATUS_CONFIG[topicModalStudent.status];
        return (
          <div
            onClick={() => setTopicModalStudent(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: C.card, borderRadius: '20px', border: `1.5px solid ${cfg.border}`, width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: C.shadowLg, fontFamily: FONT }}
            >
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cfg.bg }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: cfg.color }}>{topicModalStudent.student.full_name}</div>
                  <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '2px' }}>{selectedTopic}</div>
                </div>
                <button onClick={() => setTopicModalStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: '4px' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                </button>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                {[
                  { label: 'Attempts', value: String(attempts.length), color: C.teal },
                  { label: 'Topic Score', value: topicModalStudent.quizAvgScore != null ? `${topicModalStudent.quizAvgScore}%` : '—', color: cfg.color },
                  { label: 'Status', value: cfg.label, color: cfg.color },
                ].map((s, i) => (
                  <div key={s.label} style={{ padding: '14px', textAlign: 'center', borderLeft: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ padding: '16px 22px 20px' }}>
                {attempts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: '13px' }}>No attempt data for this topic.</div>
                ) : (
                  <StackedBarChart
                    title="Attempt Outcome"
                    data={chartData}
                    xDataKey="chartKey"
                    xTickFormatter={(v) => `#${v}`}
                    tooltipLabelFormatter={(v) => `Attempt ${v}`}
                    segments={[
                      { key: 'Correct', label: 'Correct', color: '#10B981' },
                      { key: 'Incorrect', label: 'Incorrect', color: '#F43F5E' },
                    ]}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

interface ScoreRowProps {
  label: string;
  value: string;
  pct: number;
  barColor: string;
  showBar: boolean;
  valueColor: string;
}

const ScoreRow: React.FC<ScoreRowProps> = ({ label, value, pct, barColor, showBar, valueColor }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: 700, color: valueColor }}>{value}</span>
    </div>
    <div style={{ height: '4px', borderRadius: '99px', background: '#1E293B' }}>
      {showBar && <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: barColor }} />}
    </div>
  </div>
);

interface DualRangeSliderProps {
  title: string;
  min: number;
  max: number;
  low: number;
  high: number;
  unit: string;
  onLow: (v: number) => void;
  onHigh: (v: number) => void;
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({ title, min, max, low, high, unit, onLow, onHigh }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<'low' | 'high' | null>(null);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const lowPct = pct(low);
  const highPct = pct(high);

  React.useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const val = Math.round(min + p * (max - min));
      if (active === 'low') onLow(Math.min(val, high - 1));
      else onHigh(Math.max(val, low + 1));
    };
    const onUp = () => setActive(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [active, min, max, low, high, onLow, onHigh]);

  const trackGradient = `linear-gradient(to right,
    #F43F5E 0%, #F43F5E ${lowPct}%,
    #F59E0B ${lowPct}%, #F59E0B ${highPct}%,
    #10B981 ${highPct}%, #10B981 100%)`;

  return (
    <div style={{ background: '#111827', borderRadius: '12px', padding: '16px 20px', border: '1px solid #1E293B', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
        {title}
      </div>
      <div style={{ position: 'relative', height: '24px', marginBottom: '4px' }}>
        <div style={{ position: 'absolute', left: `${lowPct}%`, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#F43F5E' }}>{low}{unit}</span>
        </div>
        <div style={{ position: 'absolute', left: `${highPct}%`, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B' }}>{high}{unit}</span>
        </div>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: '28px', display: 'flex', alignItems: 'center', userSelect: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '4px', background: trackGradient }} />
        <div
          onMouseDown={e => { e.preventDefault(); setActive('low'); }}
          style={{ position: 'absolute', left: `${lowPct}%`, transform: 'translateX(-50%)', width: '20px', height: '20px', borderRadius: '50%', background: '#F43F5E', border: '3px solid #111827', cursor: active === 'low' ? 'grabbing' : 'grab', zIndex: active === 'low' ? 3 : 2, boxShadow: '0 2px 8px #F43F5E66', transition: active ? 'none' : 'left 0.05s' }}
        />
        <div
          onMouseDown={e => { e.preventDefault(); setActive('high'); }}
          style={{ position: 'absolute', left: `${highPct}%`, transform: 'translateX(-50%)', width: '20px', height: '20px', borderRadius: '50%', background: '#F59E0B', border: '3px solid #111827', cursor: active === 'high' ? 'grabbing' : 'grab', zIndex: active === 'high' ? 3 : 1, boxShadow: '0 2px 8px #F59E0B66', transition: active ? 'none' : 'left 0.05s' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{min}{unit}</span>
        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{max}{unit}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { color: '#F43F5E', text: `Completely Off: < ${low}${unit}` },
          { color: '#F59E0B', text: `Slightly Off: ${low}–${high}${unit}` },
          { color: '#10B981', text: `On Track / Above: ≥ ${high}${unit}` },
        ].map(({ color, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface TopicBreakdownModalProps {
  studentStatus: StudentStatus;
  topicMap: Map<string, { correct: number; total: number; sources: string[] }>;
  thresholds: Thresholds;
  onClose: () => void;
}

const TopicBreakdownModal: React.FC<TopicBreakdownModalProps> = ({ studentStatus, topicMap, thresholds, onClose }) => {
  const { student, status, quizAvgScore, examAvg, totalExams } = studentStatus;
  const cfg = STATUS_CONFIG[status];

  const topics = Array.from(topicMap.entries()).map(([name, { correct, total, sources }]) => {
    const pct = Math.round((correct / total) * 100);
    const topicStatus: TrackStatus =
      pct < thresholds.quizCompletelyOff ? 'completely-off' :
      pct < thresholds.quizSlightlyOff   ? 'slightly-off' : 'on-track';
    return { name, correct, total, pct, topicStatus, sources };
  }).sort((a, b) => a.pct - b.pct);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111827', borderRadius: '20px', border: `1.5px solid ${cfg.border}`, width: '100%', maxWidth: '520px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', fontFamily: FONT }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: cfg.bg }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: cfg.color }}>{student.full_name}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
              {[student.grade, student.section].filter(Boolean).join(' · ') || '—'}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: '#1a2332', marginTop: '8px', border: `1px solid ${cfg.border}` }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', lineHeight: 1 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: '#1E293B', borderBottom: '1px solid #1E293B' }}>
          {[
            {
              label: 'Quiz avg score',
              value: quizAvgScore != null ? `${quizAvgScore}%` : 'No attempt',
              color: quizAvgScore == null ? '#F43F5E'
                : quizAvgScore >= thresholds.quizSlightlyOff  ? '#10B981'
                : quizAvgScore >= thresholds.quizCompletelyOff ? '#F59E0B'
                : '#F43F5E',
            },
            {
              label: 'Exam avg score',
              value: totalExams > 0 ? (examAvg != null ? `${examAvg}%` : 'No attempt') : '—',
              color: examAvg == null ? (totalExams > 0 ? '#F43F5E' : '#94A3B8')
                : examAvg >= thresholds.examSlightlyOff  ? '#10B981'
                : examAvg >= thresholds.examCompletelyOff ? '#F59E0B'
                : '#F43F5E',
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#1a2332', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Topic breakdown */}
        <div style={{ overflowY: 'auto', flex: 1, background: '#111827' }}>
          <div style={{ padding: '16px 24px 8px', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', background: '#111827' }}>
            Topic-wise Performance
          </div>

          {topics.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', background: '#111827' }}>
              No topic-level data found for this student.
            </div>
          ) : (
            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#111827' }}>
              {topics.map(({ name, correct, total, pct, topicStatus, sources }) => {
                const tcfg = STATUS_CONFIG[topicStatus];
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: tcfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0 }}>{correct}/{total}</span>
                        {sources.map(s => (
                          <span key={s} style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '10px', fontWeight: 600, background: s === 'Quiz' ? 'rgba(20,184,166,0.15)' : 'rgba(124,58,237,0.15)', color: s === 'Quiz' ? '#14B8A6' : '#7C3AED', flexShrink: 0 }}>{s}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ padding: '2px 8px', borderRadius: '99px', background: tcfg.bg, fontSize: '10px', fontWeight: 700, color: tcfg.color }}>
                          {tcfg.label}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: tcfg.color, minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: '5px', borderRadius: '99px', background: '#1E293B' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: tcfg.color, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTrackGrid;
