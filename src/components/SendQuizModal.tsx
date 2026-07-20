import React, { useState } from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

interface SendQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, chapter: string, numQuestions: number, concept?: string) => Promise<void>;
}

const SendQuizModal: React.FC<SendQuizModalProps> = ({ isOpen, onClose, onSend }) => {
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [concept, setConcept] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!chapter.trim()) {
      setError('Please enter a chapter name');
      return;
    }
    try {
      setLoading(true);
      await onSend(subject, chapter, numQuestions, concept || undefined);
      setSubject('Physics');
      setChapter('');
      setNumQuestions(5);
      setConcept('');
      setError('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send quiz');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, fontFamily: FONT
    }}>
      <div style={{
        background: '#111827', borderRadius: '16px', border: '1px solid #1E293B',
        padding: '24px', maxWidth: '450px', width: '90%'
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#F1F5F9', fontFamily: FONT_SERIF }}>
          Send Daily MCQ Quiz
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
            Subject
          </label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{
            width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #334155',
            background: '#0F172A', color: '#F1F5F9', fontSize: '14px', fontFamily: FONT, cursor: 'pointer'
          }}>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Mathematics">Mathematics</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
            Chapter
          </label>
          <input type="text" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="e.g., Electromagnetism"
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #334155',
              background: '#0F172A', color: '#F1F5F9', fontSize: '14px', fontFamily: FONT, boxSizing: 'border-box'
            }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
              Questions
            </label>
            <select value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #334155',
              background: '#0F172A', color: '#F1F5F9', fontSize: '14px', fontFamily: FONT, cursor: 'pointer'
            }}>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase' }}>
              Concept (Optional)
            </label>
            <input type="text" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="e.g., Faraday's Law"
              style={{
                width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #334155',
                background: '#0F172A', color: '#F1F5F9', fontSize: '14px', fontFamily: FONT, boxSizing: 'border-box'
              }} />
          </div>
        </div>

        {error && <div style={{ color: '#F43F5E', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading} style={{
            padding: '10px 20px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent',
            color: '#94A3B8', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT
          }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={loading} style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #14B8A6, #0d9488)',
            color: '#fff', fontSize: '14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: FONT,
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Sending...' : 'Send to All Students'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendQuizModal;
