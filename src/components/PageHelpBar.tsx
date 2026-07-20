import React, { useState, useEffect } from 'react';

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

const C = {
  teal: '#7C3AED',
  tealSoft: 'rgba(124,58,237,0.08)',
  tealBorder: 'rgba(124,58,237,0.20)',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  card: '#FFFFFF',
  cardAlt: '#F5F3FF',
};

export interface HelpItem {
  icon: string;
  title: string;
  description: string;
}

interface Props {
  items: HelpItem[];
}

const PageHelpBar: React.FC<Props> = ({ items }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [items]);

  if (items.length === 0) return null;

  return (
    <div style={{
      marginBottom: 20,
      borderRadius: 10,
      border: `1px solid ${open ? C.tealBorder : C.border}`,
      background: open ? C.cardAlt : C.card,
      overflow: 'hidden',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>❓</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: '0.01em' }}>
            How this page works
          </span>
        </div>
        <span style={{
          fontSize: 11, color: C.textMuted, fontWeight: 600,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>▾</span>
      </button>

      {/* Expandable content */}
      <div style={{
        maxHeight: open ? '400px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.25s ease',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 8,
          padding: '0 12px 12px',
        }}>
          {items.map((item, i) => (
            <div key={i} style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: FONT }}>{item.title}</span>
              </div>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT, lineHeight: 1.45 }}>{item.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageHelpBar;
