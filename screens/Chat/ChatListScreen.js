import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { loadChats } from '../../redux/ChatSlice';
import { formatDistanceToNow } from 'date-fns';
import WebSocketService from '../../services/WebSocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const ChatListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { chats, isLoading, error, unreadCounts } = useSelector(state => state.chat);
  const { user } = useSelector(state => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState([]);
  const [userCache, setUserCache] = useState(new Map());

  useEffect(() => {
    // Add a small delay before loading chats to ensure authentication is properly set up
    const timer = setTimeout(() => {
      dispatch(loadChats());
    }, 500);

    return () => clearTimeout(timer);
  }, [dispatch]);

  // WebSocket setup for real-time updates
  useEffect(() => {
    if (user?.id) {
      // Initialize WebSocket connection
      WebSocketService.setDispatch(dispatch);
      WebSocketService.connect();
    }

    // Don't disconnect on unmount since other screens might be using WebSocket
    return () => {
      // Just clean up dispatch reference if needed
    };
  }, [dispatch, user?.id]);

  // Clear search when navigating away from screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setSearchQuery('');
    });

    return unsubscribe;
  }, [navigation]);

  // Refresh chats when screen comes into focus (like when coming back from ChatScreen)
  useFocusEffect(
    useCallback(() => {
      // Clear search query when screen comes into focus
      setSearchQuery('');
      
      // Only refresh if not already loading to prevent duplicate requests
      if (!isLoading) {
        dispatch(loadChats());
      }
    }, [dispatch])
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = chats.filter(chat => {
        const searchLower = searchQuery.toLowerCase().trim();
        
        // Search in chat name
        if (chat.chatName && chat.chatName.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in participant names
        if (chat.participants && chat.participants.length > 0) {
          return chat.participants.some(participant => {
            const user = participant.user;
            if (!user) return false;
            
            // Search in display name
            if (user.displayName && user.displayName.toLowerCase().includes(searchLower)) {
              return true;
            }
            
            // Search in first name
            if (user.firstName && user.firstName.toLowerCase().includes(searchLower)) {
              return true;
            }
            
            // Search in last name
            if (user.lastName && user.lastName.toLowerCase().includes(searchLower)) {
              return true;
            }
            
            // Search in username
            if (user.username && user.username.toLowerCase().includes(searchLower)) {
              return true;
            }
            
            // Search in email
            if (user.email && user.email.toLowerCase().includes(searchLower)) {
              return true;
            }
            
            return false;
          });
        }
        
        return false;
      });
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
  }, [chats, searchQuery]);

  // Load user cache from storage
  useEffect(() => {
    const loadUserCache = async () => {
      try {
        const cached = await AsyncStorage.getItem('userCache');
        if (cached) {
          setUserCache(new Map(JSON.parse(cached)));
        }
      } catch (error) {
        // Silent failure for cache loading
      }
    };
    loadUserCache();
  }, []);

  // Save user to cache
  const cacheUser = async (userId, userData) => {
    try {
      const newCache = new Map(userCache);
      newCache.set(userId.toString(), userData);
      setUserCache(newCache);
      await AsyncStorage.setItem('userCache', JSON.stringify([...newCache]));
    } catch (error) {
      // Silent failure for cache saving
    }
  };

  // Get user from cache
  const getCachedUser = (userId) => {
    return userCache.get(userId.toString());
  };

  const handleChatPress = (chat) => {
    navigation.navigate('ChatScreen', { chat });
  };

  const getChatDisplayName = (chat) => {
    if (chat.chatName) {
      return chat.chatName;
    }
    
    // For direct chats, show the other participant's name
    const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
    
    if (otherParticipant?.user) {
      const otherUser = otherParticipant.user;
      // Use the same logic as ChatScreen: displayName || username || 'User'
      return otherUser.displayName || otherUser.username || 'User';
    }
    
    // Try to get user info from cache if participant exists but no user details
    if (otherParticipant?.userId || otherParticipant?.user?.id) {
      const userId = otherParticipant.userId || otherParticipant.user.id;
      const cachedUser = getCachedUser(userId);
      if (cachedUser) {
        return cachedUser.displayName || cachedUser.username || 'User';
      }
    }
    
    // If we have participant IDs but no user details, show a generic name
    if (chat.participants && chat.participants.length > 0) {
      const otherParticipantCount = chat.participants.filter(p => p.user?.id !== user?.id).length;
      if (otherParticipantCount === 1) {
        return 'User';
      }
    }
    
    return 'Unknown User';
  };

  const getChatAvatar = (chat) => {
    const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
    const displayName = getChatDisplayName(chat);
    let avatarUrl = null;
    if (otherParticipant?.user) {
      avatarUrl = otherParticipant.user.avatar || otherParticipant.user.profileImageUrl || otherParticipant.user.profilePicture;
    }
    if (avatarUrl) {
      return { uri: avatarUrl };
    }
    // Fallback to generated avatar
    return { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6C7CE7&color=fff&size=50` };
  };

  const renderChatItem = ({ item: chat }) => {
    const unreadCount = unreadCounts[chat.id] || 0;
    const displayName = getChatDisplayName(chat);
    const avatar = getChatAvatar(chat);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(chat)}
        activeOpacity={0.7}
      >
        <Image source={avatar} style={styles.avatar} />
        
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {displayName}
            </Text>
            {chat.lastMessageAt && (
              <Text style={styles.timestamp}>
                {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
              </Text>
            )}
          </View>
          
          <View style={styles.lastMessageContainer}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {chat.lastMessage?.content || 'No messages yet'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleRefresh = () => {
    dispatch(loadChats());
  };

  useEffect(() => {
    if (error) {
      // Check if it's an authentication error
      if (error.includes('Authentication failed') || error.includes('No valid authentication token')) {
        // Disconnect WebSocket when authentication fails
        WebSocketService.disconnect();
        
        // Just show an error message instead of forcing logout
        Alert.alert(
          'Authentication Issue',
          'There was an issue loading your chats. Please try refreshing or check your connection.',
          [
            {
              text: 'Retry',
              onPress: () => dispatch(loadChats())
            }
          ]
        );
      } else {
        Alert.alert('Error Loading Chats', error, [
          {
            text: 'Retry',
            onPress: () => dispatch(loadChats())
          },
          {
            text: 'OK'
          }
        ]);
      }
    }
  }, [error, dispatch, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        style={styles.chatList}
        showsVerticalScrollIndicator={false}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  // ChatListScreen styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#e0e0e0',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
})
export default ChatListScreen;


