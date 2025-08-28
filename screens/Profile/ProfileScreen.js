import React, { useEffect, useState, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Video } from 'expo-av';
import * as Linking from 'expo-linking';
import { useSelector, useDispatch } from 'react-redux';
import { logout, loginSuccess } from '../../redux/authSlice';
import WebSocketService from '../../services/WebSocketService';
import ChatAPI from '../../services/ChatApi';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';

const { width } = Dimensions.get('window');

const ProfileScreen = () => {
const dispatch = useDispatch();
  const navigation = useNavigation();
  const { token, user } = useSelector((state) => state.auth);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // Changed to index-based
  const [commentsModal, setCommentsModal] = useState({ visible: false, postId: null });
  const [imageModal, setImageModal] = useState({ visible: false, imageUrl: null });
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [downloading, setDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const pagerRef = useRef(null);

  const BASE_URL = 'http://192.168.43.36:8080';

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
      
      // Sort posts by createdAt in descending order (newest first)
      const sortedMyPosts = myPostsRes.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const sortedSavedPosts = savedPostsRes.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setPosts(sortedMyPosts);
      setSavedPosts(sortedSavedPosts);
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
            // Manually clear token and disconnect WebSocket before logout
            ChatAPI.clearAuthToken();
            dispatch(logout());
            navigation.replace('Login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Carousel navigation functions
  const handleTabPress = (tabIndex) => {
    setActiveTab(tabIndex);
    pagerRef.current?.setPage(tabIndex);
  };

  const handlePageSelected = (event) => {
    setActiveTab(event.nativeEvent.position);
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

  // Image Modal Functions
  const openImageModal = (imageUrl) => {
    setImageLoading(true);
    setImageModal({ visible: true, imageUrl });
  };

  const closeImageModal = () => {
    setImageModal({ visible: false, imageUrl: null });
  };

  const downloadImage = async (imageUrl) => {
    try {
      setDownloading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to save images');
        return;
      }

      // Download the image
      const result = await FileSystem.downloadAsync(
        imageUrl,
        FileSystem.documentDirectory + 'image_' + Date.now() + '.jpg'
      );

      // Save to device gallery
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert('Success', 'Image saved to gallery!');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download image');
    } finally {
      setDownloading(false);
    }
  };

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
            style={styles.postAvatar} 
          />
          <View style={styles.userInfo}>
            <Text style={styles.postUsername}>{item.username}</Text>
            <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Post Content */}
        <View style={styles.contentArea}>
          {item.content && <Text style={styles.textContent}>{item.content}</Text>}
          
          {imageUrl && (
            <TouchableOpacity onPress={() => openImageModal(imageUrl)}>
              <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
            </TouchableOpacity>
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
      {/* Enhanced Header Section */}
      <View style={styles.headerContainer}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Profile</Text>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.avatarText}>
                  {user?.username?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity 
              style={styles.editAvatarButton} 
              onPress={pickAndUploadAvatar} 
              disabled={uploadingAvatar}
            >
              <Ionicons 
                name="camera" 
                size={12} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{posts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{savedPosts.length}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Enhanced Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 0 && styles.activeTab]}
            onPress={() => handleTabPress(0)}
          >
            <Ionicons 
              name={activeTab === 0 ? "grid" : "grid-outline"} 
              size={16} 
              color={activeTab === 0 ? "#007bff" : "#666"} 
            />
            <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
              My Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 1 && styles.activeTab]}
            onPress={() => handleTabPress(1)}
          >
            <Ionicons 
              name={activeTab === 1 ? "bookmark" : "bookmark-outline"} 
              size={16} 
              color={activeTab === 1 ? "#007bff" : "#666"} 
            />
            <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
              Saved
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabIndicator} />
      </View>

      {/* Posts Carousel */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {/* My Posts Page */}
        <View key="0" style={styles.pageContainer}>
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.postList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {loading ? (
                  <ActivityIndicator size="large" color="#1e90ff" />
                ) : (
                  <Text style={styles.emptyText}>
                    You have no posts yet
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
        </View>

        {/* Saved Posts Page */}
        <View key="1" style={styles.pageContainer}>
          <FlatList
            data={savedPosts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.postList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {loading ? (
                  <ActivityIndicator size="large" color="#1e90ff" />
                ) : (
                  <Text style={styles.emptyText}>
                    No saved posts yet
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
        </View>
      </PagerView>
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

      {/* Full Screen Image Modal */}
      <Modal
        visible={imageModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
        statusBarTranslucent={true}
      >
        <View style={styles.imageModalContainer}>
          <View style={styles.imageModalHeader}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={closeImageModal}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.downloadButton} 
              onPress={() => downloadImage(imageModal.imageUrl)}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.imageContainer}>
            {imageLoading && (
              <View style={styles.imageLoadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading image...</Text>
              </View>
            )}
            {imageModal.imageUrl && (
              <Image 
                source={{ uri: imageModal.imageUrl }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Enhanced Header Styles
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 45 : 15,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  logoutButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
  },
  placeholderAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007bff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007bff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e9ecef',
    marginRight: 20,
  },

  // Enhanced Tabs Styles
  tabsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#007bff',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  tabIndicator: {
    height: 1,
    backgroundColor: '#f1f3f4',
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
  // Smaller post avatar and username for professional look
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
  downloadButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
    minWidth: 50,
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  fullScreenImage: {
    width: width,
    height: '90%',
  },
  imageLoadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
});

export default ProfileScreen;
