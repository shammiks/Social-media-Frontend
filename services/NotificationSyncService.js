// services/NotificationSyncService.js
import { 
  fetchNotifications, 
  fetchNotificationCounts,
  markAsReadLocally,
  updateNotificationCounts 
} from '../redux/notificationSlice';

class NotificationSyncService {
  constructor() {
    this.syncQueue = new Map(); // Track pending operations
    this.retryAttempts = new Map(); // Track retry counts
    this.maxRetries = 3;
  }

  /**
   * Enhanced mark as read with proper error handling and retry logic
   */
  async markAsReadWithSync(dispatch, notificationId, token) {
    const operationId = `read-${notificationId}`;
    
    try {
      // Add to sync queue
      this.syncQueue.set(operationId, { type: 'markAsRead', notificationId });
      
      // Apply optimistic update immediately
      dispatch(markAsReadLocally(notificationId));
      
      // Make API call
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success - remove from sync queue and update counts
      this.syncQueue.delete(operationId);
      this.retryAttempts.delete(operationId);
      
      // Fetch updated counts to ensure consistency
      dispatch(fetchNotificationCounts());
      
      return { success: true, notificationId };
      
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      
      // Handle retry logic
      const retries = this.retryAttempts.get(operationId) || 0;
      
      if (retries < this.maxRetries) {
        this.retryAttempts.set(operationId, retries + 1);
        console.log(`Retrying mark as read for notification ${notificationId}, attempt ${retries + 1}`);
        
        // Retry after a delay
        setTimeout(() => {
          this.markAsReadWithSync(dispatch, notificationId, token);
        }, 1000 * Math.pow(2, retries)); // Exponential backoff
        
      } else {
        // Max retries exceeded - sync with backend to get correct state
        console.error(`Max retries exceeded for notification ${notificationId}, syncing with backend`);
        this.syncQueue.delete(operationId);
        this.retryAttempts.delete(operationId);
        
        // Fetch fresh data from backend to restore correct state
        dispatch(fetchNotifications({ page: 0, size: 20 }));
        dispatch(fetchNotificationCounts());
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync all pending operations
   */
  async syncPendingOperations(dispatch, token) {
    const pendingOps = Array.from(this.syncQueue.entries());
    
    for (const [operationId, operation] of pendingOps) {
      try {
        switch (operation.type) {
          case 'markAsRead':
            await this.markAsReadWithSync(dispatch, operation.notificationId, token);
            break;
          // Add other operation types as needed
        }
      } catch (error) {
        console.error(`Failed to sync operation ${operationId}:`, error);
      }
    }
  }

  /**
   * Check if there are pending operations
   */
  hasPendingOperations() {
    return this.syncQueue.size > 0;
  }

  /**
   * Clear all pending operations (useful for logout)
   */
  clearPendingOperations() {
    this.syncQueue.clear();
    this.retryAttempts.clear();
  }

  /**
   * Force sync with backend - useful when returning to the app
   */
  async forceSyncWithBackend(dispatch, token) {
    try {
      // Fetch fresh notifications and counts
      const [notificationsResult, countsResult] = await Promise.allSettled([
        dispatch(fetchNotifications({ page: 0, size: 20 })).unwrap(),
        dispatch(fetchNotificationCounts()).unwrap()
      ]);

      if (notificationsResult.status === 'rejected') {
        console.error('Failed to fetch notifications:', notificationsResult.reason);
      }

      if (countsResult.status === 'rejected') {
        console.error('Failed to fetch counts:', countsResult.reason);
      }

      return {
        notificationsSuccess: notificationsResult.status === 'fulfilled',
        countsSuccess: countsResult.status === 'fulfilled'
      };
      
    } catch (error) {
      console.error('Failed to sync with backend:', error);
      return { notificationsSuccess: false, countsSuccess: false };
    }
  }

  /**
   * Handle network reconnection
   */
  async handleNetworkReconnection(dispatch, token) {
    console.log('Network reconnected, syncing notifications...');
    
    // Sync pending operations first
    await this.syncPendingOperations(dispatch, token);
    
    // Then force sync with backend
    await this.forceSyncWithBackend(dispatch, token);
  }

  /**
   * Validate notification state consistency
   */
  validateStateConsistency(notifications, unreadCount, unseenCount) {
    const actualUnreadCount = notifications.filter(n => !n.isRead).length;
    const actualUnseenCount = notifications.filter(n => !n.isSeen).length;
    
    const inconsistencies = {
      unreadMismatch: actualUnreadCount !== unreadCount,
      unseenMismatch: actualUnseenCount !== unseenCount,
      actualUnreadCount,
      actualUnseenCount,
      reportedUnreadCount: unreadCount,
      reportedUnseenCount: unseenCount
    };
    
    if (inconsistencies.unreadMismatch || inconsistencies.unseenMismatch) {
      console.warn('Notification state inconsistency detected:', inconsistencies);
      return false;
    }
    
    return true;
  }

  /**
   * Fix state inconsistencies
   */
  async fixStateInconsistencies(dispatch, token, notifications, unreadCount, unseenCount) {
    if (!this.validateStateConsistency(notifications, unreadCount, unseenCount)) {
      console.log('Fixing notification state inconsistencies...');
      await this.forceSyncWithBackend(dispatch, token);
    }
  }
}

// Create singleton instance
const notificationSyncService = new NotificationSyncService();

export default notificationSyncService;