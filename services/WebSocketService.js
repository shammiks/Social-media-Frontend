import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class WebSocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectTimer = null;
    this.baseURL = 'http://192.168.1.5:8081'; // Match the actual server IP
    this.shouldReconnect = true;
    this.dispatch = null; // Store Redux dispatch
    this.currentUserId = null;
    this.isSubscribed = false; // Track if we've subscribed to user queues
    this.asyncActions = null; // Store async actions like loadChats
  }

  // Method to set Redux dispatch for handling WebSocket messages
  setDispatch(dispatch) {
    this.dispatch = dispatch;
    console.log('WebSocket: Redux dispatch set');
  }

  // Method to set async actions for triggering Redux thunks
  setAsyncActions(actions) {
    this.asyncActions = actions;
    console.log('WebSocket: Async actions set:', Object.keys(actions));
  }

  // Method to set current user ID (should be called with numeric user ID)
  setCurrentUserId(userId) {
    this.currentUserId = userId;
    console.log('WebSocket: Current user ID set to:', userId);
    console.log('WebSocket: isConnected:', this.isConnected, 'client exists:', !!this.client, 'isSubscribed:', this.isSubscribed);
    
    // If we're already connected and have a user ID, subscribe to user queues
    if (this.isConnected && this.currentUserId && this.client && !this.isSubscribed) {
      console.log('WebSocket: Already connected, subscribing to user queues now');
      this.subscribeToUserQueues();
    } else {
      console.log('WebSocket: Not ready for subscription yet - will subscribe on connect');
    }
  }

  async connect() {
    if (this.isConnected || this.isConnecting) {
      return Promise.resolve();
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnecting = true;

    return new Promise(async (resolve, reject) => {
      // Add a timeout for the connection
      const connectionTimeout = setTimeout(() => {
        console.error('WebSocket connection timeout');
        this.isConnecting = false;
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          console.error('❌ No authentication token found for WebSocket connection');
          this.isConnecting = false;
          this.shouldReconnect = false;
          clearTimeout(connectionTimeout);
          reject(new Error('No authentication token found'));
          return;
        }

        // Validate token format
        await this.validateTokenFormat();
        
        const wsUrl = `${this.baseURL}/ws?token=Bearer_${token}`;
        console.log('🔗 WebSocket connecting to:', `${this.baseURL}/ws?token=Bearer_${token.substring(0, 20)}...`);

        this.client = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: {
            'Authorization': `Bearer ${token}`,
          },
          
          reconnectDelay: 5000,
          maxReconnectAttempts: 10,
          
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          
          debug: (str) => {
            console.log('WebSocket STOMP Debug:', str);
          },
          
          onConnect: (frame) => {
            clearTimeout(connectionTimeout);
            console.log('✅ WebSocket connected successfully');
            console.log('📋 Connection frame:', frame);
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.sendConnect();
            
            // Subscribe to user-specific queues after connection
            setTimeout(() => {
              if (this.currentUserId && !this.isSubscribed) {
                console.log('WebSocket: Subscribing to user queues for user:', this.currentUserId);
                this.subscribeToUserQueues();
              }
            }, 500); // Increased delay for stability
            
            resolve();
          },
          
          onDisconnect: (frame) => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.isConnecting = false;
            this.isSubscribed = false;
            
            if (this.shouldReconnect && frame && frame.reason !== 'manual') {
              this.handleReconnect();
            }
          },
          
          onStompError: (frame) => {
            clearTimeout(connectionTimeout);
            console.error('❌ STOMP error frame:', frame);
            console.error('❌ Error headers:', frame.headers);
            console.error('❌ Error body:', frame.body);
            this.isConnected = false;
            this.isConnecting = false;
            this.isSubscribed = false;
            
            if (frame.headers && frame.headers.message) {
              if (frame.headers.message.includes('Authentication') || 
                  frame.headers.message.includes('Unauthorized') ||
                  frame.headers.message.includes('JWT') ||
                  frame.headers.message.includes('Token')) {
                console.error('🔐 JWT Authentication failed for WebSocket connection');
                console.log('💡 Try logging in again to get a fresh token');
                this.shouldReconnect = false;
                reject(new Error('JWT Authentication failed'));
                return;
              }
            }
            
            if (this.shouldReconnect) {
              this.handleReconnect();
            }
            reject(new Error('STOMP error: ' + (frame.headers.message || 'Unknown error')));
          },
          
          onWebSocketError: (error) => {
            clearTimeout(connectionTimeout);
            console.error('WebSocket connection error:', error);
            this.isConnected = false;
            this.isConnecting = false;
            
            if (this.shouldReconnect) {
              this.handleReconnect();
            }
            reject(error);
          },
        });

        this.client.activate();
      } catch (error) {
        console.error('Failed to initialize WebSocket connection:', error);
        this.isConnecting = false;
        clearTimeout(connectionTimeout);
        
        if (this.shouldReconnect) {
          this.handleReconnect();
        }
        reject(error);
      }
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.client) {
      this.client.deactivate();
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.isSubscribed = false;
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    this.currentUserId = null;
  }

  handleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (!this.shouldReconnect) {
      return;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(5000 * this.reconnectAttempts, 30000);
      
      this.reconnectTimer = setTimeout(async () => {
        if (this.shouldReconnect && !this.isConnected && !this.isConnecting) {
          const token = await AsyncStorage.getItem('authToken');
          if (!token) {
            this.shouldReconnect = false;
            return;
          }
          
          try {
            await this.connect();
          } catch (error) {
            console.error('Reconnection failed:', error);
          }
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. Stopping reconnection attempts.');
      this.shouldReconnect = false;
    }
  }

  sendConnect() {
    if (this.client && this.isConnected) {
      console.log('WebSocket: Sending connect event');
      this.client.publish({
        destination: '/app/connect',
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  // FIXED: Subscribe to user-specific queues for receiving messages
  subscribeToUserQueues() {
    if (!this.client || !this.isConnected || !this.currentUserId) {
      console.log('WebSocket: Cannot subscribe - client:', !!this.client, 'connected:', this.isConnected, 'userId:', this.currentUserId);
      return;
    }

    if (this.isSubscribed) {
      console.log('WebSocket: Already subscribed to user queues');
      return;
    }

    console.log('WebSocket: Subscribing to user queues for user:', this.currentUserId);
    this.isSubscribed = true;

    // FIXED: Subscribe to message queue with correct message handling
    // In WebSocketService.js, update the message subscription handler:

// Subscribe to message queue with ENHANCED debugging
console.log('WebSocket: Subscribing to /user/' + this.currentUserId + '/queue/messages');
this.client.subscribe(`/user/${this.currentUserId}/queue/messages`, (message) => {
  try {
    console.log('🟢 WebSocket: RAW MESSAGE RECEIVED:', message.body);
    
    const data = JSON.parse(message.body);
    console.log('🟢 WebSocket: PARSED MESSAGE DATA:', JSON.stringify(data, null, 2));
    
    if (this.dispatch) {
      // Handle the correct message structure from backend
      switch (data.type) {
        case 'NEW_MESSAGE':
          console.log('🟢 WebSocket: Processing NEW_MESSAGE for chat:', data.data.chatId);
          console.log('🟢 WebSocket: Message content:', data.data.content);
          console.log('🟢 WebSocket: Message ID:', data.data.id);
          
          // Extract chatId from the message data
          const messageData = data.data;
          const chatId = messageData.chatId;
          
          console.log('🟢 WebSocket: Dispatching addMessageViaSocket for chat:', chatId);
          
          // Dispatch the Redux action
          this.dispatch({
            type: 'chat/addMessageViaSocket',
            payload: { 
              chatId: chatId, 
              message: messageData 
            }
          });
          
          console.log('🟢 WebSocket: Redux action dispatched successfully');
          
          // Also trigger chat list refresh
          if (this.asyncActions && this.asyncActions.loadChats) {
            console.log('🟢 WebSocket: Triggering chat list refresh');
            this.dispatch(this.asyncActions.loadChats());
          }
          break;
          
        case 'MESSAGE_UPDATED':
          console.log('🟢 WebSocket: Processing MESSAGE_UPDATED:', data.data);
          this.dispatch({
            type: 'chat/updateMessageViaSocket',
            payload: {
              chatId: data.data.chatId,
              messageId: data.data.id,
              updates: data.data
            }
          });
          break;
          
        case 'MESSAGE_DELETED':
          console.log('🟢 WebSocket: Processing MESSAGE_DELETED:', data.data);
          this.dispatch({
            type: 'chat/deleteMessageViaSocket',
            payload: {
              chatId: data.data.chatId,
              messageId: data.data.messageId
            }
          });
          break;
          
        default:
          console.log('🟡 WebSocket: Unknown message type:', data.type);
          console.log('🟡 WebSocket: Full data:', data);
      }
    } else {
      console.error('🔴 WebSocket: No dispatch function available');
    }
  } catch (error) {
    console.error('🔴 WebSocket: Error parsing message:', error);
    console.error('🔴 WebSocket: Raw message body:', message.body);
  }
});

    // Subscribe to typing indicators
    this.client.subscribe(`/user/${this.currentUserId}/queue/typing`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('WebSocket: Received typing indicator:', data);
        if (this.dispatch && data.type === 'TYPING_INDICATOR') {
          this.dispatch({ 
            type: 'chat/updateTypingUser', 
            payload: {
              chatId: data.data.chatId,
              userId: data.data.userId,
              isTyping: data.data.isTyping
            }
          });
        }
      } catch (error) {
        console.error('Error parsing typing indicator:', error);
      }
    });

    // Subscribe to read status updates
    console.log('WebSocket: Subscribing to /user/' + this.currentUserId + '/queue/read-status');
    this.client.subscribe(`/user/${this.currentUserId}/queue/read-status`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('WebSocket: Received read status update:', data);
        if (this.dispatch) {
          switch (data.type) {
            case 'READ_STATUS_UPDATED':
              this.dispatch({ 
                type: 'chat/readStatusUpdated', 
                payload: data.data 
              });
              break;
            case 'CHAT_READ_UPDATED':
              this.dispatch({ 
                type: 'chat/chatReadUpdated', 
                payload: data.data 
              });
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing read status update:', error);
      }
    });

    // Subscribe to reactions
    this.client.subscribe(`/user/${this.currentUserId}/queue/reactions`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('WebSocket: Received reaction update:', data);
        if (this.dispatch && data.type === 'REACTION_UPDATED') {
          this.dispatch({
            type: 'chat/updateMessageViaSocket',
            payload: {
              chatId: data.data.chatId,
              messageId: data.data.id,
              updates: data.data
            }
          });
        }
      } catch (error) {
        console.error('Error parsing reaction update:', error);
      }
    });

    // Subscribe to chat updates
    this.client.subscribe(`/user/${this.currentUserId}/queue/chats`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('WebSocket: Received chat update:', data);
        if (this.dispatch) {
          switch (data.type) {
            case 'NEW_CHAT':
              // Handle new chat creation
              break;
            case 'CHAT_UPDATED':
              this.dispatch({ 
                type: 'chat/updateChat', 
                payload: data.data 
              });
              break;
            case 'CHAT_DELETED':
              this.dispatch({ 
                type: 'chat/removeChat', 
                payload: data.data.chatId 
              });
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing chat update:', error);
      }
    });

    console.log('WebSocket: All subscriptions completed');
  }

  // FIXED: Legacy methods for backward compatibility
  subscribeToChat(chatId, dispatch) {
    // Store dispatch for handling messages
    if (dispatch) {
      this.setDispatch(dispatch);
    }
    
    // If not connected, connect first
    if (!this.isConnected) {
      this.connect().catch(error => {
        console.error('Failed to connect WebSocket:', error);
      });
    }
  }

  sendTypingIndicator(chatId, isTyping) {
    if (this.client && this.isConnected) {
      console.log('WebSocket: Sending typing indicator for chat:', chatId, 'isTyping:', isTyping);
      this.client.publish({
        destination: `/app/chat/${chatId}/typing`,
        body: JSON.stringify({ isTyping }),
      });
    } else {
      console.warn('WebSocket: Cannot send typing indicator - not connected');
    }
  }

  joinChat(chatId) {
    if (this.client && this.isConnected) {
      console.log('WebSocket: Joining chat:', chatId);
      this.client.publish({
        destination: `/app/chat/${chatId}/join`,
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    } else {
      console.warn('WebSocket: Cannot join chat - not connected');
    }
  }

  leaveChat(chatId) {
    if (this.client && this.isConnected) {
      console.log('WebSocket: Leaving chat:', chatId);
      this.client.publish({
        destination: `/app/chat/${chatId}/leave`,
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      shouldReconnect: this.shouldReconnect,
      isSubscribed: this.isSubscribed,
      currentUserId: this.currentUserId
    };
  }

  // Add missing reconnectWithNewToken method
  async reconnectWithNewToken() {
    console.log('🔄 WebSocket: Reconnecting with new token after token refresh');
    
    // First disconnect existing connection
    this.disconnect();
    
    // Reset state and enable reconnection
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    
    // Wait a moment for cleanup
    setTimeout(async () => {
      try {
        // Verify token exists
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          console.error('❌ No new token found for WebSocket reconnection');
          return;
        }
        
        console.log('✅ New token found, attempting WebSocket reconnection');
        await this.connect();
      } catch (error) {
        console.error('❌ Failed to reconnect WebSocket with new token:', error);
      }
    }, 1000);
  }

  // Add method to update connection URL for debugging
  updateBaseURL(newURL) {
    console.log('WebSocket: Updating base URL from', this.baseURL, 'to', newURL);
    this.baseURL = newURL;
  }

  // Add method to validate token format
  async validateTokenFormat() {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.error('❌ No token found in AsyncStorage');
      return false;
    }
    
    console.log('🔍 Token validation:');
    console.log('  - Token exists: ✅');
    console.log('  - Token length:', token.length);
    console.log('  - Token preview:', token.substring(0, 20) + '...');
    console.log('  - Expected format in URL: Bearer_' + token.substring(0, 20) + '...');
    
    // Check if token is properly formatted JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('❌ Token is not a valid JWT format (should have 3 parts separated by dots)');
      return false;
    }
    
    console.log('✅ Token appears to be valid JWT format');
    return true;
  }
}

export default new WebSocketService();