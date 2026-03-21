import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, Settings, Sparkles, Loader2, Trash2, LogOut, Target } from 'lucide-react';
import { CognifyLogo } from './CognifyLogo';
import { getChats, deleteChat } from '../../api';
import { useAuth } from '../context/AuthContext';
import type { ChatSession } from '../../api';

interface SidebarProps {
  activeChatId?: string | null;
  refreshTrigger?: number;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
}

export function Sidebar({ activeChatId, refreshTrigger, onSelectChat, onNewChat }: SidebarProps) {
  const { profile, logout } = useAuth();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChats();
  }, [refreshTrigger]);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const data = await getChats();
      setChats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const { createChat } = await import('../../api');
      const newChat = await createChat("New Conversation");
      setChats(prev => [newChat, ...prev]);
      if (onSelectChat) onSelectChat(newChat.id);
    } catch (err) {
      console.error("Failed to create chat");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;
    
    // OPTIMISTIC UPDATE: Visually delete the row instantly.
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id && onNewChat) {
      onNewChat(); // Reset global active chat and return to Home Screen
    }
    
    try {
      await deleteChat(id);
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };


  return (
    <div className="w-[280px] h-full flex flex-col bg-[#0A0A0A]/60 backdrop-blur-3xl border-r border-white/[0.04] shadow-[inset_0_0_80px_rgba(124,58,237,0.05)] p-4 z-20 shrink-0">
      
      {/* Brand Header */}
      <div className="flex items-center gap-3.5 mb-8 px-2 mt-2 group cursor-pointer">
        <CognifyLogo className="w-[36px] h-[36px] shrink-0 transform group-hover:scale-[1.03] transition-all duration-500 drop-shadow-[0_0_10px_rgba(124,58,237,0.3)] group-hover:drop-shadow-[0_0_25px_rgba(124,58,237,0.6)]" />
        <span className="text-[20px] font-semibold text-transparent bg-clip-text bg-gradient-to-b from-[#FFFFFF] to-[#A1A1AA] tracking-tight leading-none pt-0.5">
          Cognify
        </span>
      </div>

      {/* Primary Action Button */}
      <button 
        onClick={handleNewChat}
        className="w-full flex items-center justify-center gap-2.5 bg-white/[0.04] border border-white/[0.08] text-[#EDEDED] rounded-xl px-4 py-[11px] font-medium mb-8 transition-all duration-300 hover:bg-white/[0.06] hover:border-[#7C3AED]/40 hover:shadow-[0_0_25px_rgba(124,58,237,0.25)] group relative"
      >
        <Plus className="w-4 h-4 text-[#EDEDED] transition-transform group-hover:rotate-90 duration-300" />
        <span className="text-[14.5px] font-semibold">New Chat</span>
      </button>

      {/* History List */}
      <div className="flex-1 overflow-y-auto pr-2 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <div className="text-[11px] font-medium text-[#71717A] mb-3 px-2 flex items-center gap-2 tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5 text-[#52525B]" />
          <span>Recent</span>
        </div>
        
        <div className="flex flex-col gap-1">
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-indigo-500" size={16}/></div>
          ) : chats.length === 0 ? (
            <div className="text-[#71717A] text-xs px-2 py-4 italic">No recent chats</div>
          ) : (
            chats.map((chat) => {
              const isActive = activeChatId === chat.id;
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat && onSelectChat(chat.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-left w-full transition-all duration-300 group ${
                    isActive 
                      ? "bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#EDEDED] shadow-[0_0_15px_rgba(124,58,237,0.2)] border-l-2 border-l-[#7C3AED]"
                      : "text-[#A1A1AA] border border-transparent hover:text-[#EDEDED] hover:bg-white/[0.05] hover:border-white/[0.06] hover:shadow-[0_0_10px_rgba(124,58,237,0.15)]"
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#7C3AED]' : 'text-[#52525B] group-hover:text-[#7C3AED]'}`} />
                  <span className="truncate leading-tight font-normal flex-1">{chat.title || 'New Conversation'}</span>
                  <button 
                    onClick={(e) => handleDelete(e, chat.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-all duration-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Settings & Profile Footer */}
      <div className="mt-auto pt-4 border-t border-white/[0.04] space-y-1">
        {/* User Profile Info */}
        <div className="px-3 py-3 mb-2 flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl mx-1 shadow-inner">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shadow-lg shrink-0">
            {profile?.name?.substring(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-[#EDEDED] truncate">{profile?.name || 'User'}</span>
            <span className="text-[10px] text-[#71717A] truncate font-medium">{profile?.email || 'Student Account'}</span>
          </div>
        </div>

        <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[#EDEDED] font-bold bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/30 hover:bg-pink-500/20 transition-all duration-300 shadow-[0_0_15px_rgba(236,72,153,0.1)] group mb-2 text-[13px]">
          <Target className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
          <span>Weakness Dashboard</span>
        </Link>

        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-white/[0.04] transition-all duration-200 text-[13px] group border border-transparent hover:border-white/[0.03]">
          <Settings className="w-4 h-4 text-[#52525B] group-hover:text-[#EDEDED] transition-colors" />
          <span className="font-medium">Settings</span>
        </button>

        <button 
          onClick={() => {
            if (confirm("Are you sure you want to log out and switch accounts?")) {
              logout();
            }
          }}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-[13px] group border border-transparent hover:border-red-500/10"
        >
          <LogOut className="w-4 h-4 text-[#52525B] group-hover:text-red-400 transition-colors" />
          <span className="font-medium">Switch / Log Out</span>
        </button>
      </div>
    </div>
  );
}
