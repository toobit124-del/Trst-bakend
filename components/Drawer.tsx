
import React, { useState, useEffect, useContext } from 'react';
import { User } from '../types';
import { auth, db as localDB } from '../backend';
import { PrivacyModal, BugReportModal, FaceIDModal, PremiumModal } from './Modals';
import { LangContext } from '../App';

interface Props {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onProfileClick: () => void;
  onGiftsClick: () => void;
  onInvitesClick: () => void;
  onContactsClick: () => void;
  onAdminClick: () => void;
  themeEffect: 'snow' | 'autumn' | 'none';
  onToggleTheme: (mode: 'snow' | 'autumn' | 'none') => void;
  onLanguageChange: (lang: string) => void;
  onUpdateUser: (data: Partial<User>) => void;
}

const Drawer: React.FC<Props> = ({ user, isOpen, onClose, onLogout, onProfileClick, onGiftsClick, onInvitesClick, onContactsClick, onAdminClick, themeEffect, onToggleTheme, onLanguageChange, onUpdateUser }) => {
  const [showAccounts, setShowAccounts] = useState(false);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isFaceIDOpen, setIsFaceIDOpen] = useState(false);
  const [isPremiumOpen, setIsPremiumOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  
  const { t, lang } = useContext(LangContext);

  useEffect(() => {
      if(isOpen) auth.getAccounts().then(setAccounts);
  }, [isOpen]);

  const toggleLightMode = () => {
      const html = document.documentElement;
      if (html.classList.contains('light-mode')) { html.classList.remove('light-mode'); setIsLightMode(false); } 
      else { html.classList.add('light-mode'); setIsLightMode(true); }
  };

  const toggleSeason = () => {
      if(themeEffect === 'snow') onToggleTheme('autumn');
      else if(themeEffect === 'autumn') onToggleTheme('none');
      else onToggleTheme('snow');
  };

  const handleLanguageCycle = () => {
      const langs = ['en', 'fa', 'de'];
      const idx = langs.indexOf(lang);
      const nextLang = langs[(idx + 1) % langs.length];
      onLanguageChange(nextLang);
  };

  const handleUserGoLive = async () => {
      const title = prompt("Enter Broadcast Title:");
      if(title) {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              stream.getTracks().forEach(t => t.stop()); 
              await localDB.stream.start(title, user.displayName);
              alert("Stream Started! You are now LIVE.");
              onClose();
          } catch(e) {
              alert("Camera permission required to stream.");
          }
      }
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/85 backdrop-blur-lg z-[150] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      
      <div className={`fixed top-0 left-0 h-full w-[310px] bg-[var(--winter-bg)] z-[160] transition-transform duration-500 ease-out transform shadow-2xl flex flex-col border-r border-[var(--border-color)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} dir="ltr">
        <div className="thick-snow relative p-6 bg-gradient-to-br from-[#1c2833] to-[#0b141d] border-b border-[var(--border-color)] overflow-hidden">
          <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div className="relative group cursor-pointer" onClick={onProfileClick}>
                    <div className={`w-16 h-16 aspect-square rounded-full p-[2px] shadow-2xl ${user.isPremium ? 'bg-gradient-to-tr from-purple-500 to-pink-500 animate-spin-slow' : 'bg-gradient-to-tr from-[#24A1DE] to-[#00e5ff]'}`}>
                        <div className="avatar-frame w-full h-full rounded-full border-2 border-[#0b141d]">
                        <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full object-cover"/>
                        </div>
                    </div>
                    {user.isPremium && <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0b141d]"><i className="fa-solid fa-star text-[10px]"></i></div>}
                </div>
                <button onClick={() => setShowAccounts(!showAccounts)} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"><i className={`fa-solid fa-chevron-${showAccounts ? 'up' : 'down'} text-xs`}></i></button>
            </div>
            
            <div className={`text-white w-full cursor-pointer ${lang === 'fa' ? 'text-right' : 'text-left'}`} onClick={onProfileClick}>
              <h4 className="text-lg font-black truncate text-white flex items-center gap-2">
                  {user.displayName || user.username}
                  {user.isPremium && <i className="fa-solid fa-crown text-yellow-400 text-xs"></i>}
              </h4>
              <p className="text-[11px] text-blue-400 font-mono tracking-wider mt-1">@{user.username}</p>
            </div>
          </div>
        </div>

        {showAccounts && (
            <div className="bg-[#151b24] p-2 animate-slide-in">
                {accounts.filter(u => u.uid !== user.uid).map(acc => (
                    <div key={acc.uid} onClick={() => auth.switchAccount(acc.uid)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer">
                        <img src={acc.avatar} className="w-8 h-8 rounded-full" />
                        <div className="flex-1 text-right text-xs font-bold text-white">{acc.displayName}</div>
                    </div>
                ))}
                {accounts.length < 3 && (
                    <div onClick={onLogout} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer text-blue-400">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><i className="fa-solid fa-plus"></i></div>
                        <div className="text-xs font-bold">Add Account</div>
                    </div>
                )}
            </div>
        )}

        <div className="flex-1 py-4 px-3 overflow-y-auto hide-scrollbar text-[var(--text-primary)]">
          <div className="space-y-4">
            
            {/* SPECIAL "TEST" USER BUTTON */}
            {user.username === 'test' && (
                <div onClick={handleUserGoLive} className="w-full flex items-center gap-4 px-6 py-4 bg-red-600 text-white font-black rounded-[20px] shadow-lg transition-all active:scale-95 group mb-4 cursor-pointer animate-pulse-slow">
                    <i className="fa-solid fa-video text-xl"></i>
                    <span>GO LIVE</span>
                </div>
            )}

            {!user.isPremium && (
                 <div onClick={() => setIsPremiumOpen(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-[20px] p-3 mb-4 cursor-pointer relative overflow-hidden group">
                     <div className="relative z-10 flex items-center gap-3">
                         <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-crown text-white"></i></div>
                         <div className="text-white">
                             <div className="font-bold text-sm">Upgrade to Premium</div>
                             <div className="text-[10px] opacity-80">Unlock exclusive features</div>
                         </div>
                     </div>
                 </div>
            )}

            <div className="bg-[var(--input-bg)] rounded-[20px] p-2 border border-[var(--border-color)]">
                <CoolDrawerItem icon="fa-user-ninja" color="text-blue-400" text={t('profile')} onClick={onProfileClick} align={lang === 'fa' ? 'right' : 'left'} />
                <CoolDrawerItem icon="fa-gift" color="text-pink-400" text={t('gift_shop')} badge="HOT" onClick={onGiftsClick} align={lang === 'fa' ? 'right' : 'left'} />
                <CoolDrawerItem icon="fa-user-group" color="text-green-400" text={t('invites')} onClick={onInvitesClick} align={lang === 'fa' ? 'right' : 'left'} />
            </div>

            <div className="bg-[var(--input-bg)] rounded-[20px] p-2 border border-[var(--border-color)]">
                <CoolDrawerItem icon="fa-shield-cat" color="text-emerald-400" text={t('privacy')} onClick={() => setIsPrivacyOpen(true)} align={lang === 'fa' ? 'right' : 'left'} />
                <CoolDrawerItem icon="fa-bug" color="text-orange-400" text={t('bug_report')} onClick={() => setIsBugReportOpen(true)} align={lang === 'fa' ? 'right' : 'left'} />
                <CoolDrawerItem icon="fa-face-viewfinder" color="text-purple-400" text={t('face_id')} onClick={() => setIsFaceIDOpen(true)} align={lang === 'fa' ? 'right' : 'left'} />

                <div onClick={toggleSeason} className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group">
                  <div className={`w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm ${themeEffect === 'autumn' ? 'text-orange-500' : 'text-blue-300'}`}>
                    <i className={`fa-solid ${themeEffect === 'autumn' ? 'fa-leaf' : (themeEffect === 'snow' ? 'fa-snowflake' : 'fa-ban')}`}></i>
                  </div>
                  <span className={`flex-1 text-[13px] font-bold text-[var(--text-primary)] ${lang === 'fa' ? 'text-right' : 'text-left'}`}>{themeEffect === 'autumn' ? t('autumn') : (themeEffect === 'snow' ? t('snow') : 'No Effects')}</span>
                </div>

                <div onClick={toggleLightMode} className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm text-yellow-400">
                    <i className={`fa-solid ${isLightMode ? 'fa-sun' : 'fa-moon'}`}></i>
                  </div>
                  <span className={`flex-1 text-[13px] font-bold text-[var(--text-primary)] ${lang === 'fa' ? 'text-right' : 'text-left'}`}>{t('theme')}</span>
                </div>

                <div onClick={handleLanguageCycle} className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm text-gray-400">
                    <i className="fa-solid fa-language"></i>
                  </div>
                  <span className={`flex-1 text-[13px] font-bold text-[var(--text-primary)] ${lang === 'fa' ? 'text-right' : 'text-left'}`}>{lang.toUpperCase()}</span>
                </div>
            </div>

            {user.isAdmin && (
              <div className="bg-[var(--input-bg)] rounded-[20px] p-2 border border-red-500/10">
                   <CoolDrawerItem icon="fa-shield-halved" color="text-red-400" text="Admin Console" onClick={onAdminClick} align={lang === 'fa' ? 'right' : 'left'} />
              </div>
            )}

            <button onClick={onLogout} className="w-full flex items-center gap-4 px-6 py-4 bg-red-500/10 text-red-400 font-bold rounded-[20px] border border-red-500/10 transition-all active:scale-95 group">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform"><i className="fa-solid fa-power-off"></i></div>
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
        <div className="p-6 text-center text-gray-500 text-[9px] font-black tracking-[0.3em] uppercase border-t border-[var(--border-color)]">Ultimate Messenger • V5.0</div>
      </div>
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} user={user} onUpdateUser={onUpdateUser} />
      <FaceIDModal isOpen={isFaceIDOpen} onClose={() => setIsFaceIDOpen(false)} user={user} onUpdateUser={onUpdateUser} />
      <PremiumModal isOpen={isPremiumOpen} onClose={() => setIsPremiumOpen(false)} user={user} onUpdateUser={onUpdateUser} />
    </>
  );
};

const CoolDrawerItem = ({ icon, color, text, badge, onClick, align }: { icon: string, color: string, text: string, badge?: string, onClick?: () => void, align: string }) => (
  <div onClick={(e) => { e.stopPropagation(); onClick?.(); }} className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group">
    <div className={`w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg shadow-sm ${color}`}><i className={`fa-solid ${icon}`}></i></div>
    <span className={`flex-1 text-[13px] font-bold text-[var(--text-primary)] text-${align}`}>{text}</span>
    {badge && <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg">{badge}</span>}
  </div>
);

export default Drawer;
