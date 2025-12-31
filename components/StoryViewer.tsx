
import React, { useState, useEffect, useRef } from 'react';
import { Story, StoryFrame } from '../types';
import { db as localDB } from '../backend';

interface Props {
  story: Story;
  onClose: () => void;
}

const StoryViewer: React.FC<Props> = ({ story, onClose }) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  // Default 5s for images, updated dynamically for video
  const [frameDuration, setFrameDuration] = useState(5000); 
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedAtRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const longPressTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentFrame = story.frames[currentFrameIndex];

  // Initialize Frame
  useEffect(() => {
    resetState();
    
    if (currentFrame.mediaType === 'video') {
        // Video logic is driven by <video> events (onTimeUpdate)
        // We force load to ensure duration is available
        if(videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch((e) => console.log("Autoplay blocked:", e));
        }
    } else {
        // Image logic driven by timer
        setFrameDuration(5000);
        startImageTimer(5000);
    }

    return () => clearTimers();
  }, [currentFrameIndex]); // Only re-run when frame changes

  const resetState = () => {
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
      isPausedRef.current = false;
      clearTimers();
  };

  const clearTimers = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const startImageTimer = (duration: number, resumeFrom: number = 0) => {
      clearTimers();
      startTimeRef.current = Date.now() - resumeFrom;
      
      timerRef.current = window.setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current;
          const nextProgress = Math.min((elapsed / duration) * 100, 100);
          setProgress(nextProgress);
          
          if (nextProgress >= 100) {
              handleNext();
          }
      }, 50); // 20fps update for smooth bar
  };

  // VIDEO EVENTS
  const onVideoTimeUpdate = () => {
      if(videoRef.current && videoRef.current.duration) {
          const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
          setProgress(p);
      }
  };

  const onVideoEnded = () => {
      handleNext();
  };

  const handleNext = () => { 
      clearTimers();
      if (currentFrameIndex < story.frames.length - 1) {
          setCurrentFrameIndex(prev => prev + 1); 
      } else {
          onClose(); 
      }
  };
  
  const handlePrev = () => { 
      clearTimers();
      if (currentFrameIndex > 0) {
          setCurrentFrameIndex(prev => prev - 1); 
      } else {
          // Restart first frame
          setProgress(0);
          startTimeRef.current = Date.now();
          if (currentFrame.mediaType !== 'video') startImageTimer(5000);
          if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play();
          }
      }
  };

  const handleTouchStart = () => {
      // PAUSE logic
      isPausedRef.current = true;
      clearTimers();

      if (currentFrame.mediaType === 'video' && videoRef.current) {
          videoRef.current.pause();
      } else {
          pausedAtRef.current = Date.now() - startTimeRef.current;
      }
      
      // Long press for deletion check
      longPressTimer.current = window.setTimeout(async () => {
          if(confirm("Delete this story?")) {
              await localDB.stories.delete(story.id);
              onClose();
          }
      }, 800);
  };

  const handleTouchEnd = () => {
      // RESUME logic
      isPausedRef.current = false;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);

      if (currentFrame.mediaType === 'video' && videoRef.current) {
          videoRef.current.play().catch(() => {});
      } else {
          startImageTimer(frameDuration, pausedAtRef.current);
      }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-fade-in rtl" dir="rtl" 
         onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onMouseDown={handleTouchStart} onMouseUp={handleTouchEnd}>
      
      {/* FULL SCREEN MEDIA LAYER */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          {currentFrame.mediaType === 'video' ? (
              <video 
                  ref={videoRef}
                  src={currentFrame.image} 
                  className="w-full h-full object-contain" 
                  playsInline 
                  autoPlay
                  onTimeUpdate={onVideoTimeUpdate}
                  onEnded={onVideoEnded}
              />
          ) : (
              <img src={currentFrame.image} className="w-full h-full object-contain" alt="" />
          )}
          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none"></div>
      </div>

      {/* Progress Bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-[1010] safe-area-top">
        {story.frames.map((_, idx) => (
          <div key={idx} className="h-[2px] flex-1 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: idx < currentFrameIndex ? '100%' : idx === currentFrameIndex ? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>

      {/* Header Info */}
      <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-[1010] text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-white/50 overflow-hidden bg-black/20 flex items-center justify-center backdrop-blur-md">
             <img src={story.avatar} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col text-left drop-shadow-md">
            <div className="font-bold text-sm leading-tight">{story.username}</div>
            <div className="text-[10px] opacity-80">{new Date(story.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-10 h-10 flex items-center justify-center text-2xl active:scale-90 drop-shadow-lg z-[1020]"><i className="fa-solid fa-xmark"></i></button>
      </div>

      {/* Footer Content */}
      <div className="absolute bottom-10 left-0 right-0 z-10 px-6 text-center pointer-events-none">
          {currentFrame.title && <h2 className="text-2xl font-black text-white mb-2 drop-shadow-lg">{currentFrame.title}</h2>}
          {currentFrame.description && <p className="text-sm text-white/90 font-medium leading-relaxed drop-shadow-md bg-black/20 p-2 rounded-xl backdrop-blur-sm inline-block">{currentFrame.description}</p>}
      </div>

      {/* Tappable Areas (Left/Right) */}
      <div className="absolute inset-0 z-[1005] flex">
        <div className="flex-1 h-full" onClick={(e) => { if(!isPausedRef.current) handlePrev(); }} />
        <div className="flex-1 h-full" onClick={(e) => { if(!isPausedRef.current) handleNext(); }} />
      </div>
    </div>
  );
};

export default StoryViewer;
