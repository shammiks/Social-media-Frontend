import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import ChatAPI from '../../services/ChatApi'; // Import the ChatAPI service

const CreateChatScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const userData = await ChatAPI.searchUsers();
      setUsers(userData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserToggle = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        // Only allow one user selection for direct chats
        return [user];
      }
    });
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select one user to start a chat');
      return;
    }

    if (selectedUsers.length > 1) {
      Alert.alert('Error', 'You can only select one user for direct chats');
      return;
    }

    try {
      setIsLoading(true);
      const participantIds = selectedUsers.map(user => user.id);
      
      // Use ChatAPI directly instead of Redux action for now
      const chatData = await ChatAPI.createChat(
        participantIds,
        '', // No name for direct chats
        'PRIVATE' // Only private chats supported
      );
      
      Alert.alert('Success', 'Chat created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack(); // Go back to chat list
            // Optionally refresh the chat list
            // dispatch(loadChats());
          }
        }
      ]);
    } catch (error) {
      console.error('Create chat error:', error);
      Alert.alert('Error', 'Failed to create chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUser = ({ item: user }) => {
    const isSelected = selectedUsers.some(u => u.id === user.id);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.selectedUser]}
        onPress={() => handleUserToggle(user)}
      >
        <Text style={styles.userName}>{user.displayName}</Text>
        {isSelected && <Ionicons name="checkmark" size={20} color="#007AFF" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id.toString()}
        style={styles.usersList}
        showsVerticalScrollIndicator={false}
      />
      
      <TouchableOpacity
        style={[
          styles.createButton,
          (selectedUsers.length === 0 || isLoading) && styles.createButtonDisabled,
        ]}
        onPress={handleCreateChat}
        disabled={selectedUsers.length === 0 || isLoading}
      >
        <Text style={styles.createButtonText}>
          {isLoading ? 'Creating...' : selectedUsers.length > 0 ? 'Start Chat' : 'Select User'}
        </Text>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};


const styles= StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  usersList: {
    flex: 1,
    marginTop: 12,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedUser: {
    backgroundColor: '#e3f2fd',
  },
  userName: {
    fontSize: 16,
    color: '#000',
  },
  createButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

})

export default CreateChatScreen;

