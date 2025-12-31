
export interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Artifact';
  description: string;
  gradient: string;
  effect?: string;
}

export const APP_GIFTS: GiftItem[] = [
  {
    id: 'gift_star_lord',
    name: 'Nebula Star',
    emoji: '🌟',
    price: 500,
    rarity: 'Legendary',
    description: 'The brightest star in the galaxy.',
    gradient: 'from-[#FFD700] to-[#FFA500]',
    effect: 'animate-pulse shadow-[0_0_30px_rgba(255,215,0,0.6)]'
  },
  {
    id: 'gift_violet_nova',
    name: 'Violet Nova',
    emoji: '⚛️',
    price: 350,
    rarity: 'Epic',
    description: 'A rare cosmic event.',
    gradient: 'from-[#8A2BE2] to-[#FF00FF]',
    effect: 'shadow-[0_0_20px_rgba(138,43,226,0.5)]'
  },
  {
    id: 'gift_cyber_heart',
    name: 'Cyber Heart',
    emoji: '💖',
    price: 200,
    rarity: 'Rare',
    description: 'Digital love.',
    gradient: 'from-[#FF1493] to-[#FF69B4]'
  },
  {
    id: 'gift_blue_comet',
    name: 'Blue Comet',
    emoji: '☄️',
    price: 150,
    rarity: 'Common',
    description: 'Fast and cool.',
    gradient: 'from-[#00BFFF] to-[#1E90FF]'
  },
  {
    id: 'gift_lucky_clover',
    name: 'Luck Boost',
    emoji: '🍀',
    price: 50,
    rarity: 'Common',
    description: '+10 Luck',
    gradient: 'from-[#32CD32] to-[#008000]'
  }
];
