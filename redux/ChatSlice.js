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

export const markAllAsRead = createAsyncThunk(
  'chat/markAllAsRead',
  async (chatId, { dispatch, rejectWithValue }) => {
    try {
      await ChatAPI.markAllAsRead(chatId);
      dispatch(markChatAsRead(chatId));
      return chatId;
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
   // In your ChatSlice.js, update the addMessageViaSocket reducer:

// In your ChatSlice.js, update the addMessageViaSocket reducer with debugging:

addMessageViaSocket: (state, action) => {
  const { chatId, message } = action.payload;
  console.log('🔵 Redux: addMessageViaSocket called with chatId:', chatId);
  console.log('🔵 Redux: Message data:', JSON.stringify(message, null, 2));
  console.log('🔵 Redux: Current messages for chat', chatId, ':', state.messages[chatId]?.length || 0);
  
  // Null check for message
  if (!message) {
    console.warn('🟡 Redux: Received null message, ignoring');
    return;
  }
  
  if (!state.messages[chatId]) {
    console.log('🔵 Redux: Creating new messages array for chat:', chatId);
    state.messages[chatId] = [];
  }
  
  // Check if message already exists
  const exists = state.messages[chatId].some(msg => msg && msg.id === message.id);
  console.log('🔵 Redux: Message exists check - ID:', message.id, 'Exists:', exists);
  
  if (!exists) {
    console.log('🔵 Redux: Adding new message via socket to chat:', chatId);
    console.log('🔵 Redux: Message content:', message.content);
    console.log('🔵 Redux: Messages array before add:', state.messages[chatId].length);
    
    // CRITICAL: Add message to the BEGINNING of array (newest first)
    // This matches how messages are stored after loadChatMessages
    state.messages[chatId].unshift(message);
    
    console.log('🔵 Redux: Messages array after add:', state.messages[chatId].length);
    console.log('🔵 Redux: New message at index 0:', state.messages[chatId][0]?.content);
    
    // Update chat's last message
    const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
    if (chatIndex !== -1) {
      console.log('🔵 Redux: Updating chat last message for chat index:', chatIndex);
      state.chats[chatIndex].lastMessage = message;
      state.chats[chatIndex].lastMessageAt = message.createdAt;
      
      // Move chat to top of list
      const [updatedChat] = state.chats.splice(chatIndex, 1);
      state.chats.unshift(updatedChat);
      console.log('🔵 Redux: Moved chat to top of list');
    } else {
      console.log('🟡 Redux: Chat not found in chats array for updating last message');
    }
    
    // Increment unread count if not current chat
    if (!state.currentChat || state.currentChat.id !== chatId) {
      const oldCount = state.unreadCounts[chatId] || 0;
      state.unreadCounts[chatId] = oldCount + 1;
      console.log('🔵 Redux: Updated unread count from', oldCount, 'to', state.unreadCounts[chatId]);
    } else {
      console.log('🔵 Redux: Not updating unread count - this is current chat');
    }
    
    console.log('🟢 Redux: Message successfully added via socket');
  } else {
    console.log('🟡 Redux: Message already exists, skipping duplicate');
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
    updateTypingUser: (state, action) => {
      const { chatId, userId, isTyping } = action.payload;
      
      if (!state.typingUsers[chatId]) {
        state.typingUsers[chatId] = [];
      }
      
      if (isTyping) {
        // Add user to typing list if not already there
        if (!state.typingUsers[chatId].includes(userId)) {
          state.typingUsers[chatId].push(userId);
        }
      } else {
        // Remove user from typing list
        state.typingUsers[chatId] = state.typingUsers[chatId].filter(id => id !== userId);
      }
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
    readStatusUpdated: (state, action) => {
      const { chatId, messageId, userId } = action.payload;
      console.log('Redux: readStatusUpdated called for chat:', chatId, 'message:', messageId, 'user:', userId);
      
      // Update the specific message's read status
      if (state.messages[chatId]) {
        const messageIndex = state.messages[chatId].findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          const message = state.messages[chatId][messageIndex];
          // Increment readByCount if this user hasn't read it before
          if (!message.readByUsers || !message.readByUsers.includes(userId)) {
            console.log('Redux: Updating read status for message:', messageId);
            state.messages[chatId][messageIndex] = {
              ...message,
              readByCount: (message.readByCount || 0) + 1,
              readByUsers: [...(message.readByUsers || []), userId]
            };
          }
        }
      }
    },
    markChatAsRead: (state, action) => {
      const chatId = action.payload;
      
      // Reset unread count for the chat
      state.unreadCounts[chatId] = 0;
      
      // Update chat's unread count in chats list
      const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = {
          ...state.chats[chatIndex],
          unreadCount: 0
        };
      }
    },
    chatReadUpdated: (state, action) => {
      const { chatId, unreadCount } = action.payload;
      
      // Update unread count from WebSocket
      state.unreadCounts[chatId] = unreadCount;
      
      // Update chat's unread count in chats list
      const chatIndex = state.chats.findIndex(chat => chat.id === chatId);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = {
          ...state.chats[chatIndex],
          unreadCount: unreadCount
        };
      }
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
  updateTypingUser,
  updateChat,
  removeChat,
  clearError,
  setOnlineUsers,
  readStatusUpdated,
  markChatAsRead,
  chatReadUpdated,
} = chatSlice.actions;

export default chatSlice.reducer;