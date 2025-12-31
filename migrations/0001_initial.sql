-- Initial migration for Ultimate Messenger

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  is_verified BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  typolo_balance INTEGER DEFAULT 0,
  referral_count INTEGER DEFAULT 0,
  inviter_uid TEXT
);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chats table
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'private', 'group', 'channel'
  name TEXT,
  avatar TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  admin_ids TEXT -- JSON array of admin user IDs
);

-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT,
  media_type TEXT,
  media_url TEXT,
  timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Calls table
CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'audio', 'video'
  status TEXT NOT NULL, -- 'ringing', 'connected', 'ended'
  started_at INTEGER,
  ended_at INTEGER,
  FOREIGN KEY (caller_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- Gifts table
CREATE TABLE gifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  price INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  description TEXT,
  gradient TEXT,
  effect TEXT
);

-- User gifts (transactions)
CREATE TABLE user_gifts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (gift_id) REFERENCES gifts(id)
);

-- Insert default admin user
INSERT INTO users (id, username, display_name, password, is_admin, typolo_balance) 
VALUES ('admin_official', 'admin', 'System Admin', 'Password@123', TRUE, 999999);

-- Insert default gifts
INSERT INTO gifts (id, name, emoji, price, rarity, description, gradient, effect) VALUES
('gift_star_lord', 'Nebula Star', '🌟', 500, 'Legendary', 'The brightest star in the galaxy.', 'from-[#FFD700] to-[#FFA500]', 'animate-pulse shadow-[0_0_30px_rgba(255,215,0,0.6)]'),
('gift_violet_nova', 'Violet Nova', '⚛️', 350, 'Epic', 'A rare cosmic event.', 'from-[#8A2BE2] to-[#FF00FF]', 'shadow-[0_0_20px_rgba(138,43,226,0.5)]'),
('gift_cyber_heart', 'Cyber Heart', '💖', 200, 'Rare', 'Digital love.', 'from-[#FF1493] to-[#FF69B4]', NULL),
('gift_blue_comet', 'Blue Comet', '☄️', 150, 'Common', 'Fast and cool.', 'from-[#00BFFF] to-[#1E90FF]', NULL);