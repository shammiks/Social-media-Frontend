import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_ENDPOINTS } from '../utils/apiConfig';
import { 
  addRealTimeNotification, 
  setConnectionStatus, 
  updateNotificationCounts,
  fetchNotificationCounts 
} from '../redux/notificationSlice';

class NotificationWebSocketService {
  constructor() {
    this.client = null;
    this.dispatch = null;
    this.userId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds
    this.isConnecting = false;
    this.subscriptions = new Map();
  }

  // Initialize the WebSocket connection
  connect(userId, token, dispatch) {
    if (this.isConnecting || (this.client && this.client.connected)) {
      return;
    }

    this.dispatch = dispatch;
    this.userId = userId;
    this.isConnecting = true;

    try {
      // Create STOMP client with SockJS
      const baseWsUrl = API_ENDPOINTS.BASE.replace('/api', '/ws/notifications');
      // Include JWT token in URL query parameter as required by WebSocketHandshakeInterceptor
      const wsUrl = `${baseWsUrl}?token=Bearer_${token}`;
      
      console.log('🔗 NotificationWebSocket connecting to:', `${baseWsUrl}?token=Bearer_${token.substring(0, 20)}...`);
      
      this.client = new Client({
        webSocketFactory: () => {
          const sockjs = new SockJS(wsUrl, null, {
            transports: ['websocket', 'xhr-streaming', 'xhr-polling']
          });
          return sockjs;
        },
        
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        
        reconnectDelay: this.reconnectInterval,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,

        onConnect: (frame) => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          if (this.dispatch) {
            this.dispatch(setConnectionStatus(true));
            // Fetch latest notification counts on connect
            this.dispatch(fetchNotificationCounts());
          }
          
          // Subscribe to user-specific notifications
          this.subscribeToNotifications();
        },

        onStompError: (frame) => {
          console.error('NotificationWebSocket: STOMP error', frame);
          this.isConnecting = false;
          
          if (this.dispatch) {
            this.dispatch(setConnectionStatus(false));
          }
          
          this.handleReconnection();
        },

        onWebSocketError: (error) => {
          console.error('NotificationWebSocket: WebSocket error', error);
          console.error('NotificationWebSocket: Error details:', JSON.stringify(error, null, 2));
          this.isConnecting = false;
          
          if (this.dispatch) {
            this.dispatch(setConnectionStatus(false));
          }
        },

        onWebSocketClose: (event) => {
          // Connection closed
        },

        onDisconnect: () => {
          this.isConnecting = false;
          
          if (this.dispatch) {
            this.dispatch(setConnectionStatus(false));
          }
          
          this.handleReconnection();
        },
      });

      // Activate the connection
      this.client.activate();
      
    } catch (error) {
      console.error('NotificationWebSocket: Connection error', error);
      this.isConnecting = false;
      
      if (this.dispatch) {
        this.dispatch(setConnectionStatus(false));
      }
      
      this.handleReconnection();
    }
  }

  // Subscribe to notification topics
  subscribeToNotifications() {
    if (!this.client || !this.client.connected || !this.userId) {
      return;
    }

    try {
      // Subscribe to user-specific notifications
      const userTopic = `/topic/notifications/${this.userId}`;
      
      const subscription = this.client.subscribe(userTopic, (message) => {
        try {
          const notification = JSON.parse(message.body);
          
          if (this.dispatch) {
            // Add the notification to Redux store
            this.dispatch(addRealTimeNotification(notification));
            
            // Update notification counts
            this.dispatch(fetchNotificationCounts());
            
            // Show system notification if app is in background
            this.showSystemNotification(notification);
          }
        } catch (error) {
          console.error('NotificationWebSocket: Error processing notification', error);
        }
      });

      this.subscriptions.set('notifications', subscription);

      // Subscribe to notification count updates
      const countTopic = `/topic/notifications/${this.userId}/counts`;
      
      const countSubscription = this.client.subscribe(countTopic, (message) => {
        try {
          const counts = JSON.parse(message.body);
          
          if (this.dispatch) {
            this.dispatch(updateNotificationCounts(counts));
          }
        } catch (error) {
          // Error processing count update
        }
      });

      this.subscriptions.set('counts', countSubscription);
      
    } catch (error) {
      // Subscription error
    }
  }

  // Show system notification (for background notifications)
  showSystemNotification(notification) {
    // This would integrate with expo-notifications for push notifications
    // Implementation for system notifications would go here
  }

  // Handle reconnection logic
  handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      if (this.userId && this.dispatch) {
        // Note: We'd need to get the token again here in a real implementation
        // For now, we'll just try to reactivate the existing client
        if (this.client && !this.client.connected) {
          this.client.activate();
        }
      }
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  // Disconnect from WebSocket
  disconnect() {
    // Unsubscribe from all topics
    this.subscriptions.forEach((subscription, topic) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        // Error unsubscribing
      }
    });
    
    this.subscriptions.clear();
    
    // Deactivate the client
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    
    // Reset state
    this.userId = null;
    this.dispatch = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  // Check connection status
  isConnected() {
    return this.client && this.client.connected;
  }

  // Send a message (for future use)
  sendMessage(destination, message) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination,
        body: JSON.stringify(message),
      });
    }
  }

  // Mark notification as seen via WebSocket
  markNotificationAsSeen(notificationId) {
    this.sendMessage('/app/notifications/mark-seen', {
      notificationId,
      userId: this.userId,
    });
  }

  // Get connection info
  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      userId: this.userId,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.keys()),
    };
  }
}

// Create singleton instance
const notificationWebSocketService = new NotificationWebSocketService();

export default notificationWebSocketService;
