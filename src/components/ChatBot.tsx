import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const SUGGESTIONS: Record<string, string[]> = {
  teacher: [
    'How are my students doing?',
    'What is the improvement this week?',
    'Which students are at risk?',
    'Who are the most active students?',
    'Which students are scoring lowest?',
    'How are students doing in Math?',
    'How many submitted homework this week?',
    'Show inactive students',
  ],
  school_admin: [
    'Dashboard summary',
    'Compare classes performance',
    'What is the improvement this week?',
    'Which students are at risk?',
    'How is Class 8 doing?',
    'Which students are scoring lowest?',
    'How did students do on exams?',
    'How many submitted homework this week?',
    'Show inactive students',
  ],
  orcalex_admin: [
    'Compare engagement across schools',
    'Dashboard summary',
    'Which students are at risk?',
    'Show inactive students',
    'Who are the most active students?',
    'Is engagement improving?',
  ],
};

const CLASS_OPTIONS = ['6', '7', '8', '9'];
const EXAM_TYPE_OPTIONS = [
  { value: 'exam_mode', label: 'Exam Mode' },
  { value: 'internal_exam', label: 'Internal Exam' },
];

const ChatBot: React.FC = () => {
  const { user } = useAuth();
  const { dashboardData } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      text: `Hi${user?.full_name ? ` ${user.full_name.split(' ')[0]}` : ''}! I'm your CRM assistant. Ask me about student engagement, at-risk students, activity summaries, and more.`,
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Improvement filter state (school_admin only)
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Auto-populate input when class or exam type is selected
  useEffect(() => {
    if (selectedClass) {
      const examLabel = EXAM_TYPE_OPTIONS.find(e => e.value === selectedExamType)?.label || '';
      const examPart = examLabel ? ` wrt ${examLabel}` : '';
      setInput(`Improvement of Class ${selectedClass}${examPart} in the last 2 weeks`);
      inputRef.current?.focus();
    }
  }, [selectedClass, selectedExamType]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Send only lightweight summary data, not full student/teacher arrays
      let trimmedData: any = undefined;
      if (dashboardData) {
        const { all_students, all_teachers, students, teachers, recent_alerts, ...summary } = dashboardData;
        // Keep only top 30 students for search/at-risk queries
        const topStudents = (all_students || students || [])
          .filter((s: any) => s.engagement_status !== 'active')
          .slice(0, 30);
        trimmedData = { ...summary, students: topStudents };
      }

      // Send last 6 messages as history for follow-up context
      const recentMessages = [...messages, userMsg]
        .slice(-6)
        .map((m) => ({ sender: m.sender, text: m.text }));

      // Build request — attach structured improvement fields if class is selected
      const request: any = {
        message: text.trim(),
        role: user?.role || 'teacher',
        school_code: user?.school_code,
        username: user?.username,
        dashboard_data: trimmedData,
        chat_history: recentMessages,
      };

      if (selectedClass) {
        request.class_name = selectedClass;
        request.exam_type = selectedExamType || undefined;
      }

      const response = await chatAPI.sendMessage(request);

      const botMsg: Message = {
        id: Date.now() + 1,
        text: response.reply,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: Message = {
        id: Date.now() + 1,
        text: 'Sorry, I couldn\'t process that request. Please make sure the API is running and try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      // Reset filters after sending
      setSelectedClass('');
      setSelectedExamType('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const role = user?.role || 'teacher';
  const isSchoolAdmin = role === 'school_admin';
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.teacher;

  const accentColor = role === 'orcalex_admin' ? '#8B5CF6' : role === 'school_admin' ? '#3B82F6' : '#14B8A6';
  const accentDark = role === 'orcalex_admin' ? 'rgba(139,92,246,0.15)' : role === 'school_admin' ? 'rgba(59,130,246,0.15)' : 'rgba(20,184,166,0.15)';

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${accentColor}55, 0 0 40px ${accentColor}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            zIndex: 1000,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = `0 6px 28px ${accentColor}66, 0 0 50px ${accentColor}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}55, 0 0 40px ${accentColor}22`;
          }}
          title="Open CRM Assistant"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '460px',
            height: '560px',
            background: '#111827',
            borderRadius: '16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px #1E293B',
            border: '1px solid #1E293B',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'chatSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}18)`,
              borderBottom: '1px solid #1E293B',
              color: '#F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#F1F5F9' }}>
                CRM Assistant
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                Ask about students, engagement & activity
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid #334155',
                color: '#94A3B8',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#F1F5F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
            >
              &#x2715;
            </button>
          </div>

          {/* Quick suggestions – horizontally scrollable */}
          <div
            className="chat-suggestions"
            style={{
              padding: '8px 16px',
              display: 'flex',
              gap: '6px',
              borderBottom: '1px solid #1E293B',
              background: '#111827',
              flexShrink: 0,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
            }}
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                disabled={isLoading}
                style={{
                  padding: '5px 11px',
                  borderRadius: '99px',
                  border: `1px solid ${accentColor}44`,
                  background: accentDark,
                  color: accentColor,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isLoading ? 'default' : 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'all 0.15s',
                  opacity: isLoading ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = accentColor;
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = accentDark;
                  e.currentTarget.style.color = accentColor;
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#0B1120',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: msg.sender === 'user' ? '85%' : '95%',
                    padding: '10px 14px',
                    borderRadius: msg.sender === 'user'
                      ? '14px 14px 4px 14px'
                      : '14px 14px 14px 4px',
                    background: msg.sender === 'user' ? accentColor : '#0F172A',
                    color: msg.sender === 'user' ? '#fff' : '#F1F5F9',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    boxShadow: msg.sender === 'bot' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                    border: msg.sender === 'bot' ? '1px solid #1E293B' : 'none',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    whiteSpace: msg.sender === 'user' ? 'pre-wrap' : 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.sender === 'bot' ? (
                    <div className="chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: '14px 14px 14px 4px',
                    background: '#0F172A',
                    border: '1px solid #1E293B',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    Analyzing data
                  </span>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: accentColor,
                        opacity: 0.5,
                        animation: `chatPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Improvement filter bar – school_admin only, above input */}
          {isSchoolAdmin && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid #1E293B',
                background: '#0F172A',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                Improvement of
              </span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1.5px solid #334155',
                  fontSize: '11px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  outline: 'none',
                  background: '#111827',
                  color: '#F1F5F9',
                  cursor: 'pointer',
                  minWidth: '80px',
                }}
              >
                <option value="">Class</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                wrt
              </span>
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1.5px solid #334155',
                  fontSize: '11px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  outline: 'none',
                  background: '#111827',
                  color: '#F1F5F9',
                  cursor: 'pointer',
                  minWidth: '100px',
                }}
              >
                <option value="">Exam Type</option>
                {EXAM_TYPE_OPTIONS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Input */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #1E293B',
              background: '#111827',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about students, engagement..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #334155',
                fontSize: '13px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: 'none',
                transition: 'border-color 0.15s',
                background: isLoading ? '#1E293B' : '#0F172A',
                color: '#F1F5F9',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = accentColor; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#334155'; }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: 'none',
                background: input.trim() && !isLoading ? accentColor : '#334155',
                color: input.trim() && !isLoading ? '#fff' : '#64748B',
                cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        .chat-suggestions::-webkit-scrollbar { display: none; }
        .chat-markdown h2 { font-size: 13px; font-weight: 700; margin: 10px 0 4px 0; color: #F1F5F9; }
        .chat-markdown h3 { font-size: 12px; font-weight: 700; margin: 8px 0 3px 0; color: #94A3B8; }
        .chat-markdown p { margin: 4px 0; }
        .chat-markdown ul, .chat-markdown ol { margin: 4px 0; padding-left: 18px; }
        .chat-markdown li { margin: 2px 0; }
        .chat-markdown strong { font-weight: 700; }
        .chat-markdown table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; display: block; overflow-x: auto; }
        .chat-markdown th { background: #1E293B; padding: 5px 8px; text-align: left; border: 1px solid #334155; font-weight: 600; color: #94A3B8; }
        .chat-markdown td { padding: 4px 8px; border: 1px solid #334155; color: #F1F5F9; }
        .chat-markdown tr:nth-child(even) td { background: #111827; }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default ChatBot;
