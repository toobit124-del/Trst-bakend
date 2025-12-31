// API client for Cloudflare backend
const API_BASE = (import.meta as any).env?.PROD ? '/api' : 'http://localhost:8787/api';

interface ApiResponse<T = any> {
  error?: string;
  [key: string]: any;
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data as T;
  }

  // Auth
  async login(username: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Users
  async getUsers(search?: string) {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/users${params}`);
  }

  async getUser(userId: string) {
    return this.request(`/users/${userId}`);
  }

  async createUser(userData: { username: string; displayName: string; password: string; inviterUid?: string }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Chats
  async getChats() {
    return this.request('/chats');
  }

  async getChat(chatId: string) {
    return this.request(`/chats/${chatId}`);
  }

  async createChat(chatData: { type: string; name?: string; avatar?: string; participants?: string[] }) {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify(chatData),
    });
  }

  // Messages
  async getMessages(chatId: string) {
    return this.request(`/messages/${chatId}`);
  }

  async sendMessage(chatId: string, messageData: { content?: string; mediaType?: string; mediaUrl?: string }) {
    return this.request(`/messages/${chatId}`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  // Stories
  async getStories() {
    return this.request('/stories');
  }

  async createStory(storyData: { content?: string; mediaType?: string; mediaUrl?: string; expiresIn?: number }) {
    return this.request('/stories', {
      method: 'POST',
      body: JSON.stringify(storyData),
    });
  }

  async deleteStory(storyId: string) {
    return this.request(`/stories/${storyId}`, { method: 'DELETE' });
  }

  // Calls
  async createCall(callData: { receiverId: string; callType: string }) {
    return this.request('/calls', {
      method: 'POST',
      body: JSON.stringify(callData),
    });
  }

  async updateCallStatus(callId: string, status: string) {
    return this.request(`/calls/${callId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Gifts
  async getGifts() {
    return this.request('/gifts');
  }

  async sendGift(giftData: { giftId: string; receiverId: string }) {
    return this.request('/gifts/send', {
      method: 'POST',
      body: JSON.stringify(giftData),
    });
  }

  async getGiftHistory() {
    return this.request('/gifts/history');
  }

  // Admin
  async getAdminUsers() {
    return this.request('/admin/users');
  }

  async adminAction(userId: string, action: string) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    });
  }

  async getAdminStats() {
    return this.request('/admin/stats');
  }
}

export const api = new ApiClient();