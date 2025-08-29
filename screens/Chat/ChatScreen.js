import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { 
  loadChatMessages, 
  sendMessage, 
  setCurrentChat 
} from '../../redux/ChatSlice';
import WebSocketService from '../../services/WebSocketService';
import { LinearGradient } from 'expo-linear-gradient';

const { height: screenHeight } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }) => {
  const { chat, targetUser } = route.params;
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatMessages = messages[chat.id] || [];
  const chatTypingUsers = typingUsers[chat.id] || [];

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
      if (targetUser && targetUser.id !== user?.id) {
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
    };
  }, [chat, dispatch]);

  // Keyboard handling for better input visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Auto scroll to bottom when keyboard shows
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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
        await dispatch(sendMessage({ 
          chatId: chat.id, 
          content 
        })).unwrap();
        
        // Stop typing indicator
        if (isTyping) {
          setIsTyping(false);
          WebSocketService.sendTypingIndicator(chat.id, false);
        }
        
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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
    // Better message identification - handle missing senderId
    let isMyMessage = false;
    
    if (message.senderId === user?.id || message.senderId === 'CURRENT_USER_MESSAGE') {
      isMyMessage = true;
    } else if (!message.senderId && message.senderName === undefined) {
      // If no senderId and no senderName, it's likely a message we just sent
      // This is a fallback for when backend doesn't set sender info properly
      isMyMessage = true;
    }
    
    const messageTime = new Date(message.createdAt);
    const timeString = messageTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Better sender name logic
    const getSenderDisplayName = (message) => {
      // If it's my message, use my user info
      if (isMyMessage && user) {
        return user.displayName || user.username || (user.email ? user.email.split('@')[0] : 'You');
      }
      
      // For other users' messages
      if (message.senderName) return message.senderName;
      if (message.senderDisplayName) return message.senderDisplayName;
      
      // Try to find sender from chat participants
      const sender = chat.participants?.find(p => p.user?.id === message.senderId);
      if (sender?.user) {
        return sender.user.displayName || 
               sender.user.username || 
               (sender.user.email ? sender.user.email.split('@')[0] : null) ||
               'Unknown User';
      }
      
      // If we can't find the sender info but we know the senderId
      if (message.senderId === user?.id || message.senderId === 'CURRENT_USER_MESSAGE') {
        return user?.displayName || user?.username || (user?.email ? user.email.split('@')[0] : 'You');
      }
      
      return 'Unknown User';
    };

    const senderDisplayName = getSenderDisplayName(message);

    return (
      <View style={[
        styles.messageWrapper,
        isMyMessage ? styles.myMessageWrapper : styles.otherMessageWrapper,
      ]}>
        {!isMyMessage && (
          <View style={styles.avatarContainer}>
            <Image 
              source={{ 
                uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(senderDisplayName)}&background=6C7CE7&color=fff&size=32` 
              }} 
              style={styles.avatar}
            />
          </View>
        )}
        
        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}>
          {!isMyMessage && senderDisplayName && (
            <Text style={styles.senderName}>{senderDisplayName}</Text>
          )}
          
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText,
          ]}>
            {message.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}>
              {timeString}
            </Text>
            
            {message.edited && (
              <Text style={styles.editedLabel}>edited</Text>
            )}
            
            {isMyMessage && (
              <View style={styles.messageStatusContainer}>
                <MaterialIcons 
                  name={message.readBy?.length > 1 ? 'done-all' : 'done'} 
                  size={16} 
                  color={message.readBy?.length > 1 ? '#4FC3F7' : '#B0BEC5'} 
                />
              </View>
            )}
          </View>
        </View>
      </View>
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
      // Prefer displayName, then username, then email prefix
      return otherUser.displayName || 
             otherUser.username || 
             (otherUser.email ? otherUser.email.split('@')[0] : null);
    }
    
    // Fallback to targetUser if provided (when coming from profile)
    if (targetUser && targetUser.id !== user?.id) {
      return targetUser.displayName || 
             targetUser.username || 
             (targetUser.email ? targetUser.email.split('@')[0] : null);
    }
    
    // Try to extract from chat ID or other properties
    if (chat.id) {
      return `User ${chat.id}`;
    }
    
    // Final fallback
    return 'Unknown User';
  };

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
      // Show email if no username
      if (!otherUser.username && otherUser.email) {
        return otherUser.email;
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
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <View style={styles.headerAvatar}>
              <Image 
                source={{ 
                  uri: `https://ui-avatars.com/api/?name=${getChatDisplayName(chat)}&background=fff&color=6C7CE7&size=40` 
                }} 
                style={styles.headerAvatarImage}
              />
              <View style={styles.onlineIndicator} />
            </View>
            
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {getChatDisplayName(chat)}
              </Text>
              <Text style={styles.headerSubtitle}>
                {getUserStatus()}
              </Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => Alert.alert('Chat Info', 'Chat settings coming soon!')}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        enabled={true}
      >
        {/* Messages Background */}
        <View style={styles.messagesBackground}>
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            inverted
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
          
          {renderTypingIndicator()}
        </View>
        
        {/* Input Container */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="add" size={24} color="#6C7CE7" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
              blurOnSubmit={false}
              onFocus={() => {
                // Scroll to bottom when input is focused
                setTimeout(() => {
                  flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }, 300);
              }}
              textAlignVertical="center"
              returnKeyType="send"
              onSubmitEditing={() => {
                if (messageText.trim()) {
                  handleSendMessage();
                }
              }}
            />
            
            <TouchableOpacity 
              style={styles.emojiButton}
              onPress={() => {/* Add emoji picker */}}
            >
              <Ionicons name="happy-outline" size={22} color="#6C7CE7" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (messageText.trim() && !sendingMessage) ? styles.sendButtonActive : styles.sendButtonInactive,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sendingMessage}
          >
            <Ionicons 
              name="send" 
              size={18} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
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
    padding: 8,
    marginRight: 8,
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
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 4,
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
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
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
});

export default ChatScreen;