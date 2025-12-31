
import React, { useState, useEffect, useRef } from 'react';
import { Chat, User, Message, CallSession, ChatSnapshot } from '../types';
import { db as localDB } from '../backend';
import { getUserBadge } from '../VerifiedUsers';
import { getBadgeIcon, getBadgeStyle } from '../SupportDB';
import { UserProfileModal } from './Modals'; 
import { PROFANITY_LIST } from '../constants';

interface Props {
  chat: Chat;
  user: User;
  onBack: () => void;
  onUpdateUser: (data: Partial<User>) => void;
  onMentionClick: (mention: string) => void;
  onStartCall: (type: 'audio' | 'video') => void;
}

const EMOJI_LIST = ['😀','😂','😍','😭','😡','👍','👎','❤️','🔥','🎉','👻','👽','🤖','💩','💀','🤡','🫶','👀','☠️','👑','💎','💸','💣','💊','🩸','🔮','🧸','🎵','🎮','🚀'];
const STICKERS = [
    'https://cdn-icons-png.flaticon.com/512/4712/4712038.png',
    'https://cdn-icons-png.flaticon.com/512/4712/4712100.png',
    'https://cdn-icons-png.flaticon.com/512/4712/4712109.png',
    'https://cdn-icons-png.flaticon.com/512/4712/4712068.png',
    'https://cdn-icons-png.flaticon.com/512/4712/4712139.png',
    'https://cdn-icons-png.flaticon.com/512/4712/4712009.png'
];

type BotCreationStep = 'IDLE' | 'WAITING_FOR_NAME' | 'WAITING_FOR_USERNAME' | 'WAITING_FOR_BOT_SELECTION' | 'BOT_SETTINGS_MENU' | 'WAITING_FOR_WEB_APP_URL';

const ChatView: React.FC<Props> = ({ chat, user, onBack, onUpdateUser, onMentionClick, onStartCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [peerUser, setPeerUser] = useState<User | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showWarning, setShowWarning] = useState(false); // Profanity Warning
  const [warningStep, setWarningStep] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const recordInterval = useRef<number | null>(null);

  // Emoji/Sticker Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji');

  // Message Actions State
  const [longPressedMessage, setLongPressedMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // BOTFATHER STATE
  const [botStep, setBotStep] = useState<BotCreationStep>('IDLE');
  const [tempBotName, setTempBotName] = useState('');
  const [myBotsList, setMyBotsList] = useState<User[]>([]);
  const [selectedBot, setSelectedBot] = useState<User | null>(null);

  // CHECK READ-ONLY STATUS (For Support Tickets)
  const isReadOnly = chat.id.startsWith('support_ticket_') && !user.isAdmin;

  useEffect(() => {
    if (chat.type === 'private') {
      let peerId = '';
      if (chat.adminIds && chat.adminIds.length > 0) peerId = chat.adminIds.find(id => id !== user.uid) || '';
      else if (!peerId) {
          if (chat.id.startsWith(user.uid + '_')) peerId = chat.id.substring(user.uid.length + 1);
          else if (chat.id.endsWith('_' + user.uid)) peerId = chat.id.substring(0, chat.id.length - user.uid.length - 1);
          else { const parts = chat.id.split('_'); peerId = parts.find(p => p !== user.uid) || ''; }
      }
      if (peerId) {
        localDB.users.get(peerId).then(u => setPeerUser(u));
        const updateListener = () => { localDB.users.get(peerId).then(u => setPeerUser(u)); };
        window.addEventListener('server-update', updateListener);
        return () => window.removeEventListener('server-update', updateListener);
      }
    }
  }, [chat.id, user.uid]);

  // SNAPSHOT MONITORING (UPDATED TO 1 MINUTE)
  useEffect(() => {
      // Capture a snapshot of this chat every 1 minute (60,000 ms)
      const snapshotInterval = setInterval(async () => {
          if (messages.length === 0) return;
          const recent = messages.slice(-50).map(m => ({
              sender: m.senderName,
              text: m.text || (m.mediaType ? `[${m.mediaType}]` : '[content]'),
              time: new Date(m.localTimestamp).toLocaleTimeString()
          }));
          const snap: ChatSnapshot = {
              id: `snap_${chat.id}_${Date.now()}`,
              chatId: chat.id,
              chatName: chat.name,
              timestamp: Date.now(),
              messages: recent,
              expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 Hours
          };
          await localDB.snapshots.add(snap);
      }, 60000); // 1 min

      return () => clearInterval(snapshotInterval);
  }, [chat.id, messages]);

  useEffect(() => {
    const unsubscribe = localDB.messages.subscribe(chat.id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [chat.id]);

  const handleStartCall = async (type: 'audio' | 'video') => {
      onStartCall(type); 
      if(!peerUser) return alert('Connecting...');
      const callId = `call_${Date.now()}`;
      const newCall: CallSession = {
          id: callId,
          callerId: user.uid,
          callerName: user.displayName,
          callerAvatar: user.avatar || '',
          receiverId: peerUser.uid,
          type: type,
          status: 'ringing',
          timestamp: Date.now()
      };
      await localDB.calls.initiate(newCall);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    
    // --- STRICT PROFANITY CHECK ---
    const lowerText = inputText.toLowerCase();
    const hasProfanity = PROFANITY_LIST.some(bad => lowerText.includes(bad));

    if (hasProfanity) {
        const currentWarnings = (user.warnings || 0) + 1;
        setWarningStep(currentWarnings);
        setShowWarning(true);
        setInputText(''); // Clear input

        if (currentWarnings >= 2) {
             await onUpdateUser({ warnings: 2, isBanned: true });
             return;
        } else {
             await onUpdateUser({ warnings: currentWarnings });
             setTimeout(() => setShowWarning(false), 5000); 
             return;
        }
    }

    const text = inputText;
    setInputText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    
    const msgData: Message = { 
      id: 'msg_' + Date.now(),
      senderId: user.uid, 
      senderName: user.displayName || user.username, 
      type: 'text', 
      text: text, 
      status: 'sent', 
      replyToId: replyTo?.id,
      timestamp: Date.now(), 
      localTimestamp: Date.now(), 
      seenBy: [user.uid], 
      isForwarded: false,
      isDeleted: false,
      editHistory: [],
      reactions: [] 
    };
    await localDB.messages.send(chat.id, msgData);

    const isBotFather = peerUser && (peerUser.username === 'botfather' || peerUser.uid === 'bot_father_official');
    if (isBotFather) await processBotFatherCommand(text);
  };

  // BotFather Logic (Condensed)
  const processBotFatherCommand = async (cmd: string) => { 
       const lowerCmd = cmd.toLowerCase().trim().replace('/', ''); 
       let responseText = '';
       if (lowerCmd === 'cancel') { setBotStep('IDLE'); setTempBotName(''); setSelectedBot(null); responseText = "Cancelled."; }
       else if (botStep === 'IDLE') {
          if (lowerCmd === 'start') responseText = "I can help you create and manage Telegram bots.\n/newbot\n/mybots";
          else if (lowerCmd === 'newbot') { setBotStep('WAITING_FOR_NAME'); responseText = "Alright, a new bot. How are we going to call it?"; }
          else if (lowerCmd === 'mybots') {
              const allUsers = await localDB.users.getAll();
              const myBots = allUsers.filter(u => u.isBot && u.inviterUid === user.uid); 
              setMyBotsList(myBots);
              if(myBots.length === 0) responseText = "You have currently no bots.";
              else { setBotStep('WAITING_FOR_BOT_SELECTION'); responseText = "Choose a bot:\n\n" + myBots.map((b, i) => `${i + 1}. @${b.username}`).join('\n'); }
          }
       } 
       else if (botStep === 'WAITING_FOR_BOT_SELECTION') {
           const index = parseInt(cmd) - 1;
           if (myBotsList[index]) { setSelectedBot(myBotsList[index]); setBotStep('BOT_SETTINGS_MENU'); responseText = `Selected @${myBotsList[index].username}. Options:\n1. Edit Name\n2. Edit Web App\n3. Back`; }
       }
       else if (botStep === 'BOT_SETTINGS_MENU') {
           if (cmd === '2') { setBotStep('WAITING_FOR_WEB_APP_URL'); responseText = "Send me the URL."; }
           else if (cmd === '3') { setBotStep('IDLE'); processBotFatherCommand('/mybots'); return; }
       }
       else if (botStep === 'WAITING_FOR_WEB_APP_URL') {
           if(selectedBot) { await localDB.users.update(selectedBot.uid, { webAppUrl: cmd.trim() }); responseText = "Web App URL updated."; setBotStep('IDLE'); setSelectedBot(null); }
       }
       else if (botStep === 'WAITING_FOR_NAME') { setTempBotName(cmd.trim()); setBotStep('WAITING_FOR_USERNAME'); responseText = "Good. Now choose a username ending in `bot`."; }
       else if (botStep === 'WAITING_FOR_USERNAME') {
           const uName = cmd.trim().toLowerCase();
           if (!uName.endsWith('bot')) responseText = "Must end in 'bot'.";
           else {
               const exists = (await localDB.users.search(uName)).find(u => u.username === uName);
               if (exists) responseText = "Username taken.";
               else {
                   const botId = `bot_${Date.now()}`;
                   const token = `712:${Date.now().toString(36)}`;
                   await localDB.users.create({ 
                       uid: botId, numericId: Date.now(), username: uName, displayName: tempBotName, isBot: true, botToken: token, inviterUid: user.uid, avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uName}`, typoloBalance: 0, gifts: [], joinedChannels: [], archivedChats: [], isAdmin: false, presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false }, sessions: [], blockedUsers: [], contacts: [], inviteLink: `t.me/${uName}`, referralCount: 0, privacy: { inactivityMonths: 12, lastSeen: 'everybody', forwarding: 'everybody' } 
                   });
                   setBotStep('IDLE'); setTempBotName(''); responseText = `Done! Token: \`${token}\``;
               }
           }
       }
       if (responseText) { setTimeout(async () => { await localDB.messages.send(chat.id, { id: 'msg_bot_' + Date.now(), senderId: 'bot_father_official', senderName: 'BotFather', type: 'text', text: responseText, status: 'sent', timestamp: Date.now(), localTimestamp: Date.now(), seenBy: [], isForwarded: false, isDeleted: false, editHistory: [], reactions: [] }); }, 600); }
  };

  const handleSendSticker = async (url: string) => {
      setShowEmojiPicker(false);
      const msg: Message = { id: 'msg_stick_' + Date.now(), senderId: user.uid, senderName: user.displayName, type: 'media', mediaType: 'sticker', mediaUrl: url, status: 'sent', timestamp: Date.now(), localTimestamp: Date.now(), seenBy: [user.uid], isForwarded: false, isDeleted: false, editHistory: [], reactions: [] };
      await localDB.messages.send(chat.id, msg);
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      const reader = new FileReader();
      reader.onload = async () => {
          const msgData: Message = { id: 'msg_media_' + Date.now(), senderId: user.uid, senderName: user.displayName, type: 'media', mediaUrl: reader.result as string, mediaType: isVideo ? 'video' : (isImage ? 'image' : 'file'), text: file.name, status: 'sent', timestamp: Date.now(), localTimestamp: Date.now(), seenBy: [user.uid], isForwarded: false, isDeleted: false, editHistory: [], reactions: [] };
          await localDB.messages.send(chat.id, msgData);
      };
      reader.readAsDataURL(file);
  };

  const handleRecordToggle = async () => {
    if (isRecording) { mediaRecorder?.stop(); setIsRecording(false); if(recordInterval.current) clearInterval(recordInterval.current); } 
    else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
           const reader = new FileReader();
           reader.readAsDataURL(new Blob(chunks, { type: 'audio/webm' }));
           reader.onloadend = async () => {
               await localDB.messages.send(chat.id, { id: 'msg_audio_' + Date.now(), senderId: user.uid, senderName: user.displayName, type: 'voice', audio: reader.result as string, status: 'sent', timestamp: Date.now(), localTimestamp: Date.now(), seenBy: [user.uid], isForwarded: false, isDeleted: false, editHistory: [], reactions: [] });
           };
           stream.getTracks().forEach(t => t.stop());
        };
        recorder.start(); setMediaRecorder(recorder); setAudioChunks([]); setIsRecording(true); setRecordingTime(0); recordInterval.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (err) { alert("Microphone access denied."); }
    }
  };

  const handleMessageAction = (action: 'reply' | 'pin' | 'delete' | 'copy') => {
      if(!longPressedMessage) return;
      switch(action) {
          case 'reply': setReplyTo(longPressedMessage); break;
          case 'pin': alert('Pinned'); break;
          case 'delete': if (longPressedMessage.senderId === user.uid) localDB.messages.delete(longPressedMessage.id); else alert("Delete own messages only."); break;
          case 'copy': if(longPressedMessage.text) navigator.clipboard.writeText(longPressedMessage.text); break;
      }
      setLongPressedMessage(null);
  };

  const handleOpenMiniApp = () => { if(peerUser?.webAppUrl) window.dispatchEvent(new CustomEvent('open-mini-app', { detail: { url: peerUser.webAppUrl, title: peerUser.displayName } })); };

  // TEXT PARSER (Mentions & Links)
  const renderMessageText = (text: string) => {
      if (!text) return null;
      // Split by spaces to find tokens
      const parts = text.split(/(\s+)/);
      return parts.map((part, i) => {
          if (part.startsWith('@')) {
              return <span key={i} className="text-blue-400 font-bold cursor-pointer hover:underline" onClick={(e) => {e.stopPropagation(); onMentionClick(part)}}>{part}</span>
          }
          if (part.match(/^(http|https):\/\/[^ "]+$/)) {
              return <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-400 underline break-all" onClick={e => e.stopPropagation()}>{part}</a>
          }
          return part;
      });
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${s%60<10?'0':''}${s%60}`;
  // CUSTOM BADGE LOGIC FOR OFFICIAL SUPPORT
  const badgeType = (chat.id.startsWith('support_ticket_') && peerUser?.uid === 'official_support_agent') ? 'VERIFIED' : (peerUser ? getUserBadge(peerUser.uid) : 'NONE');
  
  const peerAvatar = peerUser?.avatar || chat.avatar;
  const statusText = peerUser ? (peerUser.isBot ? 'Bot' : (peerUser.presence.isOnline ? 'online' : 'last seen recently')) : 'offline';

  return (
    <>
    {/* PROFANITY WARNING OVERLAY */}
    {showWarning && (
        <div className="fixed inset-0 z-[99999] bg-red-900 text-white flex flex-col items-center justify-center animate-fade-in p-8 text-center select-none">
            <div className="w-48 h-48 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(255,0,0,0.8)] animate-bounce mb-8">
                <i className="fa-solid fa-triangle-exclamation text-8xl"></i>
            </div>
            <h1 className="text-6xl font-black uppercase mb-4 tracking-tighter">Violation Detected</h1>
            <div className="bg-black/40 border-2 border-red-400 p-6 rounded-2xl mb-8">
                <p className="text-3xl font-bold">PROFANITY IS STRICTLY PROHIBITED</p>
                <p className="text-xl mt-2 text-red-200">Our AI has intercepted offensive content.</p>
            </div>
            <div className="text-5xl font-mono font-black text-yellow-400 bg-red-950 px-8 py-4 rounded-xl border border-yellow-500 shadow-2xl">
                WARNING {warningStep} OF 2
            </div>
            {warningStep === 2 && <p className="mt-8 text-xl font-bold animate-pulse">TERMINATING ACCOUNT...</p>}
        </div>
    )}

    <div className="fixed inset-0 bg-[#0b141d] z-[120] flex flex-col slide-in font-sans rtl bg-[var(--winter-bg)]" dir="rtl">
      {/* Background with Blur support */}
      <div className={`absolute inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center ${user.chatBackgroundBlur ? 'backdrop-blur-md' : ''}`} style={{ backgroundImage: user.chatBackground ? `url(${user.chatBackground})` : 'none' }} />
      {user.chatBackgroundBlur && <div className="absolute inset-0 z-0 bg-black/20 pointer-events-none"></div>}
      
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-black/80 z-[1] pointer-events-none dark:to-black/80 to-white/10"></div>

      <div className="thick-snow bg-[#15202b]/90 backdrop-blur-3xl text-white p-3 flex items-center gap-4 shadow-2xl h-16 z-10 border-b border-[var(--border-color)] dark:bg-[#15202b]/90 bg-white/90 dark:text-white text-gray-800">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center active:scale-90 flex-shrink-0"><i className="fa-solid fa-arrow-right text-blue-400"></i></button>
        <div className="flex flex-1 items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
            <div className="avatar-frame w-11 h-11 aspect-square rounded-full bg-gradient-to-br from-[#1c2833] to-[#24A1DE] border border-white/10 shadow-lg font-black overflow-hidden">
            {peerAvatar ? <img src={peerAvatar} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center w-full h-full">{(peerUser?.displayName || chat.name).charAt(0)}</span>}
            </div>
            <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-1.5">
                <h2 className="font-black text-[15px] truncate dark:text-blue-50 text-gray-900">{peerUser?.displayName || chat.name}</h2>
                {badgeType !== 'NONE' && <i className={`${getBadgeIcon(badgeType)} ${getBadgeStyle(badgeType)} text-[10px]`}></i>}
            </div>
            {chat.type === 'private' && <p className={`text-[10px] font-bold ${statusText === 'online' || statusText === 'Bot' ? 'text-blue-400' : 'text-gray-400'}`}>{statusText}</p>}
            </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => handleStartCall('audio')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 active:scale-90"><i className="fa-solid fa-phone text-blue-400 text-sm"></i></button>
            <button onClick={() => handleStartCall('video')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 active:scale-90"><i className="fa-solid fa-video text-blue-400 text-sm"></i></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 pb-32 hide-scrollbar z-10 relative">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-start' : 'items-end'}`}>
            <div 
                className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-2xl relative backdrop-blur-md border border-[var(--border-color)] transition-all active:scale-95 cursor-pointer ${
                msg.senderId === user.uid ? 'bg-blue-600/80 text-white rounded-br-none' : 'bg-white/10 dark:bg-white/5 dark:text-blue-100 text-gray-800 rounded-bl-none'
                } ${msg.mediaType === 'sticker' ? 'bg-transparent border-0 p-0 shadow-none' : ''}`}
                onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(msg); }}
            >
              {msg.replyToId && <div className="mb-2 border-r-2 border-white/50 pr-2 opacity-70 text-xs truncate font-bold">Replying...</div>}
              
              {msg.type === 'voice' && msg.audio ? ( <AudioMessage audioSrc={msg.audio} isOwn={msg.senderId === user.uid} /> ) 
              : msg.mediaType === 'sticker' && msg.mediaUrl ? ( <img src={msg.mediaUrl} className="w-32 h-32 object-contain drop-shadow-2xl" /> )
              : msg.type === 'media' && msg.mediaUrl ? (
                  <div className="flex flex-col gap-2">
                      {msg.mediaType === 'image' && <img src={msg.mediaUrl} className="rounded-xl max-w-full max-h-64 object-cover" />}
                      {msg.mediaType === 'video' && <video src={msg.mediaUrl} controls className="rounded-xl max-w-full max-h-64 bg-black" />}
                      {msg.text && <div className="text-[12px] opacity-80 mt-1">{msg.text}</div>}
                  </div>
              ) : ( <div className={`text-[14px] leading-relaxed break-words font-medium whitespace-pre-wrap ${msg.senderId !== user.uid ? 'text-white' : ''}`}>{renderMessageText(msg.text || '')}</div> )}
              
              <div className="text-[8px] font-black mt-2 opacity-40 text-left flex justify-end gap-1 items-center">
                 {msg.senderId === user.uid && <i className="fa-solid fa-check text-[10px]"></i>}
                 {new Date(msg.localTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {msg.senderId !== user.uid && peerUser?.isBot && peerUser.webAppUrl && (
                <button onClick={handleOpenMiniApp} className="mt-2 bg-white/10 backdrop-blur-md border border-white/20 text-[#24A1DE] px-4 py-2 rounded-xl text-xs font-bold w-[85%] flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
                    <i className="fa-solid fa-window-maximize"></i> Open {peerUser.displayName} Mini App
                </button>
            )}
          </div>
        ))}
      </div>

      {longPressedMessage && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setLongPressedMessage(null)}>
              <div className="bg-[#1c1c1e] rounded-2xl w-64 p-2 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleMessageAction('reply')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-white text-sm font-bold"><i className="fa-solid fa-reply text-blue-400"></i> Reply</button>
                  <button onClick={() => handleMessageAction('copy')} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-white text-sm font-bold"><i className="fa-regular fa-copy text-green-400"></i> Copy</button>
                  {longPressedMessage.senderId === user.uid && <button onClick={() => handleMessageAction('delete')} className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 rounded-lg text-red-400 text-sm font-bold"><i className="fa-solid fa-trash"></i> Delete</button>}
              </div>
          </div>
      )}

      {showEmojiPicker && (
          <div className="absolute bottom-24 left-4 right-4 h-64 bg-[#15202b]/95 backdrop-blur-xl rounded-[24px] z-30 border border-white/10 p-3 shadow-2xl animate-fade-in flex flex-col">
              <div className="flex gap-2 mb-3 border-b border-white/10 pb-2">
                  <button onClick={() => setPickerTab('emoji')} className={`flex-1 py-2 rounded-xl font-bold text-xs ${pickerTab === 'emoji' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>Emoji</button>
                  <button onClick={() => setPickerTab('sticker')} className={`flex-1 py-2 rounded-xl font-bold text-xs ${pickerTab === 'sticker' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>Stickers</button>
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar grid grid-cols-6 gap-2">
                  {pickerTab === 'emoji' ? EMOJI_LIST.map(e => (
                      <button key={e} onClick={() => { setInputText(p => p+e); }} className="text-2xl hover:bg-white/10 rounded-lg p-2">{e}</button>
                  )) : STICKERS.map((s, i) => (
                      <button key={i} onClick={() => handleSendSticker(s)} className="hover:bg-white/10 rounded-lg p-2"><img src={s} className="w-full h-full object-contain" /></button>
                  ))}
              </div>
          </div>
      )}

      <div className="absolute bottom-0 w-full px-3 z-20 flex items-end gap-2 pb-6 safe-area-bottom pt-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex-1 bg-[#1c1c1e]/80 dark:bg-[#1c1c1e]/80 bg-white/80 backdrop-blur-xl rounded-[26px] flex items-center p-1.5 border border-[var(--border-color)] shadow-lg min-h-[50px] relative">
            {isReadOnly ? (
                <div className="flex items-center justify-center w-full h-full text-red-400 font-bold text-sm bg-red-900/10 rounded-[20px]">
                    <i className="fa-solid fa-lock mr-2"></i> Read-Only Ticket
                </div>
            ) : (
                <>
                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-10 h-10 rounded-full text-gray-400 hover:text-blue-500 transition-colors flex items-center justify-center flex-shrink-0"><i className={`fa-${showEmojiPicker ? 'solid' : 'regular'} fa-face-smile text-2xl`}></i></button>
                    <textarea className="flex-1 bg-transparent px-2 text-[15px] outline-none text-[var(--text-primary)] text-right font-medium placeholder-gray-500 max-h-24 resize-none py-3 hide-scrollbar" placeholder={isRecording ? "Recording..." : "Message"} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyPress={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} disabled={isRecording} dir="auto" rows={1} />
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleAttachment} accept="image/*,video/*" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full text-gray-400 hover:text-blue-500 transition-colors flex items-center justify-center flex-shrink-0 transform -rotate-45"><i className="fa-solid fa-paperclip text-xl"></i></button>
                </>
            )}
        </div>
        
        {!isReadOnly && (
            <div className="flex-shrink-0 w-[50px] h-[50px]">
                {inputText.trim() ? (
                    <button onClick={handleSendText} className="w-full h-full rounded-full bg-[#24A1DE] text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform animate-pop-in"><i className="fa-solid fa-paper-plane text-xl pr-1"></i></button>
                ) : (
                    <button onClick={handleRecordToggle} className={`w-full h-full rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all ${isRecording ? 'bg-red-500 animate-pulse scale-110' : 'bg-[#1c1c1e]/80 bg-white/80 backdrop-blur-xl border border-[var(--border-color)] text-blue-500'}`}>{isRecording ? <i className="fa-solid fa-stop text-white"></i> : <i className="fa-solid fa-microphone text-xl"></i>}</button>
                )}
            </div>
        )}
      </div>
    </div>
    {peerUser && <UserProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} user={peerUser} />}
    </>
  );
};

const AudioMessage = ({ audioSrc, isOwn }: { audioSrc: string, isOwn: boolean }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const togglePlay = () => { if(audioRef.current) { if(isPlaying) audioRef.current.pause(); else audioRef.current.play(); setIsPlaying(!isPlaying); } };
    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <button onClick={togglePlay} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 ${isOwn ? 'bg-white text-blue-500' : 'bg-blue-500 text-white'}`}><i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play pl-1'}`}></i></button>
            <div className="flex flex-col flex-1 gap-1"><div className="h-8 flex items-center gap-[2px] opacity-70">{Array.from({length: 20}).map((_, i) => (<div key={i} className={`w-1 rounded-full bg-current transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`} style={{ height: `${Math.random() * 100}%` }}></div>))}</div><div className="text-[10px] font-mono opacity-60">Voice Message</div></div>
            <audio ref={audioRef} src={audioSrc} onEnded={() => setIsPlaying(false)} className="hidden" />
        </div>
    );
};

export default ChatView;
