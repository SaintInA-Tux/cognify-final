import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { MainChat } from './components/MainChat';
import { DashboardPage } from './components/DashboardPage';
import AuthPage from './components/AuthPage';
import OnboardingFlow from './components/OnboardingFlow';
import ChallengePage from './components/ChallengePage';
import SettingsPage from './components/SettingsPage';
import NotFoundPage from './components/NotFoundPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import React from 'react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", fontSize: 13 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600 }}>Φ</div>
        <div style={{ color: 'var(--tlo)' }}>Loading…</div>
      </div>
    </div>
  );
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { token, profile, isLoading } = useAuth();
  if (isLoading) return null;
  if (!token) return <Navigate to="/" replace />;
  // If already onboarded, go straight to chat
  if (profile && profile.onboarded) return <Navigate to="/chat" replace />;
  return <>{children}</>;
}

function ChatLayout() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const activeChatId = chatId || null;
  const setActiveChatId = (id: string | null) => {
    if (id) navigate(`/chat/${id}`);
    else navigate('/chat');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden relative" style={{ background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", cursor: 'none' }}>
      {/* Subtle background glow — kept subtle, not the purple explosion */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-[0.04] blur-[120px] rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>

      <div className="relative z-10 flex w-full h-full overflow-hidden">
        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:w-20' : 'md:w-[280px]'}`}>
          <Sidebar
            activeChatId={activeChatId}
            refreshTrigger={refreshTrigger}
            collapsed={isSidebarCollapsed}
            onSelectChat={(id) => { setActiveChatId(id); setIsSidebarOpen(false); }}
            onNewChat={() => { setActiveChatId(null); setIsSidebarOpen(false); }}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <MainChat
            activeChatId={activeChatId}
            onChatCreated={(id) => { setActiveChatId(id); setRefreshTrigger(prev => prev + 1); }}
            onMenuClick={() => setIsSidebarOpen(true)}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        </div>
      </div>

      <style>{`@media(max-width:480px){ body{ cursor: auto!important; } }`}</style>
    </div>
  );
}

function AppRoutes() {
  const { token, profile, isLoading } = useAuth();

  if (isLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 600, color: 'rgba(255,255,255,.15)' }}>Φ</div>
    </div>
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={
        token
          ? (profile?.onboarded ? <Navigate to="/chat" replace /> : <Navigate to="/onboarding" replace />)
          : <AuthPage />
      } />

      {/* Onboarding — shown once after first login */}
      <Route path="/onboarding" element={
        <OnboardingGuard>
          <OnboardingFlow />
        </OnboardingGuard>
      } />

      {/* Core app */}
      <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
      <Route path="/chat/:chatId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />

      {/* Secondary pages */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/challenge" element={<ProtectedRoute><ChallengePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  React.useEffect(() => {
    const fs = localStorage.getItem('phi_chat_fs') || '12.5';
    document.documentElement.style.setProperty('--chat-fs', `${fs}px`);
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
