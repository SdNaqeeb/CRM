import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, type User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, options?: { username?: string; schoolCode?: string }) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (role: UserRole, options?: { username?: string; schoolCode?: string }) => {
    const { username, schoolCode } = options || {};
    const mockUser: User = {
      id: role === UserRole.ORCALEX_ADMIN ? 999 : 1,
      email: '',
      full_name: role === UserRole.ORCALEX_ADMIN
        ? 'OrcaLex Admin'
        : role === UserRole.SCHOOL_ADMIN
        ? 'School Admin'
        : username || 'Teacher',
      role,
      school_code: schoolCode,
      username: username,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
