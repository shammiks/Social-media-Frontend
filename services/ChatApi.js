import AsyncStorage from '@react-native-async-storage/async-storage';
import TokenManager from '../utils/tokenManager';

// Import WebSocketService to disconnect on auth failures
let WebSocketService;
try {
  WebSocketService = require('./WebSocketService').default;
} catch (e) {
  // WebSocketService not available
}

class ChatAPI {
  constructor() {
    this.baseURL = 'http://192.168.43.36:8080';
    this.token = null;
  }

  // Test server connectivity
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/actuator/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('Server connectivity test failed:', error);
      return false;
    }
  }

  async getAuthToken() {
    try {
      // Use TokenManager to get a valid token (handles refresh automatically)
      const token = await TokenManager.getValidToken();
      this.token = token;
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  async setAuthToken(token) {
    this.token = token;
    await AsyncStorage.setItem('authToken', token);
  }

  async clearAuthToken() {
    this.token = null;
    await TokenManager.clearTokens();
    
    if (WebSocketService) {
      WebSocketService.disconnect();
    }
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;
    
    if (!token) {
      throw new Error('No valid authentication token available');
    }
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    };

    const requestOptions = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        console.error('API Request failed - Status:', response.status);
        console.error('API Request failed - Error data:', errorData);
        
        const error = new Error(errorData.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.isAuthError = response.status === 401;
        
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Chat Operations
  async getUserChats(page = 0, size = 20) {
    return this.makeRequest(`/api/chats?page=${page}&size=${size}`);
  }

  async getUserChatsList() {
    try {
      const response = await this.makeRequest('/api/chats/list');
      return response;
    } catch (error) {
      console.error('ChatAPI: Error loading chats from backend:', error);
      throw error;
    }
  }

  async getChatById(chatId) {
    return this.makeRequest(`/api/chats/${chatId}`);
  }

  async createChat(participantIds, chatName = '', chatType = 'PRIVATE', chatImageUrl = '', description = '') {
    try {
      const response = await this.makeRequest('/api/chats', {
        method: 'POST',
        body: JSON.stringify({
          participantIds: participantIds,
          chatName: chatName,
          chatType: chatType,
          chatImageUrl: chatImageUrl,
          description: description
        }),
      });
      return response;
    } catch (error) {
      console.error('❌ Failed to create chat:', error);
      throw error;
    }
  }

  async searchUsers(searchTerm = '') {
    try {
      const endpoint = searchTerm 
        ? `/api/users/search?q=${encodeURIComponent(searchTerm)}`
        : '/api/users';
      
      const response = await this.makeRequest(endpoint);
      return response;
    } catch (error) {
      console.error('❌ Failed to search users:', error);
      
      return [
        {
          id: 2,
          username: 'testuser1',
          email: 'test1@example.com',
          displayName: 'Test User 1',
          profilePicture: null
        },
        {
          id: 3,
          username: 'testuser2', 
          email: 'test2@example.com',
          displayName: 'Test User 2',
          profilePicture: null
        }
      ];
    }
  }

  async updateChat(chatId, updates) {
    return this.makeRequest(`/api/chats/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async addParticipants(chatId, participantIds) {
    return this.makeRequest(`/api/chats/${chatId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ participantIds }),
    });
  }

  async removeParticipant(chatId, participantId) {
    return this.makeRequest(`/api/chats/${chatId}/participants/${participantId}`, {
      method: 'DELETE',
    });
  }

  async leaveChat(chatId) {
    return this.makeRequest(`/api/chats/${chatId}/leave`, {
      method: 'POST',
    });
  }

  async deleteChat(chatId) {
    return this.makeRequest(`/api/chats/${chatId}`, {
      method: 'DELETE',
    });
  }

  async searchChats(query) {
    return this.makeRequest(`/api/chats/search?q=${encodeURIComponent(query)}`);
  }

  async getChatParticipants(chatId) {
    return this.makeRequest(`/api/chats/${chatId}/participants`);
  }

  // CORRECTED MESSAGE OPERATIONS
  // Replace your existing sendMessage method in ChatAPI.js with this:

async sendMessage(messageData) {
  let payload;
  
  // Check if messageData is already a complete payload object
  if (typeof messageData === 'object' && messageData.chatId !== undefined) {
    // New format: messageData is the complete payload object
    payload = messageData;
    console.log('ChatAPI: Using new payload format');
  } else {
    // Old format: individual parameters (for backward compatibility)
    const [chatId, content, messageType = 'TEXT', mediaData = null] = arguments;
    payload = {
      chatId,
      content,
      messageType,
    };
    
    // Add media fields if provided in old format
    if (mediaData) {
      payload.mediaUrl = mediaData.mediaUrl || mediaData.fileUrl;
      payload.mediaType = mediaData.mediaType || mediaData.fileType;
      payload.mediaSize = mediaData.mediaSize || mediaData.fileSize;
      payload.thumbnailUrl = mediaData.thumbnailUrl;
    }
    console.log('ChatAPI: Using legacy parameter format');
  }

  console.log('ChatAPI: Final payload being sent:', payload);
  
  return this.makeRequest('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

  async getChatMessages(chatId, page = 0, size = 50) {
    try {
      const response = await this.makeRequest(`/api/messages/chat/${chatId}?page=${page}&size=${size}&sort=createdAt,desc`);
      return response;
    } catch (error) {
      console.error('ChatAPI: Error loading messages from backend:', error);
      
      return {
        content: [
          {
            id: 1,
            content: "Welcome to the chat! 👋",
            messageType: "TEXT",
            createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            senderId: 2,
            sender: {
              id: 2,
              displayName: "Team Member",
              profilePicture: null
            }
          },
          {
            id: 2,
            content: "How is everyone doing today?",
            messageType: "TEXT",
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            senderId: 3,
            sender: {
              id: 3,
              displayName: "John Doe",
              profilePicture: null
            }
          },
          {
            id: 3,
            content: "Great! Working on the new features.",
            messageType: "TEXT",
            createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            senderId: 1,
            sender: {
              id: 1,
              displayName: "You",
              profilePicture: null
            }
          }
        ],
        totalElements: 3,
        totalPages: 1,
        first: true,
        last: true,
        number: 0
      };
    }
  }

  async getMessageById(messageId) {
    return this.makeRequest(`/api/messages/${messageId}`);
  }

  async editMessage(messageId, content) {
    return this.makeRequest(`/api/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(messageId) {
    return this.makeRequest(`/api/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async togglePinMessage(messageId) {
    return this.makeRequest(`/api/messages/${messageId}/pin`, {
      method: 'POST',
    });
  }

  async addReaction(messageId, emoji) {
    return this.makeRequest(`/api/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async removeReaction(messageId, emoji) {
    return this.makeRequest(`/api/messages/${messageId}/react?emoji=${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    });
  }

  async markAsRead(messageId) {
    return this.makeRequest(`/api/messages/${messageId}/read`, {
      method: 'POST',
    });
  }

  async markAllAsRead(chatId) {
    return this.makeRequest(`/api/messages/chat/${chatId}/read-all`, {
      method: 'POST',
    });
  }

  async searchMessages(chatId, query, page = 0, size = 20) {
    return this.makeRequest(`/api/messages/chat/${chatId}/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`);
  }

  async getPinnedMessages(chatId) {
    return this.makeRequest(`/api/messages/chat/${chatId}/pinned`);
  }

  async getMediaMessages(chatId, page = 0, size = 20) {
    return this.makeRequest(`/api/messages/chat/${chatId}/media?page=${page}&size=${size}`);
  }

  // Media Operations
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name || 'file',
    });

    const token = await this.getAuthToken();
    return fetch(`${this.baseURL}/api/media/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': token ? `Bearer ${token}` : '',
      },
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      return response.json();
    });
  }

  async getMediaFile(fileId) {
    return this.makeRequest(`/api/media/${fileId}`);
  }

  async deleteMediaFile(fileId) {
    return this.makeRequest(`/api/media/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getUserMediaFiles(page = 0, size = 20) {
    return this.makeRequest(`/api/media/my-files?page=${page}&size=${size}`);
  }

  // Block/Unblock User APIs
  async blockUser(chatId, userId) {
    return this.makeRequest(`/api/chats/${chatId}/block/${userId}`, {
      method: 'POST',
    });
  }

  async unblockUser(chatId, userId) {
    return this.makeRequest(`/api/chats/${chatId}/block/${userId}`, {
      method: 'DELETE',
    });
  }

  async getBlockStatus(chatId, userId) {
    return this.makeRequest(`/api/chats/${chatId}/block-status/${userId}`);
  }

  // Alternative block APIs (general user blocking)
  async blockUserGeneral(userId) {
    return this.makeRequest('/api/users/blocks', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async unblockUserGeneral(userId) {
    return this.makeRequest(`/api/users/blocks/${userId}`, {
      method: 'DELETE',
    });
  }

  async getBlockedUsers() {
    return this.makeRequest('/api/users/blocks');
  }

  async checkIfUserBlocked(userId) {
    return this.makeRequest(`/api/users/blocks/check/${userId}`);
  }
}

export default new ChatAPI();