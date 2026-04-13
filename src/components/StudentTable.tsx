import React, { useState } from 'react';
import { StudentEngagementSummary, EngagementStatus } from '../types';

const FONT = "'Plus Jakarta Sans', sans-serif";

// Dark theme palette
const COLORS = {
  bg: '#0B1120',
  cardBg: '#111827',
  cardBorder: '#1E293B',
  rowHover: '#1E293B',
  headerBg: '#0F172A',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  green: '#10B981',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  amber: '#F59E0B',
  rose: '#F43F5E',
  teal: '#14B8A6',
  inputBorder: '#334155',
};

interface StudentTableProps {
  students: StudentEngagementSummary[];
  onSendAlert: (studentId: number) => void;
  onSendChallenge?: (studentId: number) => void;
  onViewDetails: (studentId: number) => void;
  selectedIds?: Set<number>;
  onSelectionChange?: (selectedIds: Set<number>) => void;
}

const StudentTable: React.FC<StudentTableProps> = ({
  students,
  onSendAlert,
  onSendChallenge,
  onViewDetails,
  selectedIds,
  onSelectionChange,
}) => {
  const [filter, setFilter] = useState<'all' | EngagementStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'lastLogin' | 'sessions' | 'highEngagement' | 'lowEngagement'>('name');
  const [classFilter, setClassFilter] = useState<string>('all');

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

  const filteredStudents = students
    .filter((student) => filter === 'all' ? true : student.engagement_status === filter)
    .filter((student) => classFilter === 'all' ? true : (student.grade || 'Unknown') === classFilter);

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
        <div style={{ display: 'flex', gap: '6px' }}>
          {filterOptions.map((opt) => {
            const isActive = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '99px',
                  border: isActive ? `1.5px solid ${opt.color}` : '1.5px solid transparent',
                  background: isActive ? `${opt.color}15` : 'rgba(100,116,139,0.08)',
                  color: isActive ? opt.color : COLORS.textMuted,
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: FONT,
                  boxShadow: isActive ? `0 0 12px ${opt.color}25` : 'none',
                }}
              >
                {opt.label}
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    opacity: 0.7,
                  }}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Class Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
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
              {selectable && (
                <th style={{ padding: '12px 16px', textAlign: 'left', width: '44px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: COLORS.teal,
                      cursor: 'pointer',
                    }}
                  />
                </th>
              )}
              {['Student', 'Grade', 'Last Login', 'Sessions', 'Status', ''].map((header) => (
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
                    background: isSelected ? 'rgba(20,184,166,0.08)' : COLORS.cardBg,
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
                  {selectable && (
                    <td style={{ padding: '14px 16px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(student.student_id) || false}
                        onChange={() => handleToggle(student.student_id)}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: COLORS.teal,
                          cursor: 'pointer',
                        }}
                      />
                    </td>
                  )}

                  {/* Student name */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Active indicator */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: student.is_currently_active ? COLORS.green : '#475569',
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

                  {/* Last Login */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '14px', color: COLORS.textPrimary }}>
                      {student.last_login
                        ? new Date(student.last_login).toLocaleDateString()
                        : 'Never'}
                    </div>
                    {student.days_since_login !== null &&
                      student.days_since_login !== undefined && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: COLORS.textMuted,
                            marginTop: '1px',
                          }}
                        >
                          {student.days_since_login === 0
                            ? 'Today'
                            : `${student.days_since_login}d ago`}
                        </div>
                      )}
                  </td>

                  {/* Sessions */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: COLORS.textPrimary }}>
                      {student.sessions_this_week}
                      <span style={{ fontWeight: 400, color: COLORS.textMuted }}>/wk</span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: COLORS.textMuted,
                        marginTop: '1px',
                      }}
                    >
                      {student.total_sessions} total
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: status.color,
                        background: status.bg,
                        border: `1px solid ${status.border}`,
                        letterSpacing: '0.02em',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: status.color,
                          marginRight: '6px',
                        }}
                      />
                      {status.label}
                    </span>
                    {student.has_active_alert && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '11px',
                          color: COLORS.rose,
                          fontWeight: 600,
                        }}
                      >
                        Alert active
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <DarkActionButton
                        label="View"
                        color={COLORS.blue}
                        onClick={() => onViewDetails(student.student_id)}
                      />
                      {student.engagement_status !== EngagementStatus.ACTIVE && (
                        <DarkActionButton
                          label="Alert"
                          color={COLORS.amber}
                          onClick={() => onSendAlert(student.student_id)}
                        />
                      )}
                      {onSendChallenge && (
                        <DarkActionButton
                          label="Challenge"
                          color={COLORS.purple}
                          onClick={() => onSendChallenge(student.student_id)}
                        />
                      )}
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
            stroke={COLORS.inputBorder}
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
