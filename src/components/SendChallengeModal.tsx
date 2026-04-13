import React, { useState, useEffect } from 'react';
import { challengeAPI } from '../services/api';
import type { MCQQuestion } from '../types';
import KaTeXText from './KaTeXText';

/* ── Inline keyframes (avoids needing external CSS) ── */
const modalStyles = `
@keyframes mcm-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes mcm-panel-in {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes mcm-card-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes mcm-pulse-dot {
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}
@keyframes mcm-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

interface SendChallengeModalProps {
  studentId: number | null;
  studentName?: string;
  studentGrade?: string;
  onClose: () => void;
  onSend: (studentId: number, subject: string, numQuestions: number, concept?: string) => Promise<void>;
}

type ModalStep = 'form' | 'loading' | 'preview';

/* ── Subject config with icons ── */
const SUBJECTS = [
  { name: 'Mathematics', icon: '\u03C0', color: '#14B8A6' },
  { name: 'Physics', icon: '\u269B', color: '#8B5CF6' },
  { name: 'Chemistry', icon: '\u2697', color: '#F43F5E' },
  { name: 'Biology', icon: '\uD83E\uDDEC', color: '#10B981' },
  { name: 'English', icon: 'Aa', color: '#F59E0B' },
  { name: 'Social Studies', icon: '\uD83C\uDF0D', color: '#8B5CF6' },
  { name: 'Computer Science', icon: '<>', color: '#3B82F6' },
];

const FONT_UI = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const SendChallengeModal: React.FC<SendChallengeModalProps> = ({
  studentId,
  studentName,
  studentGrade,
  onClose,
  onSend,
}) => {
  const [step, setStep] = useState<ModalStep>('form');
  const [subject, setSubject] = useState('');
  const [concept, setConcept] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedSubject = SUBJECTS.find((s) => s.name === subject);

  const handleGeneratePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) { setError('Please select a subject'); return; }
    setError('');
    setStep('loading');

    try {
      const grade = studentGrade || '10';
      const response = await challengeAPI.generatePreview({
        subject,
        grade,
        num_questions: numQuestions,
        concept: concept || undefined,
      });
      setQuestions(response.questions);
      setStep('preview');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to generate questions. Please try again.';
      setError(detail);
      setStep('form');
    }
  };

  const handleRegenerate = () => { setQuestions([]); setStep('form'); };

  const handleSendChallenge = async () => {
    if (!studentId) return;
    setSending(true);
    setError('');
    try {
      await onSend(studentId, subject, numQuestions, concept || undefined);
      onClose();
    } catch {
      setError('Failed to send challenge. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!studentId) return null;

  const isPreview = step === 'preview';
  const accentColor = selectedSubject?.color || '#14B8A6';

  return (
    <>
      <style>{modalStyles}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          animation: mounted ? 'mcm-backdrop-in 0.25s ease-out' : undefined,
          fontFamily: FONT_UI,
        }}
        onClick={(e) => { if (e.target === e.currentTarget && step !== 'loading' && !sending) onClose(); }}
      >
        {/* Panel */}
        <div
          style={{
            background: '#111827',
            borderRadius: '16px',
            width: '100%',
            maxWidth: isPreview ? '780px' : '460px',
            maxHeight: '88vh',
            overflowY: isPreview ? 'auto' : undefined,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px #1E293B',
            border: '1px solid #1E293B',
            animation: mounted ? 'mcm-panel-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
            transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #1E293B',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              background: isPreview
                ? `linear-gradient(135deg, ${accentColor}12, ${accentColor}06)`
                : undefined,
            }}
          >
            <div>
              <h2 style={{
                margin: 0, fontSize: '18px', fontWeight: 700, color: '#F1F5F9',
                letterSpacing: '-0.02em',
              }}>
                {isPreview ? 'Challenge Preview' : 'Create Challenge'}
              </h2>
              {studentName && (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                  for <span style={{ fontWeight: 600, color: '#94A3B8' }}>{studentName}</span>
                  {studentGrade && (
                    <span style={{
                      marginLeft: '8px', padding: '1px 8px', borderRadius: '99px',
                      background: '#0F172A', fontSize: '12px', fontWeight: 600, color: '#94A3B8',
                      border: '1px solid #334155',
                    }}>
                      Grade {studentGrade}
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={step === 'loading' || sending}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px', borderRadius: '8px', color: '#64748B',
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

          {/* ── Body ── */}
          <div style={{ padding: '20px 24px 24px' }}>

            {/* ─── FORM STEP ─── */}
            {step === 'form' && (
              <form onSubmit={handleGeneratePreview}>
                {/* Subject chips */}
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Subject
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  {SUBJECTS.map((s) => {
                    const active = subject === s.name;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => setSubject(s.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '7px 14px', borderRadius: '99px',
                          border: active ? `2px solid ${s.color}` : '2px solid #334155',
                          background: active ? `${s.color}1A` : '#0F172A',
                          color: active ? s.color : '#94A3B8',
                          fontSize: '13px', fontWeight: active ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{s.icon}</span>
                        {s.name}
                      </button>
                    );
                  })}
                </div>

                {/* Concept */}
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Topic <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#64748B' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., Quadratic Equations, Newton's Laws"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #334155', fontSize: '14px', color: '#F1F5F9',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: FONT_UI,
                    background: '#0F172A',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}18`; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Leave blank to cover all key topics from the syllabus
                </p>

                {/* Number of questions */}
                <div style={{ marginTop: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Questions
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {[3, 5, 10, 15].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNumQuestions(n)}
                        style={{
                          width: '44px', height: '44px', borderRadius: '12px',
                          border: numQuestions === n ? `2px solid ${accentColor}` : '2px solid #334155',
                          background: numQuestions === n ? `${accentColor}1A` : '#0F172A',
                          color: numQuestions === n ? accentColor : '#94A3B8',
                          fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontFamily: FONT_UI,
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      style={{
                        width: '64px', height: '44px', borderRadius: '12px',
                        border: '2px solid #334155', textAlign: 'center',
                        fontSize: '15px', fontWeight: 600, color: '#F1F5F9',
                        outline: 'none', fontFamily: FONT_UI,
                        background: '#0F172A',
                      }}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E',
                    fontSize: '13px',
                  }}>
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px',
                      border: '1.5px solid #334155', background: '#0F172A',
                      color: '#94A3B8', fontSize: '14px', fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT_UI,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = '#F1F5F9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#0F172A'; e.currentTarget.style.color = '#94A3B8'; }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!subject}
                    style={{
                      flex: 2, padding: '12px', borderRadius: '12px',
                      border: 'none',
                      background: subject
                        ? `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`
                        : '#334155',
                      color: subject ? '#fff' : '#64748B',
                      fontSize: '14px', fontWeight: 700, cursor: subject ? 'pointer' : 'not-allowed',
                      fontFamily: FONT_UI,
                      boxShadow: subject ? `0 4px 16px ${accentColor}33` : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    Generate Preview
                  </button>
                </div>
              </form>
            )}

            {/* ─── LOADING STEP ─── */}
            {step === 'loading' && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 0',
              }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: accentColor,
                        animation: `mcm-pulse-dot 1.4s ease-in-out ${i * 0.16}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#F1F5F9' }}>
                  Crafting questions...
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Thinking through HOT-level problems for Grade {studentGrade || '10'}
                </p>

                {/* Shimmer skeleton preview */}
                <div style={{ width: '100%', maxWidth: '340px', marginTop: '28px' }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: '14px', borderRadius: '7px', marginBottom: '10px',
                        width: `${100 - i * 18}%`,
                        background: `linear-gradient(90deg, #1E293B 25%, #334155 50%, #1E293B 75%)`,
                        backgroundSize: '200% 100%',
                        animation: `mcm-shimmer 1.6s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ─── PREVIEW STEP ─── */}
            {step === 'preview' && (
              <div>
                {/* Summary badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '6px 14px', borderRadius: '99px', marginBottom: '20px',
                  background: `${accentColor}15`, border: `1px solid ${accentColor}33`,
                }}>
                  <span style={{ fontSize: '14px' }}>{selectedSubject?.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: accentColor }}>
                    {subject}
                  </span>
                  {concept && (
                    <span style={{ fontSize: '13px', color: '#64748B' }}>/ {concept}</span>
                  )}
                  <span style={{
                    padding: '1px 8px', borderRadius: '99px',
                    background: accentColor, color: '#fff',
                    fontSize: '11px', fontWeight: 700,
                  }}>
                    {questions.length}
                  </span>
                </div>

                {/* Question cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      style={{
                        borderRadius: '14px', overflow: 'hidden',
                        border: '1px solid #1E293B',
                        background: '#0F172A',
                        animation: `mcm-card-in 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 0.07}s both`,
                      }}
                    >
                      {/* Question header */}
                      <div style={{
                        padding: '16px 20px 14px',
                        borderBottom: '1px solid #1E293B',
                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                      }}>
                        <span style={{
                          flexShrink: 0, width: '28px', height: '28px',
                          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: accentColor, color: '#fff',
                          fontSize: '13px', fontWeight: 700,
                        }}>
                          {idx + 1}
                        </span>
                        <p style={{
                          margin: 0, fontSize: '15px', lineHeight: 1.6,
                          color: '#F1F5F9', fontFamily: FONT_SERIF, fontWeight: 400,
                        }}>
                          <KaTeXText text={q.question} />
                        </p>
                      </div>

                      {/* Options grid */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '1px', background: '#1E293B',
                      }}>
                        {q.options.map((opt) => (
                          <div
                            key={opt.label}
                            style={{
                              padding: '12px 16px',
                              background: '#111827',
                              display: 'flex', alignItems: 'center', gap: '10px',
                              fontSize: '14px', color: '#94A3B8',
                            }}
                          >
                            <span style={{
                              flexShrink: 0, width: '24px', height: '24px',
                              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: '#1E293B', border: '1.5px solid #334155',
                              fontSize: '12px', fontWeight: 700, color: '#64748B',
                            }}>
                              {opt.label}
                            </span>
                            <span style={{ fontFamily: FONT_SERIF, fontSize: '14px' }}>
                              <KaTeXText text={opt.text} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#F43F5E',
                    fontSize: '13px',
                  }}>
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div style={{
                  display: 'flex', gap: '10px', marginTop: '24px',
                  paddingTop: '20px', borderTop: '1px solid #1E293B',
                }}>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={sending}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px',
                      border: `1.5px solid ${accentColor}44`, background: '#0F172A',
                      color: accentColor, fontSize: '14px', fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT_UI,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${accentColor}12`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#0F172A'; }}
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleSendChallenge}
                    disabled={sending}
                    style={{
                      flex: 2, padding: '12px', borderRadius: '12px',
                      border: 'none',
                      background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                      color: '#fff', fontSize: '14px', fontWeight: 700,
                      cursor: sending ? 'wait' : 'pointer',
                      fontFamily: FONT_UI,
                      boxShadow: `0 4px 16px ${accentColor}33`,
                      transition: 'all 0.2s',
                      opacity: sending ? 0.7 : 1,
                    }}
                  >
                    {sending ? 'Sending...' : 'Send Challenge'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SendChallengeModal;
