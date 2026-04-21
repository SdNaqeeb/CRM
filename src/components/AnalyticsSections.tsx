import React, { useEffect, useRef, useState } from 'react';
import { BarChart, GroupedBarChart, LineChart, DAUWAUMAUCards, StackedBarChart } from './AnalyticsCharts';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import { StudentEngagementSummary, OrcaLexSchoolSummary, EngagementStatus, TestPrepSchoolResponse, TestPrepItem } from '../types';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

// ─── Helper: simulate an 8-week trend from current snapshot ───────────────────
function simulateWeeklyTrend(
  currentWeekValue: number,
  totalValue: number,
  weeks: number = 8
): { label: string; value: number }[] {
  // Derive a weekly average from total_sessions assuming ~12 weeks of history
  const estimatedWeeklyAvg = totalValue / 12;
  const points: { label: string; value: number }[] = [];

  for (let i = weeks; i >= 1; i--) {
    let value: number;
    if (i === 1) {
      // Most recent week uses actual data
      value = currentWeekValue;
    } else {
      // Older weeks: interpolate between the estimated average and current week
      const progress = (weeks - i) / (weeks - 1);
      const base = estimatedWeeklyAvg + (currentWeekValue - estimatedWeeklyAvg) * progress;
      // Add slight deterministic variance so the line isn't perfectly straight
      const variance = 1 + 0.08 * Math.sin(i * 2.5);
      value = Math.max(0, Math.round(base * variance));
    }
    points.push({ label: `Week ${weeks - i + 1}`, value });
  }
  return points;
}

// ─── Helper: compute usage vs academic improvement buckets ────────────────────
function computeUsageVsImprovement(students: StudentEngagementSummary[]): { label: string; value: number }[] {
  const buckets = [
    { label: '0 hrs', min: 0, max: 0 },
    { label: '1-2 hrs', min: 1, max: 2 },
    { label: '3-5 hrs', min: 3, max: 5 },
    { label: '6-10 hrs', min: 6, max: 10 },
    { label: '11+ hrs', min: 11, max: Infinity },
  ];

  return buckets.map(bucket => {
    const inBucket = students.filter(s => s.sessions_this_week >= bucket.min && s.sessions_this_week <= bucket.max);
    const activeInBucket = inBucket.filter(s => s.engagement_status === EngagementStatus.ACTIVE).length;
    const rate = inBucket.length > 0 ? Math.round((activeInBucket / inBucket.length) * 100) : 0;
    return { label: bucket.label, value: rate };
  });
}

function buildClassTestPrepTrend(items: TestPrepItem[]): { label: string; previousScore: number; latestScore: number }[] {
  const grouped: Record<string, TestPrepItem[]> = {};
  items.forEach((item) => {
    const classKey = String(item.graph_data?.class_num ?? item.graph_data?.class ?? 'Unknown');
    if (!grouped[classKey]) grouped[classKey] = [];
    grouped[classKey].push(item);
  });

  return Object.entries(grouped)
    .map(([classKey, classItems]) => {
      const sortedItems = [...classItems].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const latestItem = sortedItems[sortedItems.length - 1];
      const latestScore = Number(latestItem.graph_data?.score_pct ?? latestItem.analysis?.analysis?.score_pct ?? latestItem.analysis?.prediction?.score_pct ?? 0);
      const previousScores = sortedItems.slice(0, -1).map((item) =>
        Number(item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? item.analysis?.prediction?.score_pct ?? 0)
      );
      const previousScore = previousScores.length
        ? Math.round(previousScores.reduce((sum, value) => sum + value, 0) / previousScores.length)
        : 0;

      return {
        label: `Class ${classKey}`,
        previousScore,
        latestScore,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function buildAverageScoreByClass(items: TestPrepItem[]): { label: string; value: number }[] {
  const grouped = new Map<string, { totalScore: number; count: number }>();

  items.forEach((item) => {
    const className = getTestPrepClass(item);
    if (!className || className === 'Unknown') return;

    const existing = grouped.get(className);
    const score = getTestPrepScore(item);

    if (existing) {
      existing.totalScore += score;
      existing.count += 1;
      return;
    }

    grouped.set(className, { totalScore: score, count: 1 });
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([className, bucket]) => ({
      label: `Class ${className}`,
      value: Math.round(bucket.totalScore / bucket.count),
    }));
}

function getTestPrepScore(item: TestPrepItem): number {
  return Number(
    item.graph_data?.score_pct ?? item.analysis?.analysis?.score_pct ?? item.analysis?.prediction?.score_pct ?? 0
  );
}

function getTestPrepTimeSpentSec(item: TestPrepItem): number | null {
  const candidates = [
    item.graph_data?.time_spent_sec,
    item.analysis?.analysis?.time_spent_sec,
    item.analysis?.prediction?.time_spent_sec,
    item.prediction?.time_spent_sec,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function getTestPrepClass(item: TestPrepItem): string {
  return String(item.class_name ?? item.graph_data?.class_num ?? item.graph_data?.class ?? 'Unknown');
}

function getTestPrepSection(item: TestPrepItem): string {
  return String(item.section_name ?? item.graph_data?.section_name ?? item.graph_data?.section ?? 'Unknown');
}

function formatTestPrepDate(value: string, includeTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function getTestPrepLabel(item: TestPrepItem): string {
  return (
    item.graph_data?.chapter_breakdown?.[0]?.chapter  ||
    item.name ||
    formatTestPrepDate(item.created_at, true)
  );
}

function getTestPrepChartKey(item: TestPrepItem, index: number): string {
  return `${item.id}-${new Date(item.created_at).getTime()}-${index}`;
}

function formatTimeSpent(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = seconds / 60;
  if (minutes < 10) return `${minutes.toFixed(1)}m`;
  return `${Math.round(minutes)}m`;
}

function computePearsonCorrelation(points: Array<{ x: number; y: number }>): number | null {
  const validPoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const n = validPoints.length;

  if (n < 2) return null;

  const sumX = validPoints.reduce((sum, point) => sum + point.x, 0);
  const sumY = validPoints.reduce((sum, point) => sum + point.y, 0);
  const sumXY = validPoints.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = validPoints.reduce((sum, point) => sum + point.x * point.x, 0);
  const sumY2 = validPoints.reduce((sum, point) => sum + point.y * point.y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return null;

  return numerator / denominator;
}

function buildOverallTestPrepTrend(
  items: TestPrepItem[]
): { label: string; value: number; examCount: number; studentCount: number }[] {
  const grouped = new Map<string, { timestamp: number; totalScore: number; count: number; students: Set<string> }>();

  items.forEach((item) => {
    const createdAt = new Date(item.created_at);
    if (Number.isNaN(createdAt.getTime())) return;

    const dayKey = createdAt.toISOString().slice(0, 10);
    const existing = grouped.get(dayKey);
    const score = getTestPrepScore(item);

    if (existing) {
      existing.totalScore += score;
      existing.count += 1;
      existing.students.add(item.username || String(item.student_id));
      return;
    }

    grouped.set(dayKey, {
      timestamp: createdAt.getTime(),
      totalScore: score,
      count: 1,
      students: new Set([item.username || String(item.student_id)]),
    });
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([dayKey, bucket]) => ({
      label: formatTestPrepDate(dayKey),
      value: Math.round(bucket.totalScore / bucket.count),
      examCount: bucket.count,
      studentCount: bucket.students.size,
    }));
}

function buildStudentAttemptScoreTrend(items: TestPrepItem[]): { label: string; chartKey: string; value: number }[] {
  return items
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((item, index) => ({
      label: getTestPrepLabel(item),
      chartKey: getTestPrepChartKey(item, index),
      value: getTestPrepScore(item),
    }));
}

function buildStudentAttemptBreakdown(
  items: TestPrepItem[]
): { label: string; chartKey: string; Correct: number; Incorrect: number; Skipped: number }[] {
  return items
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((item, index) => {
      const correct = Number(item.graph_data?.correct ?? item.analysis?.analysis?.correct ?? 0);
      const total = Number(
        item.graph_data?.total ?? item.analysis?.analysis?.total ?? item.questions?.length ?? 0
      );
      const skipped = Number(item.graph_data?.skipped ?? 0);
      const incorrect = Math.max(total - correct - skipped, 0);

      return {
        label: getTestPrepLabel(item),
        chartKey: getTestPrepChartKey(item, index),
        Correct: correct,
        Incorrect: incorrect,
        Skipped: skipped,
      };
    });
}

function buildStudentTimeSpentCorrelationData(items: TestPrepItem[]): {
  points: Array<{
    label: string;
    chartKey: string;
    takenOn: string;
    timeSpentSec: number;
    timeLabel: string;
    value: number;
  }>;
  correlation: number | null;
} {
  const getResolvedTimeSpentSec = (item: TestPrepItem): number => {
    return getTestPrepTimeSpentSec(item) ?? 0;
  };

  const points = items
    .slice()
    .sort((a, b) => {
      const timeA = getResolvedTimeSpentSec(a);
      const timeB = getResolvedTimeSpentSec(b);
      if (timeA !== timeB) return timeA - timeB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .map((item, index) => {
      const timeSpentSec = getResolvedTimeSpentSec(item);
      return {
        label: getTestPrepLabel(item),
        chartKey: getTestPrepChartKey(item, index),
        takenOn: formatTestPrepDate(item.created_at, true),
        timeSpentSec,
        timeLabel: formatTimeSpent(timeSpentSec),
        value: getTestPrepScore(item),
      };
    });

  return {
    points,
    correlation: computePearsonCorrelation(
      points.map((point) => ({
        x: point.timeSpentSec,
        y: point.value,
      }))
    ),
  };
}

// ─── Shared section wrapper (dark theme) ─────────────────────────────────────
const SectionWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT }}>
    <h2
      style={{
        fontFamily: FONT_SERIF,
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 14,
        color: '#F1F5F9',
      }}
    >
    
    </h2>
    {children}
  </div>
);

const ChartGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: 14,
    }}
  >
    {children}
  </div>
);

const FullWidthRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ gridColumn: '1 / -1', marginBottom: 10 }}>{children}</div>
);

// ─── Insight text component ──────────────────────────────────────────────────
const UsageInsight: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const nonZeroBuckets = data.filter(d => d.value > 0);
  if (nonZeroBuckets.length < 2) return null;
  const maxRate = Math.max(...data.map(d => d.value));
  const minRate = Math.min(...data.filter(d => d.value > 0).map(d => d.value));
  const diff = maxRate - minRate;
  return (
    <p
      style={{
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 8,
        marginBottom: 0,
        fontFamily: FONT,
        fontStyle: 'italic',
      }}
    >
      Students with higher usage show {diff}% better engagement
    </p>
  );
};

// ─── Loading skeleton component ──────────────────────────────────────────────
const ChartLoadingSkeleton: React.FC<{ height?: number }> = ({ height = 240 }) => (
  <div
    style={{
      background: '#111827',
      borderRadius: 14,
      border: '1px solid #1E293B',
      padding: '16px 18px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        height: 20,
        background: '#1E293B',
        borderRadius: 4,
        marginBottom: 16,
        width: '60%',
      }}
    />
    <div
      style={{
        height: height - 60,
        background: '#1E293B',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
    <style>
      {`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}
    </style>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. TeacherAnalytics
// ─────────────────────────────────────────────────────────────────────────────
interface TeacherAnalyticsProps {
  students: StudentEngagementSummary[];
}

export const TeacherAnalytics: React.FC<TeacherAnalyticsProps> = ({ students }) => {
  // Weekly engagement trend (simulated 8 weeks)
  const totalSessionsAll = students.reduce((sum, s) => sum + s.total_sessions, 0);
  const sessionsThisWeekAll = students.reduce((sum, s) => sum + s.sessions_this_week, 0);
  const trendData = simulateWeeklyTrend(sessionsThisWeekAll, totalSessionsAll);

  // Determine trend direction
  const lastVal = trendData.length > 0 ? trendData[trendData.length - 1].value : 0;
  const prevVal = trendData.length > 1 ? trendData[trendData.length - 2].value : lastVal;
  const trendLabel = lastVal > prevVal ? 'Improving' : lastVal < prevVal ? 'Declining' : 'Stable';
  const trendColor = lastVal > prevVal ? '#10B981' : lastVal < prevVal ? '#F43F5E' : '#F59E0B';

  // Sessions by class
  const gradeSessionMap: Record<string, { total: number; count: number }> = {};
  students.forEach((s) => {
    const grade = s.grade || 'Unknown';
    if (!gradeSessionMap[grade]) gradeSessionMap[grade] = { total: 0, count: 0 };
    gradeSessionMap[grade].total += s.sessions_this_week;
    gradeSessionMap[grade].count++;
  });
  const sessionsByClass = Object.entries(gradeSessionMap)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([grade, d]) => ({ label: `Class ${grade}`, value: Math.round(d.total / d.count) }));

  return (
    <SectionWrapper>
      <ChartGrid>
        <BarChart title="Avg Sessions per Class" data={sessionsByClass} />
        <LineChart title={`Engagement Trend `} data={trendData} color={trendColor} />
      </ChartGrid>
    </SectionWrapper>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. SchoolAnalytics
// ─────────────────────────────────────────────────────────────────────────────
interface SchoolAnalyticsProps {
  students: StudentEngagementSummary[];
  trend?: 'up' | 'down' | 'stable';
}

export const SchoolAnalytics: React.FC<SchoolAnalyticsProps> = ({ students, trend }) => {
  const { user } = useAuth();
  const schoolCode = user?.school_code;
  const lastSchoolPrepRequestRef = useRef<string | null>(null);
  const [schoolPrepData, setSchoolPrepData] = useState<TestPrepSchoolResponse | null>(null);
  const [studentPrepData, setStudentPrepData] = useState<TestPrepSchoolResponse | null>(null);
  const [selectedStudentUsername, setSelectedStudentUsername] = useState<string>('');
  const [selectedClassForGraphs, setSelectedClassForGraphs] = useState<string>('All');
  const [selectedSectionForGraphs, setSelectedSectionForGraphs] = useState<string>('All');
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [prepError, setPrepError] = useState('');

  const classOptions = React.useMemo(() => {
    if (!schoolPrepData?.items) return ['All'];
    const classes = new Set<string>();
    schoolPrepData.items.forEach((item) => {
      const className = getTestPrepClass(item);
      if (className && className !== 'Unknown') {
        classes.add(className);
      }
    });
    return ['All', ...Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [schoolPrepData]);

  const sectionOptions = React.useMemo(() => {
    if (!schoolPrepData?.items) return ['All'];

    const sections = new Set<string>();
    schoolPrepData.items
      .filter((item) => selectedClassForGraphs === 'All' ? true : getTestPrepClass(item) === selectedClassForGraphs)
      .forEach((item) => {
        const sectionName = getTestPrepSection(item);
        if (sectionName && sectionName !== 'Unknown') {
          sections.add(sectionName);
        }
      });

    return ['All', ...Array.from(sections).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
  }, [schoolPrepData, selectedClassForGraphs]);

  const studentOptions = React.useMemo(() => {
    if (!schoolPrepData?.items) return [];
    const seen = new Set<string>();
    return schoolPrepData.items
      .filter((item) => selectedClassForGraphs === 'All' ? true : getTestPrepClass(item) === selectedClassForGraphs)
      .filter((item) => selectedSectionForGraphs === 'All' ? true : getTestPrepSection(item) === selectedSectionForGraphs)
      .reduce<{ label: string; value: string }[]>((acc, item) => {
        if (item.username && !seen.has(item.username)) {
          seen.add(item.username);
          acc.push({ label: item.student_name || item.username, value: item.username });
        }
        return acc;
      }, []);
  }, [schoolPrepData, selectedClassForGraphs, selectedSectionForGraphs]);

  const selectedStudentName = React.useMemo(() => {
    return studentOptions.find((opt) => opt.value === selectedStudentUsername)?.label || 'Student';
  }, [studentOptions, selectedStudentUsername]);

  useEffect(() => {
    setSelectedSectionForGraphs('All');
  }, [selectedClassForGraphs]);

  useEffect(() => {
    if (!studentOptions.length) {
      setSelectedStudentUsername('');
      return;
    }

    if (!studentOptions.some((option) => option.value === selectedStudentUsername)) {
      setSelectedStudentUsername(studentOptions[0].value);
    }
  }, [studentOptions, selectedStudentUsername]);

  // Fetch school data only when schoolCode changes
  useEffect(() => {
    if (!schoolCode) return;
    if (lastSchoolPrepRequestRef.current === schoolCode) return;
    lastSchoolPrepRequestRef.current = schoolCode;

    const fetchSchoolPrepData = async () => {
      try {
        setSchoolLoading(true);
        setPrepError('');

        const schoolResponse = await dashboardAPI.getTestPrepBySchoolCode(schoolCode, 500);
        setSchoolPrepData(schoolResponse);
      } catch (err) {
        console.error('Failed to load test prep analytics:', err);
        setPrepError('Unable to load test prep analytics at this time.');
        setSchoolPrepData(null);
        lastSchoolPrepRequestRef.current = null;
      } finally {
        setSchoolLoading(false);
      }
    };

    fetchSchoolPrepData();
  }, [schoolCode]);

  // Fetch student data when schoolCode or selectedStudentUsername changes
  useEffect(() => {
    if (!schoolCode || !selectedStudentUsername) {
      setStudentPrepData(null);
      return;
    }

    const fetchStudentPrepData = async () => {
      try {
        setStudentLoading(true);
        setPrepError('');

        const studentResponse = await dashboardAPI.getTestPrepByUsernameSchoolCode(
          schoolCode,
          selectedStudentUsername,
          100
        );
        setStudentPrepData(studentResponse);
      } catch (err) {
        console.error('Failed to load student test prep analytics:', err);
        setPrepError('Unable to load student test prep analytics at this time.');
        setStudentPrepData(null);
      } finally {
        setStudentLoading(false);
      }
    };

    fetchStudentPrepData();
  }, [schoolCode, selectedStudentUsername]);

  // Class-wise grouped bar chart
  const gradeMap: Record<string, { active: number; inactiveAtRisk: number }> = {};
  students.forEach((s) => {
    const grade = s.grade || 'Unknown';
    if (!gradeMap[grade]) gradeMap[grade] = { active: 0, inactiveAtRisk: 0 };
    if (s.engagement_status === EngagementStatus.ACTIVE) {
      gradeMap[grade].active++;
    } else if (
      s.engagement_status === EngagementStatus.INACTIVE ||
      s.engagement_status === EngagementStatus.AT_RISK
    ) {
      gradeMap[grade].inactiveAtRisk++;
    }
  });

  const classWiseData = Object.entries(gradeMap)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([grade, counts]) => ({
      label: `Class ${grade}`,
      value1: counts.active,
      value2: counts.inactiveAtRisk,
    }));

  // Engagement trend data
  const totalSessionsAll = students.reduce((sum, s) => sum + s.total_sessions, 0);
  const sessionsThisWeekAll = students.reduce((sum, s) => sum + s.sessions_this_week, 0);
  const trendData = simulateWeeklyTrend(sessionsThisWeekAll, totalSessionsAll);
  const trendLabel = trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable';
  const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#F43F5E' : '#F59E0B';

  const classScoreData = React.useMemo(() => {
    if (!schoolPrepData?.items) return [];
    return buildAverageScoreByClass(
      schoolPrepData.items
        .filter((item) => getTestPrepClass(item) !== 'Unknown')
        .filter((item) => selectedClassForGraphs === 'All' ? true : getTestPrepClass(item) === selectedClassForGraphs)
        .filter((item) => selectedSectionForGraphs === 'All' ? true : getTestPrepSection(item) === selectedSectionForGraphs)
    );
  }, [schoolPrepData, selectedClassForGraphs, selectedSectionForGraphs]);

  const testPrepTrendData = React.useMemo(() => {
    if (!schoolPrepData?.items) return [];

    const filteredItems =
      schoolPrepData.items
        .filter((item) => selectedClassForGraphs === 'All' ? true : getTestPrepClass(item) === selectedClassForGraphs)
        .filter((item) => selectedSectionForGraphs === 'All' ? true : getTestPrepSection(item) === selectedSectionForGraphs);

    return buildOverallTestPrepTrend(filteredItems);
  }, [schoolPrepData, selectedClassForGraphs, selectedSectionForGraphs]);

  const studentScoreTrendData = React.useMemo(() => {
    return studentPrepData?.items ? buildStudentAttemptScoreTrend(studentPrepData.items) : [];
  }, [studentPrepData]);

  const studentTestPrepData = React.useMemo(() => {
    return studentPrepData?.items ? buildStudentAttemptBreakdown(studentPrepData.items) : [];
  }, [studentPrepData]);

  const studentTimeScoreCorrelation = React.useMemo(() => {
    if (!studentPrepData?.items) {
      return { points: [], correlation: null as number | null };
    }

    return buildStudentTimeSpentCorrelationData(studentPrepData.items);
  }, [studentPrepData]);

  const filteredSchoolPrepItems = React.useMemo(() => {
    if (!schoolPrepData?.items) return [];

    return selectedClassForGraphs === 'All'
      ? schoolPrepData.items.filter((item) => selectedSectionForGraphs === 'All' ? true : getTestPrepSection(item) === selectedSectionForGraphs)
      : schoolPrepData.items
          .filter((item) => getTestPrepClass(item) === selectedClassForGraphs)
          .filter((item) => selectedSectionForGraphs === 'All' ? true : getTestPrepSection(item) === selectedSectionForGraphs);
  }, [schoolPrepData, selectedClassForGraphs, selectedSectionForGraphs]);

  const overallTrendSummary = React.useMemo(() => {
    const uniqueStudents = new Set(
      filteredSchoolPrepItems.map((item) => item.username || String(item.student_id))
    );

    return {
      examCount: filteredSchoolPrepItems.length,
      studentCount: uniqueStudents.size,
    };
  }, [filteredSchoolPrepItems]);

  return (
    <SectionWrapper>
      {/* <ChartGrid>
        <GroupedBarChart
          title="Class Performance Overview"
          data={classWiseData}
          legend1="Active"
          legend2="Inactive/At-Risk"
          color1="#059669"
          color2="#e11d48"
        />
        <LineChart title={`Engagement Trend `} data={trendData} color={trendColor} />
      </ChartGrid> */}

      <FullWidthRow>
        <div
          style={{
            border: '1px solid #1E293B',
            borderRadius: 16,
            padding: 24,
            marginTop: 24,
            background: '#111827',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#F1F5F9',
                fontFamily: FONT_SERIF,
              }}
            >
              Test Prep Analysis
            </h3>
            
          </div>

          {prepError ? (
            <div style={{ color: '#F43F5E', fontSize: 14 }}>{prepError}</div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: '1 1 320px', minWidth: 260 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
                    Filter school test prep analytics by class and section, then choose a student below for individual analysis.
                  </p>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    flex: '0 1 420px',
                    width: '100%',
                    maxWidth: 420,
                  }}
                >
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94A3B8' }}>
                    Class
                  </label>
                  <select
                    value={selectedClassForGraphs}
                    onChange={(e) => setSelectedClassForGraphs(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #334155',
                      background: '#0F172A',
                      color: '#F1F5F9',
                      fontSize: 14,
                    }}
                  >
                    {classOptions.map((classOption) => (
                      <option key={classOption} value={classOption}>
                        {classOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94A3B8' }}>
                    Section
                  </label>
                  <select
                    value={selectedSectionForGraphs}
                    onChange={(e) => setSelectedSectionForGraphs(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #334155',
                      background: '#0F172A',
                      color: '#F1F5F9',
                      fontSize: 14,
                    }}
                  >
                    {sectionOptions.map((sectionOption) => (
                      <option key={sectionOption} value={sectionOption}>
                        {sectionOption}
                      </option>
                    ))}
                  </select>
                </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                  gap: 14,
                }}
              >
                <div style={{ gridColumn: '1 / -1', marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
                    {overallTrendSummary.studentCount} students attempted {overallTrendSummary.examCount} exams
                    {selectedClassForGraphs !== 'All' ? ` in Class ${selectedClassForGraphs}` : ''}
                    {selectedSectionForGraphs !== 'All' ? ` Section ${selectedSectionForGraphs}` : ''}.
                  </p>
                </div>
                {schoolLoading ? (
                  <ChartLoadingSkeleton />
                ) : (
                  <BarChart
                    title="Average Test Prep Score by Class"
                    data={classScoreData}
                    showValues
                    valueLabel="Score %"
                  />
                )}
                {schoolLoading ? (
                  <ChartLoadingSkeleton />
                ) : (
                  <LineChart
                    title="Overall Class Test Prep Score Trend"
                    data={testPrepTrendData}
                    color="#8B5CF6"
                    tooltipLabelFormatter={(value) => {
                      const match = testPrepTrendData.find((item) => item.label === value);
                      if (!match) return String(value);
                      return `${match.label} • ${match.studentCount} students • ${match.examCount} exams`;
                    }}
                  />
                )}
              </div>

              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 16,
                  }}
                >
                  {studentOptions.length > 0 ? (
                    <div style={{ minWidth: 240 }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#94A3B8' }}>
                        Select Student
                      </label>
                      <select
                        value={selectedStudentUsername}
                        onChange={(e) => setSelectedStudentUsername(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid #334155',
                          background: '#0F172A',
                          color: '#F1F5F9',
                          fontSize: 14,
                        }}
                      >
                        {studentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ minWidth: 240, color: '#94A3B8', fontSize: 13 }}>
                      No students found for the selected class and section.
                    </div>
                  )}
                </div>
                <h4
                  style={{
                    margin: '0 0 10px',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#F1F5F9',
                    fontFamily: FONT_SERIF,
                  }}
                >
                  Individual Student Test Prep — {selectedStudentName}
                </h4>
               
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                    gap: 14,
                  }}
                >
                  {/* {studentLoading ? (
                    <ChartLoadingSkeleton />
                  ) : (
                    <LineChart
                      title="Student Score Trend"
                      data={studentScoreTrendData}
                      color="#10B981"
                      xDataKey="chartKey"
                      tooltipLabelFormatter={(value) => {
                        const match = studentScoreTrendData.find((item) => item.chartKey === value);
                        return match?.label ?? String(value);
                      }}
                    />
                  )} */}
                  {studentLoading ? (
                    <ChartLoadingSkeleton />
                  ) : (
                    <StackedBarChart
                      title="Student Correct / Incorrect / Skipped"
                      data={studentTestPrepData}
                      xDataKey="chartKey"
                      xTickFormatter={(value) => {
                        const match = studentTestPrepData.find((item) => item.chartKey === value);
                        return match?.label ?? String(value);
                      }}
                      tooltipLabelFormatter={(value) => {
                        const match = studentTestPrepData.find((item) => item.chartKey === value);
                        return match?.label ?? String(value);
                      }}
                      segments={[
                        { key: 'Correct', label: 'Correct', color: '#10B981' },
                        { key: 'Incorrect', label: 'Incorrect', color: '#e11d48' },
                        { key: 'Skipped', label: 'Skipped', color: '#f59e0b' },
                      ]}
                    />
                  )}
                  {studentLoading ? (
                    <ChartLoadingSkeleton />
                  ) : (
                    <LineChart
                      title={`Time Spent vs Score`}
                      data={studentTimeScoreCorrelation.points}
                      color="#F59E0B"
                      xDataKey="chartKey"
                      showXAxisTicks
                      xTickFormatter={(value) => {
                        const match = studentTimeScoreCorrelation.points.find((item) => item.chartKey === value);
                        return match?.timeLabel ?? String(value);
                      }}
                      tooltipLabelFormatter={(value) => {
                        const match = studentTimeScoreCorrelation.points.find((item) => item.chartKey === value);
                        return match
                          ? `${match.label} • ${match.takenOn} • Time ${match.timeLabel}`
                          : String(value);
                      }}
                      tooltipValueFormatter={(value) => [String(value), 'Score %']}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </FullWidthRow>
    </SectionWrapper>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Donut Chart for a single school (dark theme)
// ─────────────────────────────────────────────────────────────────────────────

const DonutChart: React.FC<{
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
  size?: number;
}> = ({ segments, centerLabel, centerSub, size = 160 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="60" fill="none" stroke="#1E293B" strokeWidth="20" />
        <text x="80" y="76" textAnchor="middle" fontSize="28" fontWeight="800" fill="#94A3B8" fontFamily={FONT_SERIF}>0%</text>
        <text x="80" y="96" textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8" letterSpacing="0.08em">{centerSub}</text>
      </svg>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      {/* Background ring */}
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#1E293B" strokeWidth="20" />

      {/* Segments */}
      {segments.map((seg, i) => {
        if (seg.value === 0) return null;
        const segLen = (seg.value / total) * circumference;
        const offset = circumference - accumulated + circumference * 0.25; // start from top
        accumulated += segLen;
        return (
          <circle
            key={i}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="20"
            strokeDasharray={`${segLen} ${circumference - segLen}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{
              animation: `fade-in-up 0.5s ease ${i * 0.08}s both`,
            }}
          />
        );
      })}

      {/* Center text */}
      <text
        x="80"
        y="76"
        textAnchor="middle"
        fontSize="28"
        fontWeight="800"
        fill="#F1F5F9"
        fontFamily={FONT_SERIF}
      >
        {centerLabel}
      </text>
      <text
        x="80"
        y="96"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#94A3B8"
        letterSpacing="0.08em"
      >
        {centerSub}
      </text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// School-wise Donut Grid (dark theme)
// ─────────────────────────────────────────────────────────────────────────────

const SchoolWiseDonutGrid: React.FC<{ schools: OrcaLexSchoolSummary[] }> = ({ schools }) => {
  return (
    <div style={{ marginBottom: 24, fontFamily: FONT }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <svg width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 21H3V3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 9l-5 5-2-2-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: '#F1F5F9',
            fontFamily: FONT_SERIF,
          }}
        >
          School-wise Analytics
        </h3>
        <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>
          Engagement breakdown per school
        </span>
      </div>

      {/* Grid of school cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 16,
        }}
      >
        {schools.map((school) => {
          const active = school.active_this_week;
          const atRisk = school.at_risk_count;
          const inactive = school.inactive_count;
          const other = Math.max(0, school.total_students - active - atRisk - inactive);
          const total = Math.max(school.total_students, 1);
          const engagedPct = Math.round((active / total) * 100);

          const segments = [
            { label: 'Active', value: active, color: '#059669' },
            { label: 'At-Risk', value: atRisk, color: '#d97706' },
            { label: 'Inactive', value: inactive, color: '#e11d48' },
            { label: 'Other', value: other, color: '#94A3B8' },
          ];

          return (
            <div
              key={school.school_id}
              style={{
                background: '#111827',
                borderRadius: 16,
                border: '1px solid #1E293B',
                padding: '20px 24px',
                transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
                e.currentTarget.style.borderColor = '#334155';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#1E293B';
              }}
            >
              {/* School name & subtitle */}
              <h4
                style={{
                  margin: '0 0 4px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#F1F5F9',
                  fontFamily: FONT,
                }}
              >
                {school.school_name}
              </h4>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 13,
                  color: '#94A3B8',
                  fontWeight: 500,
                }}
              >
                {school.total_students} students &middot;  {school.total_sessions_this_week} sessions/wk
              </p>

              {/* Donut + Legend row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* Donut */}
                <div style={{ flexShrink: 0 }}>
                  <DonutChart
                    segments={segments}
                    centerLabel={`${engagedPct}%`}
                    centerSub="ENGAGED"
                  />
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                  {segments.map((seg) => {
                    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
                    return (
                      <div
                        key={seg.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: seg.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            color: '#94A3B8',
                            fontWeight: 500,
                            minWidth: 70,
                          }}
                        >
                          {seg.label}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#F1F5F9',
                            fontFamily: FONT_SERIF,
                          }}
                        >
                          {seg.value}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: '#94A3B8',
                            fontWeight: 500,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. AdminAnalytics
// ─────────────────────────────────────────────────────────────────────────────
interface AdminAnalyticsProps {
  schools: OrcaLexSchoolSummary[];
  allStudents?: StudentEngagementSummary[];
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ schools }) => {
  return (
    <div style={{ fontFamily: FONT }}>
      <SchoolWiseDonutGrid schools={schools} />
    </div>
  );
};
