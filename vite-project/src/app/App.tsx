import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { MainChat } from './components/MainChat';
import { DashboardPage } from './components/DashboardPage';
import WelcomePage from './components/WelcomePage';
import { AuthProvider, useAuth } from './context/AuthContext';
import React from 'react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="h-screen flex items-center justify-center bg-black text-white">Loading...</div>;
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ChatLayout() {
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  return (
    <div
      className="flex h-screen w-full bg-[#000000] text-[#EDEDED] overflow-hidden selection:bg-[#7C3AED]/30 font-sans antialiased relative"
    >
      {/* Premium Deep Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Core AI Glow (subtle, breathing) */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#7C3AED]/[0.06] blur-[140px] rounded-full mix-blend-screen animate-pulse duration-[4000ms]"></div>
        <div className="absolute bottom-[0%] right-[5%] w-[600px] h-[400px] bg-[#4F46E5]/[0.05] blur-[150px] rounded-full mix-blend-screen"></div>

        {/* Film grain noise for premium texture */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        ></div>
      </div>

      <div className="relative z-10 flex w-full h-full max-w-[1920px] mx-auto overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar Container */}
        <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
          <Sidebar 
            activeChatId={activeChatId} 
            refreshTrigger={refreshTrigger}
            onSelectChat={(id) => { setActiveChatId(id); setIsSidebarOpen(false); }} 
            onNewChat={() => { setActiveChatId(null); setIsSidebarOpen(false); }} 
          />
        </div>

        <MainChat 
          activeChatId={activeChatId} 
          onChatCreated={(id) => { setActiveChatId(id); setRefreshTrigger(prev => prev + 1); }} 
          onMenuClick={() => setIsSidebarOpen(true)}
        />
      </div>
    </div>
  );
}

function AppRoutes() {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="h-screen flex items-center justify-center bg-black text-white">Loading...</div>;
  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/chat" replace /> : <WelcomePage />} />
      <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
