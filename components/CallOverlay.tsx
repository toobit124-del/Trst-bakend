
import React, { useState, useEffect, useRef } from 'react';
import { User, CallSession } from '../types';
import { db as localDB } from '../backend';

interface CallProps {
  user: User;
  callData: CallSession;
  onClose: () => void;
}

// REAL WEBRTC CONFIGURATION
const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const CallOverlay: React.FC<CallProps> = ({ user, callData, onClose }) => {
  const [status, setStatus] = useState<'ringing' | 'connected' | 'ending'>(callData.status as any);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [duration, setDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const durationInterval = useRef<number | null>(null);

  const isCaller = callData.callerId === user.uid;
  
  // Initialize Media
  useEffect(() => {
      const init = async () => {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                  video: callData.type === 'video'
              });
              setLocalStream(stream);
              if(localVideoRef.current) localVideoRef.current.srcObject = stream;
              
              if(isCaller) {
                  // Caller creates Offer immediately
                  createPeerConnection(stream);
                  const offer = await peerConnection.current!.createOffer();
                  await peerConnection.current!.setLocalDescription(offer);
                  await localDB.calls.setSDP(callData.id, 'offer', JSON.stringify(offer));
              }
          } catch(e) {
              console.error("Media Error:", e);
              alert("Microphone/Camera permission required.");
              onClose();
          }
      };
      init();
      return () => {
          if(peerConnection.current) peerConnection.current.close();
          if(localStream) localStream.getTracks().forEach(t => t.stop());
      };
  }, []);

  // SIGNALING LOOP
  useEffect(() => {
      const checkSignaling = async () => {
          const call = (await localDB.calls.getActiveCalls(user.uid)).find(c => c.id === callData.id);
          
          if(!call) { onClose(); return; }
          if(call.status === 'ended' || call.status === 'rejected') { onClose(); return; }
          
          // Sync status
          if(call.status === 'connected' && status === 'ringing') setStatus('connected');
          
          // HANDLE SDP EXCHANGE
          if (peerConnection.current) {
              const remoteDesc = peerConnection.current.remoteDescription;
              
              if (isCaller && call.sdpAnswer && !remoteDesc) {
                  // Caller receives Answer
                  const answer = JSON.parse(call.sdpAnswer);
                  await peerConnection.current.setRemoteDescription(answer);
              } else if (!isCaller && call.sdpOffer && !remoteDesc) {
                  // Receiver receives Offer (handled in handleAccept mainly, but check here too)
              }

              // HANDLE ICE CANDIDATES
              const myRole = isCaller ? 'caller' : 'receiver';
              const peerCandidates = isCaller ? call.receiverCandidates : call.callerCandidates;
              
              if(peerCandidates) {
                  for(const cStr of peerCandidates) {
                      // We need a mechanism to track added candidates to avoid duplicates.
                      // For simplicity in this simulated env, we try add and ignore errors.
                      try {
                          await peerConnection.current.addIceCandidate(JSON.parse(cStr));
                      } catch(e) {}
                  }
              }
          }
      };

      const interval = setInterval(checkSignaling, 1000);
      return () => clearInterval(interval);
  }, [callData.id, status, isCaller]);

  const createPeerConnection = (stream: MediaStream) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnection.current = pc;
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
          if(remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = async (event) => {
          if(event.candidate) {
              await localDB.calls.addCandidate(callData.id, isCaller ? 'caller' : 'receiver', JSON.stringify(event.candidate));
          }
      };
  };

  const handleAccept = async () => {
      if(!localStream) return;
      createPeerConnection(localStream);
      
      // Get Offer
      const call = (await localDB.calls.getActiveCalls(user.uid)).find(c => c.id === callData.id);
      if(call && call.sdpOffer) {
          await peerConnection.current!.setRemoteDescription(JSON.parse(call.sdpOffer));
          const answer = await peerConnection.current!.createAnswer();
          await peerConnection.current!.setLocalDescription(answer);
          
          await localDB.calls.setSDP(callData.id, 'answer', JSON.stringify(answer));
          await localDB.calls.updateStatus(callData.id, 'connected');
          setStatus('connected');
      }
  };

  const handleEndCall = async () => {
      setStatus('ending');
      await localDB.calls.updateStatus(callData.id, 'ended');
      setTimeout(onClose, 500);
  };

  // Timer
  useEffect(() => {
      if (status === 'connected') {
          durationInterval.current = window.setInterval(() => setDuration(d => d + 1), 1000);
      }
      return () => { if (durationInterval.current) clearInterval(durationInterval.current); }
  }, [status]);

  const formatTime = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f1115] text-white flex flex-col font-sans animate-fade-in overflow-hidden">
        
        {/* VIDEO LAYER */}
        {callData.type === 'video' && (
            <div className="absolute inset-0 z-0">
                {/* REMOTE VIDEO (FULL SCREEN) */}
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                {/* LOCAL VIDEO (PIP) */}
                <div className="absolute bottom-32 right-6 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                </div>
            </div>
        )}

        {/* AUDIO LAYER */}
        {callData.type === 'audio' && (
             <div className="absolute inset-0 z-0 bg-[#1c2833] flex items-center justify-center">
                 <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl relative">
                     <img src={isCaller ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${callData.receiverId}` : callData.callerAvatar} className="w-full h-full object-cover" />
                     {status === 'ringing' && <div className="absolute inset-0 bg-blue-500/20 animate-ping"></div>}
                 </div>
                 {/* HIDDEN VIDEOS FOR AUDIO STREAMING */}
                 <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
                 <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
             </div>
        )}

        {/* CONTROLS */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">
            <div className="mt-16 text-center">
                 <h2 className="text-3xl font-black drop-shadow-md">{isCaller ? callData.receiverId : callData.callerName}</h2>
                 <p className="text-lg opacity-80 font-bold tracking-widest">{status === 'connected' ? formatTime(duration) : (isCaller ? 'Calling...' : 'Incoming Call...')}</p>
            </div>

            <div className="mb-12 flex justify-center gap-8 pointer-events-auto">
                {status === 'ringing' && !isCaller ? (
                    <>
                        <button onClick={handleEndCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"><i className="fa-solid fa-phone-slash text-3xl"></i></button>
                        <button onClick={handleAccept} className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform animate-bounce"><i className="fa-solid fa-phone text-3xl"></i></button>
                    </>
                ) : (
                    <button onClick={handleEndCall} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"><i className="fa-solid fa-phone-slash text-3xl"></i></button>
                )}
            </div>
        </div>
    </div>
  );
};

export default CallOverlay;
