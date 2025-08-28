import AsyncStorage from '@react-native-async-storage/async-storage';

// Import WebSocketService to disconnect on auth failures
let WebSocketService;
try {
  WebSocketService = require('./WebSocketService').default;
} catch (e) {
  console.log('WebSocketService not available for import');
}

class ChatAPI {
  constructor() {
    this.baseURL = 'http://192.168.43.36:8080'; // Replace with your actual backend URL
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

  // Debug method to test various endpoints
  async debugAuthentication() {
    const token = await this.getAuthToken();
    if (!token) {
      console.log('No token available for debugging');
      return;
    }

    console.log('=== AUTHENTICATION DEBUGGING ===');
    
    // Test endpoints that might work
    const testEndpoints = [
      '/api/auth/me',
      '/api/users/profile',
      '/api/posts',
      '/api/chats',
      '/api/chats/list'
    ];

    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`${endpoint}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`${endpoint} SUCCESS:`, data);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.log(`${endpoint} ERROR:`, errorData);
        }
      } catch (error) {
        console.log(`${endpoint} FETCH ERROR:`, error.message);
      }
    }
  }

  async getAuthToken() {
    if (!this.token) {
      this.token = await AsyncStorage.getItem('authToken');
      console.log('Retrieved token from storage:', this.token ? this.token.substring(0, 30) + '...' : 'null');
    } else {
      console.log('Using cached token:', this.token.substring(0, 30) + '...');
    }
    
    // Check if token is expired
    if (this.token) {
      try {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        const expirationTime = payload.exp;
        
        console.log('Token issued at:', new Date(payload.iat * 1000).toISOString());
        console.log('Token expires at:', new Date(expirationTime * 1000).toISOString());
        console.log('Current time:', new Date(currentTime * 1000).toISOString());
        console.log('Token expired:', currentTime > expirationTime);
        
        if (currentTime > expirationTime) {
          console.error('Token is expired - user will need to login again');
          // Don't automatically clear expired tokens, let user decide
          return this.token; // Return the token anyway, let the server reject it
        }
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
    
    return this.token;
  }

  async setAuthToken(token) {
    console.log('Setting auth token:', token ? token.substring(0, 30) + '...' : 'null');
    this.token = token;
    await AsyncStorage.setItem('authToken', token);
    
    // Verify the token was stored correctly
    const storedToken = await AsyncStorage.getItem('authToken');
    console.log('Token stored successfully:', storedToken ? 'Yes' : 'No');
  }

  // Method to clear token manually (for explicit logout)
  async clearAuthToken() {
    console.log('Manually clearing auth token and disconnecting WebSocket');
    this.token = null;
    await AsyncStorage.removeItem('authToken');
    
    // Disconnect WebSocket when token is manually cleared
    if (WebSocketService) {
      WebSocketService.disconnect();
    }
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;
    
    console.log('Making API request to:', url);
    console.log('Auth token available:', token ? 'Yes (' + token.substring(0, 20) + '...)' : 'No');
    
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
    
    console.log('Request headers:', JSON.stringify(requestOptions.headers, null, 2));
    console.log('Request method:', requestOptions.method || 'GET');
    
    try {
      const response = await fetch(url, requestOptions);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        console.error('API Request failed - Status:', response.status);
        console.error('API Request failed - Error data:', errorData);
        
        // Create an error object with status information
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
      console.log('ChatAPI: Loading user chats list from backend...');
      const response = await this.makeRequest('/api/chats/list');
      console.log('✅ SUCCESS: Got real chats from backend');
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
    console.log('ChatAPI: Creating new chat...', {
      participantIds,
      chatName,
      chatType,
      chatImageUrl,
      description
    });

    try {
      const response = await this.makeRequest('/api/chats', {
        method: 'POST',
        body: JSON.stringify({
          participantIds: participantIds,
          chatName: chatName,
          chatType: chatType, // 'PRIVATE' or 'GROUP'
          chatImageUrl: chatImageUrl,
          description: description
        }),
      });
      console.log('✅ Chat created successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to create chat:', error);
      throw error;
    }
  }

  // User search for creating chats
  async searchUsers(searchTerm = '') {
    try {
      console.log('ChatAPI: Searching users...', searchTerm);
      const endpoint = searchTerm 
        ? `/api/users/search?q=${encodeURIComponent(searchTerm)}`
        : '/api/users';
      
      const response = await this.makeRequest(endpoint);
      console.log('✅ Found users:', response.length || 0);
      return response;
    } catch (error) {
      console.error('❌ Failed to search users:', error);
      
      // Return mock users for testing
      console.log('🔧 Using mock users for testing...');
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

  // Message Operations
  async sendMessage(chatId, content, messageType = 'TEXT', mediaFileId = null) {
    return this.makeRequest('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        content,
        messageType,
        mediaFileId,
      }),
    });
  }

  async getChatMessages(chatId, page = 0, size = 50) {
    try {
      console.log(`ChatAPI: Loading messages for chat ${chatId}...`);
      const response = await this.makeRequest(`/api/messages/chat/${chatId}?page=${page}&size=${size}&sort=createdAt,desc`);
      console.log('✅ SUCCESS: Got real messages from backend');
      return response;
    } catch (error) {
      console.error('ChatAPI: Error loading messages from backend:', error);
      
      // Return mock messages while backend issues are being fixed
      console.log('🔧 Using mock messages while backend is being fixed...');
      return {
        content: [
          {
            id: 1,
            content: "Welcome to the chat! 👋",
            messageType: "TEXT",
            createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
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
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
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
            createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
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
}

export default new ChatAPI();
