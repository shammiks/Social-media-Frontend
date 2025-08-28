import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { loadChats } from '../../redux/ChatSlice';
import { logout } from '../../redux/authSlice';
import { formatDistanceToNow } from 'date-fns';
import ChatAPI from '../../services/ChatApi';
import WebSocketService from '../../services/WebSocketService';

const ChatListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { chats, isLoading, error, unreadCounts } = useSelector(state => state.chat);
  const { user } = useSelector(state => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState([]);

  useEffect(() => {
    // Add a small delay before loading chats to ensure authentication is properly set up
    const timer = setTimeout(() => {
      console.log('ChatListScreen: Loading chats...');
      dispatch(loadChats());
    }, 500);

    return () => clearTimeout(timer);
  }, [dispatch]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = chats.filter(chat =>
        chat.chatName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.participants?.some(p => 
          p.user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
  }, [chats, searchQuery]);

  const handleChatPress = (chat) => {
    navigation.navigate('ChatScreen', { chat });
  };

  const getChatDisplayName = (chat) => {
    if (chat.chatName) {
      return chat.chatName;
    }
    
    // For direct chats, show the other participant's name
    const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
    return otherParticipant?.user?.displayName || 'Unknown User';
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroup) {
      return require('../../assets/default-avatar.png'); // Add your group avatar
    }
    
    const otherParticipant = chat.participants?.find(p => p.user?.id !== user?.id);
    return otherParticipant?.user?.profilePicture 
      ? { uri: otherParticipant.user.profilePicture }
      : require('../../assets/default-avatar.png'); // Add your default avatar
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
      console.log('ChatListScreen error:', error);
      
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
            },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: () => {
                dispatch(logout());
                navigation.replace('Login');
              }
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

  const handleCreateChat = () => {
    navigation.navigate('CreateChatScreen');
  };

  const handleDebugAuth = async () => {
    console.log('Running authentication debug...');
    await ChatAPI.debugAuthentication();
  };

  const handleManualLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            ChatAPI.clearAuthToken();
            dispatch(logout());
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={styles.debugButton} onPress={handleDebugAuth}>
            <Ionicons name="bug-outline" size={20} color="#FF6B35" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleManualLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateChat}>
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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
  createButton: {
    padding: 8,
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
  debugButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
  },
})
export default ChatListScreen;


