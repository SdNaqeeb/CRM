import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import { UserRole } from './types';
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/TeacherDashboard';
import SchoolDashboard from './pages/SchoolDashboard';
import OrcaLexDashboard from './pages/OrcaLexDashboard';
import ChatBot from './components/ChatBot';

// Protected Route wrapper
const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  requiredRole?: UserRole;
}> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    if (user?.role === UserRole.ORCALEX_ADMIN) {
      return <Navigate to="/orcalex" replace />;
    } else if (user?.role === UserRole.SCHOOL_ADMIN) {
      return <Navigate to="/school" replace />;
    } else {
      return <Navigate to="/teacher" replace />;
    }
  }

  return children;
};

// Layout with header
const DashboardLayout: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, logout } = useAuth();

  const getRoleBadge = () => {
    const role = user?.role;
    if (role === UserRole.ORCALEX_ADMIN) return { label: 'Admin', bg: '#7c3aed', fg: '#fff' };
    if (role === UserRole.SCHOOL_ADMIN) return { label: 'School', bg: '#0d9488', fg: '#fff' };
    return { label: 'Teacher', bg: 'rgba(124,58,237,0.12)', fg: '#7C3AED' };
  };

  const badge = getRoleBadge();

  return (
    <div style={{ minHeight: '100vh', background: '#EDE9FE' }}>
      {/* Navigation */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '64px',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#7C3AED',
                letterSpacing: '-0.02em',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Smartlearners.ai
            </span>
            <span
              style={{
                fontSize: '17px',
                fontWeight: 400,
                color: '#94A3B8',
                marginLeft: '6px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              CRM
            </span>
          </div>

          {/* User section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0F172A',
                  lineHeight: '1.3',
                }}
              >
                {user?.full_name}
              </div>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '2px',
                  padding: '1px 8px',
                  borderRadius: '99px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: badge.bg,
                  color: badge.fg,
                }}
              >
                {badge.label}
              </span>
            </div>

            {/* Avatar circle */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6D28D9, #7C3AED)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: '#fff',
                border: '2px solid rgba(124,58,237,0.2)',
              }}
            >
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                background: 'transparent',
                color: '#64748B',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#F43F5E';
                e.currentTarget.style.color = '#F43F5E';
                e.currentTarget.style.background = 'rgba(244,63,94,0.07)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.color = '#64748B';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {children}

      {/* Chat Assistant */}
      <ChatBot />
    </div>
  );
};

// App Router
const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/teacher"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <TeacherDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/school"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <SchoolDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orcalex"
        element={
          <ProtectedRoute requiredRole={UserRole.ORCALEX_ADMIN}>
            <DashboardLayout>
              <OrcaLexDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            user?.role === UserRole.ORCALEX_ADMIN ? (
              <Navigate to="/orcalex" replace />
            ) : user?.role === UserRole.SCHOOL_ADMIN ? (
              <Navigate to="/school" replace />
            ) : (
              <Navigate to="/teacher" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DashboardProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DashboardProvider>
    </AuthProvider>
  );
};

export default App;
