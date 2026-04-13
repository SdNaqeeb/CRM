import React, { useState, useEffect } from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";

interface SendAlertModalProps {
  studentId: number | null;
  studentName?: string;
  onClose: () => void;
  onSend: (studentId: number) => Promise<void>;
}

const SendAlertModal: React.FC<SendAlertModalProps> = ({
  studentId,
  studentName,
  onClose,
  onSend,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSend = async () => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    try {
      await onSend(studentId);
      onClose();
    } catch (err) {
      setError('Failed to send alert. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!studentId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        fontFamily: FONT,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.25s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div
        style={{
          background: '#111827',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px #1E293B',
          border: '1px solid #1E293B',
          overflow: 'hidden',
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease-out',
        }}
      >
        {/* Top accent */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #10B981, rgba(16,185,129,0.3))' }} />

        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" fill="none" stroke="#10B981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
                Send WhatsApp Alert
              </h2>
              {studentName && (
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  to <span style={{ fontWeight: 600, color: '#94A3B8' }}>{studentName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              color: '#64748B',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.background = '#1E293B'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'none'; }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#0F172A',
              border: '1px solid #1E293B',
              marginBottom: '16px',
            }}
          >
            <p style={{ margin: 0, fontSize: '13px', color: '#14B8A6', lineHeight: 1.6 }}>
              A WhatsApp notification will be sent to the student's registered phone number encouraging them to re-engage with the platform.
            </p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(244,63,94,0.12)',
                border: '1px solid rgba(244,63,94,0.3)',
                color: '#F43F5E',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1.5px solid #334155',
                background: '#0F172A',
                color: '#94A3B8',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0F172A'; e.currentTarget.style.color = '#94A3B8'; }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669, #10B981)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: FONT,
                boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                transition: 'all 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send Alert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendAlertModal;
