
import React, { useState, useEffect, useMemo, createContext, useRef } from 'react';
import { User, Chat, Message, Story, CallSession, LiveStream, SystemAlert, StoryFrame } from './types';
import { MOCK_STORIES } from './constants';
import { auth as localAuth, db as localDB, signOut } from './backend'; 
import AuthScreen from './components/AuthScreen';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import Drawer from './components/Drawer';
import Header from './components/Header';
import StoryViewer from './components/StoryViewer';
import CallOverlay from './components/CallOverlay';
import AdminPanel from './components/AdminPanel';
import { BackgroundPickerModal, ProfileModal, GiftsModal, InvitesModal, CreateChatModal, StreamModal, MiniAppModal } from './components/Modals';
import { monitorService } from './MonitorService';

// Siren Sound (Beep)
const playSiren = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.5);
        osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 1.0);
        gain.gain.value = 0.5;
        osc.start();
        osc.stop(ctx.currentTime + 1.0);
    } catch(e) {}
};

// Robust File Processor with Real Progress
const processMediaFile = (file: File, onProgress: (percentage: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Track read progress (0-90%)
    reader.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 90);
            onProgress(percent);
        }
    };

    reader.onload = (event) => {
        if (!event.target?.result) return reject("Read error");
        const result = event.target.result as string;

        if(file.type.startsWith('video/')) {
            onProgress(100);
            resolve(result);
        } else {
            // Processing image (90-100%)
            onProgress(95);
            const img = new Image();
            img.src = result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1080; 
                const MAX_HEIGHT = 1920;
                let width = img.width; 
                let height = img.height;

                if (width > height) { 
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
                } else { 
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } 
                }
                
                canvas.width = width; 
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                onProgress(100);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => reject("Image load error");
        }
    };
    reader.onerror = error => reject(error);
    
    // Start reading
    reader.readAsDataURL(file);
  });
};

export const LangContext = createContext<{t: (k: string) => string; lang: string}>({ t: (k) => k, lang: 'en' });
const TRANSLATIONS: any = {
    'en': { 'settings': 'Settings', 'logout': 'Logout', 'profile': 'Profile', 'gift_shop': 'Gift Shop', 'invites': 'Invites', 'privacy': 'Privacy', 'theme': 'Theme Mode', 'snow': 'Winter Snow', 'autumn': 'Autumn Leaves', 'bug_report': 'Bug Reporter', 'face_id': 'Face ID Login' },
    'fa': { 'settings': 'تنظیمات', 'logout': 'خروج از حساب', 'profile': 'پروفایل من', 'gift_shop': 'فروشگاه گیفت', 'invites': 'دعوت دوستان', 'privacy': 'حریم خصوصی', 'theme': 'حالت شب/روز', 'snow': 'تم برفی زمستان', 'autumn': 'تم پاییزی', 'bug_report': 'گزارش باگ (جایزه دار)', 'face_id': 'ورود با چهره' },
    'de': { 'settings': 'Einstellungen', 'logout': 'Abmelden', 'profile': 'Profil', 'gift_shop': 'Geschenkeladen', 'invites': 'Einladungen', 'privacy': 'Privatsphäre', 'theme': 'Themenmodus', 'snow': 'Winterschnee', 'autumn': 'Herbstblätter', 'bug_report': 'Fehler melden', 'face_id': 'Face ID' }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchResults, setSearchResults] = useState<Chat[]>([]);
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBGModalOpen, setIsBGModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGiftsModalOpen, setIsGiftsModalOpen] = useState(false);
  const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);
  const [isCreateChatModalOpen, setIsCreateChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  
  const [themeEffect, setThemeEffect] = useState<'snow' | 'autumn' | 'none'>('snow');
  const [language, setLanguage] = useState('en');

  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [miniAppUrl, setMiniAppUrl] = useState('');
  const [miniAppTitle, setMiniAppTitle] = useState('');
  const [showMiniApp, setShowMiniApp] = useState(false);
  
  const [systemAlert, setSystemAlert] = useState<SystemAlert | null>(null);
  const [alertTimer, setAlertTimer] = useState(0);
  const alertIntervalRef = useRef<number | null>(null);

  // New State for Upload Progress
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = localAuth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        monitorService.startMonitoring();
        if(currentUser.language) setLanguage(currentUser.language);
        if(currentUser.themeMode) setThemeEffect(currentUser.themeMode);
        
        // IMMEDIATE ALERT CHECK ON LOGIN
        const alertData = await localDB.alerts.getActive();
        if (alertData) {
            setSystemAlert(alertData);
            setAlertTimer(Math.ceil((alertData.expiresAt - Date.now()) / 1000));
            playSiren();
        }

        // DEEP LINKING CHECK (Join Group)
        const urlParams = new URLSearchParams(window.location.search);
        const joinGroup = urlParams.get('join');
        if (joinGroup) {
            const group = await localDB.chats.getByGroupUsername(joinGroup);
            if (group) {
                if (confirm(`Join group "${group.name}"?`)) {
                    if (!group.adminIds?.includes(currentUser.uid)) {
                        const newMembers = [...(group.adminIds || []), currentUser.uid];
                        await localDB.chats.update(group.id, { adminIds: newMembers });
                        alert("Joined Successfully!");
                        window.history.replaceState({}, document.title, "/"); // Clear URL
                    } else {
                        alert("You are already a member.");
                    }
                }
            }
        }

        const userChats = await localDB.chats.getMyChats(currentUser.uid);
        setChats(userChats);
        fetchFilteredStories(currentUser.uid, userChats);
      } else { 
          setUser(null); 
          setChats([]);
          setIncomingCall(null);
          setActiveChat(null);
          setIsDrawerOpen(false);
          setSystemAlert(null); // Clear alert on logout
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchFilteredStories = async (uid: string, currentChats: Chat[]) => {
      const allStories = await localDB.stories.get(uid);
      const validStories = allStories.filter(s => s.expiresAt > Date.now());
      
      const peerIds = new Set<string>();
      currentChats.forEach(c => {
          if(c.type === 'private') {
              const pid = c.id.replace(uid, '').replace('_', '');
              if(pid) peerIds.add(pid);
          }
      });

      const filtered = validStories.filter(s => {
          if (s.userId === uid) return true; // My story
          if (peerIds.has(s.userId)) return true; // Contact's story
          if (s.userId === 'admin_official') return true; // Official stories always shown
          return false; 
      });
      
      setStories(filtered);
  };

  useEffect(() => {
      if (!user) return;
      const interval = setInterval(() => localDB.users.heartbeat(user.uid), 60000);
      localDB.users.heartbeat(user.uid);
      return () => clearInterval(interval);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const handleServerUpdate = async () => {
      const freshUser = await localDB.users.get(user.uid);
      if (freshUser) setUser(freshUser);
      
      const updatedChats = await localDB.chats.getMyChats(user.uid);
      setChats(updatedChats);
      fetchFilteredStories(user.uid, updatedChats);
      
      const calls = await localDB.calls.getActiveCalls(user.uid);
      const activeCall = calls.find(c => (c.receiverId === user.uid && c.status === 'ringing') || (c.callerId === user.uid && c.status !== 'ended' && c.status !== 'rejected') || (c.receiverId === user.uid && c.status === 'connected'));
      if ((activeCall && !incomingCall) || (activeCall && incomingCall && activeCall.id !== incomingCall.id) || (!activeCall && incomingCall)) { setIncomingCall(activeCall || null); }
      
      const stream = await localDB.stream.get();
      if(stream && stream.isActive) {
          if (!activeStream) setActiveStream(stream); 
      } else {
          setActiveStream(null);
          setShowStreamModal(false);
      }
      
      const activeAlert = await localDB.alerts.getActive();
      if (activeAlert) {
          if (!systemAlert || systemAlert.id !== activeAlert.id) {
              setSystemAlert(activeAlert);
              setAlertTimer(Math.ceil((activeAlert.expiresAt - Date.now()) / 1000));
              playSiren();
          }
      } else {
          if(systemAlert) setSystemAlert(null); // Alert expired or removed
      }
    };
    
    if (systemAlert && !alertIntervalRef.current) {
        alertIntervalRef.current = window.setInterval(() => {
            playSiren(); 
            setAlertTimer(prev => {
                if (prev <= 1) {
                    setSystemAlert(null);
                    if(alertIntervalRef.current) { clearInterval(alertIntervalRef.current); alertIntervalRef.current = null; }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else if (!systemAlert && alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
    }
    
    const handleJoinStream = () => setShowStreamModal(true);
    const handleOpenMiniApp = (e: any) => { if(e.detail && e.detail.url) { setMiniAppUrl(e.detail.url); setMiniAppTitle(e.detail.title || 'Mini App'); setShowMiniApp(true); } };
    
    window.addEventListener('server-update', handleServerUpdate);
    window.addEventListener('join-stream', handleJoinStream);
    window.addEventListener('open-mini-app', handleOpenMiniApp);
    
    const pollInterval = setInterval(handleServerUpdate, 1500); 
    
    return () => { 
        window.removeEventListener('server-update', handleServerUpdate); 
        window.removeEventListener('join-stream', handleJoinStream); 
        window.removeEventListener('open-mini-app', handleOpenMiniApp); 
        clearInterval(pollInterval);
    }
  }, [user?.uid, incomingCall, systemAlert]); 

  // ... (Search, Story, UserUpdate handlers) ...
  useEffect(() => {
    if (!isSearching || !searchQuery.trim() || !user) { setSearchResults([]); return; }
    const delaySearch = setTimeout(async () => {
        const foundUsers = await localDB.users.search(searchQuery);
        const resultsAsChats: Chat[] = foundUsers.filter(u => u.uid !== user.uid).map(u => {
                const existingChat = chats.find(c => c.type === 'private' && c.id.includes(u.uid));
                if (existingChat) return existingChat;
                const chatId = [user.uid, u.uid].sort().join('_');
                return { id: chatId, name: u.displayName, avatar: u.avatar || '', type: 'private', status: 'active', lastMessage: '@' + u.username, lastMessageTime: Date.now(), unreadCount: 0, time: '', adminIds: [user.uid, u.uid] } as Chat;
            });
        setSearchResults(resultsAsChats);
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [searchQuery, isSearching, user, chats]);

  const handleAddStory = async (file: File) => {
    if (!user) return;
    
    // 1. Prevent Consecutive Uploads
    if (uploadProgress !== null) {
        return alert("Please wait for the current story to finish uploading.");
    }

    // 2. Size Check (50MB Limit for stability in Local DB)
    if (file.size > 50 * 1024 * 1024) {
        return alert("File too large. Max 50MB allowed.");
    }

    try { 
        setUploadProgress(0); // Initialize progress bar only now

        const isVideo = file.type.startsWith('video/');
        
        // 3. Process File with Real Progress
        const base64 = await processMediaFile(file, (percent) => {
            setUploadProgress(percent);
        });
        
        // 4. Save to DB
        const userStories = await localDB.stories.get(user.uid);
        let activeGroup = userStories.find(s => s.userId === user.uid && s.expiresAt > Date.now());

        const newFrame: StoryFrame = {
            id: `f_${Date.now()}`,
            title: isVideo ? 'Video Story' : 'New Story',
            description: '',
            image: base64,
            mediaType: isVideo ? 'video' : 'image',
            color: '#000'
        };

        if (activeGroup) {
            // Append to existing
            activeGroup.frames.push(newFrame);
            await localDB.stories.add(activeGroup);
        } else {
            // New Story Group
            const newStory: Story = { 
                id: `story_${user.uid}`, 
                userId: user.uid, 
                username: user.displayName, 
                avatar: user.avatar || '', 
                seen: false, 
                createdAt: Date.now(), 
                expiresAt: Date.now() + 86400000, 
                frames: [newFrame] 
            }; 
            await localDB.stories.add(newStory);
        }
        
        // Refresh UI
        setUploadProgress(null);
        window.dispatchEvent(new Event('server-update'));

    } catch (e: any) { 
        setUploadProgress(null);
        console.error("Story Upload Error:", e);
        alert('Failed to upload story: ' + (e.message || "Unknown error")); 
    }
  };

  const handleUpdateUser = async (data: Partial<User>) => { if (!user) return; await localDB.users.update(user.uid, data); if(data.language) setLanguage(data.language); if(data.themeMode) setThemeEffect(data.themeMode); };
  
  const particles = useMemo(() => { 
      if (!themeEffect || themeEffect === 'none') return []; 
      return Array.from({ length: 45 }).map((_, i) => ({ 
          id: i, 
          left: `${Math.random() * 100}%`, 
          size: `${themeEffect === 'autumn' ? 15 + Math.random() * 10 : 2 + Math.random() * 5}px`, 
          duration: `${6 + Math.random() * 12}s`, 
          delay: `${Math.random() * 10}s`,
          type: themeEffect
      })); 
  }, [themeEffect]);
  
  const t = (key: string) => (TRANSLATIONS[language] && TRANSLATIONS[language][key]) ? TRANSLATIONS[language][key] : (TRANSLATIONS['en'][key] || key);

  const formatAlertTime = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (user && user.isBanned) return ( <div className="fixed inset-0 bg-[#350b0b] flex flex-col items-center justify-center z-[9999] text-white p-10 text-center animate-fade-in"><div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-pulse"><i className="fa-solid fa-xmark text-6xl"></i></div><h1 className="text-3xl font-black uppercase tracking-widest mb-4">Account Banned</h1><p className="text-red-200 mb-10 font-medium">Permanent Ban.<br/>#BAN_User_{user.numericId}</p><button onClick={() => { signOut(); setUser(null); }} className="bg-white text-red-900 px-8 py-4 rounded-2xl font-black text-lg hover:scale-105 transition-transform">LOGOUT</button></div> );
  if (isAdminMode) return <AdminPanel onExit={() => setIsAdminMode(false)} />;
  if (!user) return <AuthScreen onLogin={setUser} onAdminLogin={() => setIsAdminMode(true)} />;

  return (
    <LangContext.Provider value={{ t, lang: language }}>
    <div className={`flex flex-col h-screen w-screen bg-[var(--winter-bg)] overflow-hidden font-sans relative ${language === 'fa' ? 'rtl' : 'ltr'}`} dir={language === 'fa' ? 'rtl' : 'ltr'}>
      {/* SEASONAL THEME LAYER */}
      <div className="snow-container" style={{ pointerEvents: 'none', zIndex: 1 }}>
        {particles.map(p => ( 
            <div 
                key={p.id} 
                className={p.type === 'autumn' ? 'autumn-leaf' : 'snowflake'} 
                style={{ 
                    left: p.left, 
                    width: p.size, 
                    height: p.size, 
                    animationDuration: p.duration, 
                    animationDelay: p.delay,
                    opacity: p.type === 'snow' ? 0.7 : 0.9
                }} 
            /> 
        ))}
      </div>

      <Header 
        onMenuClick={() => setIsDrawerOpen(true)} 
        isSearching={isSearching} 
        setIsSearching={(val) => { setIsSearching(val); if(!val) { setSearchQuery(''); setSearchResults([]); } }} 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stories={stories} 
        onStoryClick={setActiveStory} 
        onAddStory={handleAddStory} 
        uploadProgress={uploadProgress} 
        onGlobalAction={(act) => { if (act === 'background') setIsBGModalOpen(true); if (act === 'profile') setIsProfileModalOpen(true); if (act === 'invite') setIsInvitesModalOpen(true); }} 
      />
      
      <div className="flex-1 overflow-hidden relative bg-[var(--winter-bg)] z-10">
        <ChatList chats={isSearching ? searchResults : chats} searchQuery={searchQuery} activeTab={activeTab} archivedChats={user.archivedChats || []} onChatClick={(c) => { setActiveChat(c); setIsSearching(false); setSearchQuery(''); }} onPin={async (id) => { const chat = chats.find(c => c.id === id); if (chat) await localDB.chats.update(id, { pinned: !chat.pinned }); }} onArchive={async (id) => { const newArchived = user.archivedChats.includes(id) ? user.archivedChats.filter(x => x !== id) : [...user.archivedChats, id]; await localDB.users.update(user.uid, { archivedChats: newArchived }); }} onDelete={async (id) => { if(confirm('Delete this chat permanently?')) await localDB.chats.delete(id); }} onTabChange={setActiveTab} />
        {!isSearching && activeTab !== 'Archived' && ( <button onClick={() => setIsCreateChatModalOpen(true)} className="absolute bottom-12 right-6 w-16 h-16 bg-gradient-to-tr from-[#24A1DE] to-[#00e5ff] text-white rounded-3xl shadow-[0_15px_45px_rgba(0,229,255,0.45)] flex items-center justify-center text-2xl z-20 active:scale-90 transition-all border border-white/20"><i className="fa-solid fa-pen-to-square"></i></button> )}
      </div>

      <Drawer user={user} isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onLogout={() => { signOut(); }} onProfileClick={() => { setIsDrawerOpen(false); setIsProfileModalOpen(true); }} onGiftsClick={() => { setIsDrawerOpen(false); setIsGiftsModalOpen(true); }} onInvitesClick={() => { setIsDrawerOpen(false); setIsInvitesModalOpen(true); }} onContactsClick={() => {}} onAdminClick={() => { setIsDrawerOpen(false); setIsAdminMode(true); }} themeEffect={themeEffect} onToggleTheme={(m) => handleUpdateUser({ themeMode: m })} onLanguageChange={(l) => handleUpdateUser({ language: l })} onUpdateUser={handleUpdateUser} />
      
      {activeChat && ( <ChatView chat={activeChat} user={user} onBack={() => setActiveChat(null)} onUpdateUser={handleUpdateUser} onMentionClick={(m) => console.log(m)} onStartCall={(t) => {}} /> )}
      {incomingCall && ( <CallOverlay user={user} callData={incomingCall} onClose={() => setIncomingCall(null)} /> )}
      {activeStream && showStreamModal && ( <StreamModal isOpen={showStreamModal} onClose={() => setShowStreamModal(false)} user={user} stream={activeStream} /> )}
      
      {systemAlert && (
          <div className="fixed inset-0 z-[9999] bg-red-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 animate-pulse select-none" onClick={e => e.stopPropagation()}>
              <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(255,0,0,1)] animate-bounce mb-8">
                  <i className="fa-solid fa-radiation text-white text-6xl"></i>
              </div>
              <h1 className="text-5xl font-black text-white uppercase tracking-widest mb-4">Emergency Alert</h1>
              <p className="text-2xl text-white font-bold mb-12 bg-black/50 p-6 rounded-2xl border-2 border-red-500 max-w-lg">{systemAlert.message}</p>
              <div className="text-xl font-mono text-red-200">System Locked for {formatAlertTime(alertTimer)}</div>
          </div>
      )}

      <MiniAppModal isOpen={showMiniApp} onClose={() => setShowMiniApp(false)} url={miniAppUrl} title={miniAppTitle} />
      <BackgroundPickerModal isOpen={isBGModalOpen} onClose={() => setIsBGModalOpen(false)} onSelect={(bg) => handleUpdateUser({ chatBackground: bg })} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onSave={handleUpdateUser} />
      <GiftsModal isOpen={isGiftsModalOpen} onClose={() => setIsGiftsModalOpen(false)} user={user} onUpdateUser={handleUpdateUser} />
      <InvitesModal isOpen={isInvitesModalOpen} onClose={() => setIsInvitesModalOpen(false)} user={user} onStartChat={setActiveChat} />
      <CreateChatModal isOpen={isCreateChatModalOpen} onClose={() => setIsCreateChatModalOpen(false)} user={user} onCreated={setActiveChat} />
      {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />}
    </div>
    </LangContext.Provider>
  );
};

export default App;
