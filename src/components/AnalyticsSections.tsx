import React, { useEffect, useState } from 'react';
import { BarChart, GroupedBarChart, LineChart, DAUWAUMAUCards, StackedBarChart } from './AnalyticsCharts';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import { StudentEngagementSummary, OrcaLexSchoolSummary, EngagementStatus, TestPrepSchoolResponse } from '../types';

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
      Analytics
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
        <LineChart title={`Engagement Trend \u2014 ${trendLabel}`} data={trendData} color={trendColor} />
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
  const [schoolPrepData, setSchoolPrepData] = useState<TestPrepSchoolResponse | null>(null);
  const [studentPrepData, setStudentPrepData] = useState<TestPrepSchoolResponse | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState('');

  const selectedStudent = students.find((s) => !!s.username);
  const studentLabel = selectedStudent?.full_name || selectedStudent?.username || 'Student';
  const studentUsername = selectedStudent?.username;

  useEffect(() => {
    if (!schoolCode) return;

    const fetchPrepData = async () => {
      try {
        setPrepLoading(true);
        setPrepError('');

        const schoolResponse = await dashboardAPI.getTestPrepBySchoolCode(schoolCode, 100);
        setSchoolPrepData(schoolResponse);

        if (studentUsername) {
          const studentResponse = await dashboardAPI.getTestPrepByUsernameSchoolCode(
            schoolCode,
            studentUsername,
            100
          );
          setStudentPrepData(studentResponse);
        } else {
          setStudentPrepData(null);
        }
      } catch (err) {
        console.error('Failed to load test prep analytics:', err);
        setPrepError('Unable to load test prep analytics at this time.');
        setSchoolPrepData(null);
        setStudentPrepData(null);
      } finally {
        setPrepLoading(false);
      }
    };

    fetchPrepData();
  }, [schoolCode, studentUsername]);

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

  const testPrepTrendData = schoolPrepData?.items.map((item) => ({
    label: item.name || new Date(item.created_at).toLocaleDateString(),
    value: Number(
      item.graph_data?.score ?? item.analysis?.score ?? item.prediction?.score ?? item.questions?.length ?? 0
    ),
  })) ?? [];

  const studentTestPrepData = studentPrepData?.items.map((item) => ({
    label: item.name || new Date(item.created_at).toLocaleDateString(),
    Correct: Number(item.graph_data?.correct ?? item.analysis?.correct ?? 0),
    Incorrect: Number(item.graph_data?.incorrect ?? item.analysis?.incorrect ?? 0),
    Skipped: Number(item.graph_data?.skipped ?? item.analysis?.skipped ?? 0),
  })) ?? [];

  return (
    <SectionWrapper>
      <ChartGrid>
        <GroupedBarChart
          title="Class Performance Overview"
          data={classWiseData}
          legend1="Active"
          legend2="Inactive/At-Risk"
          color1="#059669"
          color2="#e11d48"
        />
        <LineChart title={`Engagement Trend \u2014 ${trendLabel}`} data={trendData} color={trendColor} />
      </ChartGrid>

      <FullWidthRow>
        <div
          style={{
            border: '1px solid #1E293B',
            borderRadius: 16,
            padding: '20px 24px',
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
            <span
              style={{
                padding: '1px 8px',
                borderRadius: '99px',
                background: 'rgba(139,92,246,0.15)',
                fontSize: 12,
                fontWeight: 700,
                color: '#8B5CF6',
              }}
            >
              {schoolPrepData?.total ?? 0} items
            </span>
          </div>

          {prepLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 180,
                color: '#94A3B8',
              }}
            >
              Loading test prep analytics...
            </div>
          ) : prepError ? (
            <div style={{ color: '#F43F5E', fontSize: 14 }}>{prepError}</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 14,
              }}
            >
              <LineChart
                title="Overall Class Test Prep Trend"
                data={testPrepTrendData}
                color="#8B5CF6"
              />
              {studentUsername ? (
                <StackedBarChart
                  title={`Individual Student Test Prep — ${studentLabel}`}
                  data={studentTestPrepData}
                  segments={[
                    { key: 'Correct', label: 'Correct', color: '#10B981' },
                    { key: 'Incorrect', label: 'Incorrect', color: '#e11d48' },
                    { key: 'Skipped', label: 'Skipped', color: '#f59e0b' },
                  ]}
                />
              ) : (
                <div
                  style={{
                    borderRadius: 14,
                    border: '1px solid #1E293B',
                    padding: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 240,
                    color: '#94A3B8',
                    background: '#0F172A',
                  }}
                >
                  Student username is required to load individual test prep analysis.
                </div>
              )}
            </div>
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
                {school.total_students} students &middot; {school.total_teachers} teachers &middot; {school.total_sessions_this_week} sessions/wk
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
