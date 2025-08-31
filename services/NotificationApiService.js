import axios from 'axios';
import { API_ENDPOINTS } from '../utils/apiConfig';

class NotificationApiService {
  constructor() {
    this.baseURL = API_ENDPOINTS.BASE;
  }

  // Get authorization headers
  getAuthHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // ======================== NOTIFICATION FETCHING ========================

  // Get paginated notifications
  async getNotifications(token, page = 0, size = 20) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications?page=${page}&size=${size}`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get unread notifications
  async getUnreadNotifications(token, page = 0, size = 20) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/unread?page=${page}&size=${size}`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get notifications by type
  async getNotificationsByType(token, type, page = 0, size = 20) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/type/${type}?page=${page}&size=${size}`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get recent notifications (for quick preview)
  async getRecentNotifications(token, limit = 5) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/recent?limit=${limit}`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ======================== NOTIFICATION ACTIONS ========================

  // Mark notification as read
  async markAsRead(token, notificationId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/${notificationId}/read`,
        {},
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mark notification as unread
  async markAsUnread(token, notificationId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/${notificationId}/unread`,
        {},
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mark notification as seen
  async markAsSeen(token, notificationId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/${notificationId}/seen`,
        {},
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mark all notifications as read
  async markAllAsRead(token) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/mark-all-read`,
        {},
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mark all notifications as seen
  async markAllAsSeen(token) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/mark-all-seen`,
        {},
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mark multiple notifications as read
  async markMultipleAsRead(token, notificationIds) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/mark-multiple-read`,
        { notificationIds },
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ======================== NOTIFICATION STATISTICS ========================

  // Get notification counts
  async getNotificationCounts(token) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/counts`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get notification counts by type
  async getNotificationCountsByType(token) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/counts/by-type`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get badge count (for app icon badge)
  async getBadgeCount(token) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/badge-count`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ======================== NOTIFICATION PREFERENCES ========================

  // Get user notification preferences
  async getNotificationPreferences(token) {
    try {
      const response = await axios.get(
        `${this.baseURL}/notifications/preferences`,
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update notification preference
  async updateNotificationPreference(token, notificationType, emailEnabled, pushEnabled, inAppEnabled) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/preferences`,
        {
          notificationType,
          emailEnabled,
          pushEnabled,
          inAppEnabled,
        },
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update multiple notification preferences
  async updateMultiplePreferences(token, preferences) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/preferences/bulk`,
        { preferences },
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Reset preferences to defaults
  async resetPreferencesToDefaults(token) {
    try {
      const response = await axios.post(
        `${this.baseURL}/notifications/preferences/reset`,
        {},
        { headers: this.getAuthHeaders(token) }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ======================== UTILITY METHODS ========================

  // Handle API errors
  handleError(error) {
    console.error('NotificationApiService Error:', error);
    
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      return new Error(data?.message || `HTTP ${status}: ${error.message}`);
    } else if (error.request) {
      // Network error
      return new Error('Network error: Please check your connection');
    } else {
      // Other error
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  // Get notification type icon
  getNotificationTypeIcon(type) {
    const iconMap = {
      LIKE: '❤️',
      COMMENT: '💬',
      REPLY: '↩️',
      FOLLOW: '👤',
      UNFOLLOW: '👤',
      MENTION: '@',
      TAG: '🏷️',
      POST_SHARED: '📤',
      POST_SAVED: '💾',
      WELCOME: '👋',
      ACCOUNT_VERIFIED: '✅',
      PASSWORD_CHANGED: '🔒',
      LOGIN_ALERT: '🚨',
      POST_APPROVED: '✅',
      POST_REJECTED: '❌',
      ACCOUNT_WARNING: '⚠️',
      ACCOUNT_SUSPENDED: '🚫',
      GROUP_INVITE: '👥',
      GROUP_REQUEST: '📩',
      GROUP_ACCEPTED: '✅',
      MILESTONE: '🎯',
      BADGE_EARNED: '🏆',
    };
    
    return iconMap[type] || '🔔';
  }

  // Get notification type color
  getNotificationTypeColor(type) {
    const colorMap = {
      LIKE: '#FF3B30',
      COMMENT: '#007AFF',
      REPLY: '#007AFF',
      FOLLOW: '#34C759',
      UNFOLLOW: '#8E8E93',
      MENTION: '#FF9500',
      TAG: '#AF52DE',
      POST_SHARED: '#007AFF',
      POST_SAVED: '#FF9500',
      WELCOME: '#34C759',
      ACCOUNT_VERIFIED: '#34C759',
      PASSWORD_CHANGED: '#FF9500',
      LOGIN_ALERT: '#FF3B30',
      POST_APPROVED: '#34C759',
      POST_REJECTED: '#FF3B30',
      ACCOUNT_WARNING: '#FF9500',
      ACCOUNT_SUSPENDED: '#FF3B30',
      GROUP_INVITE: '#007AFF',
      GROUP_REQUEST: '#007AFF',
      GROUP_ACCEPTED: '#34C759',
      MILESTONE: '#AF52DE',
      BADGE_EARNED: '#FF9500',
    };
    
    return colorMap[type] || '#8E8E93';
  }

  // Get notification priority color
  getPriorityColor(priority) {
    const priorityColors = {
      LOW: '#8E8E93',
      NORMAL: '#007AFF',
      HIGH: '#FF9500',
      URGENT: '#FF3B30',
    };
    
    return priorityColors[priority] || '#007AFF';
  }
}

// Create singleton instance
const notificationApiService = new NotificationApiService();

export default notificationApiService;
