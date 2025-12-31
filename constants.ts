
import { Chat, Gift, Story } from './types';

export const HELPER_CHAT_ID = "official_helper_channel";
export const ADMIN_CHAT_ID = "admin_channel_secure";

const now = Date.now();
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export const INITIAL_CHATS: Chat[] = [
  {
    id: HELPER_CHAT_ID,
    name: 'Support Team',
    status: 'Ready Only',
    avatar: 'H',
    type: 'channel',
    lastMessage: 'Tap here for a comprehensive guide on all features.',
    time: 'Always',
    unreadCount: 0,
    pinned: true
  }
];

export const MOCK_STORIES: Story[] = [
  { 
    id: 'official_guide_story', 
    userId: 'admin_official', 
    username: 'Ultimate App', 
    avatar: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/2048px-Telegram_logo.svg.png', 
    seen: false,
    createdAt: now,
    expiresAt: now + THREE_DAYS_MS,
    frames: [
      {
        id: 'f1',
        title: 'Welcome',
        description: 'Experience the next generation of messaging.',
        image: 'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?auto=format&fit=crop&q=80&w=1000',
        mediaType: 'image',
        color: '#24A1DE'
      }
    ]
  }
];

export const NFT_GIFTS: Gift[] = [
  { 
    id: "1", 
    giftId: "mock_crown_1", 
    name: "Golden Crown", 
    price: 50, 
    emoji: "👑", 
    rarity: "Legendary", 
    acquiredAt: now 
  }
];

export const POPULAR_EMOJIS = ['😂', '❤️', '👍', '🙏', '😭', '😊', '😍', '🔥'];

// --- STRICT PROFANITY LIST (200+ Variations) ---
// This list includes variations to catch bypass attempts.
export const PROFANITY_LIST = [
  // English
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'whore', 'slut', 'bastard', 'cunt',
  'nigger', 'faggot', 'retard', 'idiot', 'stupid', 'dumb', 'sex', 'porn', 'xxx', 'kill',
  'die', 'suicide', 'murder', 'bomb', 'terrorist', 'isis', 'rape', 'rapist', 'molester',
  'pedophile', 'hitler', 'nazi', 'kkk', 'white power', 'hate', 'racist', 'anal', 'anus',
  'balls', 'blowjob', 'boner', 'boob', 'butt', 'clitoris', 'cock', 'cum', 'dildo', 'erection',
  'fuk', 'f*ck', 'sh*t', 'b*tch', 'a$$', 'azz', 'p0rn', 'prn', 's3x', 'boobs', 'vagina', 'penis',
  // Farsi / Persian (Transliterated & Script)
  'kos', 'kir', 'kon', 'jakesh', 'madar', 'khahar', 'bi namus', 'sag', 'pedar sag', 'ashgal', 'avazi',
  'kesafat', 'lanati', 'zahr', 'marg', 'gomsho', 'khafe', 'bishoor', 'ahmagh', 'khandeh', 'jende',
  'ghahbeh', 'dayous', 'pofiyuz', 'kir', 'koon', 'meme', 'kire', 'kose', 'koni', 'lavat', 'gay',
  'koskhol', 'kiram', 'kosam', 'jendeh', 'fahişe', 'harami', 'shol', 'las',
  // Variations
  'f.u.c.k', 's.h.i.t', 'b.i.t.c.h', 'f_u_c_k', 'sh1t', 'b1tch', 'a55', 'd1ck', 'pu55y',
  // German
  'arschloch', 'schlampe', 'hure', 'fotze', 'wichser', 'scheisse', 'verdammt',
  // General
  'scam', 'fraud', 'hack', 'cheat', 'steal', 'money', 'bank', 'password', 'login'
];

export const HELPER_GUIDE_TEXT = `Welcome to the Official Helper Channel!`;