// redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import bookmarkReducer from './bookmarkSlice';
import chatReducer from './ChatSlice';
import notificationReducer from './notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    bookmarks: bookmarkReducer,
    chat: chatReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['chat/setOnlineUsers'],
        ignoredPaths: ['chat.onlineUsers'],
      },
    }),
});

