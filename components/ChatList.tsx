
import React, { useState, useMemo, useEffect } from 'react';
import { Chat, AdConfig, LiveStream } from '../types';
import { getBadgeIcon, getBadgeStyle } from '../SupportDB';
import { getUserBadge } from '../VerifiedUsers';
import { db as localDB } from '../backend';

interface Props {
  chats: Chat[];
  searchQuery: string;
  activeTab: string;
  archivedChats: string[];
  onChatClick: (chat: Chat) => void;
  onPin: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onTabChange: (tab: string) => void;
}

const ChatList: React.FC<Props> = ({ chats, searchQuery, activeTab, archivedChats, onChatClick, onPin, onArchive, onDelete, onTabChange }) => {
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const [activeAd, setActiveAd] = useState<AdConfig | null>(null);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  
  // Ad Countdown State
  const [adCountdown, setAdCountdown] = useState<string | null>(null);

  useEffect(() => {
    // Fetch active ad & stream
    const loadExtras = async () => {
        const ad = await localDB.ads.getActive();
        setActiveAd(ad || null);
        const stream = await localDB.stream.get();
        setActiveStream(stream || null);
    };
    loadExtras();
    
    // Listen for updates
    window.addEventListener('server-update', loadExtras);
    const interval = setInterval(() => {
        if(activeAd && activeAd.isScheduled && activeAd.startTime) {
             const now = Date.now();
             if(now < activeAd.startTime) {
                 const diff = activeAd.startTime - now;
                 const h = Math.floor(diff / 3600000);
                 const m = Math.floor((diff % 3600000) / 60000);
                 const s = Math.floor((diff % 60000) / 1000);
                 setAdCountdown(`${h}h ${m}m ${s}s`);
             } else {
                 setAdCountdown(null);
             }
        }
    }, 1000);

    return () => {
        window.removeEventListener('server-update', loadExtras);
        clearInterval(interval);
    };
  }, [activeAd]);

  const sorted = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let filtered = chats.filter(chat => {
      if (q) return (chat.name || '').toLowerCase().includes(q) || (chat.lastMessage || '').toLowerCase().includes(q);
      const isArchived = (archivedChats || []).includes(chat.id);
      if (activeTab === 'Archived') return isArchived;
      if (isArchived) return false;
      if (activeTab === 'Private' && chat.type !== 'private') return false;
      if (activeTab === 'Groups' && chat.type !== 'group') return false;
      if (activeTab === 'Channels' && chat.type !== 'channel') return false;
      return true;
    });
    
    const uniqueList = Array.from(new Map<string, Chat>(filtered.map(c => [c.id, c])).values());
    return uniqueList.sort((a: Chat, b: Chat) => {
      const aPinned = a.pinned || false;
      const bPinned = b.pinned || false;
      if (aPinned === bPinned) {
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
      }
      return aPinned ? -1 : 1;
    });
  }, [chats, searchQuery, activeTab, archivedChats]);

  const handleAdClick = () => {
    if(activeAd?.link && !adCountdown) window.open(activeAd.link, '_blank');
  };

  const handleJoinStream = () => {
      window.dispatchEvent(new Event('join-stream'));
  };

  return (
    <div 
      className="flex flex-col p-0 bg-transparent h-full overflow-y-auto hide-scrollbar touch-pan-y"
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        if (activeTab === 'All' && top < 0) {
             setPullProgress(Math.min(Math.abs(top) / 100, 1));
        } else {
             setPullProgress(0);
        }
      }}
      onTouchEnd={() => { 
          if (pullProgress >= 0.8 && activeTab === 'All') {
              onTabChange('Archived'); 
          }
          setPullProgress(0); 
      }}
    >
      <div 
        style={{ height: `${pullProgress * 80}px`, opacity: Math.max(0, pullProgress - 0.2) }} 
        className="flex items-end justify-center pb-2 text-blue-300 transition-all overflow-hidden bg-[#1c2833]"
      >
          <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center animate-bounce">
                <i className="fa-solid fa-box-archive"></i>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Release for Archive</span>
          </div>
      </div>

      {activeTab === 'Archived' && (
          <div className="px-4 py-2 bg-gray-500/10 text-center text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/5">
              Archived Chats
          </div>
      )}

      <div className="p-4 space-y-4 pb-24">
        
        {/* LIVE STREAM BANNER */}
        {activeStream && !searchQuery && (
            <div onClick={handleJoinStream} className="relative flex items-center p-4 gap-4 bg-gradient-to-r from-red-900/80 to-black rounded-[28px] shadow-lg border border-red-500/40 cursor-pointer animate-pulse-slow overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                <div className="w-14 h-14 rounded-full border-2 border-red-500 flex items-center justify-center bg-black relative z-10">
                    <i className="fa-solid fa-tower-broadcast text-red-500 text-2xl"></i>
                    <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">LIVE</div>
                </div>
                <div className="flex-1 min-w-0 z-10">
                    <h3 className="font-black text-white text-lg uppercase tracking-wide">Global Broadcast</h3>
                    <p className="text-xs text-red-200">{activeStream.title}</p>
                </div>
                <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase shadow-lg z-10">
                    JOIN
                </div>
            </div>
        )}

        {/* SPONSORED MESSAGE / AD */}
        {activeAd && activeAd.isActive && !searchQuery && activeTab === 'All' && (
            <div onClick={handleAdClick} className={`relative flex items-center p-3 gap-4 bg-gradient-to-r from-[#1c1c1e] to-[#252527] rounded-[24px] shadow-lg border border-blue-500/20 cursor-pointer animate-fade-in mb-2 group ${adCountdown ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}>
                {activeAd.image && (
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black flex-shrink-0">
                        <img src={activeAd.image} className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="flex-1 min-w-0 text-right">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-[14px] text-white truncate">{activeAd.title}</h3>
                        <span className="text-[9px] bg-white/10 text-white/60 px-2 py-0.5 rounded font-black uppercase tracking-wide">Sponsored</span>
                    </div>
                    {adCountdown ? (
                        <p className="text-xs text-yellow-500 font-mono font-bold">Starts in: {adCountdown}</p>
                    ) : (
                        <p className="text-[12px] text-gray-400 line-clamp-2 leading-tight">{activeAd.text}</p>
                    )}
                </div>
                {!adCountdown && <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[24px]"></div>}
            </div>
        )}

        {sorted.map(chat => {
          const badgeType = getUserBadge(chat.id.split('_').pop() || chat.id);
          const safeName = chat.name || 'Anonymous User';
          
          return (
            <div 
              key={chat.id}
              className={`relative flex items-center p-4 gap-4 bg-white/5 rounded-[28px] shadow-xl transition-all active:scale-95 border border-white/5 backdrop-blur-md ${chat.pinned ? 'ring-1 ring-blue-400/30 bg-white/10' : ''}`}
              onClick={() => longPressedId ? setLongPressedId(null) : onChatClick(chat)}
              onContextMenu={(e) => { e.preventDefault(); setLongPressedId(chat.id); }}
            >
              <div className="avatar-frame w-14 h-14 aspect-square rounded-full bg-gradient-to-br from-[#1c2833] to-[#24A1DE] text-white font-black text-xl shadow-lg border border-white/10">
                 {chat.avatar && chat.avatar.length > 5 ? (
                   <img src={chat.avatar} className="w-full h-full object-cover" alt="" />
                 ) : (
                   <span className="flex items-center justify-center w-full h-full">{safeName.charAt(0)}</span>
                 )}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2 truncate">
                    <h3 className="font-black text-[15px] text-blue-50 truncate">{safeName}</h3>
                    {badgeType !== 'NONE' && <i className={`${getBadgeIcon(badgeType)} ${getBadgeStyle(badgeType)} text-[10px]`}></i>}
                    {chat.pinned && <i className="fa-solid fa-thumbtack text-blue-400 text-[10px] -rotate-45"></i>}
                  </div>
                  <span className="text-[9px] text-blue-200/40 font-black">{chat.time || 'Now'}</span>
                </div>
                <p className="text-[12px] text-blue-100/40 truncate font-medium">{chat.lastMessage || 'No messages yet'}</p>
              </div>

              {longPressedId === chat.id && (
                <div className="absolute inset-0 bg-[#0b141d]/95 backdrop-blur-xl z-30 flex items-center justify-center gap-4 rounded-[28px] animate-fade-in border border-white/20">
                  <button onClick={(e) => { e.stopPropagation(); onPin(chat.id); setLongPressedId(null); }} className="w-11 h-11 bg-blue-500 rounded-2xl text-white flex items-center justify-center shadow-lg"><i className="fa-solid fa-thumbtack"></i></button>
                  <button onClick={(e) => { e.stopPropagation(); onArchive(chat.id); setLongPressedId(null); }} className="w-11 h-11 bg-green-500 rounded-2xl text-white flex items-center justify-center shadow-lg"><i className="fa-solid fa-box-archive"></i></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(chat.id); setLongPressedId(null); }} className="w-11 h-11 bg-red-600 rounded-2xl text-white flex items-center justify-center shadow-lg"><i className="fa-solid fa-trash"></i></button>
                  <button onClick={(e) => { e.stopPropagation(); setLongPressedId(null); }} className="w-11 h-11 bg-white/10 rounded-2xl text-white flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatList;
