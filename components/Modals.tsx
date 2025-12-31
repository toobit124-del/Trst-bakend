
import React, { useState, useRef, useEffect } from 'react';
import { User, Chat, LiveStream, StreamMessage, Gift } from '../types';
import { db as localDB } from '../backend';
import { APP_GIFTS, GiftItem } from '../GiftsData';
import { faceAuthService } from '../FaceAuthService';

const compressImage = (file: File): Promise<string> => { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target?.result as string; img.onload = () => { const canvas = document.createElement('canvas'); const MAX_SIZE = 500; let width = img.width; let height = img.height; if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }; }; }); };

interface BaseModalProps { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; transparent?: boolean; }
const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children, transparent }) => {
  if (!isOpen) return null;
  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-0 animate-fade-in ${transparent ? 'bg-black/60 backdrop-blur-md' : 'bg-black/80'}`} onClick={onClose}>
      <div className={`${transparent ? 'bg-[#1c1c1e]/90 border border-white/10 backdrop-blur-xl' : 'bg-[#1c1c1e]'} w-full max-w-lg h-full sm:h-auto sm:max-h-[95vh] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden transition-all`} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between z-10 border-b border-white/5">
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center rounded-full active:bg-white/10"><i className="fa-solid fa-xmark"></i></button>
          <h3 className="text-[17px] font-bold text-white">{title}</h3>
          <div className="w-8"></div>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar relative">
          {children}
        </div>
      </div>
    </div>
  );
};

export const FaceIDModal = ({ isOpen, onClose, user, onUpdateUser }: { isOpen: boolean, onClose: () => void, user: User, onUpdateUser: (d: Partial<User>) => void }) => {
    const [status, setStatus] = useState('Idle');
    const [isLoading, setIsLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if(isOpen) {
            setIsLoading(true);
            setStatus("Loading Neural Engine...");
            faceAuthService.loadModels().then(async () => {
                setStatus("Starting Camera...");
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                    streamRef.current = stream;
                    if(videoRef.current) {
                        videoRef.current.srcObject = stream;
                        await videoRef.current.play();
                    }
                    setStatus("Ready to Register");
                    setIsLoading(false);
                } catch(e) {
                    setStatus("Camera Error");
                }
            });
        }
        return () => {
            if(streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        }
    }, [isOpen]);

    const handleRegister = async () => {
        if (!videoRef.current) return;
        setIsLoading(true);
        setStatus("Analyzing Face Structure...");
        
        try {
            const descriptor = await faceAuthService.registerFace(videoRef.current);
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const snapshot = canvas.toDataURL('image/jpeg');

            onUpdateUser({ faceDescriptor: descriptor, faceIdData: snapshot });
            setStatus("Success!");
            alert("Face Registered Successfully with Neural Embedding!");
            onClose();
        } catch (e: any) {
            setStatus("Error: " + e.message);
            setIsLoading(false);
        }
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Face ID Registration">
            <div className="p-6 text-center space-y-6 flex flex-col items-center">
                <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-blue-500 shadow-2xl bg-black">
                    <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" playsInline muted autoPlay />
                    {isLoading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold animate-pulse">{status}</div>}
                </div>
                <p className="text-gray-400 text-xs px-4">Ensure good lighting. Look directly at the camera.</p>
                <button onClick={handleRegister} disabled={isLoading} className="w-full py-4 bg-blue-500 rounded-xl font-bold text-white shadow-lg disabled:opacity-50">
                    {isLoading ? 'Processing...' : 'Capture & Encrypt Face'}
                </button>
            </div>
        </BaseModal>
    );
};

export const StreamModal = ({ isOpen, onClose, user, stream }: { isOpen: boolean, onClose: () => void, user: User, stream: LiveStream }) => {
    const [msgText, setMsgText] = useState('');
    const [messages, setMessages] = useState<StreamMessage[]>(stream.messages || []);
    const [guestStream, setGuestStream] = useState<MediaStream | null>(null);
    const guestVideoRef = useRef<HTMLVideoElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const interval = setInterval(async () => { 
            const currentStream = await localDB.stream.get(); 
            if(currentStream) setMessages(currentStream.messages); else onClose(); 
            if (currentStream && currentStream.guestId === user.uid && !guestStream) {
                 try {
                     const s = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
                     setGuestStream(s);
                 } catch(e) { console.error(e); }
            }
        }, 1000);
        return () => { clearInterval(interval); if(guestStream) guestStream.getTracks().forEach(t=>t.stop()); };
    }, [guestStream, user.uid]);

    useEffect(() => {
        if(guestVideoRef.current && guestStream) {
            guestVideoRef.current.srcObject = guestStream;
            guestVideoRef.current.play();
        }
    }, [guestStream]);

    const handleSend = async () => { if(!msgText.trim()) return; const msg: StreamMessage = { id: `sm_${Date.now()}`, userId: user.uid, username: user.displayName, text: msgText, isDonation: false, timestamp: Date.now() }; await localDB.stream.addMessage(msg); setMsgText(''); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); };
    
    const handleDonate = async () => {
        if (user.typoloBalance < 100) return alert("Insufficient Balance");
        await localDB.users.update(user.uid, { typoloBalance: user.typoloBalance - 100 });
        const msg: StreamMessage = { id: `don_${Date.now()}`, userId: user.uid, username: user.displayName, text: 'Sent 100 Stars! 🌟', isDonation: true, amount: 100, timestamp: Date.now() };
        await localDB.stream.addMessage(msg);
    };

    const handleRequestJoin = async () => {
        await localDB.stream.addRequest({ userId: user.uid, username: user.displayName, avatar: user.avatar || '' });
        alert("Request Sent to Host!");
    };

    return ( 
        <div className="fixed inset-0 z-[500] bg-black text-white flex flex-col font-sans">
            <div className="relative flex-1 bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-50 bg-[url('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z0bnZ4eGZ0bnZ4eGZ0bnZ4eGZ0bnZ4eGZ0bnZ4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/L1R1TVTh2ulx6/giphy.gif')] bg-cover bg-center"></div>
                {(stream.guestId || guestStream) && (
                    <div className="absolute top-4 right-4 w-32 h-48 bg-black border-2 border-white rounded-lg overflow-hidden shadow-2xl z-40">
                         <video ref={guestVideoRef} className="w-full h-full object-cover" muted={stream.guestId === user.uid} />
                         <div className="absolute bottom-0 w-full bg-black/50 text-[10px] text-center font-bold">Guest</div>
                    </div>
                )}
                <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center z-50"><i className="fa-solid fa-xmark"></i></button>
                {stream.isChatDisabled && <div className="absolute bottom-40 w-full text-center bg-red-600/80 p-2 font-bold">CHAT DISABLED BY ADMIN</div>}
            </div>
            {!stream.isChatDisabled && (
                <div className="h-1/3 bg-black p-4 flex flex-col">
                    <div ref={scrollRef} className="flex-1 overflow-y-auto hide-scrollbar mb-2 space-y-2">
                        {messages.map(m => (
                            <div key={m.id} className={`text-sm ${m.isDonation ? 'text-yellow-400 font-bold bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/30' : 'text-white'}`}>
                                <span className="opacity-60 text-xs">{m.username}:</span> {m.text}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={handleRequestJoin} className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg"><i className="fa-solid fa-video"></i></button>
                        <button onClick={handleDonate} className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg"><i className="fa-solid fa-star text-black"></i></button>
                        <input className="flex-1 bg-white/10 rounded-full px-4 py-3 border-none outline-none" placeholder="Say something..." value={msgText} onChange={e => setMsgText(e.target.value)} />
                        <button onClick={handleSend} className="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center"><i className="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            )}
        </div> 
    );
};

export const MiniAppModal = ({ isOpen, onClose, url, title }: { isOpen: boolean, onClose: () => void, url: string, title: string }) => { if (!isOpen) return null; return ( <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex flex-col justify-end animate-slide-in"><div className="bg-white h-[85vh] w-full rounded-t-[24px] overflow-hidden flex flex-col shadow-2xl"><div className="bg-white px-4 py-3 border-b flex justify-between items-center z-10"><button onClick={onClose} className="text-[#24A1DE] font-bold text-sm">Close</button><span className="font-black text-black text-sm">{title}</span><button className="text-gray-400"><i className="fa-solid fa-ellipsis"></i></button></div><div className="flex-1 bg-gray-100 relative">{url ? <iframe src={url} className="w-full h-full border-0" title="Mini App" allow="camera; microphone; geolocation" /> : <div className="flex items-center justify-center h-full text-gray-400">Invalid URL</div>}</div></div></div> ); };

export const ProfileModal = ({ isOpen, onClose, user, onSave }: { isOpen: boolean, onClose: () => void, user: User, onSave: (data: Partial<User>) => void }) => { 
    const [displayName, setDisplayName] = useState(user.displayName); 
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleUpdate = () => { onSave({ displayName, bio, avatar }); onClose(); };
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { const compressed = await compressImage(f); setAvatar(compressed); } };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="" transparent>
             <div className="bg-[#0b141d] h-full flex flex-col relative overflow-hidden">
                 {/* COVER AREA */}
                 <div className="h-40 bg-gradient-to-r from-blue-600 to-purple-600 relative">
                     <div className="absolute -bottom-16 left-6">
                         <div className="w-32 h-32 rounded-full p-1 bg-[#0b141d] relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                             <img src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full rounded-full object-cover" />
                             <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-camera text-white"></i></div>
                             <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                         </div>
                     </div>
                 </div>
                 
                 <div className="mt-20 px-6 pb-6 flex-1 overflow-y-auto">
                     <input className="bg-transparent text-3xl font-black text-white outline-none w-full border-b border-white/10 pb-2 mb-4 focus:border-blue-500 transition-colors" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                     
                     <div className="space-y-6">
                         <div>
                             <label className="text-xs text-blue-400 font-bold uppercase tracking-wider">Bio</label>
                             <textarea className="w-full bg-white/5 rounded-xl p-3 text-white mt-2 outline-none border border-white/10 focus:border-blue-500 h-24 resize-none" placeholder="Write something about yourself..." value={bio} onChange={e => setBio(e.target.value)} />
                         </div>

                         {/* GIFTS SHOWCASE */}
                         <div>
                             <label className="text-xs text-pink-400 font-bold uppercase tracking-wider mb-3 block">My Gifts</label>
                             <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                                 {user.gifts && user.gifts.length > 0 ? user.gifts.map(g => (
                                     <div key={g.id} className="min-w-[70px] h-[70px] bg-white/5 rounded-2xl flex items-center justify-center text-3xl border border-white/10 relative">
                                         {g.emoji}
                                         <div className="absolute -bottom-2 bg-black/50 px-2 rounded-full text-[8px] text-white border border-white/20">{g.rarity}</div>
                                     </div>
                                 )) : (
                                     <div className="text-gray-500 text-sm italic">No gifts yet. Visit the shop!</div>
                                 )}
                             </div>
                         </div>
                     </div>

                     <button onClick={handleUpdate} className="w-full py-4 bg-white text-black rounded-2xl font-black mt-10 shadow-xl hover:scale-105 transition-transform">SAVE CHANGES</button>
                 </div>
             </div>
        </BaseModal> 
    ); 
};

export const GiftsModal = ({ isOpen, onClose, user, onUpdateUser }: { isOpen: boolean, onClose: () => void, user: User, onUpdateUser: (data: Partial<User>) => void }) => { 
    const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null); 
    const handleBuy = async () => { 
        if (!selectedGift) return; 
        if (user.typoloBalance < selectedGift.price) return alert('Not enough Stars!'); 
        if (confirm(`Purchase ${selectedGift.name}?`)) { 
            const newGift: Gift = { id: `g_${Date.now()}`, giftId: selectedGift.id, name: selectedGift.name, price: selectedGift.price, emoji: selectedGift.emoji, rarity: selectedGift.rarity, acquiredAt: Date.now() }; 
            await localDB.users.update(user.uid, { typoloBalance: user.typoloBalance - selectedGift.price, gifts: [...(user.gifts||[]), newGift] }); 
            onUpdateUser({ typoloBalance: user.typoloBalance - selectedGift.price }); 
            alert('Purchased!'); onClose(); 
        } 
    }; 
    return ( 
        <BaseModal isOpen={isOpen} onClose={onClose} title="Gift Shop" transparent>
            <div className="p-4 grid grid-cols-2 gap-4">
                {APP_GIFTS.map(gift => (
                    <div key={gift.id} onClick={() => setSelectedGift(gift)} className={`relative p-4 rounded-3xl border border-white/10 cursor-pointer overflow-hidden group bg-gradient-to-br ${gift.gradient} transition-transform hover:scale-95`}>
                        <div className="text-center py-4">
                            <div className={`text-6xl mb-2 drop-shadow-2xl ${gift.effect || ''}`}>{gift.emoji}</div>
                            <div className="text-white font-black text-lg uppercase tracking-wide drop-shadow-md">{gift.name}</div>
                            <div className="inline-block bg-black/30 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full mt-2 border border-white/20">{gift.price} Coins</div>
                        </div>
                    </div>
                ))}
            </div>
            {selectedGift && (
                <div className="p-4 bg-[#1c1c1e] border-t border-white/10">
                    <button onClick={handleBuy} className="w-full bg-white text-black py-4 font-black rounded-xl">BUY FOR {selectedGift.price}</button>
                </div>
            )}
        </BaseModal> 
    ); 
};

export const BugReportModal = ({ isOpen, onClose, user, onUpdateUser }: { isOpen: boolean, onClose: () => void, user: User, onUpdateUser: (d: Partial<User>) => void }) => { const [desc, setDesc] = useState(''); const handleSubmit = async () => { if(!desc.trim()) return; await localDB.reports.add({ id: `bug_${Date.now()}`, reporterId: user.uid, description: desc, timestamp: Date.now(), status: 'pending' }); const newBalance = (user.typoloBalance || 0) + 50; onUpdateUser({ typoloBalance: newBalance }); alert('Report sent!'); onClose(); }; return ( <BaseModal isOpen={isOpen} onClose={onClose} title="Report Bug"><div className="p-6 space-y-4"><textarea className="w-full h-32 bg-black/20 rounded-xl p-3 text-white" value={desc} onChange={e => setDesc(e.target.value)} /><button onClick={handleSubmit} className="w-full py-3 bg-orange-500 rounded-xl font-bold text-black">Submit</button></div></BaseModal> ); };
export const UserProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: User }) => { if(!isOpen) return null; return ( <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-xl flex items-center justify-center animate-fade-in p-6" onClick={onClose}><div className="bg-[#1c1c1e] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10" onClick={e=>e.stopPropagation()}><div className="h-32 bg-gradient-to-tr from-blue-500 to-purple-500 relative"><div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 w-24 h-24 rounded-full border-4 border-[#1c1c1e] overflow-hidden bg-black"><img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full object-cover"/></div></div><div className="pt-14 pb-8 px-6 text-center text-white"><h2 className="text-2xl font-black">{user.displayName}</h2><p className="text-blue-400 text-sm font-bold">@{user.username}</p><p className="mt-4 text-gray-400 text-sm leading-relaxed">{user.bio || "No bio yet."}</p><div className="mt-6 flex justify-center gap-2">{user.gifts && user.gifts.map(g => <span key={g.id} className="text-2xl">{g.emoji}</span>)}</div></div></div></div> ); };

export const BackgroundPickerModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (bg: string, blur: boolean) => void }) => { 
    const bgs = ['https://images.unsplash.com/photo-1557683316-973673baf926', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', 'https://images.unsplash.com/photo-1532983330958-4b32a25fa373']; 
    const [blur, setBlur] = useState(false);
    return ( 
        <BaseModal isOpen={isOpen} onClose={onClose} title="Wallpaper & Style">
            <div className="p-4">
                <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-xl">
                    <span className="text-white font-bold text-sm">Blur Wallpaper</span>
                    <button onClick={() => setBlur(!blur)} className={`w-12 h-6 rounded-full relative transition-colors ${blur ? 'bg-blue-500' : 'bg-gray-600'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${blur ? 'left-7' : 'left-1'}`}></div>
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {bgs.map((bg, i) => (
                        <div key={i} onClick={() => {onSelect(bg, blur); onClose();}} className="h-24 rounded-xl cursor-pointer bg-cover bg-center border border-white/10 hover:border-blue-500 relative overflow-hidden group" style={{backgroundImage: `url(${bg})`}}>
                            {blur && <div className="absolute inset-0 backdrop-blur-sm bg-black/20"></div>}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 text-white font-bold transition-opacity">Select</div>
                        </div>
                    ))}
                </div>
            </div>
        </BaseModal> 
    ); 
};

export const CreateChatModal = ({ isOpen, onClose, user, onCreated }: { isOpen: boolean, onClose: () => void, user: User, onCreated: (c: Chat) => void }) => { 
    const [step, setStep] = useState(1);
    const [name, setName] = useState(''); 
    const [groupUsername, setGroupUsername] = useState('');
    const [members, setMembers] = useState<string[]>([]);
    const [tempMember, setTempMember] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    const [avatar, setAvatar] = useState<string | null>(null);

    const handleAddMember = async () => {
        if(!tempMember.trim()) return;
        // Fix: Clean up input (remove @, lowercase, trim)
        const target = tempMember.replace('@', '').toLowerCase().trim();
        
        // Check availability
        const users = await localDB.users.search(target);
        // Ensure exact match for username
        const match = users.find(u => u.username === target);
        
        if (match) {
            if(!members.includes(match.uid) && match.uid !== user.uid) {
                setMembers([...members, match.uid]);
                setTempMember('');
            } else {
                alert("User already added or is yourself.");
            }
        } else {
            alert(`User @${target} not found.`);
        }
    };

    const handleCreate = async () => { 
        if(!name) return;
        
        // Validate Group Username
        if (groupUsername) {
            if (groupUsername.length < 5) return alert("Group username must be 5+ chars.");
            const existing = await localDB.chats.getByGroupUsername(groupUsername);
            if (existing) return alert("Group link taken.");
        }

        const id = `group_${Date.now()}`; 
        const c: Chat = { 
            id, 
            name, 
            avatar: avatar || 'G', 
            type: 'group', 
            status: 'Active', 
            lastMessage: 'Group Created', 
            lastMessageTime: Date.now(), 
            adminIds: [user.uid, ...members], 
            unreadCount: 0, 
            time: 'Now',
            groupUsername: groupUsername || undefined
        }; 
        await localDB.chats.create(c); 
        onCreated(c); 
        onClose(); 
    }; 
    
    const handleFile = async (e: any) => {
        const file = e.target.files[0];
        if(file) {
            const base64 = await compressImage(file);
            setAvatar(base64);
        }
    };

    return ( 
        <BaseModal isOpen={isOpen} onClose={onClose} title="New Advanced Group">
            <div className="p-6">
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden border-2 border-dashed border-gray-500" onClick={() => fileRef.current?.click()}>
                                {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-camera text-2xl text-gray-400"></i>}
                            </div>
                            <input type="file" ref={fileRef} className="hidden" onChange={handleFile} accept="image/*" />
                        </div>
                        <input className="w-full bg-[#2c2c2e] p-3 rounded-xl text-white outline-none focus:ring-1 ring-blue-500" placeholder="Group Name" value={name} onChange={e=>setName(e.target.value)} />
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-400">t.me/</span>
                            <input className="w-full bg-[#2c2c2e] p-3 pl-14 rounded-xl text-white outline-none focus:ring-1 ring-blue-500" placeholder="Public Link (Optional)" value={groupUsername} onChange={e=>setGroupUsername(e.target.value)} />
                        </div>
                        <button onClick={() => setStep(2)} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold mt-4">Next: Add Members</button>
                    </div>
                )}
                
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                             <input className="flex-1 bg-[#2c2c2e] p-3 rounded-xl text-white outline-none" placeholder="Add by username (e.g. @arvin6889)" value={tempMember} onChange={e=>setTempMember(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMember()} />
                             <button onClick={handleAddMember} className="w-12 bg-green-600 rounded-xl text-white"><i className="fa-solid fa-plus"></i></button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {members.map(mId => (
                                <div key={mId} className="bg-white/5 p-2 rounded-lg flex justify-between items-center text-white text-xs">
                                    <span>{mId}</span> 
                                    <button onClick={() => setMembers(members.filter(m => m !== mId))} className="text-red-400"><i className="fa-solid fa-times"></i></button>
                                </div>
                            ))}
                            <div className="text-gray-500 text-xs text-center">{members.length}/50 Members</div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setStep(1)} className="flex-1 py-3 bg-gray-600 text-white rounded-xl font-bold">Back</button>
                             <button onClick={handleCreate} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold">Create Group</button>
                        </div>
                    </div>
                )}
            </div>
        </BaseModal> 
    ); 
};

export const PrivacyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => { return ( <BaseModal isOpen={isOpen} onClose={onClose} title="Privacy & Security" transparent><div className="p-6 text-white space-y-6"><div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl"><h4 className="text-green-400 font-bold mb-2"><i className="fa-solid fa-lock"></i> End-to-End Encryption</h4><p className="text-xs text-gray-300 leading-relaxed">All your messages, calls, and media are encrypted using industry-standard protocols.</p></div></div></BaseModal> ); };
export const PremiumModal = ({ isOpen, onClose, user, onUpdateUser }: { isOpen: boolean, onClose: () => void, user: User, onUpdateUser: (d: Partial<User>) => void }) => { const handleBuy = async () => { if (user.typoloBalance < 50) return alert("Insufficient Balance. You need 50 Coins."); const newBal = user.typoloBalance - 50; await localDB.users.update(user.uid, { typoloBalance: newBal, isPremium: true, premiumExpiry: Date.now() + (7 * 24 * 60 * 60 * 1000) }); alert("Welcome to Premium! Enjoy your exclusive features."); onUpdateUser({ typoloBalance: newBal, isPremium: true }); onClose(); }; return ( <BaseModal isOpen={isOpen} onClose={onClose} title="Premium Access" transparent><div className="p-6 text-center text-white"><div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)] mb-6 animate-pulse"><i className="fa-solid fa-crown text-4xl"></i></div><h2 className="text-2xl font-black mb-2">Unlock Ultimate Power</h2><p className="text-sm text-gray-400 mb-8">Get exclusive features for just 50 coins / week.</p><button onClick={handleBuy} className="w-full py-4 bg-white text-black font-black rounded-xl hover:scale-105 transition-transform shadow-xl">SUBSCRIBE FOR 50 <i className="fa-solid fa-coins text-yellow-600"></i></button></div></BaseModal> ); };
export const InvitesModal = ({ isOpen, onClose, user, onStartChat }: { isOpen: boolean, onClose: () => void, user: User, onStartChat?: (c:Chat)=>void }) => { const copyLink = () => { navigator.clipboard.writeText(user.inviteLink); alert('Link Copied!'); }; return ( <BaseModal isOpen={isOpen} onClose={onClose} title="Invite & Earn" transparent><div className="p-8 text-center text-white"><div className="w-24 h-24 bg-green-500/20 rounded-full mx-auto flex items-center justify-center mb-6 border border-green-500/50"><i className="fa-solid fa-user-plus text-4xl text-green-400"></i></div><h3 className="text-xl font-bold mb-2">Get 100 Free Coins</h3><p className="text-sm text-gray-400 mb-6">Send this link to your friends. When they join, you BOTH get 100 coins instantly!</p><div className="bg-black/40 p-4 rounded-xl border border-white/10 mb-6 font-mono text-xs break-all select-all">{user.inviteLink}</div><button onClick={copyLink} className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold shadow-lg transition-all">COPY LINK</button><div className="mt-4 text-xs text-gray-500 font-bold">Total Referrals: {user.referralCount || 0}</div></div></BaseModal> ); };
