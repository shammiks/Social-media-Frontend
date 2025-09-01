import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_ENDPOINTS } from '../utils/apiConfig';

// Async thunks for API calls
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ page = 0, size = 20, type = null }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;
      
      let url = `${API_ENDPOINTS.BASE}/notifications?page=${page}&size=${size}`;
      if (type) {
        url = `${API_ENDPOINTS.BASE}/notifications/type/${type}?page=${page}&size=${size}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return {
        notifications: response.data.content || [],
        totalPages: response.data.totalPages || 0,
        totalElements: response.data.totalElements || 0,
        currentPage: page,
        isFirstPage: page === 0
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notifications');
    }
  }
);

export const fetchUnreadNotifications = createAsyncThunk(
  'notifications/fetchUnreadNotifications',
  async ({ page = 0, size = 20 }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const response = await axios.get(
        `${API_ENDPOINTS.BASE}/notifications/unread?page=${page}&size=${size}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data.content || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch unread notifications');
    }
  }
);

export const fetchNotificationCounts = createAsyncThunk(
  'notifications/fetchNotificationCounts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const response = await axios.get(`${API_ENDPOINTS.BASE}/notifications/counts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notification counts');
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId, { getState, rejectWithValue, dispatch }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      // Make the API call to mark as read
      await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // After successful API call, fetch updated counts
      dispatch(fetchNotificationCounts());
      
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark notification as read');
    }
  }
);

export const markNotificationAsSeen = createAsyncThunk(
  'notifications/markAsSeen',
  async (notificationId, { getState, rejectWithValue, dispatch }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/${notificationId}/seen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // After successful API call, fetch updated counts
      dispatch(fetchNotificationCounts());
      
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark notification as seen');
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { getState, rejectWithValue, dispatch }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const response = await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/mark-all-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // After successful API call, fetch updated counts and fresh notifications
      dispatch(fetchNotificationCounts());
      dispatch(fetchNotifications({ page: 0, size: 20 }));
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

export const markAllAsSeen = createAsyncThunk(
  'notifications/markAllAsSeen',
  async (_, { getState, rejectWithValue, dispatch }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const response = await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/mark-all-seen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // After successful API call, fetch updated counts
      dispatch(fetchNotificationCounts());
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all as seen');
    }
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (notificationId, { getState, rejectWithValue, dispatch }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      await axios.delete(
        `${API_ENDPOINTS.BASE}/notifications/${notificationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // After successful deletion, fetch updated counts
      dispatch(fetchNotificationCounts());
      
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete notification');
    }
  }
);

// Notification types for filtering
export const NOTIFICATION_TYPES = {
  LIKE: 'LIKE',
  COMMENT: 'COMMENT',
  REPLY: 'REPLY',
  FOLLOW: 'FOLLOW',
  UNFOLLOW: 'UNFOLLOW',
  MENTION: 'MENTION',
  TAG: 'TAG',
  POST_SHARED: 'POST_SHARED',
  POST_SAVED: 'POST_SAVED',
  WELCOME: 'WELCOME',
  ACCOUNT_VERIFIED: 'ACCOUNT_VERIFIED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  LOGIN_ALERT: 'LOGIN_ALERT',
  POST_APPROVED: 'POST_APPROVED',
  POST_REJECTED: 'POST_REJECTED',
  ACCOUNT_WARNING: 'ACCOUNT_WARNING',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  GROUP_INVITE: 'GROUP_INVITE',
  GROUP_REQUEST: 'GROUP_REQUEST',
  GROUP_ACCEPTED: 'GROUP_ACCEPTED',
  MILESTONE: 'MILESTONE',
  BADGE_EARNED: 'BADGE_EARNED'
};

const initialState = {
  notifications: [],
  unreadNotifications: [],
  recentNotifications: [],
  loading: false,
  refreshing: false,
  error: null,
  
  // Pagination
  currentPage: 0,
  totalPages: 0,
  totalElements: 0,
  hasMore: true,
  
  // Counts
  unreadCount: 0,
  unseenCount: 0,
  
  // Real-time
  connected: false,
  lastUpdated: null,
  
  // UI State
  showPopup: false,
  popupNotification: null,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Real-time notification handling
    addRealTimeNotification: (state, action) => {
      const notification = action.payload;
      
      // Add to the beginning of notifications array
      state.notifications.unshift(notification);
      
      // Update counts
      if (!notification.isRead) {
        state.unreadCount += 1;
      }
      if (!notification.isSeen) {
        state.unseenCount += 1;
      }
      
      // Show popup for new notification
      state.showPopup = true;
      state.popupNotification = notification;
      state.lastUpdated = new Date().toISOString();
    },
    
    // Update notification counts from WebSocket or API
    updateNotificationCounts: (state, action) => {
      const { unreadCount, unseenCount } = action.payload;
      state.unreadCount = unreadCount || 0;
      state.unseenCount = unseenCount || 0;
    },
    
    // Mark notification as read locally (optimistic update)
    markAsReadLocally: (state, action) => {
      const notificationId = action.payload;
      
      // Update in notifications array
      const notification = state.notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
      
      // Update in unread notifications array
      state.unreadNotifications = state.unreadNotifications.filter(n => n.id !== notificationId);
    },
    
    // Mark notification as seen locally (optimistic update)
    markAsSeenLocally: (state, action) => {
      const notificationId = action.payload;
      
      const notification = state.notifications.find(n => n.id === notificationId);
      if (notification && !notification.isSeen) {
        notification.isSeen = true;
        state.unseenCount = Math.max(0, state.unseenCount - 1);
      }
    },
    
    // Mark all as read locally (optimistic update)
    markAllAsReadLocally: (state) => {
      state.notifications.forEach(notification => {
        if (!notification.isRead) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
        }
      });
      state.unreadNotifications = [];
      state.unreadCount = 0;
    },
    
    // Mark all as seen locally (optimistic update)
    markAllAsSeenLocally: (state) => {
      state.notifications.forEach(notification => {
        if (!notification.isSeen) {
          notification.isSeen = true;
        }
      });
      state.unseenCount = 0;
    },
    
    // WebSocket connection status
    setConnectionStatus: (state, action) => {
      state.connected = action.payload;
    },
    
    // UI actions
    hideNotificationPopup: (state) => {
      state.showPopup = false;
      state.popupNotification = null;
    },
    
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadNotifications = [];
      state.currentPage = 0;
      state.hasMore = true;
    },
    
    resetNotificationState: (state) => {
      return { ...initialState };
    },
  },
  
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        if (action.meta.arg.page === 0) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { notifications, totalPages, totalElements, currentPage, isFirstPage } = action.payload;
        
        if (isFirstPage) {
          // FIXED: Replace notifications completely with fresh data from backend
          state.notifications = notifications;
          state.refreshing = false;
        } else {
          // For pagination, append new notifications
          state.notifications = [...state.notifications, ...notifications];
        }
        
        state.currentPage = currentPage;
        state.totalPages = totalPages;
        state.totalElements = totalElements;
        state.hasMore = currentPage < totalPages - 1;
        state.loading = false;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.error = action.payload;
      })
      
    // Fetch unread notifications
    builder
      .addCase(fetchUnreadNotifications.fulfilled, (state, action) => {
        state.unreadNotifications = action.payload;
      })
      
    // Fetch notification counts
    builder
      .addCase(fetchNotificationCounts.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unreadCount || 0;
        state.unseenCount = action.payload.unseenCount || 0;
      })
      
    // FIXED: Mark as read - Apply optimistic update immediately
    builder
      .addCase(markNotificationAsRead.pending, (state, action) => {
        const notificationId = action.meta.arg;
        
        // Apply optimistic update immediately
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification && !notification.isRead) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        
        // Remove from unread notifications
        state.unreadNotifications = state.unreadNotifications.filter(n => n.id !== notificationId);
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        // API call succeeded, optimistic update already applied
        // Just ensure the state is consistent
        const notificationId = action.payload;
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        // API call failed, revert optimistic update
        const notificationId = action.meta.arg;
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.isRead = false;
          notification.readAt = null;
          state.unreadCount += 1;
          // Re-add to unread notifications if not already there
          if (!state.unreadNotifications.find(n => n.id === notificationId)) {
            state.unreadNotifications.unshift(notification);
          }
        }
      })
      
    // FIXED: Mark as seen - Apply optimistic update immediately
    builder
      .addCase(markNotificationAsSeen.pending, (state, action) => {
        const notificationId = action.meta.arg;
        
        // Apply optimistic update immediately
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification && !notification.isSeen) {
          notification.isSeen = true;
          state.unseenCount = Math.max(0, state.unseenCount - 1);
        }
      })
      .addCase(markNotificationAsSeen.fulfilled, (state, action) => {
        // API call succeeded, optimistic update already applied
        const notificationId = action.payload;
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.isSeen = true;
        }
      })
      .addCase(markNotificationAsSeen.rejected, (state, action) => {
        // API call failed, revert optimistic update
        const notificationId = action.meta.arg;
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.isSeen = false;
          state.unseenCount += 1;
        }
      })
      
    // FIXED: Mark all as read - Apply optimistic update immediately
    builder
      .addCase(markAllAsRead.pending, (state) => {
        // Apply optimistic update immediately
        state.notifications.forEach(notification => {
          if (!notification.isRead) {
            notification.isRead = true;
            notification.readAt = new Date().toISOString();
          }
        });
        state.unreadNotifications = [];
        state.unreadCount = 0;
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        // API call succeeded, optimistic update already applied
        // Ensure state is consistent
        state.notifications.forEach(notification => {
          notification.isRead = true;
          if (!notification.readAt) {
            notification.readAt = new Date().toISOString();
          }
        });
        state.unreadNotifications = [];
        state.unreadCount = 0;
      })
      .addCase(markAllAsRead.rejected, (state, action) => {
        // API call failed - need to refetch to get correct state
        console.error('Failed to mark all as read:', action.payload);
        // Don't revert optimistic update here as it's complex
        // Instead, let the next fetch restore the correct state
      })
      
    // FIXED: Mark all as seen - Apply optimistic update immediately
    builder
      .addCase(markAllAsSeen.pending, (state) => {
        // Apply optimistic update immediately
        state.notifications.forEach(notification => {
          if (!notification.isSeen) {
            notification.isSeen = true;
          }
        });
        state.unseenCount = 0;
      })
      .addCase(markAllAsSeen.fulfilled, (state) => {
        // API call succeeded, optimistic update already applied
        state.notifications.forEach(notification => {
          notification.isSeen = true;
        });
        state.unseenCount = 0;
      })
      .addCase(markAllAsSeen.rejected, (state, action) => {
        // API call failed - let next fetch restore correct state
        console.error('Failed to mark all as seen:', action.payload);
      })
      
    // Delete notification
    builder
      .addCase(deleteNotification.pending, (state, action) => {
        const notificationId = action.meta.arg;
        
        // Apply optimistic delete
        const notificationIndex = state.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex !== -1) {
          const notification = state.notifications[notificationIndex];
          
          // Update counts before removing
          if (!notification.isRead && state.unreadCount > 0) {
            state.unreadCount -= 1;
          }
          if (!notification.isSeen && state.unseenCount > 0) {
            state.unseenCount -= 1;
          }
          
          // Remove from arrays
          state.notifications.splice(notificationIndex, 1);
          state.unreadNotifications = state.unreadNotifications.filter(n => n.id !== notificationId);
        }
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        // API call succeeded, optimistic update already applied
        const notificationId = action.payload;
        
        // Ensure notification is removed (double-check)
        state.notifications = state.notifications.filter(n => n.id !== notificationId);
        state.unreadNotifications = state.unreadNotifications.filter(n => n.id !== notificationId);
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        // API call failed - refetch to restore correct state
        console.error('Failed to delete notification:', action.payload);
        // Complex to revert optimistic delete, better to refetch
      });
  },
});

export const {
  addRealTimeNotification,
  updateNotificationCounts,
  markAsReadLocally,
  markAsSeenLocally,
  markAllAsReadLocally,
  markAllAsSeenLocally,
  setConnectionStatus,
  hideNotificationPopup,
  clearNotifications,
  resetNotificationState,
} = notificationSlice.actions;

export default notificationSlice.reducer;