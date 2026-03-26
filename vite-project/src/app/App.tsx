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
import { PhiCursor, usePhiCursor } from './components/usePhiCursor';

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
    <div
      className="app-shell"
      style={{
        display: 'grid',
        gridTemplateColumns: isSidebarCollapsed ? '72px 1fr' : '220px 1fr',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--thi)',
        fontFamily: "'Jost', sans-serif",
        transition: 'grid-template-columns 0.3s ease',
      }}
    >
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          className="md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar — grid column 1 */}
      <div
        className="app-sidebar"
        style={{
          gridColumn: 1,
          gridRow: 1,
          height: '100%',
          overflow: 'hidden',
          zIndex: 50,
        }}
      >
        <Sidebar
          activeChatId={activeChatId}
          refreshTrigger={refreshTrigger}
          collapsed={isSidebarCollapsed}
          onSelectChat={(id) => { setActiveChatId(id); setIsSidebarOpen(false); }}
          onNewChat={() => { setActiveChatId(null); setIsSidebarOpen(false); }}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Main content — grid column 2 */}
      <div style={{ gridColumn: 2, gridRow: 1, overflow: 'hidden', minWidth: 0 }}>
        <MainChat
          activeChatId={activeChatId}
          onChatCreated={(id) => { setActiveChatId(id); setRefreshTrigger(prev => prev + 1); }}
          onMenuClick={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .app-shell { grid-template-columns: 1fr !important; }
          .app-sidebar {
            position: fixed !important;
            inset: 0 auto 0 0 !important;
            width: 260px !important;
            transform: translateX(${isSidebarOpen ? '0' : '-100%'});
            transition: transform 0.3s ease;
            z-index: 1000 !important;
          }
        }
      `}</style>
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

  usePhiCursor();

  return (
    <AuthProvider>
      <PhiCursor />
      <AppRoutes />
    </AuthProvider>
  );
}
