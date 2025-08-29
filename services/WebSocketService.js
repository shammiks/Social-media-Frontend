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
    this.baseURL = 'http://192.168.43.36:8080';
    this.shouldReconnect = true;
    this.dispatch = null; // Store Redux dispatch
    this.currentUserId = null;
  }

  // Method to set Redux dispatch for handling WebSocket messages
  setDispatch(dispatch) {
    this.dispatch = dispatch;
  }

  async connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnecting = true;

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('No authentication token found for WebSocket connection');
        this.isConnecting = false;
        this.shouldReconnect = false;
        throw new Error('No authentication token found');
      }

      // Extract user ID from token for subscriptions
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUserId = payload.sub || payload.userId; // Adjust based on your JWT structure
      } catch (e) {
        console.error('Could not extract user ID from token:', e);
      }

      this.client = new Client({
        webSocketFactory: () => new SockJS(`${this.baseURL}/ws`),
        connectHeaders: {
          'Authorization': `Bearer ${token}`,
        },
        
        reconnectDelay: 0,
        maxReconnectAttempts: 0,
        
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        
        onConnect: (frame) => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.sendConnect();
          
          // Subscribe to user-specific queues immediately after connection
          if (this.currentUserId) {
            this.subscribeToUserQueues();
          }
        },
        
        onDisconnect: (frame) => {
          this.isConnected = false;
          this.isConnecting = false;
          
          if (this.shouldReconnect && frame && frame.reason !== 'manual') {
            this.handleReconnect();
          }
        },
        
        onStompError: (frame) => {
          console.error('STOMP error frame:', frame);
          this.isConnected = false;
          this.isConnecting = false;
          
          if (frame.headers && frame.headers.message && 
              (frame.headers.message.includes('Authentication') || 
               frame.headers.message.includes('Unauthorized'))) {
            console.error('Authentication failed for WebSocket connection - stopping reconnection attempts');
            this.shouldReconnect = false;
            return;
          }
          
          if (this.shouldReconnect) {
            this.handleReconnect();
          }
        },
        
        onWebSocketError: (error) => {
          console.error('WebSocket connection error:', error);
          this.isConnected = false;
          this.isConnecting = false;
          
          if (this.shouldReconnect) {
            this.handleReconnect();
          }
        },
      });

      this.client.activate();
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.isConnecting = false;
      
      if (this.shouldReconnect) {
        this.handleReconnect();
      }
    }
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
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    this.currentUserId = null;
  }

  resetConnection() {
    this.disconnect();
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
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
          
          this.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. Stopping reconnection attempts.');
      this.shouldReconnect = false;
    }
  }

  retryConnection() {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.connect();
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      shouldReconnect: this.shouldReconnect
    };
  }

  sendConnect() {
    if (this.client && this.isConnected) {
      this.client.publish({
        destination: '/app/connect',
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  // Subscribe to user-specific queues for receiving messages
  subscribeToUserQueues() {
    if (!this.client || !this.isConnected || !this.currentUserId) {
      return;
    }

    // Subscribe to message queue
    this.client.subscribe(`/user/${this.currentUserId}/queue/messages`, (message) => {
      try {
        const data = JSON.parse(message.body);
        
        if (this.dispatch) {
          // Handle different message types
          switch (data.type) {
            case 'NEW_MESSAGE':
              // Dispatch the action directly
              this.dispatch({
                type: 'chat/addMessageViaSocket',
                payload: { 
                  chatId: data.data.chatId, 
                  message: data.data 
                }
              });
              break;
            case 'MESSAGE_UPDATED':
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
              this.dispatch({
                type: 'chat/deleteMessageViaSocket',
                payload: {
                  chatId: data.data.chatId,
                  messageId: data.data.id
                }
              });
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    // Subscribe to typing indicators
    this.client.subscribe(`/user/${this.currentUserId}/queue/typing`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (this.dispatch && data.type === 'TYPING_INDICATOR') {
          this.dispatch({ 
            type: 'chat/setTypingUsers', 
            payload: {
              chatId: data.data.chatId,
              users: data.data.isTyping ? [data.data.userId] : []
            }
          });
        }
      } catch (error) {
        console.error('Error parsing typing indicator:', error);
      }
    });

    // Subscribe to read status updates
    this.client.subscribe(`/user/${this.currentUserId}/queue/read-status`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (this.dispatch) {
          switch (data.type) {
            case 'READ_STATUS_UPDATED':
              this.dispatch({ type: 'chat/readStatusUpdated', payload: data.data });
              break;
            case 'CHAT_READ_UPDATED':
              this.dispatch({ type: 'chat/chatReadUpdated', payload: data.data });
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing read status update:', error);
      }
    });

    // Subscribe to chat updates
    this.client.subscribe(`/user/${this.currentUserId}/queue/chats`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (this.dispatch) {
          switch (data.type) {
            case 'NEW_CHAT':
              this.dispatch({ type: 'chat/newChat', payload: data.data });
              break;
            case 'CHAT_UPDATED':
              this.dispatch({ type: 'chat/chatUpdated', payload: data.data });
              break;
            case 'CHAT_DELETED':
              this.dispatch({ type: 'chat/chatDeleted', payload: data.data });
              break;
            case 'PARTICIPANT_LEFT':
              this.dispatch({ type: 'chat/participantLeft', payload: data.data });
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing chat update:', error);
      }
    });

    // Subscribe to general notifications
    this.client.subscribe(`/user/${this.currentUserId}/queue/notifications`, (message) => {
      try {
        const data = JSON.parse(message.body);
        // Handle notifications as needed
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    });

    // Subscribe to user status updates
    this.client.subscribe(`/user/${this.currentUserId}/queue/user-status`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (this.dispatch && data.type === 'USER_STATUS_CHANGED') {
          this.dispatch({ type: 'chat/userStatusChanged', payload: data.data });
        }
      } catch (error) {
        console.error('Error parsing user status update:', error);
      }
    });
  }

  // Legacy methods for backward compatibility - now using user queues
  subscribeToChat(chatId, dispatch) {
    // Store dispatch for handling messages
    if (dispatch) {
      this.setDispatch(dispatch);
    }
    
    // If not connected, connect first
    if (!this.isConnected) {
      this.connect();
    }
  }

  unsubscribeFromChat(chatId) {
    // User queues handle all messages, so no need to unsubscribe from specific chats
  }

  subscribeToUserNotifications(userId, onNotification) {
    // Handled by subscribeToUserQueues
  }

  sendTypingIndicator(chatId, isTyping) {
    if (this.client && this.isConnected) {
      this.client.publish({
        destination: `/app/chat/${chatId}/typing`,
        body: JSON.stringify({ isTyping }),
      });
    }
  }

  joinChat(chatId) {
    if (this.client && this.isConnected) {
      this.client.publish({
        destination: `/app/chat/${chatId}/join`,
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  leaveChat(chatId) {
    if (this.client && this.isConnected) {
      this.client.publish({
        destination: `/app/chat/${chatId}/leave`,
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  sendHeartbeat() {
    if (this.client && this.isConnected) {
      this.client.publish({
        destination: '/app/heartbeat',
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  sendGenericEvent(eventType, payload = {}) {
    if (this.client && this.isConnected) {
      this.client.publish({
        destination: '/app/event',
        body: JSON.stringify({ type: eventType, ...payload }),
      });
    }
  }
}

export default new WebSocketService();