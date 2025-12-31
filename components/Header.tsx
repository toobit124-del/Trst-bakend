
import React, { useState, useRef, useEffect } from 'react';
import { Story } from '../types';

interface Props {
  onMenuClick: () => void;
  isSearching: boolean;
  setIsSearching: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  activeTab: string;
  setActiveTab: (val: string) => void;
  stories: Story[];
  onStoryClick: (story: Story) => void;
  onAddStory: (file: File) => void; 
  onGlobalAction: (action: string) => void;
  uploadProgress: number | null; // Receive progress
}

const Header: React.FC<Props> = ({ 
  onMenuClick, 
  isSearching, 
  setIsSearching, 
  searchQuery, 
  setSearchQuery, 
  activeTab, 
  setActiveTab,
  stories,
  onStoryClick,
  onAddStory,
  onGlobalAction,
  uploadProgress
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabs = ['All', 'Private', 'Groups', 'Channels'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (act: string) => {
    setShowDropdown(false);
    onGlobalAction(act);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onAddStory(file);
      // Reset input so same file can be selected again if needed
      e.target.value = ''; 
    }
  };

  return (
    <div className="bg-[#15202b]/95 backdrop-blur-3xl text-white shadow-2xl z-[60] flex flex-col border-b border-white/10 relative header-snow-container">
      {/* Hidden File Input (Updated to accept Video) */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        onChange={handleFileChange} 
      />

      <div className="h-14 px-4 flex items-center justify-between relative z-20">
        {!isSearching ? (
          <>
            <button onClick={onMenuClick} className="w-10 h-10 flex items-center justify-center text-xl active:scale-90 transition-transform">
              <i className="fa-solid fa-bars text-blue-300"></i>
            </button>
            
            {/* Dynamic Title / Progress Indicator - SHOW ONLY IF UPLOADING */}
            {uploadProgress !== null ? (
               <div className="flex-1 px-4 flex flex-col items-center justify-center gap-1 animate-fade-in">
                   <div className="flex w-full items-center justify-between text-[10px] font-bold text-[#24A1DE]">
                       <span>Uploading Story...</span>
                       <span>{Math.round(uploadProgress)}%</span>
                   </div>
                   <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                       <div className="bg-[#24A1DE] h-full transition-all duration-200 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                   </div>
               </div>
            ) : (
               <h1 className="flex-1 px-4 text-[16px] font-black tracking-tight text-left uppercase text-blue-50">Ultimate Messenger</h1>
            )}
            
            <div className="flex items-center gap-1">
              <button onClick={() => setIsSearching(true)} className="w-10 h-10 flex items-center justify-center text-lg active:scale-90 transition-transform">
                <i className="fa-solid fa-magnifying-glass text-blue-300"></i>
              </button>
              
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setShowDropdown(!showDropdown)} className="w-10 h-10 flex items-center justify-center text-lg active:scale-90 transition-transform">
                  <i className="fa-solid fa-ellipsis-vertical text-blue-300"></i>
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#1c2833] rounded-2xl shadow-2xl py-2 z-[100] border border-white/10 animate-fade-in text-gray-200">
                    <button onClick={() => handleAction('invite')} className="w-full px-5 py-3 text-left hover:bg-white/5 flex items-center gap-4 text-[13px] font-bold">
                      <i className="fa-solid fa-link text-[#24A1DE] w-5"></i> کپی لینک دعوت
                    </button>
                    <button onClick={() => handleAction('background')} className="w-full px-5 py-3 text-left hover:bg-white/5 flex items-center gap-4 text-[13px] font-bold">
                      <i className="fa-solid fa-image text-[#24A1DE] w-5"></i> پس‌زمینه گفتگوها
                    </button>
                    <div className="h-[1px] bg-white/5 my-1"></div>
                    <button onClick={() => handleAction('profile')} className="w-full px-5 py-3 text-left hover:bg-white/5 flex items-center gap-4 text-[13px] font-bold">
                      <i className="fa-solid fa-user-gear text-[#24A1DE] w-5"></i> تنظیمات حساب
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-3 animate-fade-in">
            <button onClick={() => setIsSearching(false)} className="w-10 h-10 flex items-center justify-center">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <input 
              autoFocus
              className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-blue-300/50 outline-none text-left font-bold"
              placeholder="❄️ Search @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {!isSearching && (
        <div className="flex gap-4 px-4 py-3 overflow-x-auto hide-scrollbar relative z-20">
          <div className="flex flex-col items-center gap-2 min-w-[62px]">
            {/* Add Story Button - Disabled during upload */}
            <div 
              onClick={() => { if(uploadProgress === null) fileInputRef.current?.click(); }} 
              className={`w-[60px] h-[60px] rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                  uploadProgress !== null 
                  ? 'bg-gray-800 border-gray-600 cursor-not-allowed opacity-50' 
                  : 'border-white/20 hover:bg-white/10 cursor-pointer active:scale-95'
              }`}
            >
              {uploadProgress !== null ? (
                  <i className="fa-solid fa-spinner fa-spin text-white"></i>
              ) : (
                  <i className="fa-solid fa-plus text-blue-300"></i>
              )}
            </div>
            <span className="text-[10px] text-blue-200/60 font-black">{uploadProgress !== null ? 'Wait...' : 'Add Story'}</span>
          </div>
          
          {stories.map(story => {
            // Grouped Ring Logic
            const frameCount = story.frames.length;
            // Create a Segmented SVG Ring
            const radius = 28;
            const circumference = 2 * Math.PI * radius;
            const gap = frameCount > 1 ? 4 : 0;
            const segmentLength = (circumference / frameCount) - gap;

            return (
                <div key={story.id} className="flex flex-col items-center gap-2 min-w-[62px] relative" onClick={() => onStoryClick(story)}>
                  <div className="w-[60px] h-[60px] relative cursor-pointer active:scale-95 transition-transform">
                    {/* Segmented Ring SVG */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 60 60">
                        {Array.from({ length: frameCount }).map((_, i) => (
                            <circle
                                key={i}
                                cx="30"
                                cy="30"
                                r={radius}
                                fill="transparent"
                                stroke={story.seen ? "#6b7280" : "#24A1DE"} 
                                strokeWidth="2"
                                strokeDasharray={`${segmentLength} ${gap}`}
                                strokeDashoffset={-(segmentLength + gap) * i}
                                strokeLinecap="round"
                            />
                        ))}
                    </svg>
                    
                    <div className="absolute inset-[3px] rounded-full overflow-hidden bg-[#0b141d] border border-[#0b141d]">
                      <img src={story.avatar} alt={story.username} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="text-[10px] text-white/80 font-bold truncate w-full text-center max-w-[60px]">{story.username}</span>
                </div>
            );
          })}
        </div>
      )}

      {/* Tabs Area */}
      <div className="flex gap-3 px-4 pb-6 pt-1 overflow-x-auto hide-scrollbar relative z-20">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-[12px] font-black transition-all whitespace-nowrap border ${
              activeTab === tab ? 'bg-white/15 text-blue-300 border-blue-400/30 shadow-lg' : 'bg-transparent text-white/40 border-transparent hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      
      {/* Pinned Snowy Divider */}
      <div className="ultra-thick-snow-line"></div>
    </div>
  );
};

export default Header;
