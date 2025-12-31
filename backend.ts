import { User, Chat, Message, Story, AdConfig, CallSession, LiveStream, StreamMessage, Report, SystemAlert, ChatSnapshot } from './types';
import { api } from './api';

// API Response types
interface ApiResponse<T = any> {
  error?: string;
  [key: string]: any;
}

interface AuthResponse extends ApiResponse {
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isAdmin: boolean;
    isBanned: boolean;
    isVerified: boolean;
  };
}

interface UsersResponse extends ApiResponse {
  users?: any[];
}

interface ChatsResponse extends ApiResponse {
  chats?: any[];
}

interface MessagesResponse extends ApiResponse {
  messages?: any[];
}

interface StoriesResponse extends ApiResponse {
  stories?: any[];
}

// Mock data for initial chats (will be moved to backend later)
const INITIAL_CHATS: Chat[] = [
  {
    id: 'channel_global',
    name: 'Global Chat',
    status: 'Active',
    avatar: '',
    type: 'channel',
    lastMessage: 'Welcome to Ultimate Messenger!',
    lastMessageTime: Date.now(),
    unreadCount: 0
  }
];

const MOCK_STORIES: Story[] = [
  {
    id: 'mock_story_1',
    userId: 'admin_official',
    username: 'admin',
    avatar: '',
    frames: [{
      id: 'frame_1',
      title: 'Welcome',
      description: 'Welcome to Ultimate Messenger',
      image: '',
      mediaType: 'image',
      color: '#007bff'
    }],
    seen: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  }
];

const triggerUpdate = () => { window.dispatchEvent(new Event('server-update')); };

export const auth = {
  currentUser: null as User | null,
  onAuthStateChanged: (cb: (user: User | null) => void) => {
    const checkAuth = async () => {
      try {
        const response: AuthResponse = await api.getCurrentUser();
        const user = response.user;
        if (user) {
          auth.currentUser = {
            uid: user.id,
            numericId: 1, // Will be added to backend
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            typoloBalance: 0, // Will be added
            gifts: [],
            joinedChannels: [],
            archivedChats: [],
            isAdmin: user.isAdmin,
            isBanned: user.isBanned,
            presence: { isOnline: true, lastSeen: Date.now(), statusHidden: false },
            sessions: [],
            blockedUsers: [],
            contacts: [],
            inviteLink: '',
            referralCount: 0,
            privacy: { inactivityMonths: 12, lastSeen: 'everybody', forwarding: 'everybody' }
          };
        } else {
          auth.currentUser = null;
        }
        cb(auth.currentUser);
      } catch (error) {
        auth.currentUser = null;
        cb(null);
      }
    };

    checkAuth();
    const interval = setInterval(checkAuth, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  },
  login: async (user: User) => {
    // This will be handled by AuthScreen
    auth.currentUser = user;
    window.dispatchEvent(new Event('auth-change'));
  },
  switchAccount: (uid: string) => {
    // For now, just trigger auth change
    window.dispatchEvent(new Event('auth-change'));
  },
  getAccounts: async (): Promise<User[]> => {
    // Return current user as single account for now
    return auth.currentUser ? [auth.currentUser] : [];
  },
  logout: async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    auth.currentUser = null;
    window.dispatchEvent(new Event('auth-change'));
  }
};

export const signOut = () => { auth.logout(); };

export const db = {
  users: {
    create: async (user: User) => {
      const response: ApiResponse = await api.createUser({
        username: user.username,
        displayName: user.displayName,
        password: user.password || '',
        inviterUid: user.inviterUid
      });
      return { ...user, uid: response.userId };
    },
    get: async (uid: string) => {
      try {
        const response: ApiResponse = await api.getUser(uid);
        return response.user;
      } catch (error) {
        return null;
      }
    },
    getAll: async () => {
      const response: UsersResponse = await api.getUsers();
      return response.users;
    },
    search: async (queryStr: string) => {
      const response: UsersResponse = await api.getUsers(queryStr);
      return response.users;
    },
    update: async (uid: string, data: Partial<User>) => {
      // For now, we'll handle this in specific endpoints
      triggerUpdate();
    },
    heartbeat: async (uid: string) => {
      // Heartbeat not implemented in API yet
    },
    addBalance: async (uid: string, amount: number) => {
      // Balance updates not implemented yet
    }
  },
  chats: {
    getMyChats: async (uid: string) => {
      try {
        const response: ChatsResponse = await api.getChats();
        let chats = response.chats;

        // If no chats, return initial chats
        if (chats.length === 0) {
          chats = INITIAL_CHATS;
        }

        return chats.map((chat: any) => ({
          id: chat.id,
          name: chat.name || 'Chat',
          status: 'Active',
          avatar: chat.avatar || '',
          type: chat.type,
          lastMessage: chat.last_message,
          lastMessageTime: chat.last_message_time,
          time: 'Now',
          unreadCount: chat.unread_count || 0
        }));
      } catch (error) {
        return INITIAL_CHATS;
      }
    },
    getByGroupUsername: async (username: string) => {
      // Not implemented yet
      return null;
    },
    create: async (chat: Chat) => {
      const response: ApiResponse = await api.createChat({
        type: chat.type,
        name: chat.name,
        avatar: chat.avatar,
        participants: [] // Will be handled differently
      });
      triggerUpdate();
      return { ...chat, id: response.chatId };
    },
    update: async (chatId: string, data: Partial<Chat>) => {
      // Update not implemented yet
      triggerUpdate();
    },
    delete: async (chatId: string) => {
      // Delete not implemented yet
      triggerUpdate();
    }
  },
  messages: {
    send: async (chatId: string, message: Message) => {
      await api.sendMessage(chatId, {
        content: message.text,
        mediaType: message.mediaType,
        mediaUrl: message.mediaUrl
      });
      triggerUpdate();
    },
    delete: async (id: string) => {
      // Delete not implemented yet
      triggerUpdate();
    },
    subscribe: (chatId: string, cb: (msgs: Message[]) => void) => {
      const handler = async () => {
        try {
          const response: MessagesResponse = await api.getMessages(chatId);
          const messages = response.messages?.map((msg: any) => ({
            id: msg.id,
            senderId: msg.sender_id,
            senderName: msg.username,
            text: msg.content,
            mediaType: msg.media_type,
            mediaUrl: msg.media_url,
            type: (msg.content ? 'text' : 'media') as 'text' | 'media' | 'voice' | 'system',
            status: 'sent',
            timestamp: msg.timestamp,
            localTimestamp: msg.timestamp,
            seenBy: [],
            isDeleted: false,
            editHistory: [],
            reactions: [],
            isForwarded: false
          } as Message)) || [];
          cb(messages);
        } catch (error) {
          cb([]);
        }
      };

      handler();
      const interval = setInterval(handler, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  },
  stories: {
    get: async (viewerUid: string) => {
      try {
        const response: StoriesResponse = await api.getStories();
        return response.stories.map((story: any) => ({
          id: story.id,
          userId: story.userId,
          username: 'User', // Will be added
          avatar: '',
          frames: [{
            id: 'frame_1',
            title: 'Story',
            description: story.content || '',
            image: story.mediaUrl || '',
            mediaType: story.mediaType || 'image',
            color: '#007bff'
          }],
          seen: false,
          createdAt: story.timestamp,
          expiresAt: story.expiresAt
        }));
      } catch (error) {
        return MOCK_STORIES;
      }
    },
    add: async (story: Story) => {
      const frame = story.frames[0];
      await api.createStory({
        content: frame.description,
        mediaType: frame.mediaType,
        mediaUrl: frame.image
      });
      triggerUpdate();
    },
    delete: async (id: string) => {
      await api.deleteStory(id);
      triggerUpdate();
    }
  },
  calls: {
    initiate: async (call: CallSession) => {
      await api.createCall({
        receiverId: call.receiverId,
        callType: call.type
      });
      triggerUpdate();
    },
    updateStatus: async (callId: string, status: 'connected' | 'ended' | 'rejected') => {
      await api.updateCallStatus(callId, status);
      triggerUpdate();
    },
    setSDP: async (callId: string, type: 'offer' | 'answer', sdp: string) => {
      // SDP handling not implemented in API yet
      triggerUpdate();
    },
    addCandidate: async (callId: string, type: 'caller' | 'receiver', candidate: string) => {
      // Candidate handling not implemented yet
      triggerUpdate();
    },
    getActiveCalls: async (userId: string) => {
      // Active calls not implemented yet
      return [];
    }
  },
  stream: {
    get: async () => {
      // Stream not implemented yet
      return null;
    },
    start: async (title: string, hostId: string) => {
      // Stream not implemented yet
      triggerUpdate();
    },
    stop: async () => {
      // Stream not implemented yet
      triggerUpdate();
    },
    update: async (data: Partial<LiveStream>) => {
      // Stream not implemented yet
      triggerUpdate();
    },
    addRequest: async (user: { userId: string, username: string, avatar: string }) => {
      // Stream not implemented yet
      triggerUpdate();
    },
    removeRequest: async (userId: string) => {
      // Stream not implemented yet
      triggerUpdate();
    },
    addMessage: async (msg: StreamMessage) => {
      // Stream not implemented yet
      triggerUpdate();
    },
    setGuest: async (guestId: string | undefined, guestName: string | undefined) => {
      // Stream not implemented yet
      triggerUpdate();
    }
  },
  reports: {
    add: async (report: Report) => {
      // Reports not implemented yet
      triggerUpdate();
    },
    getAll: async () => {
      // Reports not implemented yet
      return [];
    }
  },
  ads: {
    set: async (ad: AdConfig) => {
      // Ads not implemented yet
      triggerUpdate();
    },
    getActive: async () => {
      // Ads not implemented yet
      return null;
    },
    getAll: async () => {
      // Ads not implemented yet
      return [];
    }
  },
  alerts: {
    set: async (alert: SystemAlert) => {
      // Alerts not implemented yet
      triggerUpdate();
    },
    getActive: async () => {
      // Alerts not implemented yet
      return null;
    }
  },
  snapshots: {
    add: async (snapshot: ChatSnapshot) => {
      // Snapshots not implemented yet
      triggerUpdate();
    },
    getAll: async () => {
      // Snapshots not implemented yet
      return [];
    }
  }
};