import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../../api';
import type { StudentProfile } from '../../api';
import { clearUserData } from '../localStore';

interface AuthContextType {
  token: string | null;
  studentId: string | null;
  profile: StudentProfile | null;
  login: (token: string, studentId: string) => void;
  logout: () => void;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('phyprep_token'));
  const [studentId, setStudentId] = useState<string | null>(localStorage.getItem('phyprep_student_id'));
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Listen for auth expiry events dispatched by apiFetch
  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setStudentId(null);
      setProfile(null);
      localStorage.removeItem('phyprep_token');
      localStorage.removeItem('phyprep_student_id');
    };
    window.addEventListener('auth-token-expired', handleExpired);
    return () => window.removeEventListener('auth-token-expired', handleExpired);
  }, []);

  useEffect(() => {
    loadUser();
  }, [token]);

  const loadUser = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const prof = await getMe();
      setProfile(prof);
      if (prof.id) {
        setStudentId(prof.id);
        localStorage.setItem('phyprep_student_id', prof.id);
      }
    } catch (err) {
      // Token invalid — clear auth
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const prof = await getMe();
      setProfile(prof);
    } catch { /* silent */ }
  };

  const login = (newToken: string, newStudentId: string) => {
    setToken(newToken);
    setStudentId(newStudentId);
    localStorage.setItem('phyprep_token', newToken);
    localStorage.setItem('phyprep_student_id', newStudentId);
    // Profile will load via useEffect on token change
  };

  const logout = () => {
    clearUserData();
    setToken(null);
    setStudentId(null);
    setProfile(null);
    localStorage.removeItem('phyprep_token');
    localStorage.removeItem('phyprep_student_id');
  };

  return (
    <AuthContext.Provider value={{ token, studentId, profile, login, logout, isLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
