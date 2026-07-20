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
    'Which students are at risk?',
    'Who hasn\'t logged in this week?',
    'Show inactive students',
    'Who are my most active students?',
    'Which students got alerts recently?',
    'How many students are active today?',
    'List students by engagement status',
    'Which students need immediate attention?',
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

// Client-side intent handler — answers common teacher questions directly from dashboard data
function tryClientSideAnswer(message: string, dashboardData: any): string | null {
  if (!dashboardData) return null;
  const students: any[] = dashboardData.students || [];
  const alerts: any[] = dashboardData.recent_alerts || [];
  const msg = message.toLowerCase().trim();

  const studentLabel = (s: any) => {
    const loc = [s.grade, s.section].filter(Boolean).join(' ');
    return `**${s.full_name}**${loc ? ` (${loc})` : ''}`;
  };

  // --- greetings ---
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|sup|yo|howdy)[!.,\s]*$/i.test(msg)) {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${timeGreeting}!`;
  }

  // --- thanks ---
  if (/^(thanks|thank you|thx|ty|cheers)[!.,\s]*$/i.test(msg)) {
    return "You're welcome! Let me know if you need anything else.";
  }

  // --- help ---
  if (msg === 'help' || msg === 'help me') {
    return `Here's what I can help with:\n\n- **Who hasn't logged in this week?**\n- **Which students are at risk?**\n- **Show inactive students**\n- **Who are my most active students?**\n- **Which students got alerts recently?**\n- **How many students are active today?**\n- **List students by engagement status**\n- **Which students need immediate attention?**\n- **Dashboard summary**`;
  }

  // --- "who hasn't logged in this week / today / X days" ---
  const loginMatch = msg.match(/(?:hasn'?t|haven'?t|not|didn'?t).*log(?:ged)?\s*in.*?(\d+)?\s*(day|week|today)?/);
  const isLoginQuery = loginMatch || (msg.includes('log') && (msg.includes('week') || msg.includes('today') || msg.includes("hasn't") || msg.includes("haven't")));
  if (isLoginQuery) {
    const days = msg.includes('today') ? 0 : msg.includes('week') ? 7 : loginMatch?.[1] ? Number(loginMatch[1]) : 7;
    const inactive = students
      .filter((s) => s.auth_provider !== 'google' && (s.days_since_login === null || s.days_since_login > days))
      .sort((a, b) => (b.days_since_login ?? 9999) - (a.days_since_login ?? 9999));
    if (!inactive.length) return `All students have logged in within the last ${days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''}`}!`;
    const rows = inactive.map((s) => `- ${studentLabel(s)} — ${s.days_since_login != null ? `${s.days_since_login} days ago` : 'never logged in'}`).join('\n');
    return `**${inactive.length} student${inactive.length > 1 ? 's' : ''} haven't logged in${days === 7 ? ' this week' : days === 0 ? ' today' : ` in ${days} days`}:**\n\n${rows}`;
  }

  // --- at-risk students ---
  if (msg.includes('at risk') || msg.includes('at-risk')) {
    const atRisk = students.filter((s) => s.engagement_status === 'at_risk');
    if (!atRisk.length) return 'No students are currently marked as at-risk.';
    const rows = atRisk.map((s) => `- ${studentLabel(s)} — last login: ${s.days_since_login != null ? `${s.days_since_login} days ago` : 'never'}`).join('\n');
    return `**${atRisk.length} at-risk student${atRisk.length > 1 ? 's' : ''}:**\n\n${rows}`;
  }

  // --- inactive students ---
  if (msg.includes('inactive')) {
    const inactive = students.filter((s) => s.engagement_status === 'inactive' || s.engagement_status === 'low_engagement');
    if (!inactive.length) return 'No inactive students found.';
    const rows = inactive.map((s) => `- ${studentLabel(s)} — ${s.days_since_login != null ? `${s.days_since_login} days since login` : 'never logged in'}`).join('\n');
    return `**${inactive.length} inactive/low-engagement student${inactive.length > 1 ? 's' : ''}:**\n\n${rows}`;
  }

  // --- most active / top active students ---
  if (msg.includes('most active') || msg.includes('top active') || (msg.includes('active') && msg.includes('student'))) {
    const active = students
      .filter((s) => s.engagement_status === 'active')
      .sort((a, b) => (a.days_since_login ?? 999) - (b.days_since_login ?? 999))
      .slice(0, 15);
    if (!active.length) return 'No students are currently marked as active.';
    const rows = active.map((s) => `- ${studentLabel(s)} — logged in ${s.days_since_login === 0 ? 'today' : `${s.days_since_login} days ago`}`).join('\n');
    return `**Top ${active.length} active student${active.length > 1 ? 's' : ''}:**\n\n${rows}`;
  }

  // --- how many active today ---
  if (msg.includes('how many') && msg.includes('active') && msg.includes('today')) {
    const today = students.filter((s) => s.days_since_login === 0).length;
    return `**${today}** student${today !== 1 ? 's' : ''} logged in today out of ${students.length} total.`;
  }

  // --- students by engagement status ---
  if (msg.includes('by engagement') || msg.includes('engagement status') || msg.includes('list student')) {
    const groups: Record<string, any[]> = {};
    for (const s of students) {
      const key = s.engagement_status || 'unknown';
      (groups[key] = groups[key] || []).push(s);
    }
    const order = ['active', 'at_risk', 'low_engagement', 'inactive', 'unknown'];
    const lines = order.filter((k) => groups[k]?.length).map((k) => {
      const label = k.replace(/_/g, ' ');
      const names = groups[k].map((s) => `${s.full_name}`).join(', ');
      return `**${label.charAt(0).toUpperCase() + label.slice(1)} (${groups[k].length}):** ${names}`;
    });
    return lines.join('\n\n');
  }

  // --- recent alerts ---
  if (msg.includes('alert')) {
    if (!alerts.length) return 'No recent alerts found.';
    const studentMap = Object.fromEntries(students.map((s) => [s.student_id, s]));
    const rows = alerts.slice(0, 10).map((a) => {
      const s = studentMap[a.student_id];
      const name = s ? studentLabel(s) : `Student #${a.student_id}`;
      return `- ${name} — ${a.reason ?? a.alert_type} (${new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`;
    });
    return `**${alerts.length} recent alert${alerts.length > 1 ? 's' : ''}:**\n\n${rows.join('\n')}`;
  }

  // --- immediate attention / need help ---
  if (msg.includes('immediate attention') || msg.includes('need help') || msg.includes('needs attention')) {
    const urgent = students.filter((s) => s.engagement_status === 'at_risk' || s.engagement_status === 'inactive');
    if (!urgent.length) return 'No students currently need immediate attention.';
    const rows = urgent.map((s) => `- ${studentLabel(s)} — ${s.engagement_status.replace(/_/g, ' ')} | ${s.days_since_login != null ? `${s.days_since_login} days since login` : 'never logged in'}`).join('\n');
    return `**${urgent.length} student${urgent.length > 1 ? 's' : ''} needing attention:**\n\n${rows}`;
  }

  // --- dashboard summary / overview ---
  if (msg.includes('summary') || msg.includes('overview') || msg.includes('dashboard')) {
    const d = dashboardData;
    return `**Dashboard Summary**\n\n- **Total students:** ${d.total_students}\n- **Active:** ${d.active_students}\n- **At risk:** ${d.at_risk_students}\n- **Inactive:** ${d.inactive_students}\n- **Active sessions now:** ${d.active_sessions ?? 0}`;
  }

  return null;
}

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
      // Answer locally if possible — no API call needed
      const localAnswer = tryClientSideAnswer(text.trim(), dashboardData);
      if (localAnswer) {
        setMessages((prev) => [...prev, { id: Date.now() + 1, text: localAnswer, sender: 'bot', timestamp: new Date() }]);
        return;
      }

      let trimmedData: any = undefined;
      if (dashboardData) {
        const { all_students, all_teachers, students, teachers, recent_alerts, ...summary } = dashboardData;
        const allStudents = (all_students || students || []);
        // Send all students but only essential fields so the bot can answer about any student by name
        const studentSummaries = allStudents.map((s: any) => ({
          student_id: s.student_id,
          full_name: s.full_name,
          grade: s.grade,
          section: s.section,
          days_since_login: s.days_since_login,
          engagement_status: s.engagement_status,
          auth_provider: s.auth_provider,
        }));
        trimmedData = {
          ...summary,
          students: studentSummaries,
          recent_alerts: (recent_alerts || []).slice(0, 15),
        };
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

  const accentColor = role === 'orcalex_admin' ? '#7c3aed' : role === 'school_admin' ? '#4f46e5' : '#0d9488';
  const accentLight = role === 'orcalex_admin' ? '#ede9fe' : role === 'school_admin' ? '#eef2ff' : '#f0fdfa';

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
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            zIndex: 1000,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
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
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
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
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                CRM Assistant
              </div>
              <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
                Ask about students, engagement & activity
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
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
              borderBottom: '1px solid #e8e6e1',
              background: '#fff',
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
                  border: `1px solid ${accentColor}40`,
                  background: accentLight,
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
                  e.currentTarget.style.background = accentLight;
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
              background: '#fafaf8',
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
                    background: msg.sender === 'user' ? accentColor : '#fff',
                    color: msg.sender === 'user' ? '#fff' : '#1e293b',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    boxShadow: msg.sender === 'bot' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    border: msg.sender === 'bot' ? '1px solid #e8e6e1' : 'none',
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
                    background: '#fff',
                    border: '1px solid #e8e6e1',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
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
                borderTop: '1px solid #e8e6e1',
                background: '#f8fafc',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                Improvement of
              </span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '11px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  outline: 'none',
                  background: '#fff',
                  color: '#1e293b',
                  cursor: 'pointer',
                  minWidth: '80px',
                }}
              >
                <option value="">Class</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                wrt
              </span>
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '11px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  outline: 'none',
                  background: '#fff',
                  color: '#1e293b',
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
              borderTop: '1px solid #e8e6e1',
              background: '#fff',
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
                border: '1.5px solid #e2e8f0',
                fontSize: '13px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: 'none',
                transition: 'border-color 0.15s',
                background: isLoading ? '#f8fafc' : '#fff',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = accentColor; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: 'none',
                background: input.trim() && !isLoading ? accentColor : '#e2e8f0',
                color: input.trim() && !isLoading ? '#fff' : '#94a3b8',
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
        .chat-markdown h2 { font-size: 13px; font-weight: 700; margin: 10px 0 4px 0; color: #1e293b; }
        .chat-markdown h3 { font-size: 12px; font-weight: 700; margin: 8px 0 3px 0; color: #334155; }
        .chat-markdown p { margin: 4px 0; }
        .chat-markdown ul, .chat-markdown ol { margin: 4px 0; padding-left: 18px; }
        .chat-markdown li { margin: 2px 0; }
        .chat-markdown strong { font-weight: 700; }
        .chat-markdown table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; display: block; overflow-x: auto; }
        .chat-markdown th { background: #f1f5f9; padding: 5px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
        .chat-markdown td { padding: 4px 8px; border: 1px solid #e2e8f0; }
        .chat-markdown tr:nth-child(even) td { background: #f8fafc; }
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
