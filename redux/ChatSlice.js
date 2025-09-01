import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import ChatAPI from '../services/ChatApi';

// Async thunks for chat operations
export const loadChats = createAsyncThunk(
  'chat/loadChats',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const result = await ChatAPI.getUserChatsList();
      return result;
    } catch (error) {
      console.error('Failed to load chats in Redux action:', error);
      
      // If it's an authentication error, we might want to logout the user
      if (error.message.includes('Authentication failed') || error.message.includes('No valid authentication token')) {
        // You could dispatch a logout action here if needed
        // dispatch(logout());
      }
      
      return rejectWithValue(error.message);
    }
  }
);

export const loadChatMessages = createAsyncThunk(
  'chat/loadChatMessages',
  async ({ chatId, page = 0 }, { rejectWithValue }) => {
    try {
      const response = await ChatAPI.getChatMessages(chatId, page);
      return {
        chatId,
        messages: response.content || response,
        page,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Replace your existing sendMessage thunk with this:

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (messageData, { rejectWithValue, getState }) => {
    try {
      // Support both old call format and new complete payload format
      let payload;
      
      if (messageData.mediaUrl || messageData.mediaType || messageData.mediaSize || messageData.thumbnailUrl) {
        // New format: complete payload object for media messages
        payload = messageData;
      } else {
        // Old format: for backward compatibility with text messages
        const { chatId, content, messageType = 'TEXT', mediaFileId = null } = messageData;
        payload = { chatId, content, messageType };
        
        // Add mediaFileId if provided (for backward compatibility)
        if (mediaFileId) {
          payload.mediaFileId = mediaFileId;
        }
      }
      
      console.log('Redux sendMessage: Dispatching payload:', payload);
      
      // Pass the complete payload object to ChatAPI
      const message = await ChatAPI.sendMessage(payload);
      
      // Get current user from state
      const state = getState();
      const currentUserId = state.auth.user?.id;
      
      return { chatId: payload.chatId, message, currentUserId };
    } catch (error) {
      console.error('Redux sendMessage failed:', error);
      return rejectWithValue(error.message);
    }
  }
);
export const createNewChat = createAsyncThunk(
  'chat/createChat',
  async ({ participants, chatName = '' }, { rejectWithValue }) => {
    try {
      return await ChatAPI.createChat(participants, chatName, 'PRIVATE');
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  chats: [],
  currentChat: null,
  messages: {},
  isLoading: false, // For loading chats list
  isLoadingMessages: false, // For loading individual chat messages
  error: null,
  typingUsers: {},
  unreadCounts: {},
  onlineUsers: new Set(),
  sendingMessage: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentChat: (state, action) => {
      state.currentChat = action.payload;
      // Reset unread count for current chat
      if (action.payload) {
        state.unreadCounts[action.payload.id] = 0;
      }
    },
    addMessageViaSocket: (state, action) => {
      const { chatId, message } = action.payload;
      
      // Null check for message
      if (!message) {
        console.warn('addMessageViaSocket: Received null message, ignoring');
        return;
      }
      
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      
      // Check if message already exists (avoid duplicates)
      const exists = state.messages[chatId].some(msg => msg && msg.id === message.id);
      if (!exists) {
        // Keep the message as is - WebSocket messages should have proper sender info
        // If senderId is missing, it's likely from another user (since WebSocket typically sends others' messages)
        state.messages[chatId].push(message);
        
        // Update chat's last message
        const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
        if (chatIndex !== -1) {
          state.chats[chatIndex].lastMessage = message;
          state.chats[chatIndex].lastMessageAt = message.createdAt;
          
          // Move chat to top of list
          const [updatedChat] = state.chats.splice(chatIndex, 1);
          state.chats.unshift(updatedChat);
        }
        
        // Increment unread count if not current chat
        if (!state.currentChat || state.currentChat.id !== chatId) {
          state.unreadCounts[chatId] = (state.unreadCounts[chatId] || 0) + 1;
        }
      }
    },
    updateMessageViaSocket: (state, action) => {
      const { chatId, messageId, updates } = action.payload;
      if (state.messages[chatId]) {
        const messageIndex = state.messages[chatId].findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          state.messages[chatId][messageIndex] = {
            ...state.messages[chatId][messageIndex],
            ...updates,
          };
        }
      }
    },
    deleteMessageViaSocket: (state, action) => {
      const { chatId, messageId } = action.payload;
      if (state.messages[chatId]) {
        state.messages[chatId] = state.messages[chatId].filter(msg => msg.id !== messageId);
      }
    },
    setTypingUsers: (state, action) => {
      const { chatId, users } = action.payload;
      state.typingUsers[chatId] = users;
    },
    updateChat: (state, action) => {
      const updatedChat = action.payload;
      const chatIndex = state.chats.findIndex(chat => chat.id === updatedChat.id);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = updatedChat;
      }
    },
    removeChat: (state, action) => {
      const chatId = action.payload;
      state.chats = state.chats.filter(chat => chat.id !== chatId);
      delete state.messages[chatId];
      delete state.typingUsers[chatId];
      delete state.unreadCounts[chatId];
      
      if (state.currentChat?.id === chatId) {
        state.currentChat = null;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    setOnlineUsers: (state, action) => {
      state.onlineUsers = new Set(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Load chats
      .addCase(loadChats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadChats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.chats = action.payload;
        
        // Initialize unread counts
        action.payload.forEach(chat => {
          if (!state.unreadCounts[chat.id]) {
            state.unreadCounts[chat.id] = chat.unreadCount || 0;
          }
        });
      })
      .addCase(loadChats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Load messages
      .addCase(loadChatMessages.pending, (state) => {
        state.isLoadingMessages = true;
      })
      .addCase(loadChatMessages.fulfilled, (state, action) => {
        state.isLoadingMessages = false;
        const { chatId, messages, page } = action.payload;
        
        // Filter out null messages to prevent rendering errors
        const validMessages = (messages || []).filter(msg => msg != null);
        
        if (page === 0) {
          state.messages[chatId] = validMessages.reverse();
        } else {
          // Append older messages for pagination
          state.messages[chatId] = [...validMessages.reverse(), ...state.messages[chatId]];
        }
      })
      .addCase(loadChatMessages.rejected, (state, action) => {
        state.isLoadingMessages = false;
        state.error = action.payload;
      })
      
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.sendingMessage = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sendingMessage = false;
        // Message will be added via WebSocket, but add optimistically
        const { chatId, message, currentUserId } = action.payload;
        if (!state.messages[chatId]) {
          state.messages[chatId] = [];
        }
        
        // Add message if not already exists (optimistic update)
        const exists = state.messages[chatId].some(msg => msg.id === message.id);
        if (!exists) {
          // Ensure the message has proper senderId for identification
          const enhancedMessage = {
            ...message,
            // Set the senderId to current user ID since they just sent it
            senderId: message.senderId || currentUserId
          };
          state.messages[chatId].push(enhancedMessage);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sendingMessage = false;
        state.error = action.payload;
      })
      
      // Create chat
      .addCase(createNewChat.fulfilled, (state, action) => {
        state.chats.unshift(action.payload);
      })
      .addCase(createNewChat.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const {
  setCurrentChat,
  addMessageViaSocket,
  updateMessageViaSocket,
  deleteMessageViaSocket,
  setTypingUsers,
  updateChat,
  removeChat,
  clearError,
  setOnlineUsers,
} = chatSlice.actions;

export default chatSlice.reducer;