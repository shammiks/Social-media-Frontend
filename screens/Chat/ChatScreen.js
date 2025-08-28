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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { 
  loadChatMessages, 
  sendMessage, 
  setCurrentChat 
} from '../../redux/ChatSlice';
import WebSocketService from '../../services/WebSocketService';

const ChatScreen = ({ route, navigation }) => {
  const { chat } = route.params;
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
      const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
      return otherParticipant?.user?.displayName || 'Chat';
    };

    navigation.setOptions({
      title: getChatDisplayName(chat),
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            // Navigate to chat details or settings
            Alert.alert('Chat Info', 'Chat settings coming soon!');
          }}
        >
          <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [chat, navigation, user]);

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
    const isMyMessage = message.senderId === user?.id;
    const senderName = message.sender?.displayName || 'Unknown';

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage,
      ]}>
        {!isMyMessage && chat.isGroup && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        
        <Text style={[
          styles.messageText,
          isMyMessage ? styles.myMessageText : styles.otherMessageText,
        ]}>
          {message.content}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          
          {message.edited && (
            <Text style={styles.editedLabel}>edited</Text>
          )}
          
          {isMyMessage && (
            <Text style={styles.messageStatus}>
              {message.readBy?.length > 1 ? '✓✓' : '✓'}
            </Text>
          )}
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.container}>
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            style={[styles.messagesList, { marginBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]}
            contentContainerStyle={styles.messagesContent}
            inverted
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
          
          {renderTypingIndicator()}
          
          <View style={[
            styles.inputContainer,
            Platform.OS === 'android' && keyboardHeight > 0 && {
              position: 'absolute',
              bottom: keyboardHeight,
              left: 0,
              right: 0,
            }
          ]}>
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              multiline
              maxLength={1000}
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (messageText.trim()) {
                  handleSendMessage();
                }
              }}
            />
            
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
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
   headerButton: {
    padding: 8,
    marginRight: 8,
  },
  messageContainer: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e5ea',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  editedLabel: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginRight: 4,
  },
  messageStatus: {
    fontSize: 12,
    color: '#4CAF50',
  },
  typingIndicator: {
    padding: 8,
    paddingHorizontal: 16,
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8f8f8',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 76, // Ensure minimum height
    width: '100%',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonInactive: {
    backgroundColor: '#ccc',
  },
})
export default ChatScreen;