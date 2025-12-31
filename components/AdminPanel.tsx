
import React, { useState, useEffect, useRef } from 'react';
import { db as localDB } from '../backend';
import { api } from '../api';
import { User, AdConfig, ChatSnapshot, Report, Chat, Message, LiveStream } from '../types';

interface Props { onExit: () => void; }

const AdminPanel: React.FC<Props> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'alert' | 'stream' | 'ads' | 'snapshots' | 'reports'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({ totalUsers: 0, premiumUsers: 0, totalBanned: 0, totalCoins: 0 });

  // Features
  const [searchTerm, setSearchTerm] = useState('');
  const [globalAlertMsg, setGlobalAlertMsg] = useState('');
  const [alertDuration, setAlertDuration] = useState(60); // Default 1 min
  
  // Stream
  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<LiveStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Ads
  const [adTitle, setAdTitle] = useState('');
  const [adText, setAdText] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adImage, setAdImage] = useState('');
  const [adScheduledTime, setAdScheduledTime] = useState(0);

  // Snapshots
  const [snapshots, setSnapshots] = useState<ChatSnapshot[]>([]);
  const [snapSearch, setSnapSearch] = useState('');

  // Bug Reports
  const [reports, setReports] = useState<Report[]>([]);
  const [replyText, setReplyText] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
      loadData();
      const interval = setInterval(loadData, 3000);
      return () => { 
          clearInterval(interval); 
          if(streamRef.current) {
              streamRef.current.getTracks().forEach(t=>t.stop());
              localDB.stream.stop(); 
          }
      };
  }, []);

  const loadData = async () => {
      try {
        const [usersResponse, statsResponse] = await Promise.all([
          api.getAdminUsers(),
          api.getAdminStats()
        ]);

        setUsers(usersResponse.users.map((u: any) => ({
          uid: u.id,
          username: u.username,
          displayName: u.display_name,
          avatar: u.avatar,
          isBanned: u.is_banned,
          isVerified: u.is_verified,
          createdAt: u.created_at,
          typoloBalance: 0 // Will be added
        })));

        setStats({
          totalUsers: statsResponse.stats.totalUsers,
          premiumUsers: 0, // Will be added
          totalBanned: statsResponse.stats.bannedUsers,
          totalCoins: 0 // Will be added
        });

        // Snapshots and reports not implemented yet
        setSnapshots([]);
        setReports([]);

        // Stream not implemented
        setStreamData(null);
      } catch (error) {
        console.error('Failed to load admin data:', error);
      }
  };

  const handleBan = async (uid: string, currentBan: boolean) => {
      try {
        await api.adminAction(uid, currentBan ? 'unban' : 'ban');
        loadData();
      } catch (error) {
        console.error('Failed to ban/unban user:', error);
      }
  };

  const handleAddCoins = async (uid: string) => {
      const amount = prompt("Enter amount to add:");
      if(amount) await localDB.users.addBalance(uid, parseInt(amount));
  };

  const handleGlobalAlert = async () => {
      if(!globalAlertMsg) return;
      await localDB.alerts.set({
          id: `alert_${Date.now()}`,
          message: globalAlertMsg,
          type: 'danger',
          durationSeconds: alertDuration,
          createdAt: Date.now(),
          expiresAt: Date.now() + (alertDuration * 1000),
          isGlobalLock: true
      });
      alert(`GLOBAL ALERT SENT! LOCKED FOR ${formatDuration(alertDuration)}.`);
      setGlobalAlertMsg('');
  };

  const handleStartStream = async () => {
      if(!streamTitle) return alert("Title required");
      try {
          const s = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
          streamRef.current = s;
          if(videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
          await localDB.stream.start(streamTitle, 'Admin');
          setIsStreaming(true);
      } catch(e) { alert("Camera Error"); }
  };

  const handleCreateAd = async () => {
      if(!adTitle || !adText) return alert("Title and Text required");
      const newAd: AdConfig = {
          id: `ad_${Date.now()}`,
          title: adTitle,
          text: adText,
          image: adImage,
          link: adLink,
          isActive: true,
          views: 0,
          isScheduled: adScheduledTime > 0,
          startTime: adScheduledTime > 0 ? Date.now() + (adScheduledTime * 60000) : undefined 
      };
      await localDB.ads.set(newAd);
      alert("Ad Created!");
      setAdTitle(''); setAdText(''); setAdLink(''); setAdImage('');
  };

  const handleReplyReport = async () => {
      if(!selectedReport || !replyText.trim()) return;
      
      const chatId = `support_ticket_${selectedReport.reporterId}`;
      const user = users.find(u => u.uid === selectedReport.reporterId);
      if(!user) return alert("User not found");

      // 1. Create Official Support Chat if not exists
      const existingChat = (await localDB.chats.getMyChats(selectedReport.reporterId)).find(c => c.id === chatId);
      
      if(!existingChat) {
          const supportChat: Chat = {
              id: chatId,
              name: "پاسخ ریپورت (Official Support)",
              avatar: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Stack_Overflow_icon.svg/768px-Stack_Overflow_icon.svg.png", // Special Avatar
              type: "private", // Special type handled in ChatView
              status: "Official",
              lastMessage: "Ticket Created",
              lastMessageTime: Date.now(),
              unreadCount: 1,
              time: "Now",
              adminIds: [selectedReport.reporterId, 'admin_official']
          };
          await localDB.chats.create(supportChat);
      }

      // 2. Send Message as "Official Support"
      const msg: Message = {
          id: `rep_${Date.now()}`,
          senderId: 'official_support_agent', // Special ID for Blue Tick
          senderName: "Official Support Team",
          type: 'text',
          text: `In response to your report:\n"${selectedReport.description}"\n\n----------------\n${replyText}`,
          status: 'sent',
          timestamp: Date.now(),
          localTimestamp: Date.now(),
          seenBy: [],
          isForwarded: false,
          isDeleted: false,
          editHistory: [],
          reactions: []
      };

      await localDB.messages.send(chatId, msg);
      
      // 3. Mark Report Resolved
      await localDB.reports.add({ ...selectedReport, status: 'resolved' });
      
      alert("Reply Sent & Ticket Closed!");
      setReplyText('');
      setSelectedReport(null);
      loadData();
  };

  const updateStreamSettings = async (setting: Partial<LiveStream>) => {
      await localDB.stream.update(setting);
      loadData();
  };

  const formatDuration = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-white font-sans flex flex-col md:flex-row z-[5000] overflow-hidden">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 z-50">
          <span className="font-black text-lg text-blue-400">ADMIN CONSOLE</span>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="w-10 h-10 bg-slate-700 rounded-lg"><i className="fa-solid fa-bars"></i></button>
      </div>

      {/* SIDEBAR */}
      <div className={`fixed inset-0 bg-slate-900/95 z-40 md:relative md:w-64 md:bg-slate-800 md:border-r md:border-slate-700 flex flex-col transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="hidden md:block p-6 border-b border-slate-700">
              <h1 className="text-2xl font-black italic">ULTIMATE<span className="text-blue-500">ADMIN</span></h1>
          </div>
          <nav className="flex-1 p-4 space-y-2 mt-16 md:mt-0 overflow-y-auto">
              <TabButton icon="fa-chart-line" label="Overview" active={activeTab==='dashboard'} onClick={()=>{setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} />
              <TabButton icon="fa-users-gear" label="User Manager" active={activeTab==='users'} onClick={()=>{setActiveTab('users'); setIsMobileMenuOpen(false);}} />
              <TabButton icon="fa-triangle-exclamation" label="Global Alert" active={activeTab==='alert'} onClick={()=>{setActiveTab('alert'); setIsMobileMenuOpen(false);}} />
              <TabButton icon="fa-tower-broadcast" label="Live Studio" active={activeTab==='stream'} onClick={()=>{setActiveTab('stream'); setIsMobileMenuOpen(false);}} />
              <TabButton icon="fa-rectangle-ad" label="Ad Manager" active={activeTab==='ads'} onClick={()=>{setActiveTab('ads'); setIsMobileMenuOpen(false);}} />
              <TabButton icon="fa-camera-retro" label="Chat Snaps" active={activeTab==='snapshots'} onClick={()=>{setActiveTab('snapshots'); setIsMobileMenuOpen(false);}} />
              <TabButton icon="fa-bug" label="Bug Reports" active={activeTab==='reports'} onClick={()=>{setActiveTab('reports'); setIsMobileMenuOpen(false);}} />
          </nav>
          <div className="p-4 border-t border-slate-700">
              <button onClick={onExit} className="w-full py-3 bg-red-600 text-white font-black rounded-xl">EXIT</button>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-900 pb-20">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Users" value={stats.totalUsers} icon="fa-users" color="bg-blue-600" />
                  <StatCard label="Premium" value={stats.premiumUsers} icon="fa-crown" color="bg-purple-600" />
                  <StatCard label="Banned" value={stats.totalBanned} icon="fa-ban" color="bg-red-600" />
                  <StatCard label="Economy" value={stats.totalCoins} icon="fa-coins" color="bg-yellow-500" />
              </div>
          )}

          {/* USER MANAGER */}
          {activeTab === 'users' && (
              <div className="space-y-4">
                  <input className="w-full bg-slate-800 border-none rounded-xl p-4 text-white font-bold outline-none" placeholder="Search Users..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  <div className="space-y-2">
                      {users.filter(u => u.username.includes(searchTerm)).map(u => (
                          <div key={u.uid} className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                              <div className="flex items-center gap-3">
                                  <img src={u.avatar} className="w-10 h-10 rounded-full bg-slate-700" />
                                  <div>
                                      <div className="font-bold text-sm">{u.displayName}</div>
                                      <div className="text-xs text-slate-500">@{u.username} | {u.typoloBalance} Coins</div>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => handleAddCoins(u.uid)} className="w-8 h-8 bg-yellow-500/20 text-yellow-500 rounded-lg"><i className="fa-solid fa-plus"></i></button>
                                  <button onClick={() => handleBan(u.uid, !!u.isBanned)} className={`w-8 h-8 rounded-lg ${u.isBanned ? 'bg-green-500 text-white' : 'bg-red-500/20 text-red-500'}`}><i className={`fa-solid ${u.isBanned ? 'fa-unlock' : 'fa-ban'}`}></i></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* GLOBAL ALERT (EXTENDED TIMER) */}
          {activeTab === 'alert' && (
              <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-6">
                  <h2 className="text-2xl font-black text-red-500">EMERGENCY BROADCAST</h2>
                  <textarea className="w-full bg-slate-800 rounded-xl p-4 text-white font-bold" placeholder="WARNING MESSAGE" value={globalAlertMsg} onChange={e=>setGlobalAlertMsg(e.target.value)} />
                  <div className="w-full">
                      <div className="flex justify-between text-xs text-slate-400 mb-2">
                          <span>10s</span>
                          <span className="font-bold text-white text-lg">{formatDuration(alertDuration)}</span>
                          <span>5h</span>
                      </div>
                      <input type="range" min="10" max="18000" step="10" value={alertDuration} onChange={e=>setAlertDuration(parseInt(e.target.value))} className="w-full accent-red-500" />
                  </div>
                  <button onClick={handleGlobalAlert} className="w-full py-4 bg-red-600 font-black rounded-xl hover:bg-red-700 transition-colors">SEND ALERT</button>
              </div>
          )}

          {/* AD MANAGER */}
          {activeTab === 'ads' && (
              <div className="max-w-xl mx-auto space-y-4">
                  <h2 className="text-2xl font-black">Create Sponsored Ad</h2>
                  <input className="w-full bg-slate-800 p-4 rounded-xl" placeholder="Ad Title" value={adTitle} onChange={e=>setAdTitle(e.target.value)} />
                  <textarea className="w-full bg-slate-800 p-4 rounded-xl" placeholder="Ad Text" value={adText} onChange={e=>setAdText(e.target.value)} />
                  <input className="w-full bg-slate-800 p-4 rounded-xl" placeholder="Image URL (Optional)" value={adImage} onChange={e=>setAdImage(e.target.value)} />
                  <input className="w-full bg-slate-800 p-4 rounded-xl" placeholder="Link URL" value={adLink} onChange={e=>setAdLink(e.target.value)} />
                  <div className="flex items-center gap-4">
                      <label>Schedule Delay (Mins):</label>
                      <input type="number" className="bg-slate-800 p-2 rounded w-20" value={adScheduledTime} onChange={e=>setAdScheduledTime(parseInt(e.target.value))} />
                  </div>
                  <button onClick={handleCreateAd} className="w-full py-4 bg-blue-600 font-black rounded-xl">PUBLISH AD</button>
              </div>
          )}

          {/* CHAT SNAPSHOTS (FIXED) */}
          {activeTab === 'snapshots' && (
              <div className="space-y-4 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                      <h2 className="text-xl font-black">Chat Monitoring (Real-time Text Snaps)</h2>
                      <input 
                          className="bg-slate-800 p-2 rounded-lg text-sm border border-slate-700"
                          placeholder="Search Chat ID / User..."
                          value={snapSearch}
                          onChange={e => setSnapSearch(e.target.value)}
                      />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pb-20">
                      {snapshots
                          .filter(s => s.chatName.toLowerCase().includes(snapSearch.toLowerCase()) || s.chatId.includes(snapSearch))
                          .map(snap => (
                          <div key={snap.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col h-80">
                              <div className="flex justify-between border-b border-slate-600 pb-2 mb-2 bg-slate-900/50 p-2 rounded-lg">
                                  <div>
                                      <div className="font-bold text-blue-400">{snap.chatName}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">{snap.chatId}</div>
                                  </div>
                                  <span className="text-xs text-slate-400">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-black/20 rounded-lg">
                                  {snap.messages && snap.messages.length > 0 ? snap.messages.map((m, i) => (
                                      <div key={i} className="flex flex-col">
                                          <div className="flex justify-between items-baseline">
                                              <span className="font-bold text-slate-300 text-xs">{m.sender}</span>
                                              <span className="text-[9px] text-slate-600">{m.time}</span>
                                          </div>
                                          <div className="text-sm text-slate-400 break-words bg-slate-700/30 p-1 rounded px-2">{m.text}</div>
                                      </div>
                                  )) : (
                                      <div className="text-center text-slate-600 italic mt-10">No visible messages in this snapshot.</div>
                                  )}
                              </div>
                          </div>
                      ))}
                      {snapshots.length === 0 && <div className="text-slate-500">No snapshots captured yet. Waiting for intervals...</div>}
                  </div>
              </div>
          )}

          {/* BUG REPORTS (NEW) */}
          {activeTab === 'reports' && (
              <div className="h-full flex flex-col space-y-4">
                  <h2 className="text-xl font-black">User Bug Reports</h2>
                  <div className="flex-1 overflow-y-auto space-y-3">
                      {reports.length === 0 && <div className="text-slate-500">No reports found.</div>}
                      {reports.map(rep => (
                          <div key={rep.id} className={`bg-slate-800 p-4 rounded-xl border-l-4 ${rep.status === 'resolved' ? 'border-green-500 opacity-50' : 'border-orange-500'}`}>
                              <div className="flex justify-between mb-2">
                                  <span className="font-bold text-sm">User ID: {rep.reporterId}</span>
                                  <span className="text-xs text-slate-500">{new Date(rep.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="bg-black/30 p-3 rounded-lg text-slate-300 mb-3">{rep.description}</p>
                              {rep.status !== 'resolved' && (
                                  <button onClick={() => setSelectedReport(rep)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold">Reply & Solve</button>
                              )}
                              {rep.status === 'resolved' && <span className="text-green-500 font-bold text-xs uppercase">Resolved</span>}
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* REPLY MODAL */}
          {selectedReport && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[6000]">
                  <div className="bg-slate-800 w-full max-w-lg p-6 rounded-2xl border border-slate-600">
                      <h3 className="font-bold text-xl mb-4">Reply to User</h3>
                      <p className="text-xs text-slate-400 mb-2">This will send a message from "Official Support" via a special Blue-Ticked channel.</p>
                      <textarea 
                          className="w-full h-32 bg-slate-900 rounded-xl p-3 text-white mb-4 border border-slate-700" 
                          placeholder="Type your official response here..."
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                      />
                      <div className="flex gap-2 justify-end">
                          <button onClick={() => setSelectedReport(null)} className="px-4 py-2 rounded-lg hover:bg-white/10">Cancel</button>
                          <button onClick={handleReplyReport} className="px-6 py-2 bg-blue-600 rounded-lg font-bold">Send Official Reply</button>
                      </div>
                  </div>
              </div>
          )}

          {/* LIVE STREAM - FULL OPTION */}
          {activeTab === 'stream' && (
              <div className="h-full flex flex-col">
                  <div className="bg-black rounded-2xl overflow-hidden relative aspect-video mx-auto w-full max-w-4xl border border-slate-700 shadow-2xl mb-4">
                      <video ref={videoRef} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 p-6 flex flex-col justify-end">
                          {!isStreaming ? (
                              <div className="space-y-4 max-w-md mx-auto w-full">
                                  <input className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 text-white font-bold placeholder-white/50" placeholder="Stream Title" value={streamTitle} onChange={e=>setStreamTitle(e.target.value)} />
                                  <button onClick={handleStartStream} className="w-full py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all">GO LIVE</button>
                              </div>
                          ) : (
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-lg animate-pulse">
                                          <span className="font-bold text-white text-sm">LIVE</span>
                                      </div>
                                      <span className="text-white font-mono">{streamData?.viewersCount || 0} Viewers</span>
                                  </div>
                                  <button onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); setIsStreaming(false); localDB.stream.stop(); }} className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200">END STREAM</button>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* ADMIN CONTROLS */}
                  {isStreaming && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800 rounded-2xl border border-slate-700">
                          <button onClick={() => updateStreamSettings({ isAudioMuted: !streamData?.isAudioMuted })} className={`p-4 rounded-xl font-bold flex flex-col items-center gap-2 ${streamData?.isAudioMuted ? 'bg-red-600' : 'bg-slate-700'}`}>
                              <i className={`fa-solid ${streamData?.isAudioMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                              {streamData?.isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                          </button>
                          
                          <button onClick={() => updateStreamSettings({ isVideoHidden: !streamData?.isVideoHidden })} className={`p-4 rounded-xl font-bold flex flex-col items-center gap-2 ${streamData?.isVideoHidden ? 'bg-red-600' : 'bg-slate-700'}`}>
                              <i className={`fa-solid ${streamData?.isVideoHidden ? 'fa-video-slash' : 'fa-video'}`}></i>
                              {streamData?.isVideoHidden ? 'Show Video' : 'Hide Video'}
                          </button>

                          <button onClick={() => updateStreamSettings({ isChatDisabled: !streamData?.isChatDisabled })} className={`p-4 rounded-xl font-bold flex flex-col items-center gap-2 ${streamData?.isChatDisabled ? 'bg-orange-600' : 'bg-slate-700'}`}>
                              <i className={`fa-solid ${streamData?.isChatDisabled ? 'fa-comment-slash' : 'fa-comment'}`}></i>
                              {streamData?.isChatDisabled ? 'Enable Chat' : 'Disable Chat'}
                          </button>

                          <button className="p-4 rounded-xl font-bold flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-500" onClick={() => alert("Announcement Sent!")}>
                              <i className="fa-solid fa-bullhorn"></i>
                              Announce
                          </button>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

const TabButton = ({ icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
        <i className={`fa-solid ${icon} w-6 text-center text-lg`}></i>
        <span className="font-bold">{label}</span>
    </button>
);

const StatCard = ({ label, value, icon, color }: any) => (
    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between h-32">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white mb-2`}><i className={`fa-solid ${icon}`}></i></div>
        <div>
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-xs font-bold text-slate-500 uppercase">{label}</div>
        </div>
    </div>
);

export default AdminPanel;
