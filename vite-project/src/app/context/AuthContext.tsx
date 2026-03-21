import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../../api';
import type { StudentProfile } from '../../api';

interface AuthContextType {
  token: string | null;
  studentId: string | null;
  profile: StudentProfile | null;
  login: (token: string, studentId: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('cognify_token'));
  const [studentId, setStudentId] = useState<string | null>(localStorage.getItem('cognify_student_id'));
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const prof = await getMe();
          setProfile(prof);
          if (prof.id) {
            setStudentId(prof.id);
            localStorage.setItem('cognify_student_id', prof.id);
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
          logout();
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  const login = (newToken: string, newStudentId: string) => {
    setToken(newToken);
    setStudentId(newStudentId);
    localStorage.setItem('cognify_token', newToken);
    localStorage.setItem('cognify_student_id', newStudentId);
  };

  const logout = () => {
    setToken(null);
    setStudentId(null);
    setProfile(null);
    localStorage.removeItem('cognify_token');
    localStorage.removeItem('cognify_student_id');
  };

  return (
    <AuthContext.Provider value={{ token, studentId, profile, login, logout, isLoading }}>
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
