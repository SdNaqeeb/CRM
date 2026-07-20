import React, { useState } from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

export interface TimelineEntry {
  week: string;
  date_range: string;
  subject: string;
  topic: string;
  subtopics: string[];
  learning_objectives: string;
  resources: string;
  status: 'completed' | 'in-progress' | 'upcoming';
}

// Mock data for samiya@elp — ELP school weekly plan
export const MOCK_TIMELINE: TimelineEntry[] = [
  {
    week: 'Week 1',
    date_range: '5 May – 9 May 2025',
    subject: 'Mathematics',
    topic: 'Number Systems',
    subtopics: ['Natural numbers', 'Integers', 'Rational numbers', 'Irrational numbers'],
    learning_objectives: 'Students should be able to classify numbers and perform operations on the number line.',
    resources: 'NCERT Ch. 1, Worksheet A',
    status: 'completed',
  },
  {
    week: 'Week 2',
    date_range: '12 May – 16 May 2025',
    subject: 'Mathematics',
    topic: 'Polynomials',
    subtopics: ['Degree of polynomials', 'Zeroes of a polynomial', 'Remainder theorem', 'Factor theorem'],
    learning_objectives: 'Understand polynomial expressions and apply the factor theorem to factorise.',
    resources: 'NCERT Ch. 2, Practice Set B',
    status: 'in-progress',
  },
  {
    week: 'Week 3',
    date_range: '19 May – 23 May 2025',
    subject: 'Mathematics',
    topic: 'Coordinate Geometry',
    subtopics: ['Cartesian plane', 'Plotting points', 'Distance formula'],
    learning_objectives: 'Plot points accurately and calculate distances between two points.',
    resources: 'NCERT Ch. 3, Khan Academy video set',
    status: 'upcoming',
  },
  {
    week: 'Week 4',
    date_range: '26 May – 30 May 2025',
    subject: 'Mathematics',
    topic: 'Linear Equations in Two Variables',
    subtopics: ['Solutions of linear equations', 'Graph of a linear equation', 'Word problems'],
    learning_objectives: 'Solve and graph linear equations in two variables; model real-world scenarios.',
    resources: 'NCERT Ch. 4, Worksheet C',
    status: 'upcoming',
  },
  {
    week: 'Week 5',
    date_range: '2 Jun – 6 Jun 2025',
    subject: 'Mathematics',
    topic: "Euclid's Geometry",
    subtopics: ["Euclid's definitions", 'Axioms and postulates', 'Equivalent versions of the 5th postulate'],
    learning_objectives: "Understand Euclid's approach to geometry and distinguish axioms from theorems.",
    resources: 'NCERT Ch. 5, Supplementary notes',
    status: 'upcoming',
  },
  {
    week: 'Week 6',
    date_range: '9 Jun – 13 Jun 2025',
    subject: 'Mathematics',
    topic: 'Lines and Angles',
    subtopics: ['Pairs of angles', 'Parallel lines', 'Transversal', 'Angle sum property'],
    learning_objectives: 'Apply theorems about angles formed by parallel lines cut by a transversal.',
    resources: 'NCERT Ch. 6, Geometry kit activity',
    status: 'upcoming',
  },
];

const statusConfig = {
  completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  'in-progress': { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  upcoming: { label: 'Upcoming', color: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
};

const WeekCard: React.FC<{ entry: TimelineEntry; index: number; onTopicClick?: (topic: string) => void }> = ({ entry, index, onTopicClick }) => {
  const [expanded, setExpanded] = useState(entry.status === 'in-progress');
  const cfg = statusConfig[entry.status];

  return (
    <div style={{
      display: 'flex',
      gap: '0',
    }}>
      {/* Timeline spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', flexShrink: 0 }}>
        <div style={{
          width: '14px', height: '14px', borderRadius: '50%', marginTop: '18px',
          background: cfg.color, boxShadow: `0 0 0 3px ${cfg.bg}`,
          flexShrink: 0, zIndex: 1,
        }} />
        <div style={{ width: '2px', flex: 1, background: '#1E293B', marginTop: '4px' }} />
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginLeft: '12px', marginBottom: '16px',
        background: '#111827', borderRadius: '14px',
        border: `1px solid ${entry.status === 'in-progress' ? cfg.border : '#1E293B'}`,
        overflow: 'hidden',
        boxShadow: entry.status === 'in-progress' ? `0 0 0 1px ${cfg.border}` : 'none',
      }}>
        {/* Card header */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: FONT, textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{entry.week}</span>
                <span style={{ fontSize: '11px', color: '#475569' }}>{entry.date_range}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', fontFamily: FONT_SERIF }}>{entry.topic}</span>
                {onTopicClick && (
                  <span
                    onClick={(e) => { e.stopPropagation(); onTopicClick(entry.topic); }}
                    title="View track status for this topic"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                      background: 'rgba(20,184,166,0.1)', color: '#14B8A6',
                      border: '1px solid rgba(20,184,166,0.25)', cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.1)')}
                  >
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Track Status
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{entry.subject}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{
              padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
            }}>{cfg.label}</span>
            <svg
              width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div style={{ padding: '0 18px 16px', borderTop: '1px solid #1E293B' }}>
            {/* Subtopics */}
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Subtopics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {entry.subtopics.map((s) => (
                  <span key={s} style={{
                    padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                    background: 'rgba(20,184,166,0.1)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.2)',
                  }}>{s}</span>
                ))}
              </div>
            </div>

            {/* Learning objectives */}
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Learning Objectives</div>
              <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>{entry.learning_objectives}</p>
            </div>

            {/* Resources */}
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '12px', color: '#64748B' }}>{entry.resources}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface TeacherTimelineProps {
  teacherUsername?: string;
  entries?: TimelineEntry[];
  onTopicClick?: (topic: string) => void;
}

const TeacherTimeline: React.FC<TeacherTimelineProps> = ({ teacherUsername, entries, onTopicClick }) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'in-progress' | 'upcoming'>('all');

  const data = entries ?? MOCK_TIMELINE;
  const filtered = filterStatus === 'all' ? data : data.filter((e) => e.status === filterStatus);

  const counts = {
    completed: data.filter((e) => e.status === 'completed').length,
    'in-progress': data.filter((e) => e.status === 'in-progress').length,
    upcoming: data.filter((e) => e.status === 'upcoming').length,
  };

  const progress = Math.round((counts.completed / data.length) * 100);

  return (
    <div>
      {/* Header banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2027 0%, #111827 100%)',
        border: '1px solid #1E293B', borderRadius: '16px',
        padding: '20px 24px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Weekly Teaching Plan
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#F1F5F9', fontFamily: FONT_SERIF }}>
            {teacherUsername ?? 'samiya@elp'} — ELP School
          </div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
            {data.length} weeks · Academic Year 2025
          </div>
        </div>

        {/* Progress ring summary */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#10B981', fontFamily: FONT_SERIF }}>{progress}%</div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Plan Progress</div>
          </div>
          <div style={{ width: '1px', height: '40px', background: '#1E293B' }} />
          {(['completed', 'in-progress', 'upcoming'] as const).map((s) => (
            <div key={s} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: statusConfig[s].color }}>{counts[s]}</div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>{statusConfig[s].label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ height: '6px', borderRadius: '99px', background: '#1E293B', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, #10B981, #14B8A6)', transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {([
          { key: 'all', label: `All (${data.length})` },
          { key: 'completed', label: `Completed (${counts.completed})` },
          { key: 'in-progress', label: `In Progress (${counts['in-progress']})` },
          { key: 'upcoming', label: `Upcoming (${counts.upcoming})` },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilterStatus(opt.key)}
            style={{
              padding: '6px 14px', borderRadius: '99px', fontFamily: FONT,
              border: filterStatus === opt.key ? '1.5px solid #14B8A6' : '1.5px solid transparent',
              background: filterStatus === opt.key ? 'rgba(20,184,166,0.12)' : '#111827',
              color: filterStatus === opt.key ? '#14B8A6' : '#64748B',
              fontSize: '12px', fontWeight: filterStatus === opt.key ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{opt.label}</button>
        ))}
      </div>

      {/* Timeline */}
      <div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B', fontSize: '14px' }}>
            No entries match the selected filter.
          </div>
        ) : (
          filtered.map((entry, i) => (
            <WeekCard key={entry.week} entry={entry} index={i} onTopicClick={onTopicClick} />
          ))
        )}
      </div>

      {/* Mock data notice */}
      <div style={{
        marginTop: '8px', padding: '10px 16px', borderRadius: '10px',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <svg width="14" height="14" fill="none" stroke="#F59E0B" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" /><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 500 }}>
          Showing mock data — live plan will load once the backend upload endpoint is ready.
        </span>
      </div>
    </div>
  );
};

export default TeacherTimeline;
