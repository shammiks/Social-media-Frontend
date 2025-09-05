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
    this.baseURL = 'http://192.168.1.5:8080';
    this.shouldReconnect = true;
    this.dispatch = null; // Store Redux dispatch
    this.currentUserId = null;
    this.isSubscribed = false; // Track if we've subscribed to user queues
  }

  // Method to set Redux dispatch for handling WebSocket messages
  setDispatch(dispatch) {
    this.dispatch = dispatch;
  }

  // Method to set current user ID (should be called with numeric user ID)
  setCurrentUserId(userId) {
    this.currentUserId = userId;
    console.log('WebSocket: Current user ID set to:', userId);
    console.log('WebSocket: isConnected:', this.isConnected, 'client exists:', !!this.client, 'isSubscribed:', this.isSubscribed);
    
    // If we're already connected and have a user ID, subscribe to user queues
    if (this.isConnected && this.currentUserId && this.client) {
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
          console.error('No authentication token found for WebSocket connection');
          this.isConnecting = false;
          this.shouldReconnect = false;
          reject(new Error('No authentication token found'));
          return;
        }

        // Extract user ID from token for subscriptions
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          // Don't extract from token since JWT contains email, not numeric ID
          // User ID will be set via setCurrentUserId() method with the numeric ID
          console.log('WebSocket: JWT token payload:', payload);
          console.log('WebSocket: Will use currentUserId set via setCurrentUserId() method');
        } catch (e) {
          console.error('Could not parse JWT token:', e);
        }

        this.client = new Client({
          webSocketFactory: () => new SockJS(`${this.baseURL}/ws`),
          connectHeaders: {
            'Authorization': `Bearer ${token}`,
          },
          
          reconnectDelay: 5000, // 5 seconds
          maxReconnectAttempts: 10, // Try to reconnect up to 10 times
          
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          
          debug: (str) => {
            console.log('WebSocket STOMP Debug:', str);
          },
          
          onConnect: (frame) => {
            clearTimeout(connectionTimeout);
            console.log('WebSocket onConnect callback triggered');
            console.log('WebSocket connected successfully');
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            console.log('WebSocket: Sending connect event');
            this.sendConnect();
            
            // Add a small delay before subscribing to ensure connection is fully ready
            setTimeout(() => {
              console.log('WebSocket: In subscription timeout, currentUserId:', this.currentUserId);
              // Subscribe to user-specific queues immediately after connection
              if (this.currentUserId) {
                console.log('WebSocket: About to subscribe to user queues for user:', this.currentUserId);
                this.subscribeToUserQueues();
              } else {
                console.warn('WebSocket: No current user ID available for subscription - will subscribe when user ID is set');
              }
            }, 100);
            
            console.log('WebSocket: About to resolve connection promise');
            resolve();
          },
          
          onDisconnect: (frame) => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.isConnecting = false;
            this.isSubscribed = false; // Reset subscription flag
            
            if (this.shouldReconnect && frame && frame.reason !== 'manual') {
              this.handleReconnect();
            }
          },
          
          onStompError: (frame) => {
            clearTimeout(connectionTimeout);
            console.error('STOMP error frame:', frame);
            this.isConnected = false;
            this.isConnecting = false;
            this.isSubscribed = false; // Reset subscription flag
            
            if (frame.headers && frame.headers.message && 
                (frame.headers.message.includes('Authentication') || 
                 frame.headers.message.includes('Unauthorized'))) {
              console.error('Authentication failed for WebSocket connection - stopping reconnection attempts');
              this.shouldReconnect = false;
              reject(new Error('Authentication failed'));
              return;
            }
            
            if (this.shouldReconnect) {
              this.handleReconnect();
            }
            reject(new Error('STOMP error: ' + frame.headers.message));
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
      console.log('WebSocket: Sending connect event');
      this.client.publish({
        destination: '/app/connect',
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }

  // Subscribe to user-specific queues for receiving messages
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

    // Subscribe to message queue
    console.log('WebSocket: Subscribing to /user/' + this.currentUserId + '/queue/messages');
    this.client.subscribe(`/user/${this.currentUserId}/queue/messages`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('WebSocket: Received message:', data);
        
        if (this.dispatch) {
          // Handle different message types
          switch (data.type) {
            case 'NEW_MESSAGE':
              console.log('WebSocket: Dispatching NEW_MESSAGE for chat:', data.data.chatId);
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
              console.log('WebSocket: Dispatching MESSAGE_UPDATED');
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
              console.log('WebSocket: Dispatching MESSAGE_DELETED');
              this.dispatch({
                type: 'chat/deleteMessageViaSocket',
                payload: {
                  chatId: data.data.chatId,
                  messageId: data.data.id
                }
              });
              break;
            default:
              console.log('WebSocket: Unknown message type:', data.type);
          }
        } else {
          console.warn('WebSocket: No dispatch function available');
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
              console.log('WebSocket: Dispatching READ_STATUS_UPDATED');
              this.dispatch({ type: 'chat/readStatusUpdated', payload: data.data });
              break;
            case 'CHAT_READ_UPDATED':
              console.log('WebSocket: Dispatching CHAT_READ_UPDATED');
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