import React, { useState } from 'react';
import { ActivityOverview, DailyActivitySummary, ActivityEntry } from '../types';

const FONT = "'Plus Jakarta Sans', sans-serif";

interface ActivityFeedProps {
  data: ActivityOverview;
}

const activityTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  gap_analysis: { label: 'Practice', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  homework_submission: { label: 'Homework', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  exam_result: { label: 'Exam Result', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  exam_created: { label: 'Exam Created', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  homework_assigned: { label: 'HW Assigned', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)' },
  classwork: { label: 'Classwork', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
};

const getScorePercentColor = (p: number | null | undefined) => {
  if (p === null || p === undefined) return '#64748B';
  if (p >= 80) return '#10B981';
  if (p >= 60) return '#3B82F6';
  if (p >= 40) return '#F59E0B';
  return '#F43F5E';
};

const EntryRow: React.FC<{ entry: ActivityEntry }> = ({ entry }) => {
  const typeInfo = activityTypeConfig[entry.activity_type] || { label: entry.activity_type, color: '#64748B', bg: 'rgba(100,116,139,0.15)' };

  return (
    <tr
      style={{ borderTop: '1px solid #1E293B', transition: 'background 0.1s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>{entry.user_name}</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>{entry.role}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
          fontSize: '11px', fontWeight: 700, color: typeInfo.color, background: typeInfo.bg,
        }}>
          {typeInfo.label}
        </span>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: '13px', color: '#F1F5F9' }}>{entry.title}</div>
        {entry.subject && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>{entry.subject}</div>}
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '13px', color: '#F1F5F9' }}>
        {entry.score !== null && entry.score !== undefined ? (
          <span>
            {entry.score}{entry.max_score ? `/${entry.max_score}` : ''}
            {entry.percentage !== null && entry.percentage !== undefined && (
              <span style={{ fontSize: '11px', color: getScorePercentColor(entry.percentage), marginLeft: '4px', fontWeight: 600 }}>({entry.percentage}%)</span>
            )}
          </span>
        ) : (
          <span style={{ color: '#334155' }}>-</span>
        )}
      </td>
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: '#64748B' }}>
        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
      </td>
    </tr>
  );
};

const DaySection: React.FC<{ day: DailyActivitySummary; isExpanded: boolean; onToggle: () => void }> = ({ day, isExpanded, onToggle }) => {
  const dateObj = new Date(day.date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{ borderRadius: '12px', border: '1px solid #1E293B', marginBottom: '10px', overflow: 'hidden', background: '#111827' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: isExpanded ? '#0F172A' : '#111827',
          border: 'none', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#0F172A'; }}
        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = '#111827'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9' }}>{dateLabel}</span>
          <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(59,130,246,0.15)', fontSize: '12px', fontWeight: 700, color: '#3B82F6' }}>
            {day.total_submissions}
          </span>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            {day.student_submissions} student | {day.teacher_activities} teacher
          </span>
        </div>
        <svg
          width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isExpanded && (
        <div style={{ overflowX: 'auto', borderTop: '1px solid #1E293B' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0F172A' }}>
                {['User', 'Type', 'Details', 'Score', 'Time'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: FONT }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {day.entries.map((entry, idx) => (
                <EntryRow key={`${entry.activity_type}-${entry.id}-${idx}`} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ data }) => {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set(data.daily_breakdown.slice(0, 2).map((d) => d.date))
  );
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'teacher'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const filteredDays = data.daily_breakdown
    .map((day) => {
      let entries = day.entries;
      if (filterRole !== 'all') entries = entries.filter((e) => e.role === filterRole);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        entries = entries.filter((e) =>
          e.user_name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          (e.subject && e.subject.toLowerCase().includes(q))
        );
      }
      return { ...day, entries, total_submissions: entries.length };
    })
    .filter((day) => day.entries.length > 0);

  const summaryCards = [
    { label: 'Practice', value: data.total_gap_analysis, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    { label: 'Homework', value: data.total_homework_submissions, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Exams', value: data.total_exams_created, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
    { label: 'Classwork', value: data.total_classwork, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Student Total', value: data.total_student_submissions, color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
    { label: 'Teacher Total', value: data.total_teacher_activities, color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
  ];

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {summaryCards.map((card) => (
          <div
            key={card.label}
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: card.bg,
              textAlign: 'center',
              border: `1px solid ${card.color}22`,
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 800, color: card.color, fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: card.color, marginTop: '4px', opacity: 0.8 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'student', 'teacher'] as const).map((role) => {
            const isActive = filterRole === role;
            return (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                style={{
                  padding: '6px 14px', borderRadius: '99px',
                  border: isActive ? '1.5px solid #3B82F6' : '1.5px solid #334155',
                  background: isActive ? 'rgba(59,130,246,0.15)' : '#0F172A',
                  color: isActive ? '#3B82F6' : '#64748B',
                  fontSize: '13px', fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                }}
              >
                {role === 'all' ? 'All' : role === 'student' ? 'Students' : 'Teachers'}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Search by name, subject..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '8px 14px', borderRadius: '10px',
            border: '1.5px solid #334155', fontSize: '13px', color: '#F1F5F9',
            outline: 'none', fontFamily: FONT, transition: 'border-color 0.2s',
            background: '#0F172A',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#3B82F6'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#334155'; }}
        />
      </div>

      {/* Days */}
      {filteredDays.length > 0 ? (
        filteredDays.map((day) => (
          <DaySection
            key={day.date}
            day={day}
            isExpanded={expandedDays.has(day.date)}
            onToggle={() => toggleDay(day.date)}
          />
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>
          No activity found matching your filters.
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
