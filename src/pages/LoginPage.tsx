import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const keyframesStyle = `
@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -40px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}
@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, 30px) scale(1.08); }
  66% { transform: translate(25px, -15px) scale(0.92); }
}
@keyframes orbFloat3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, 25px) scale(0.97); }
  66% { transform: translate(-30px, -35px) scale(1.04); }
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(UserRole.TEACHER);
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (role === UserRole.TEACHER) {
        if (!username.trim()) {
          setError('Please enter your username');
          setLoading(false);
          return;
        }
        login(role, { username });
      } else if (role === UserRole.SCHOOL_ADMIN) {
        if (!schoolCode.trim()) {
          setError('Please enter your school code');
          setLoading(false);
          return;
        }
        login(role, { schoolCode });
      } else {
        login(role);
      }

      if (role === UserRole.ORCALEX_ADMIN) {
        navigate('/orcalex');
      } else if (role === UserRole.SCHOOL_ADMIN) {
        navigate('/school');
      } else {
        navigate('/teacher');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleConfig: Record<string, { color: string; gradient: string }> = {
    [UserRole.TEACHER]: { color: '#14B8A6', gradient: 'linear-gradient(135deg, #14B8A6, #0D9488)' },
    [UserRole.SCHOOL_ADMIN]: { color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
    [UserRole.ORCALEX_ADMIN]: { color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  };

  const roles = [
    {
      value: UserRole.TEACHER,
      label: 'Teacher',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      value: UserRole.SCHOOL_ADMIN,
      label: 'School',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" strokeLinecap="round" />
        </svg>
      ),
    },
    // OrcaLex Admin role intentionally hidden from UI selector; logic remains in place.
  ];

  const activeColor = roleConfig[role]?.color || '#14B8A6';
  const activeGradient = roleConfig[role]?.gradient || 'linear-gradient(135deg, #14B8A6, #0D9488)';

  const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1.5px solid #334155',
    fontSize: '14px',
    color: '#F1F5F9',
    outline: 'none',
    fontFamily: FONT,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
    background: '#0F172A',
  };

  return (
    <>
      <style>{keyframesStyle}</style>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: FONT,
          background: '#0B1120',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated gradient orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${activeColor}18 0%, transparent 70%)`,
            pointerEvents: 'none',
            animation: 'orbFloat1 8s ease-in-out infinite',
            transition: 'background 0.6s',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-15%',
            left: '-8%',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'orbFloat2 10s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'orbFloat3 12s ease-in-out infinite',
          }}
        />

        {/* Login Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid #1E293B',
            boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03), 0 0 80px ${activeColor}08`,
            overflow: 'hidden',
            position: 'relative',
            animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              height: '3px',
              background: activeGradient,
              transition: 'background 0.4s',
            }}
          />

          <div style={{ padding: '36px 32px 32px' }}>
            {/* Branding */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1
                style={{
                  margin: '0 0 2px',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#F1F5F9',
                  letterSpacing: '-0.03em',
                  fontFamily: FONT_SERIF,
                }}
              >
                SmartLearners.ai
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                }}
              >
                CRM Dashboard
              </p>
            </div>

            {/* Role Selector */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px',
                marginBottom: '24px',
              }}
            >
              {roles.map((r) => {
                const isActive = role === r.value;
                const isHovered = hoveredRole === r.value;
                const rc = roleConfig[r.value];
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    onMouseEnter={() => setHoveredRole(r.value)}
                    onMouseLeave={() => setHoveredRole(null)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '14px 8px 12px',
                      borderRadius: '12px',
                      border: isActive
                        ? `1.5px solid ${rc.color}`
                        : `1.5px solid ${isHovered ? '#334155' : '#1E293B'}`,
                      background: isActive
                        ? `${rc.color}15`
                        : isHovered
                        ? '#1E293B'
                        : '#0F172A',
                      color: isActive ? rc.color : '#94A3B8',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      fontFamily: FONT,
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 600,
                      letterSpacing: '0.02em',
                      boxShadow: isActive ? `0 0 20px ${rc.color}20, 0 0 0 1px ${rc.color}30` : 'none',
                    }}
                  >
                    {r.icon}
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div style={{ position: 'relative', margin: '0 0 24px' }}>
              <div style={{ height: '1px', background: '#1E293B' }} />
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  padding: '0 12px',
                  background: '#111827',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Sign in
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                }}
              >
                <p style={{ margin: 0, fontSize: '13px', color: '#FB7185', fontWeight: 500 }}>
                  {error}
                </p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              {/* Teacher: username field */}
              {role === UserRole.TEACHER && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#94A3B8',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Teacher Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. john_smith"
                    required
                    style={inputStyles}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = activeColor;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${activeColor}20`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#334155';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              )}

              {/* School Admin: school code field */}
              {role === UserRole.SCHOOL_ADMIN && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#94A3B8',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    School Code
                  </label>
                  <input
                    type="text"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    placeholder="e.g. DPS_001"
                    required
                    style={inputStyles}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = activeColor;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${activeColor}20`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#334155';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Enter the school code provided by your institution
                  </p>
                </div>
              )}

              {/* OrcaLex Admin: no fields needed */}
              {role === UserRole.ORCALEX_ADMIN && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px', color: '#A78BFA', fontWeight: 500 }}>
                    Admin access — no credentials required for demo
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: activeGradient,
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: FONT,
                  boxShadow: `0 4px 20px ${activeColor}30`,
                  transition: 'all 0.25s',
                  letterSpacing: '-0.01em',
                  opacity: loading ? 0.7 : 1,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 8px 30px ${activeColor}40`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 4px 20px ${activeColor}30`;
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Footer */}
            <p
              style={{
                textAlign: 'center',
                margin: '20px 0 0',
                fontSize: '11px',
                color: '#475569',
              }}
            >
              Powered by OrcaLex Technologies
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
