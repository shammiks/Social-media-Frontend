import React, { createContext, useContext, useReducer, useEffect } from 'react';
import ChatAPI from '../services/ChatApi';
import WebSocketService from '../services/WebSocketService';

const ChatContext = createContext();

const initialState = {
  chats: [],
  currentChat: null,
  messages: {},
  isLoading: false,
  error: null,
  typingUsers: {},
  unreadCounts: {},
  onlineUsers: new Set(),
};

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_CHATS':
      return { ...state, chats: action.payload, isLoading: false };
    
    case 'ADD_CHAT':
      return { ...state, chats: [action.payload, ...state.chats] };
    
    case 'UPDATE_CHAT':
      return {
        ...state,
        chats: state.chats.map(chat => 
          chat.id === action.payload.id ? action.payload : chat
        ),
      };
    
    case 'DELETE_CHAT':
      return {
        ...state,
        chats: state.chats.filter(chat => chat.id !== action.payload),
        currentChat: state.currentChat?.id === action.payload ? null : state.currentChat,
      };
    
    case 'SET_CURRENT_CHAT':
      return { ...state, currentChat: action.payload };
    
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: action.payload.messages,
        },
      };
    
    case 'ADD_MESSAGE':
      const { chatId, message } = action.payload;
      const currentMessages = state.messages[chatId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: [message, ...currentMessages],
        },
        chats: state.chats.map(chat => 
          chat.id === chatId 
            ? { ...chat, lastMessage: message, lastMessageAt: message.createdAt }
            : chat
        ),
      };
    
    case 'UPDATE_MESSAGE':
      const { chatId: updateChatId, messageId, updates } = action.payload;
      const messagesForChat = state.messages[updateChatId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [updateChatId]: messagesForChat.map(msg => 
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      };
    
    case 'DELETE_MESSAGE':
      const { chatId: deleteChatId, messageId: deleteMessageId } = action.payload;
      const remainingMessages = (state.messages[deleteChatId] || []).filter(
        msg => msg.id !== deleteMessageId
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [deleteChatId]: remainingMessages,
        },
      };
    
    case 'SET_TYPING_USERS':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.payload.chatId]: action.payload.users,
        },
      };
    
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload.chatId]: action.payload.count,
        },
      };
    
    case 'SET_ONLINE_USERS':
      return {
        ...state,
        onlineUsers: new Set(action.payload),
      };
    
    default:
      return state;
  }
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Initialize WebSocket connection
  useEffect(() => {
    WebSocketService.connect();
    
    return () => {
      WebSocketService.disconnect();
    };
  }, []);

  // Chat operations
  const loadChats = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const chats = await ChatAPI.getUserChatsList();
      dispatch({ type: 'SET_CHATS', payload: chats });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  const createChat = async (participants, chatName = '', isGroup = false) => {
    try {
      const newChat = await ChatAPI.createChat(participants, chatName, isGroup);
      dispatch({ type: 'ADD_CHAT', payload: newChat });
      return newChat;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const selectChat = async (chat) => {
    dispatch({ type: 'SET_CURRENT_CHAT', payload: chat });
    
    // Load messages for this chat
    if (!state.messages[chat.id]) {
      await loadMessages(chat.id);
    }
    
    // Subscribe to real-time updates
    WebSocketService.subscribeToChat(chat.id, handleWebSocketMessage);
    WebSocketService.joinChat(chat.id);
    
    // Mark messages as read
    await ChatAPI.markAllAsRead(chat.id);
    dispatch({ type: 'SET_UNREAD_COUNT', payload: { chatId: chat.id, count: 0 } });
  };

  const loadMessages = async (chatId, page = 0) => {
    try {
      const response = await ChatAPI.getChatMessages(chatId, page);
      const messages = response.content || response;
      dispatch({ 
        type: 'SET_MESSAGES', 
        payload: { chatId, messages: messages.reverse() } 
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  const sendMessage = async (chatId, content, messageType = 'TEXT', mediaFileId = null) => {
    try {
      const message = await ChatAPI.sendMessage(chatId, content, messageType, mediaFileId);
      // Message will be added via WebSocket, but add optimistically
      dispatch({ type: 'ADD_MESSAGE', payload: { chatId, message } });
      return message;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'NEW_MESSAGE':
        dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: { chatId: data.chatId, message: data.message } 
        });
        break;
      
      case 'MESSAGE_UPDATED':
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: { 
            chatId: data.chatId, 
            messageId: data.messageId, 
            updates: data.updates 
          }
        });
        break;
      
      case 'MESSAGE_DELETED':
        dispatch({
          type: 'DELETE_MESSAGE',
          payload: { chatId: data.chatId, messageId: data.messageId }
        });
        break;
      
      case 'TYPING_INDICATOR':
        dispatch({
          type: 'SET_TYPING_USERS',
          payload: { chatId: data.chatId, users: data.typingUsers }
        });
        break;
      
      case 'CHAT_UPDATED':
        dispatch({ type: 'UPDATE_CHAT', payload: data.chat });
        break;
      
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const sendTypingIndicator = (chatId, isTyping) => {
    WebSocketService.sendTypingIndicator(chatId, isTyping);
  };

  const value = {
    ...state,
    loadChats,
    createChat,
    selectChat,
    loadMessages,
    sendMessage,
    sendTypingIndicator,
    dispatch,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
