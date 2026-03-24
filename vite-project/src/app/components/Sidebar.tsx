import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MessageSquare, Plus, Loader2, Trash2, LogOut, Edit2, Check, Zap, Menu, Target, Settings, Trophy } from 'lucide-react';
import { getChats, deleteChat, renameChat, createChat } from '../../api';
import { useAuth } from '../context/AuthContext';
import type { ChatSession } from '../../api';

interface SidebarProps {
  activeChatId?: string | null;
  refreshTrigger?: number;
  collapsed?: boolean;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({ activeChatId, refreshTrigger, collapsed, onSelectChat, onNewChat, onToggleCollapse }: SidebarProps) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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
      const newChat = await createChat('New Conversation');
      setChats(prev => [newChat, ...prev]);
      if (onSelectChat) onSelectChat(newChat.id);
    } catch (err) {
      console.error('Failed to create chat');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id && onNewChat) onNewChat();
    try {
      await deleteChat(id);
    } catch (err) {
      console.error('Failed to delete chat', err);
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    const originalTitle = chats.find(c => c.id === id)?.title;
    setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitle.trim() } : c));
    setEditingId(null);
    try {
      await renameChat(id, editTitle.trim());
    } catch {
      if (originalTitle) setChats(prev => prev.map(c => c.id === id ? { ...c, title: originalTitle } : c));
    }
  };

  const initials = (name: string) => name.substring(0, 2).toUpperCase();

  // Chat grouping logic
  const groupChats = (chats: ChatSession[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups: Record<string, ChatSession[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': []
    };

    chats.forEach(chat => {
      const chatDate = new Date(chat.updated_at || chat.created_at);
      if (chatDate >= today) groups['Today'].push(chat);
      else if (chatDate >= yesterday) groups['Yesterday'].push(chat);
      else if (chatDate >= thisWeek) groups['This Week'].push(chat);
      else groups['Older'].push(chat);
    });

    return groups;
  };

  const chatGroups = groupChats(chats);

  return (
    <div 
      className="sidebar-container"
      style={{
        width: '100%',
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'rgba(5,5,5,.95)',
        backdropFilter: 'blur(40px)',
        borderRight: '1px solid var(--bdr)',
        padding: collapsed ? '16px 12px' : 16, 
        zIndex: 20, 
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >

      {/* Brand & Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '4px 0' }}>
        <button
          onClick={onToggleCollapse}
          style={{ background: 'none', border: 'none', color: 'var(--tlo)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <Menu size={20} />
        </button>
        
        {!collapsed && (
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--thi)', opacity: 0.8, flex: 1 }}>SESSIONS</div>
        )}

        <button
          onClick={handleNewChat}
          style={{ background: 'rgba(255,255,255,.06)', border: 'none', color: 'var(--thi)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="New Session"
        >
          <Plus size={16} />
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-streak">
          <span className="streak-fire">
            <Zap size={14} fill={profile?.streak && profile.streak > 0 ? "currentColor" : "rgba(255,149,0,0.2)"} />
            <Zap size={14} fill={profile?.streak && profile.streak > 1 ? "currentColor" : "rgba(255,149,0,0.2)"} />
            <Zap size={14} fill={profile?.streak && profile.streak > 2 ? "currentColor" : "rgba(255,149,0,0.2)"} />
            <Zap size={14} fill={profile?.streak && profile.streak > 3 ? "currentColor" : "rgba(255,149,0,0.2)"} />
            <Zap size={14} fill={profile?.streak && profile.streak > 4 ? "currentColor" : "rgba(255,149,0,0.2)"} />
          </span>
          <span>{profile?.streak || 0} days</span>
        </div>
      )}

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Loader2 size={16} className="animate-spin" color="var(--tlo)" /></div>
        ) : chats.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--tdm)', padding: '0 8px 0', fontStyle: 'italic' }}>No recent chats</div>
        ) : (
          Object.entries(chatGroups).map(([groupName, groupChats]) => {
            if (groupChats.length === 0) return null;
            return (
              <div key={groupName}>
                {!collapsed && <div className="sidebar-group-hd">{groupName}</div>}
                {groupChats.map(chat => {
                  const isActive = activeChatId === chat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => onSelectChat && onSelectChat(chat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12, fontSize: 12.5, /* Increased from 11/13 */
                        textAlign: 'left', width: '100%', cursor: 'pointer',
                        transition: 'all .2s', marginBottom: 4,
                        background: isActive ? 'rgba(255,255,255,.08)' : 'transparent',
                        border: `1px solid ${isActive ? 'var(--bdrhi)' : 'transparent'}`,
                        color: isActive ? 'var(--thi)' : 'var(--tmd)',
                      }}
                      className="group"
                    >
                      {!collapsed && (
                        editingId === chat.id ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(chat.id); if (e.key === 'Escape') setEditingId(null); }}
                              style={{ background: 'rgba(0,0,0,.4)', border: '1px solid var(--bdrhi)', borderRadius: 5, padding: '2px 6px', fontSize: 12.5, color: 'var(--thi)', width: '100%', outline: 'none', fontFamily: "'Jost', sans-serif" }}
                            />
                            <button onClick={() => handleRename(chat.id)} style={{ padding: 3, color: 'var(--tmd)', background: 'none', border: 'none', cursor: 'pointer' }}><Check size={12} /></button>
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: isActive ? 600 : 500 }}>
                                {chat.title || 'New Session'}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--tlo)', marginTop: 2 }}>{new Date(chat.updated_at || chat.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity .2s' }} className="chat-actions">
                              <button
                                onClick={e => { e.stopPropagation(); setEditingId(chat.id); setEditTitle(chat.title || ''); }}
                                style={{ padding: 4, color: 'var(--tlo)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5, transition: 'color .15s' }}
                              ><Edit2 size={12} /></button>
                              <button
                                onClick={e => handleDelete(e, chat.id)}
                                style={{ padding: 4, color: 'var(--tlo)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5, transition: 'color .15s' }}
                              ><Trash2 size={12} /></button>
                            </div>
                          </>
                        )
                      )}
                      {collapsed && <MessageSquare size={16} style={{ margin: '0 auto' }} />}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--bdr)' }}>

        {/* Profile */}
        <div style={{ padding: collapsed ? '10px' : '12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,149,0,0.03)', border: '1px solid rgba(255,149,0,0.1)', borderRadius: 14, justifyContent: collapsed ? 'center' : 'flex-start' }} title={collapsed ? profile?.name || 'Guest' : ""}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0, color: 'var(--gold)' }}>
            {profile?.name ? initials(profile.name) : 'G'}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--thi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name || 'Darsh'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--tlo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>JEE Advanced - 2026</div>
            </div>
          )}
        </div>

        {/* Navigation links - with increased font sizes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
          <Link to="/challenge" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontSize: 12.5, width: '100%', background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)', transition: 'all .2s', fontFamily: "'Jost', sans-serif" }} title="Daily Challenge">
            <Trophy size={16} />
            {!collapsed && <span style={{ fontWeight: 600 }}>Daily Challenge</span>}
          </Link>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'var(--tlo)', textDecoration: 'none', fontSize: 12.5, width: '100%', background: 'none', transition: 'all .2s', fontFamily: "'Jost', sans-serif" }} title="Performance Dashboard">
            <Target size={16} />
            {!collapsed && <span>Dashboard</span>}
          </Link>
          <Link to="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'var(--tlo)', textDecoration: 'none', fontSize: 12.5, width: '100%', background: 'none', transition: 'all .2s', fontFamily: "'Jost', sans-serif" }} title="Settings">
            <Settings size={16} />
            {!collapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={() => { if (confirm('Log out?')) { logout(); navigate('/'); } }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'var(--tlo)', fontSize: 12.5, width: '100%', background: 'none', border: 'none', cursor: 'pointer', transition: 'all .2s', fontFamily: "'Jost', sans-serif" }}
            title="Log out"
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </div>

      <style>{`
        button.group:hover .chat-actions { opacity: 1!important; }
        @media(max-width:480px){ body { cursor: auto!important; } }
      `}</style>
    </div>
  );
}
