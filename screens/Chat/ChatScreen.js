import React, { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Keyboard,
  Image,
  StatusBar,
  Dimensions,
  Modal,
  ScrollView,
  ActionSheetIOS,
} from 'react-native';
import MessageItem from '../../components/Chat/MessageItem';
import ChatInputBar from '../../components/Chat/ChatInputBar';
import * as Clipboard from 'expo-clipboard';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { 
  loadChatMessages, 
  sendMessage, 
  setCurrentChat 
} from '../../redux/ChatSlice';
import WebSocketService from '../../services/WebSocketService';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_ENDPOINTS } from '../../utils/apiConfig';

const { height: screenHeight } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }) => {
  const { chat, targetUser } = route.params || {};
  
  // Early return if chat is not provided
  if (!chat) {
    console.error('ChatScreen: No chat object provided in route params');
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Chat not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const dispatch = useDispatch();
  const {
    messages,
    currentChat,
    typingUsers,
    sendingMessage
  } = useSelector(state => state.chat);
  const { user } = useSelector(state => state.auth);
  
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // typingTimeoutRef is already declared above
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageOptionsModal, setMessageOptionsModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [reactionModal, setReactionModal] = useState({ visible: false, messageId: null });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  // ...existing code...
  // Media sharing callback
  const handleSendMediaMessage = async (mediaData) => {
    try {
      // Determine messageType and mediaFileId
      let messageType = 'DOCUMENT';
      if (mediaData.messageType) {
        messageType = mediaData.messageType;
      } else if (mediaData.mimeType) {
        if (mediaData.mimeType.startsWith('image/')) messageType = 'IMAGE';
        else if (mediaData.mimeType.startsWith('video/')) messageType = 'VIDEO';
        else if (mediaData.mimeType.startsWith('audio/')) messageType = 'AUDIO';
      }
      const mediaFileId = mediaData.id;
      const payload = {
        chatId: chat.id,
        content: '',
        messageType,
        mediaUrl: mediaData.fileUrl || mediaData.file_url || mediaData.url || '',
        mediaType: mediaData.mimeType || mediaData.fileType || undefined,
        mediaSize: mediaData.fileSize || undefined,
        thumbnailUrl: mediaData.thumbnailUrl || undefined,
      };
      
      const result = await dispatch(sendMessage(payload)).unwrap();
      
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      Alert.alert('Send failed', e.message || 'Could not send media message');
    }
  };

  // Filter out null/undefined messages to prevent rendering errors
  const rawMessages = messages[chat?.id] || [];
  const chatMessages = rawMessages.filter(message => message != null);
  
  // Only show typing indicator if another user is typing
  const chatTypingUsersRaw = typingUsers[chat?.id] || [];
  const chatTypingUsers = chatTypingUsersRaw.filter(uid => uid && uid !== user?.id);

  // Send typing indicator to backend
  const sendTypingIndicator = useCallback((typing) => {
    if (WebSocketService.client && WebSocketService.isConnected) {
      WebSocketService.client.publish({
        destination: `/app/chat/${chat.id}/typing`,
        body: JSON.stringify({ isTyping: typing }),
      });
    }
  }, [chat.id]);

  // Integrate typing indicator logic into the existing handleTextChange

  // API Functions
  const { token } = useSelector(state => state.auth);

  // Helper function to check if a message belongs to the current user
  const isMessageMine = (message) => {
    // Null check for message
    if (!message) {
      return false;
    }
    
    const currentUserId = user?.id;
    
    if (!currentUserId) {
      return false;
    }
    
    // Check various possible sender ID fields
    const possibleSenderIds = [
      message.senderId,
      message.userId, 
      message.authorId,
      message.sender?.id,
      message.user?.id,
      message.author?.id
    ];
    
    // Check if any sender ID matches current user (handle both string and number comparisons)
    for (const senderId of possibleSenderIds) {
      if (senderId == null) continue;
      
      const senderIdStr = String(senderId);
      const currentUserIdStr = String(currentUserId);
      
      if (senderIdStr === currentUserIdStr) {
        return true;
      }
    }
    
    // Fallback checks
    // Check by display name
    const senderName = message.senderName || message.sender?.displayName || message.sender?.name;
    if (senderName === 'You') {
      return true;
    }
    
    if (senderName && (senderName === user?.username || senderName === user?.displayName)) {
      return true;
    }
    
    // Check by email
    const senderEmail = message.senderEmail || message.sender?.email;
    if (senderEmail && senderEmail === user?.email) {
      return true;
    }
    
    return false;
  };

  const editMessage = async (messageId, newContent) => {
    try {
      const response = await axios.put(
        `${API_ENDPOINTS.BASE}/messages/${messageId}`,
        { content: newContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      dispatch(loadChatMessages({ chatId: chat.id }));
      return response.data;
    } catch (error) {
      Alert.alert('Error', 'Failed to edit message');
      console.error('Edit message error:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(
        `${API_ENDPOINTS.BASE}/messages/${messageId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      dispatch(loadChatMessages({ chatId: chat.id }));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
      console.error('Delete message error:', error);
    }
  };

  const togglePinMessage = async (messageId) => {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.BASE}/messages/${messageId}/pin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      dispatch(loadChatMessages({ chatId: chat.id }));
      loadPinnedMessages();
      return response.data;
    } catch (error) {
      Alert.alert('Error', 'Failed to pin/unpin message');
      console.error('Pin message error:', error);
    }
  };

  const addReaction = async (messageId, emoji) => {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.BASE}/messages/${messageId}/react`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      dispatch(loadChatMessages({ chatId: chat.id }));
      return response.data;
    } catch (error) {
      Alert.alert('Error', 'Failed to add reaction');
      console.error('Reaction error:', error);
    }
  };

  const searchMessages = async (query) => {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.BASE}/messages/chat/${chat.id}/search?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSearchResults(response.data.content || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const loadPinnedMessages = async () => {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.BASE}/messages/chat/${chat.id}/pinned`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPinnedMessages(response.data || []);
    } catch (error) {
      console.error('Load pinned messages error:', error);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await axios.post(
        `${API_ENDPOINTS.BASE}/messages/${messageId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessageText(prev => prev + emoji);
    // setShowEmojiPicker(false); // Keep picker open for multiple emoji selection
  };

  useLayoutEffect(() => {
    // Set navigation header with chat name
    const getChatDisplayName = (chat) => {
      if (chat.chatName) {
        return chat.chatName;
      }
      
      // Try to find other participant from chat.participants
      const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
      if (otherParticipant?.user?.displayName) {
        return otherParticipant.user.displayName;
      }
      
      // Fallback to targetUser if provided (when coming from profile)
      if (targetUser && targetUser.id && targetUser.id !== user?.id) {
        return targetUser.displayName || targetUser.username;
      }
      
      // Final fallback
      return 'Chat';
    };

    navigation.setOptions({
      headerShown: false, // We'll create our own custom header
    });
  }, [chat, navigation, user, targetUser]);

  useEffect(() => {
    dispatch(setCurrentChat(chat));
    dispatch(loadChatMessages({ chatId: chat.id }));

    // Set up WebSocket connection
    WebSocketService.setDispatch(dispatch);
    WebSocketService.subscribeToChat(chat.id, dispatch);
    WebSocketService.joinChat(chat.id);

    return () => {
      // Clean up when leaving chat
      WebSocketService.leaveChat(chat.id);
      WebSocketService.unsubscribeFromChat(chat.id);
      dispatch(setCurrentChat(null));
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Send stop typing indicator
      if (isTyping) {
        sendTypingIndicator(false);
        setIsTyping(false);
      }
    };
  }, [chat, dispatch]);

  // Mark messages as read when the RECEIVER views them (not when sender sees own messages)
  useEffect(() => {
    if (chatMessages.length > 0 && user?.id) {
      // Only mark messages as read if:
      // 1. I'm NOT the sender (I'm the receiver)
      // 2. The message is not already marked as read
      // 3. The message is delivered
      const unreadMessagesFromOthers = chatMessages.filter(message => {
        const isFromOtherUser = !isMessageMine(message);
        const isUnread = !message.isRead;
        const isDelivered = message.isDelivered !== false; // Default to true if undefined
        
        return isFromOtherUser && isUnread && isDelivered;
      });
      
      // Mark each unread message from others as read
      unreadMessagesFromOthers.forEach(message => {
        markAsRead(message.id);
      });
    }
  }, [chatMessages, user?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages.length]);

  // Keyboard handling for better input visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setShowEmojiPicker(false); // Close emoji picker when keyboard shows
      // Auto scroll to bottom when keyboard shows
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const handleSendMessage = async () => {
    if (messageText.trim()) {
      const content = messageText.trim();
      setMessageText('');
      
      try {
        const result = await dispatch(sendMessage({ 
          chatId: chat.id, 
          content 
        })).unwrap();
        
        // Stop typing indicator
        if (isTyping) {
          setIsTyping(false);
          WebSocketService.sendTypingIndicator(chat.id, false);
        }
        
        flatListRef.current?.scrollToEnd({ animated: true });
      } catch (error) {
        Alert.alert('Error', 'Failed to send message');
        setMessageText(content); // Restore message on error
      }
    }
  };

  const handleTextChange = (text) => {
    setMessageText(text);
    
    // Handle typing indicator
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      WebSocketService.sendTypingIndicator(chat.id, true);
    } else if (text.length === 0 && isTyping) {
      setIsTyping(false);
      WebSocketService.sendTypingIndicator(chat.id, false);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        WebSocketService.sendTypingIndicator(chat.id, false);
      }
    }, 2000);
  };

  const renderMessage = ({ item: message }) => {
    return (
      <MessageItem
        message={message}
        user={user}
        chat={chat}
        onMessageLongPress={handleMessageLongPress}
        onReactionPress={addReaction}
        isMessageMine={isMessageMine(message)}
      />
    );
  };

  const renderTypingIndicator = () => {
    if (chatTypingUsers.length === 0) return null;

    const typingText = chatTypingUsers.length === 1
      ? `${chatTypingUsers[0].displayName} is typing...`
      : `${chatTypingUsers.length} people are typing...`;

    return (
      <View style={styles.typingIndicator}>
        <Text style={styles.typingText}>{typingText}</Text>
      </View>
    );
  };

  // Get chat display name helper function
  const getChatDisplayName = (chat) => {
    // If it's a named group chat, return the chat name
    if (chat.chatName && chat.chatName.trim()) {
      return chat.chatName;
    }
    
    // For private chats, find the other participant
    const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
    
    if (otherParticipant?.user) {
      const otherUser = otherParticipant.user;
      // Prefer displayName, then username, then fallback to 'User'
      return otherUser.displayName || 
             otherUser.username || 
             'User';
    }
    
    // Fallback to targetUser if provided (when coming from profile)
    if (targetUser && targetUser.id !== user?.id) {
      return targetUser.displayName || 
             targetUser.username || 
             'User';
    }
    
    // Try to extract from chat ID or other properties
    if (chat.id) {
      return `User ${chat.id}`;
    }
    
    // Final fallback
    return 'Unknown User';
  };

  // Handler Functions
  const handleMessageLongPress = (message) => {
    // Null check for message
    if (!message) {
      console.warn('handleMessageLongPress: Received null message, ignoring');
      return;
    }
    
    setSelectedMessage(message);
    
    if (Platform.OS === 'ios') {
      const options = ['Cancel'];
      const actions = [];
      
      // Use the helper function to separate options
      if (isMessageMine(message)) {
        // For MY messages: Edit, Delete, Copy
        options.push('Edit', 'Delete', 'Copy');
        actions.push('edit', 'delete', 'copy');
      } else {
        // For OTHER users' messages: Pin, React, Copy
        options.push('Pin/Unpin', 'Add Reaction', 'Copy');
        actions.push('pin', 'react', 'copy');
      }
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) return;
          
          const action = actions[buttonIndex - 1];
          handleMessageAction(action, message);
        }
      );
    } else {
      setMessageOptionsModal(true);
    }
  };

  const handleMessageAction = async (action, message) => {
    switch (action) {
      case 'edit':
        setEditingMessage(message);
        setEditText(message.content);
        break;
      case 'delete':
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(message.id) }
          ]
        );
        break;
      case 'pin':
        togglePinMessage(message.id);
        break;
      case 'react':
        setReactionModal({ visible: true, messageId: message.id });
        break;
      case 'copy':
        try {
          await Clipboard.setString(message.content || '');
          Alert.alert('Copied', 'Message copied to clipboard');
        } catch (error) {
          console.error('Failed to copy message:', error);
          Alert.alert('Error', 'Failed to copy message');
        }
        break;
    }
    setMessageOptionsModal(false);
  };

  const handleEditSubmit = async () => {
    if (editText.trim() && editingMessage) {
      await editMessage(editingMessage.id, editText.trim());
      setEditingMessage(null);
      setEditText('');
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      searchMessages(searchQuery.trim());
    }
  };

  // Load pinned messages on chat load
  useEffect(() => {
    if (chat.id) {
      loadPinnedMessages();
    }
  }, [chat.id]);

  // Get user status for subtitle
  const getUserStatus = () => {
    if (chatTypingUsers.length > 0) {
      return chatTypingUsers.length === 1 ? 'typing...' : `${chatTypingUsers.length} typing...`;
    }
    
    // For private chats, try to show more specific info
    const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
    if (otherParticipant?.user) {
      const otherUser = otherParticipant.user;
      // Show username if different from display name
      if (otherUser.displayName && otherUser.username && otherUser.displayName !== otherUser.username) {
        return `@${otherUser.username}`;
      }
    }
    
    // Fallback to generic status
    return 'Active now';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C7CE7" />
      
      {/* Custom Header */}
      <LinearGradient
        colors={['#6C7CE7', '#5B67D1']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{ padding: 8, marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>

            <View style={styles.headerAvatar}>
              <Image
                source={(function() {
                  // Robust avatar logic: try all possible fields
                  const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
                  let avatarUrl = null;
                  if (otherParticipant?.user) {
                    avatarUrl = otherParticipant.user.avatar || otherParticipant.user.profileImageUrl || otherParticipant.user.profilePicture;
                    if (avatarUrl && !avatarUrl.startsWith('http')) {
                      try {
                        const { BASE_URL } = require('../../utils/apiConfig');
                        avatarUrl = BASE_URL.replace(/\/$/, '') + (avatarUrl.startsWith('/') ? avatarUrl : '/' + avatarUrl);
                      } catch (e) {}
                    }
                  }
                  if (avatarUrl) {
                    return { uri: avatarUrl };
                  }
                  // Fallback to generated avatar
                  return { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent((otherParticipant?.user?.displayName || getChatDisplayName(chat)))}&background=fff&color=6C7CE7&size=40` };
                })()}
                style={styles.headerAvatarImage}
              />
              <View style={styles.onlineIndicator} />
            </View>
            
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {getChatDisplayName(chat)}
              </Text>
              <Text style={styles.headerSubtitle}>
                {/* Typing indicator in header */}
                {chatTypingUsers.length > 0 ? 'typing...' : ''}
              </Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => setShowSearch(!showSearch)}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => setShowPinnedModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="pin" size={20} color="#fff" />
              {pinnedMessages.length > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{pinnedMessages.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => Alert.alert('Chat Info', 'Chat settings coming soon!')}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            autoFocus
          />
          <TouchableOpacity onPress={handleSearchSubmit} style={styles.searchButton}>
            <Ionicons name="search" size={20} color="#6C7CE7" />
          </TouchableOpacity>
        </View>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && showSearch && (
        <View style={styles.searchResultsContainer}>
          <ScrollView style={styles.searchResults}>
            {searchResults.map((message) => (
              <TouchableOpacity
                key={message.id}
                style={styles.searchResultItem}
                onPress={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  // Scroll to message functionality could be added here
                }}
              >
                <Text style={styles.searchResultText} numberOfLines={2}>
                  {message.content}
                </Text>
                <Text style={styles.searchResultTime}>
                  {new Date(message.createdAt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 60}
        enabled={true}
      >
        {/* Messages Background */}
        <TouchableOpacity 
          style={styles.messagesBackground}
          activeOpacity={1}
          onPress={() => setShowEmojiPicker(false)}
        >
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />
          
          {renderTypingIndicator()}
        </TouchableOpacity>
        
        {/* Input Container */}
        <ChatInputBar
          newMessage={messageText}
          onTextChange={(text) => {
            setMessageText(text);
            if (!isTyping) {
              setIsTyping(true);
              sendTypingIndicator(true);
            }
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
              setIsTyping(false);
              sendTypingIndicator(false);
            }, 2000);
          }}
          onSendMessage={handleSendMessage}
          onMediaUploaded={handleSendMediaMessage}
          token={token}
          apiBase={API_ENDPOINTS.BASE}
          isTyping={sendingMessage}
          disabled={sendingMessage}
          showEmojiPicker={showEmojiPicker}
          onEmojiToggle={() => setShowEmojiPicker(!showEmojiPicker)}
        />
      </KeyboardAvoidingView>

      {/* Message Options Modal (Android) */}
      <Modal
        visible={messageOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMessageOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMessageOptionsModal(false)}
        >
          <View style={styles.messageOptionsContainer}>
            {/* Options for MY messages */}
            {isMessageMine(selectedMessage) && (
              <>
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => handleMessageAction('edit', selectedMessage)}
                >
                  <Ionicons name="create" size={20} color="#333" />
                  <Text style={styles.messageOptionText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => handleMessageAction('delete', selectedMessage)}
                >
                  <Ionicons name="trash" size={20} color="#FF6B6B" />
                  <Text style={[styles.messageOptionText, { color: '#FF6B6B' }]}>Delete</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => handleMessageAction('copy', selectedMessage)}
                >
                  <Ionicons name="copy" size={20} color="#333" />
                  <Text style={styles.messageOptionText}>Copy</Text>
                </TouchableOpacity>
              </>
            )}
            
            {/* Options for OTHER users' messages */}
            {!isMessageMine(selectedMessage) && (
              <>
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => handleMessageAction('pin', selectedMessage)}
                >
                  <Ionicons name="pin" size={20} color="#333" />
                  <Text style={styles.messageOptionText}>
                    {selectedMessage?.isPinned ? 'Unpin' : 'Pin'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => handleMessageAction('react', selectedMessage)}
                >
                  <Ionicons name="happy" size={20} color="#333" />
                  <Text style={styles.messageOptionText}>Add Reaction</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => handleMessageAction('copy', selectedMessage)}
                >
                  <Ionicons name="copy" size={20} color="#333" />
                  <Text style={styles.messageOptionText}>Copy</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={editingMessage !== null}
        animationType="slide"
        onRequestClose={() => setEditingMessage(null)}
      >
        <View style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setEditingMessage(null)}>
              <Text style={styles.editModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Message</Text>
            <TouchableOpacity onPress={handleEditSubmit}>
              <Text style={styles.editModalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.editModalContent}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Edit your message..."
            />
          </View>
        </View>
      </Modal>

      {/* Pinned Messages Modal */}
      <Modal
        visible={showPinnedModal}
        animationType="slide"
        onRequestClose={() => setShowPinnedModal(false)}
      >
        <View style={styles.pinnedModalContainer}>
          <View style={styles.pinnedModalHeader}>
            <TouchableOpacity onPress={() => setShowPinnedModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.pinnedModalTitle}>Pinned Messages</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.pinnedMessagesList}>
            {pinnedMessages.length === 0 ? (
              <View style={styles.noPinnedMessages}>
                <Ionicons name="pin-outline" size={50} color="#ccc" />
                <Text style={styles.noPinnedText}>No pinned messages</Text>
              </View>
            ) : (
              pinnedMessages.map((message) => (
                <View key={message.id} style={styles.pinnedMessageItem}>
                  <Text style={styles.pinnedMessageContent}>{message.content}</Text>
                  <Text style={styles.pinnedMessageTime}>
                    {new Date(message.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Reaction Modal */}
      <Modal
        visible={reactionModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReactionModal({ visible: false, messageId: null })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setReactionModal({ visible: false, messageId: null })}
        >
          <View style={styles.reactionContainer}>
            {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => {
                  addReaction(reactionModal.messageId, emoji);
                  setReactionModal({ visible: false, messageId: null });
                }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerContainer}>
          <ScrollView
            contentContainerStyle={styles.emojiGrid}
            showsVerticalScrollIndicator={false}
          >
            {[
              '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
              '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
              '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
              '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
              '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
              '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
              '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
              '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
              '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
              '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
              '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
              '😾', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️',
              '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
              '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
              '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶',
              '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️',
              '👅', '👄', '💋', '🩸', '👶', '🧒', '👦', '👧', '🧑', '👱',
              '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆',
              '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷'
            ].map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.emojiButton}
                onPress={() => handleEmojiSelect(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  // Header Styles
  header: {
  paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 64,
  },
  backButton: {
    padding: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Chat Container
  chatContainer: {
    flex: 1,
  },
  messagesBackground: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  
  // Message Styles
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
    marginTop: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageContainer: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessage: {
    backgroundColor: '#6C7CE7',
    borderBottomRightRadius: 6,
    marginLeft: 40,
  },
  otherMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    marginRight: 40,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C7CE7',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#2C3E50',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#95A5A6',
  },
  editedLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    marginRight: 4,
  },
  messageStatusContainer: {
    marginLeft: 4,
  },
  
  // Typing Indicator
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
  },
  typingText: {
    fontSize: 14,
    color: '#6C7CE7',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  
  // Input Container
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  paddingBottom: 0,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
    minHeight: 72,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    paddingHorizontal: 4,
    marginRight: 8,
    minHeight: 48,
  },
  attachButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#2C3E50',
    maxHeight: 120,
    minHeight: 20,
    lineHeight: 20,
    textAlignVertical: 'center',
  },
  emojiButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C7CE7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonActive: {
    backgroundColor: '#6C7CE7',
  },
  sendButtonInactive: {
    backgroundColor: '#BDC3C7',
  },
  
  // Placeholder
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderText: {
    fontSize: 18,
    color: '#95A5A6',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },

  // Header Badge
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Search Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 25,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    padding: 8,
  },
  searchResultsContainer: {
    maxHeight: 200,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchResults: {
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  searchResultTime: {
    fontSize: 12,
    color: '#666',
  },

  // Message Reactions
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },

  // Pinned Message Indicator
  pinnedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pinnedText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Message Options Modal
  messageOptionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  messageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  messageOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },

  // Edit Message Modal
  editModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editModalCancel: {
    fontSize: 16,
    color: '#666',
  },
  editModalSave: {
    fontSize: 16,
    color: '#6C7CE7',
    fontWeight: '600',
  },
  editModalContent: {
    flex: 1,
    padding: 16,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Pinned Messages Modal
  pinnedModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pinnedModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pinnedModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pinnedMessagesList: {
    flex: 1,
  },
  noPinnedMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noPinnedText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  pinnedMessageItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pinnedMessageContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  pinnedMessageTime: {
    fontSize: 12,
    color: '#666',
  },

  // Error handling
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    alignSelf: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 120,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Reaction Modal
  reactionContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  reactionButton: {
    padding: 12,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  
  // Emoji Picker Styles
  emojiPickerContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    maxHeight: 250,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 8,
  },
  emojiText: {
    fontSize: 20,
  },
});

export default ChatScreen;