// redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import bookmarkReducer from './bookmarkSlice';
import chatReducer from './ChatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    bookmarks: bookmarkReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['chat/setOnlineUsers'],
        ignoredPaths: ['chat.onlineUsers'],
      },
    }),
});

