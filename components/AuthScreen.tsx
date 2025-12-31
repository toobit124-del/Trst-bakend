
import React, { useState, useRef, useEffect } from 'react';
import { db as localDB, auth } from '../backend';
import { api } from '../api';
import { User } from '../types';
import { faceAuthService } from '../FaceAuthService';

interface Props {
  onLogin: (user: any) => void;
  onAdminLogin: () => void;
}

const AuthScreen: React.FC<Props> = ({ onLogin, onAdminLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Real Face ID States
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'idle' | 'loading_models' | 'scanning' | 'liveness_check' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
      // Check for Invite Code
      const urlParams = new URLSearchParams(window.location.search);
      const inviteParam = urlParams.get('invite');
      if (inviteParam) {
          setInviteCode(inviteParam);
          setMode('signup'); // Auto switch to signup if invited
      }

      // Preload models silently
      faceAuthService.loadModels().catch(console.error);
      return () => {
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      };
  }, []);

  const validateInputs = () => {
      // Username: Min 6 chars, letters + numbers required
      const userRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
      if (!userRegex.test(username)) {
          return "Username must be 6+ chars and contain both letters and numbers.";
      }

      // Password: Min 8 chars, letters + numbers + special char
      const passRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
      // Allow admin bypass for legacy/demo purposes strictly for 'admin' user
      if (username === 'admin') return null;

      if (!passRegex.test(password)) {
          return "Password must be 8+ chars with letters, numbers, and symbols (!@#$%^&*).";
      }
      return null;
  };

  const handleAction = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      const normalizedUsername = username.toLowerCase().trim();
      const inputPass = password.trim();

      // Legacy Admin Check
      if (normalizedUsername === 'admin' && (inputPass === 'Password@123' || inputPass === '110011')) {
        setLoading(false);
        onAdminLogin();
        return;
      }

      // Strict Validation
      if (mode === 'signup') {
          const validationError = validateInputs();
          if (validationError) throw new Error(validationError);
      }
      
      if (mode === 'signup') {
        // Create user via API
        await api.createUser({
          username: normalizedUsername,
          displayName: displayName.trim() || normalizedUsername,
          password: inputPass,
          inviterUid: inviteCode || undefined
        });

        // Then login
        const loginResponse = await api.login(normalizedUsername, inputPass);
        const user = loginResponse.user;

        const fullUser: User = {
          uid: user.id,
          numericId: Date.now(),
          username: user.username,
          password: inputPass,
          displayName: user.displayName,
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalizedUsername}`,
          typoloBalance: 100,
          gifts: [],
          isAdmin: user.isAdmin,
          referralCount: 0,
          inviteLink: `${window.location.origin}?invite=${user.id}`,
          inviterUid: inviteCode || undefined,
          presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
          privacy: { inactivityMonths: 6, lastSeen: 'everybody', forwarding: 'everybody' },
          joinedChannels: [], archivedChats: [], sessions: [], blockedUsers: [], contacts: []
        };

        auth.login(fullUser);
        onLogin(fullUser);
      } else {
        // Login via API
        const loginResponse = await api.login(normalizedUsername, inputPass);
        const user = loginResponse.user;

        const fullUser: User = {
          uid: user.id,
          numericId: Date.now(),
          username: user.username,
          password: inputPass,
          displayName: user.displayName,
          avatar: user.avatar,
          typoloBalance: 0, // Will be fetched from backend
          gifts: [],
          isAdmin: user.isAdmin,
          referralCount: 0,
          inviteLink: '',
          presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
          privacy: { inactivityMonths: 6, lastSeen: 'everybody', forwarding: 'everybody' },
          joinedChannels: [], archivedChats: [], sessions: [], blockedUsers: [], contacts: []
        };

        auth.login(fullUser);
        onLogin(fullUser);
      }
    } catch (e: any) { setError(e.message || 'Error occurred'); } finally { setLoading(false); }
  };

  const startFaceLogin = async () => {
      setFaceStatus('loading_models');
      setFaceScanning(true);
      setStatusMessage("Initializing Neural Engine...");

      try {
          await faceAuthService.loadModels();
          setStatusMessage("Starting Camera...");

          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
          streamRef.current = stream;
          
          if(videoRef.current) {
              videoRef.current.srcObject = stream;
              await new Promise(r => videoRef.current!.onloadedmetadata = r);
              await videoRef.current.play();
          }

          setFaceStatus('scanning');
          setStatusMessage("Scanning...");

          await new Promise(r => setTimeout(r, 400));

          const allUsers = await localDB.users.getAll();
          
          let attempts = 0;
          const maxAttempts = 60; // 6 seconds timeout
          
          const scanLoop = setInterval(async () => {
             attempts++;
             if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

             try {
                 const matchedUser = await faceAuthService.findUserByFace(videoRef.current, allUsers);
                 
                 if (matchedUser) {
                     clearInterval(scanLoop);
                     setFaceStatus('success');
                     setStatusMessage(`Verified: ${matchedUser.displayName}`);
                     auth.login(matchedUser);
                     onLogin(matchedUser);
                     if(streamRef.current) {
                         streamRef.current.getTracks().forEach(t => t.stop());
                         streamRef.current = null;
                     }
                 } else {
                     if (attempts > maxAttempts) {
                         clearInterval(scanLoop);
                         setFaceStatus('failed');
                         setStatusMessage("Face not recognized.");
                         setTimeout(() => stopCamera(), 2000);
                     }
                 }
             } catch (e) { }
          }, 100);

      } catch (err) { 
          setFaceScanning(false);
          setFaceStatus('failed');
          alert("Camera/Model Error: " + err); 
      }
  };

  const stopCamera = () => {
      if(streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
      }
      setFaceScanning(false);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center z-[500] font-sans rtl" dir="rtl">
      <div className="w-full h-1 bg-[#24A1DE]"></div>
      <div className="w-full max-w-sm px-8 mt-12 overflow-y-auto hide-scrollbar">
        <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#24A1DE] rounded-[24px] flex items-center justify-center shadow-xl -rotate-6">
                <i className="fa-solid fa-paper-plane text-white text-4xl"></i>
            </div>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2 text-center">{mode === 'login' ? 'ورود' : 'ثبت نام'}</h2>
        
        {inviteCode && (
            <div className="mb-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-center font-bold text-xs">
                You have been invited! +100 Coins Bonus
            </div>
        )}

        <div className="space-y-4 mt-8">
          {mode === 'signup' && ( <input className="w-full py-3 bg-gray-50 px-4 rounded-xl outline-none focus:ring-1 ring-blue-500 text-right" placeholder="نام نمایشی" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /> )}
          <input className="w-full py-3 bg-gray-50 px-4 rounded-xl outline-none focus:ring-1 ring-blue-500 text-right" placeholder="نام کاربری (حروف و اعداد)" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
          <input type="password" className="w-full py-3 bg-gray-50 px-4 rounded-xl outline-none focus:ring-1 ring-blue-500 text-right" placeholder="رمز عبور (8+ حرف، عدد، نماد)" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-red-500 text-xs font-bold text-center">{error}</div>}
          
          <button onClick={handleAction} className="w-full py-4 bg-[#24A1DE] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all">{loading ? '...' : (mode === 'login' ? 'ورود' : 'ثبت نام')}</button>
          
          {mode === 'login' && (
              <div className="relative">
                  {faceScanning ? (
                      <div className={`w-full h-64 rounded-xl overflow-hidden relative border-4 shadow-xl bg-black ${faceStatus === 'success' ? 'border-green-500' : (faceStatus === 'failed' ? 'border-red-500' : 'border-blue-500')}`}>
                          <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" playsInline autoPlay muted />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className={`w-40 h-56 border-2 rounded-[50%] relative ${faceStatus === 'scanning' ? 'border-blue-400 opacity-50' : 'border-transparent'}`}>
                                  {faceStatus === 'scanning' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/80 shadow-[0_0_15px_#3b82f6] animate-scan-line"></div>}
                              </div>
                          </div>
                          <div className="absolute bottom-0 w-full text-center text-white text-xs font-bold bg-black/70 py-2 px-2">
                              {statusMessage}
                          </div>
                      </div>
                  ) : (
                      <button onClick={startFaceLogin} className={`w-full py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg relative bg-black`}>
                          <i className="fa-solid fa-face-viewfinder text-xl"></i>
                          <span>Secure Face Login</span>
                      </button>
                  )}
              </div>
          )}

          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full py-2 text-[#24A1DE] font-bold text-sm text-center">{mode === 'login' ? 'حساب ندارید؟ بسازید' : 'اکانت دارید؟ وارد شوید'}</button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
