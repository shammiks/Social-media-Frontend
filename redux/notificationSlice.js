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
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark notification as read');
    }
  }
);

export const markNotificationAsSeen = createAsyncThunk(
  'notifications/markAsSeen',
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/${notificationId}/seen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark notification as seen');
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const response = await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/mark-all-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

export const markAllAsSeen = createAsyncThunk(
  'notifications/markAllAsSeen',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const response = await axios.post(
        `${API_ENDPOINTS.BASE}/notifications/mark-all-seen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all as seen');
    }
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      await axios.delete(
        `${API_ENDPOINTS.BASE}/notifications/${notificationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
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
    
    // Update notification counts
    updateNotificationCounts: (state, action) => {
      const { unreadCount, unseenCount } = action.payload;
      state.unreadCount = unreadCount || 0;
      state.unseenCount = unseenCount || 0;
    },
    
    // Mark notification as read locally
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
    
    // Mark notification as seen locally
    markAsSeenLocally: (state, action) => {
      const notificationId = action.payload;
      
      const notification = state.notifications.find(n => n.id === notificationId);
      if (notification && !notification.isSeen) {
        notification.isSeen = true;
        state.unseenCount = Math.max(0, state.unseenCount - 1);
      }
    },
    
    // Mark all as read locally
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
    
    // Mark all as seen locally
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
          state.notifications = notifications;
          state.refreshing = false;
        } else {
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
      
    // Mark as read
    builder
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notificationId = action.payload;
        notificationSlice.caseReducers.markAsReadLocally(state, { payload: notificationId });
      })
      
    // Mark as seen
    builder
      .addCase(markNotificationAsSeen.fulfilled, (state, action) => {
        const notificationId = action.payload;
        notificationSlice.caseReducers.markAsSeenLocally(state, { payload: notificationId });
      })
      
    // Mark all as read
    builder
      .addCase(markAllAsRead.fulfilled, (state) => {
        notificationSlice.caseReducers.markAllAsReadLocally(state);
      })
      
    // Mark all as seen
    builder
      .addCase(markAllAsSeen.fulfilled, (state) => {
        notificationSlice.caseReducers.markAllAsSeenLocally(state);
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const notificationId = action.payload;
        state.notifications = state.notifications.filter(n => n.id !== notificationId);
        state.unreadNotifications = state.unreadNotifications.filter(n => n.id !== notificationId);
        // Update counts
        if (state.unreadCount > 0) {
          state.unreadCount -= 1;
        }
        if (state.unseenCount > 0) {
          state.unseenCount -= 1;
        }
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
