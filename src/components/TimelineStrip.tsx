import React, { useRef, useState } from 'react';
import { TimelineEntry } from './TeacherTimeline';
import DashboardIcon from './DashboardIcon';

const SERIF = '"Source Serif 4", Georgia, serif';
const SANS  = '"Plus Jakarta Sans", system-ui, sans-serif';

const C = {
  border: '#1E293B', borderStrong: '#334155',
  text: '#F1F5F9', textSecondary: '#64748B', textMuted: '#94A3B8',
  teal: '#14B8A6', tealSoft: 'rgba(20,184,166,0.15)',
  green: '#10B981', greenSoft: 'rgba(16,185,129,0.15)',
  amber: '#F59E0B', amberSoft: 'rgba(245,158,11,0.15)',
  purple: '#7C3AED', purpleSoft: 'rgba(124,58,237,0.15)',
  card: '#111827', cardAlt: '#1a2332',
  shadow: '0 4px 12px rgba(0,0,0,0.15)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.2)',
  shadowGlow: '0 0 0 4px rgba(20,184,166,0.2)',
};

const STATUS_STYLE: Record<TimelineEntry['status'], { label: string; bg: string; fg: string; dot: string }> = {
  completed:     { label: 'Completed',   bg: C.greenSoft, fg: '#047857', dot: C.green },
  'in-progress': { label: 'In Progress', bg: C.amberSoft, fg: '#B45309', dot: C.amber },
  upcoming:      { label: 'Upcoming',    bg: C.cardAlt,   fg: C.textSecondary, dot: C.borderStrong },
};

interface TimelineStripProps {
  entries: TimelineEntry[];
  loadingEntries?: boolean;
  activeTopic?: string;
  onTopicClick: (topic: string) => void;
}

const TimelineStrip: React.FC<TimelineStripProps> = ({ entries, loadingEntries, activeTopic, onTopicClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const renderCards = () => {
    if (loadingEntries) {
      return Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
          <div style={{ width: 240, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 10, borderRadius: 4, background: C.cardAlt, width: '40%' }} />
            <div style={{ height: 13, borderRadius: 4, background: C.cardAlt }} />
            <div style={{ height: 10, borderRadius: 4, background: C.cardAlt, width: '60%' }} />
            <div style={{ height: 30, borderRadius: 8, background: C.cardAlt, marginTop: 4 }} />
          </div>
          <div style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 4, background: C.cardAlt, border: `2px solid ${C.card}` }} />
        </div>
      ));
    }

    if (entries.length === 0) {
      return <div style={{ padding: '0 20px', fontSize: 13, color: C.textMuted, fontFamily: SANS }}>No assignments scheduled.</div>;
    }

    return entries.map((t) => {
      const isActive = activeTopic === t.topic;
      const isHover = hoverCard === t.week;
      const s = STATUS_STYLE[t.status];
      const dotColor = isActive ? C.teal : s.dot;

      return (
        <div key={t.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
          <div
            onMouseEnter={() => setHoverCard(t.week)}
            onMouseLeave={() => setHoverCard(null)}
            style={{
              width: 240, background: C.card, borderRadius: 12,
              border: isActive ? `1.5px solid ${C.teal}` : `1px solid ${C.border}`,
              padding: '14px 14px 12px',
              display: 'flex', flexDirection: 'column', gap: 8,
              boxShadow: isActive ? `${C.shadowGlow}, ${C.shadow}` : (isHover ? C.shadowLg : C.shadow),
              transform: isHover && !isActive ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'all .18s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.textMuted, textTransform: 'uppercase' as const, fontFamily: SANS }}>
                {t.week}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.fg }}>
                {s.label}
              </span>
            </div>

            <p style={{
              margin: '4px 0 2px', fontFamily: SERIF, fontWeight: 600, fontSize: 15, color: C.text, lineHeight: 1.3,
              display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, WebkitLineClamp: 2, overflow: 'hidden', minHeight: 39,
            }}>
              {t.topic}
            </p>

            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, fontFamily: SANS }}>{t.date_range}</span>

            <button
              onClick={() => onTopicClick(isActive ? 'All' : t.topic)}
              style={{
                marginTop: 4, padding: '7px 10px', borderRadius: 8,
                fontWeight: 600, fontSize: 12, fontFamily: SANS,
                background: isActive ? C.teal : 'transparent',
                color: isActive ? '#fff' : C.teal,
                border: `1px solid ${C.teal}`,
                transition: 'all .15s ease', cursor: 'pointer',
              }}
            >
              {isActive ? 'Tracking' : 'Track Status'}
            </button>
          </div>

          <div style={{
            width: 14, height: 14, borderRadius: '50%', marginTop: 4,
            background: dotColor,
            border: isActive ? `3px solid ${C.card}` : `2px solid ${C.card}`,
            boxShadow: isActive ? `0 0 0 2px ${C.teal}` : `0 0 0 1px ${C.border}`,
          }} />
        </div>
      );
    });
  };

  return (
    <div style={{
      background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
      boxShadow: C.shadow, padding: '20px 22px 26px', marginBottom: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 30, height: 30, borderRadius: 9, background: C.purpleSoft,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DashboardIcon name="calendar" size={16} color={C.purple} />
          </span>
          <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.text }}>
            Weekly Teaching Plan
          </h3>
          {!loadingEntries && (
            <span style={{ background: C.cardAlt, color: C.textSecondary, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999 }}>
              {entries.length} weeks
            </span>
          )}
          {activeTopic && activeTopic !== 'All' && (
            <span style={{ background: C.tealSoft, color: C.teal, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5 }}>
              <DashboardIcon name="activity" size={10} color={C.teal} />
              Tracking: {activeTopic}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => scroll(dir)}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.cardAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <DashboardIcon name={dir === -1 ? 'chevL' : 'chevR'} size={16} color={C.textSecondary} />
            </button>
          ))}
        </div>
      </div>

      {/* Connector line + scrollable cards */}
      <div style={{ position: 'relative', paddingTop: 4 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 7, height: 1, background: C.border }} />
        <div
          ref={scrollRef}
          style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14, scrollbarWidth: 'thin' }}
        >
          {renderCards()}
        </div>
      </div>
    </div>
  );
};

export default TimelineStrip;
