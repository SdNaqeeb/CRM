import React, { useState, useEffect, useRef } from 'react';
import { StudentEngagementSummary, EngagementStatus } from '../types';
import { dashboardAPI } from '../services/api';

const FONT = "'Plus Jakarta Sans', sans-serif";

const COLORS = {
  bg: '#EDE9FE',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  rowHover: '#F5F3FF',
  headerBg: '#F5F3FF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  green: '#10B981',
  blue: '#3B82F6',
  purple: '#7C3AED',
  amber: '#F59E0B',
  rose: '#F43F5E',
  teal: '#7C3AED',
  inputBorder: '#E2E8F0',
};

interface StudentTableProps {
  students: StudentEngagementSummary[];
  onSendAlert: (studentId: number) => void;
  onSendChallenge?: (studentId: number) => void;
  onViewDetails: (studentId: number) => void;
  selectedIds?: Set<number>;
  onSelectionChange?: (selectedIds: Set<number>) => void;
  usernameByStudentId?: Map<number, string>;
}

const StudentTable: React.FC<StudentTableProps> = ({
  students,
  onSendAlert,
  onSendChallenge,
  onViewDetails,
  selectedIds,
  onSelectionChange,
  usernameByStudentId,
}) => {
  const [filter, setFilter] = useState<'all' | EngagementStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'lastLogin' | 'sessions' | 'highEngagement' | 'lowEngagement'>('name');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  const selectable = !!onSelectionChange;

  const getStatusConfig = (status: EngagementStatus) => {
    switch (status) {
      case EngagementStatus.ACTIVE:
        return {
          color: COLORS.green,
          bg: 'rgba(16,185,129,0.12)',
          border: 'rgba(16,185,129,0.25)',
          label: 'Active',
        };
      case EngagementStatus.AT_RISK:
        return {
          color: COLORS.amber,
          bg: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.25)',
          label: 'At Risk',
        };
      case EngagementStatus.LOW_ENGAGEMENT:
        return {
          color: '#FB923C',
          bg: 'rgba(251,146,60,0.12)',
          border: 'rgba(251,146,60,0.25)',
          label: 'Low',
        };
      case EngagementStatus.INACTIVE:
        return {
          color: COLORS.rose,
          bg: 'rgba(244,63,94,0.12)',
          border: 'rgba(244,63,94,0.25)',
          label: 'Inactive',
        };
      default:
        return {
          color: COLORS.textMuted,
          bg: 'rgba(100,116,139,0.12)',
          border: 'rgba(100,116,139,0.25)',
          label: 'Unknown',
        };
    }
  };

  // Get unique classes for filter
  const uniqueClasses = Array.from(new Set(students.map(s => s.grade || 'Unknown'))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const uniqueSections = Array.from(
    new Set(
      students
        .filter((student) => classFilter === 'all' ? true : (student.grade || 'Unknown') === classFilter)
        .map((student) => student.section || 'Unknown')
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const filteredStudents = students
    .filter((student) => filter === 'all' ? true : student.engagement_status === filter)
    .filter((student) => classFilter === 'all' ? true : (student.grade || 'Unknown') === classFilter)
    .filter((student) => sectionFilter === 'all' ? true : (student.section || 'Unknown') === sectionFilter);

  const engagementOrder: Record<string, number> = {
    [EngagementStatus.ACTIVE]: 4,
    [EngagementStatus.LOW_ENGAGEMENT]: 3,
    [EngagementStatus.AT_RISK]: 2,
    [EngagementStatus.INACTIVE]: 1,
  };

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.full_name.localeCompare(b.full_name);
      case 'lastLogin':
        return (b.days_since_login || 999) - (a.days_since_login || 999);
      case 'sessions':
        return b.sessions_this_week - a.sessions_this_week;
      case 'highEngagement':
        return (engagementOrder[b.engagement_status] || 0) - (engagementOrder[a.engagement_status] || 0);
      case 'lowEngagement':
        return (engagementOrder[a.engagement_status] || 0) - (engagementOrder[b.engagement_status] || 0);
      default:
        return 0;
    }
  });

  const allVisibleIds = sortedStudents.map((s) => s.student_id);
  const allSelected =
    selectable && allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds?.has(id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      allVisibleIds.forEach((id) => next.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      allVisibleIds.forEach((id) => next.add(id));
      onSelectionChange(next);
    }
  };

  const handleToggle = (studentId: number) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    onSelectionChange(next);
  };

  const filterOptions = [
    { label: 'All', value: 'all' as const, count: students.length, color: COLORS.teal },
    {
      label: 'At-Risk',
      value: EngagementStatus.AT_RISK,
      count: students.filter((s) => s.engagement_status === EngagementStatus.AT_RISK).length,
      color: COLORS.amber,
    },
    {
      label: 'Inactive',
      value: EngagementStatus.INACTIVE,
      count: students.filter((s) => s.engagement_status === EngagementStatus.INACTIVE).length,
      color: COLORS.rose,
    },
  ];

  return (
    <div
      style={{
        background: COLORS.cardBg,
        borderRadius: '16px',
        border: `1px solid ${COLORS.cardBorder}`,
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      {/* Filter Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${COLORS.cardBorder}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Class Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class</span>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSectionFilter('all');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${COLORS.inputBorder}`,
                background: COLORS.headerBg,
                fontSize: '13px',
                fontWeight: 500,
                color: COLORS.textSecondary,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: FONT,
              }}
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${COLORS.inputBorder}`,
                background: COLORS.headerBg,
                fontSize: '13px',
                fontWeight: 500,
                color: COLORS.textSecondary,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: FONT,
              }}
            >
              <option value="all">All Sections</option>
              {uniqueSections.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${COLORS.inputBorder}`,
                background: COLORS.headerBg,
                fontSize: '13px',
                fontWeight: 500,
                color: COLORS.textSecondary,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: FONT,
              }}
            >
              <option value="name">Name</option>
              <option value="highEngagement">Highest Engagement</option>
              <option value="lowEngagement">Lowest Engagement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: COLORS.headerBg }}>
              {['Student', 'Grade', ''].map((header) => (
                <th
                  key={header || 'actions'}
                  style={{
                    padding: '12px 20px',
                    textAlign: header === '' ? 'right' : 'left',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: COLORS.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    fontFamily: FONT,
                  }}
                >
                  {header || 'Actions'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student, idx) => {
              const status = getStatusConfig(student.engagement_status);
              const isSelected = selectable && selectedIds?.has(student.student_id);
              return (
                <tr
                  key={student.student_id}
                  style={{
                    borderTop: `1px solid ${COLORS.cardBorder}`,
                    background: isSelected ? 'rgba(124,58,237,0.08)' : COLORS.cardBg,
                    transition: 'background 0.15s',
                    cursor: 'default',
                    animation: `entrance-stagger 0.3s ease-out ${idx * 0.02}s both`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = COLORS.rowHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = COLORS.cardBg;
                  }}
                >
                  {/* Student name */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Active indicator */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: student.is_currently_active ? COLORS.green : '#CBD5E1',
                          flexShrink: 0,
                          boxShadow: student.is_currently_active
                            ? `0 0 8px rgba(16,185,129,0.5)`
                            : 'none',
                        }}
                        title={student.is_currently_active ? 'Online now' : 'Offline'}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: COLORS.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {student.full_name}
                          {student.auth_provider === 'google' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                background: 'rgba(59,130,246,0.15)',
                                fontSize: '10px',
                                fontWeight: 800,
                                color: COLORS.blue,
                              }}
                              title="Google Auth"
                            >
                              G
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: COLORS.textMuted,
                            marginTop: '1px',
                          }}
                        >
                          {student.user_id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Grade */}
                  <td
                    style={{
                      padding: '14px 20px',
                      fontSize: '14px',
                      color: COLORS.textSecondary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {student.grade || '-'} {student.section || ''}
                  </td>

                  {/* Hours in App column intentionally hidden from UI; logic kept in HoursInAppCell below. */}

                  {/* Actions */}
                  <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <DarkActionButton
                        label="View"
                        color={COLORS.blue}
                        onClick={() => onViewDetails(student.student_id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedStudents.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: COLORS.textMuted,
            fontSize: '14px',
          }}
        >
          <svg
            width="40"
            height="40"
            fill="none"
            stroke={COLORS.cardBorder}
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            style={{ margin: '0 auto 12px' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <p style={{ margin: 0, fontWeight: 600, color: COLORS.textSecondary }}>
            No students found
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};

const fmtHours = (sec: number) => {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Cache resolved totals across renders/sorts so we don't refetch a username already seen.
const hoursInAppCache = new Map<string, number>();

const HoursInAppCell: React.FC<{ username?: string }> = ({ username }) => {
  const [seconds, setSeconds] = useState<number | null>(
    username && hoursInAppCache.has(username) ? hoursInAppCache.get(username)! : null
  );
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!username || hoursInAppCache.has(username)) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        setLoading(true);
        dashboardAPI
          .getUserLoginLogs(username, 500)
          .then((logs) => {
            const total = (logs?.items ?? []).reduce(
              (s, d) => s + Number(d.total_time_seconds ?? 0),
              0
            );
            hoursInAppCache.set(username, total);
            setSeconds(total);
          })
          .catch(() => {
            setSeconds(0);
          })
          .finally(() => setLoading(false));
      }
    }, { threshold: 0.1 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [username]);

  if (!username) return <span>—</span>;
  if (seconds !== null) return <span>{fmtHours(seconds)}</span>;
  return <span ref={ref}>{loading ? '…' : ''}</span>;
};

/* Compact dark action button with colored border */
const DarkActionButton: React.FC<{
  label: string;
  color: string;
  onClick: () => void;
}> = ({ label, color, onClick }) => {
  const bg = `${color}12`;
  const hoverBg = `${color}22`;
  const borderColor = `${color}35`;

  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        background: bg,
        color: color,
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg;
        e.currentTarget.style.borderColor = `${color}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
        e.currentTarget.style.borderColor = borderColor;
      }}
    >
      {label}
    </button>
  );
};

export default StudentTable;
