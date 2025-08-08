import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import * as Linking from 'expo-linking';
import { useSelector, useDispatch } from 'react-redux';
import { logout, loginSuccess } from '../../redux/authSlice';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';

const ProfileScreen = () => {
const dispatch = useDispatch();
  const navigation = useNavigation();
  const { token, user } = useSelector((state) => state.auth);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [commentsModal, setCommentsModal] = useState({ visible: false, postId: null });
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false)

  const BASE_URL = 'http://192.168.1.3:8080';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [myPostsRes, savedPostsRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/posts/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/bookmarks/my-bookmarks`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setPosts(myPostsRes.data);
      setSavedPosts(savedPostsRes.data);
    } catch (err) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions to change your avatar.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.cancelled && !result.canceled) {
        setUploadingAvatar(true);
        const uri = result.assets[0].uri;
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        });

        const res = await axios.put(`${BASE_URL}/api/auth/me/avatar`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        dispatch(loginSuccess({ token, user: res.data }));
        Alert.alert('Success', 'Avatar updated successfully');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to update avatar: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            dispatch(logout());
            navigation.replace('Login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${BASE_URL}/api/posts/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update posts state
      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                likes: res.data.likesCount,
                isLikedByCurrentUser: res.data.isLiked
              }
            : post
        )
      );

      // Update savedPosts state if needed
      setSavedPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                likes: res.data.likesCount,
                isLikedByCurrentUser: res.data.isLiked
              }
            : post
        )
      );
    } catch (err) {
      console.error('Like error:', err.message);
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const openComments = async (postId) => {
    setCommentsModal({ visible: true, postId });
    fetchComments(postId);
  };

  const closeComments = () => {
    setCommentsModal({ visible: false, postId: null });
    setNewComment('');
    setComments([]);
  };

  const fetchComments = async (postId) => {
    try {
      setCommentsLoading(true);
      const res = await axios.get(`${BASE_URL}/api/comments/posts/${postId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data.content || []);
    } catch (err) {
      console.error('Fetch comments error:', err.message);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(`${BASE_URL}/api/comments/${commentsModal.postId}`, {
        content: newComment.trim()
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setComments(prev => [res.data, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Add comment error:', err.message);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await axios.delete(`${BASE_URL}/api/comments/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err.message);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Image 
          source={{ uri: `https://ui-avatars.com/api/?name=${item.username}` }} 
          style={styles.commentAvatar} 
        />
        <View style={styles.commentContent}>
          <Text style={styles.commentUsername}>{item.username}</Text>
          <Text style={styles.commentText}>{item.content}</Text>
          <Text style={styles.commentTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        {item.userId === user.id && (
          <TouchableOpacity 
            onPress={() => deleteComment(item.id)}
            style={styles.deleteCommentBtn}
          >
            <Ionicons name="trash-outline" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderPost = ({ item }) => {
    const imageUrl = item.imageUrl
      ? item.imageUrl.startsWith('http') ? item.imageUrl : `${BASE_URL}${item.imageUrl}`
      : null;

    const videoUrl = item.videoUrl
      ? item.videoUrl.startsWith('http') ? item.videoUrl : `${BASE_URL}${item.videoUrl}`
      : null;

    const pdfUrl = item.pdfUrl
      ? item.pdfUrl.startsWith('http') ? item.pdfUrl : `${BASE_URL}${item.pdfUrl}`
      : null;

    return (
      <Animated.View entering={FadeInUp} style={styles.card}>
        {/* Post Header */}
        <View style={styles.userRow}>
          <Image 
            source={{ uri: item.user?.avatar || `https://ui-avatars.com/api/?name=${item.username}` }} 
            style={styles.avatar} 
          />
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Post Content */}
        <View style={styles.contentArea}>
          {item.content && <Text style={styles.textContent}>{item.content}</Text>}
          
          {imageUrl && (
            <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
          )}

          {videoUrl && (
            <Video
              source={{ uri: videoUrl }}
              rate={1.0}
              volume={1.0}
              isMuted={false}
              resizeMode="cover"
              useNativeControls
              style={styles.video}
            />
          )}

          {pdfUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(pdfUrl)}>
              <View style={styles.pdfContainer}>
                <MaterialIcons name="picture-as-pdf" size={24} color="#ff4444" />
                <Text style={styles.pdfText}>View attached PDF</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Post Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => handleLike(item.id)}
          >
            <Ionicons 
              name={item.isLikedByCurrentUser ? "heart" : "heart-outline"} 
              size={24} 
              color={item.isLikedByCurrentUser ? "#ff3040" : "#444"} 
            />
            <Text style={styles.actionText}>{item.likes || 0}</Text>
          </TouchableOpacity>
          
         <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => openComments(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#444" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {/* Implement share functionality */}}
          >
            <Feather name="share" size={24} color="#444" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Logout */}
      <View style={styles.logoutWrapper}>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View style={styles.profileHeader}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Text style={{ fontSize: 18, color: '#555' }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={{ marginLeft: 12 }}>
          <Text style={styles.username}>{user?.username}</Text>
          <TouchableOpacity onPress={pickAndUploadAvatar} disabled={uploadingAvatar}>
            <Text style={[styles.editAvatar, uploadingAvatar && { color: '#ccc' }]}>
              {uploadingAvatar ? 'Uploading...' : 'Edit Avatar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>My Posts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'saved' && styles.activeTab]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>Saved Posts</Text>
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={activeTab === 'my' ? posts : savedPosts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        contentContainerStyle={styles.postList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#1e90ff" />
            ) : (
              <Text style={styles.emptyText}>
                {activeTab === 'my' ? 'You have no posts yet' : 'No saved posts yet'}
              </Text>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e90ff']}
            tintColor="#1e90ff"
          />
        }
      />
       <Modal visible={commentsModal.visible} animationType="slide" onRequestClose={closeComments}>
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={closeComments}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderComment}
            style={styles.commentsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyComments}>
                {commentsLoading ? (
                  <ActivityIndicator size="small" color="#1e90ff" />
                ) : (
                  <Text style={styles.emptyText}>No comments yet</Text>
                )}
              </View>
            )}
          />

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              onPress={addComment}
              disabled={!newComment.trim()}
              style={[styles.sendBtn, { opacity: !newComment.trim() ? 0.5 : 1 }]}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  logoutWrapper: {
    padding: 16,
    alignItems: 'flex-end',

  },
  logoutText: {
    color: 'red',
    fontSize: 16,
    fontWeight: '500',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  placeholderAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  editAvatar: {
    color: '#007bff',
    fontSize: 14,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007bff',
    fontWeight: '600',
  },
  postList: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  // Post card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  postTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  contentArea: {
    marginVertical: 12,
  },
  textContent: {
    fontSize: 15,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  pdfContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  pdfText: {
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    marginLeft: 8,
    color: '#444',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  commentItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteCommentBtn: {
    padding: 4,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#1e90ff',
    borderRadius: 20,
    padding: 10,
    marginLeft: 8,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
});

export default ProfileScreen;



