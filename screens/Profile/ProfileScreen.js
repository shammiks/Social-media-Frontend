import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  ScrollView,
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
import NotificationIntegrationService from '../../services/NotificationIntegrationService';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import CommentComponent from '../../components/Comments/CommentComponent';
import { API_ENDPOINTS } from '../../utils/apiConfig';

const { width } = Dimensions.get('window');

// Helper function to safely format dates
const formatDate = (dateString) => {
  try {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Just now';
    return date.toLocaleDateString();
  } catch (error) {
    return 'Just now';
  }
};

const ProfileScreen = () => {
const dispatch = useDispatch();
  useEffect(() => {
    fetchData();
  }, []);
  const navigation = useNavigation();
  const { token, user } = useSelector((state) => state.auth);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followeesCount, setFolloweesCount] = useState(0);
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
  const [editPostModal, setEditPostModal] = useState({ visible: false, post: null });
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editCommentModal, setEditCommentModal] = useState({ visible: false, comment: null });
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editCommentLoading, setEditCommentLoading] = useState(false);
  const [bioModal, setBioModal] = useState({ visible: false });
  const [bioContent, setBioContent] = useState('');
  const [bioLoading, setBioLoading] = useState(false);
  const pagerRef = useRef(null);

  const BASE_URL = API_ENDPOINTS.BASE.replace('/api', ''); // Remove /api suffix for direct endpoint calls

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let followeesRes = { data: 0 };
      const [myPostsRes, savedPostsRes, followersRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/posts/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/bookmarks/my-bookmarks`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/follow/count/followers/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      try {
        followeesRes = await axios.get(`${BASE_URL}/api/follow/count/following/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        followeesRes = { data: 0 };
      }
      // Sort posts by createdAt in descending order (newest first) and ensure like status
      const sortedMyPosts = myPostsRes.data
        .map(post => ({
          ...post,
          isLikedByCurrentUser: post.likedByCurrentUser || post.isLikedByCurrentUser || post.isLiked || post.liked || false
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const sortedSavedPosts = savedPostsRes.data
        .map(post => ({
          ...post,
          isLikedByCurrentUser: post.likedByCurrentUser || post.isLikedByCurrentUser || post.isLiked || post.liked || false
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPosts(sortedMyPosts);
      setSavedPosts(sortedSavedPosts);
      setFollowersCount(followersRes.data || 0);
      setFolloweesCount(followeesRes.data || 0);
    } catch (err) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [BASE_URL, token, user]);


  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Listen for real-time bookmark updates via WebSocket
  useEffect(() => {
    if (!global.WebSocketService) return;
    const ws = global.WebSocketService;
    if (!ws.isConnected) return;
    // Subscribe to bookmark updates
    const handler = (message) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        if (data.type === 'BOOKMARK_UPDATED' && data.postId) {
          // Refresh both all data and specifically saved posts
          fetchData();
          refreshSavedPosts();
        }
      } catch (e) {}
    };
    ws.subscribeToGenericEvents && ws.subscribeToGenericEvents(handler);
    return () => {
      ws.unsubscribeFromGenericEvents && ws.unsubscribeFromGenericEvents(handler);
    };
  }, [fetchData, refreshSavedPosts]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );


  const handleBookmark = async (postId) => {
    try {
      const res = await axios.post(`${BASE_URL}/api/bookmarks/${postId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const isBookmarked = res.data.bookmarked;

      // Find the post in either posts or savedPosts array
      const currentPost = posts.find(post => post.id === postId) || 
                         savedPosts.find(post => post.id === postId);

      // Update posts with bookmark status (if the post exists in My Posts)
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, isBookmarkedByCurrentUser: isBookmarked }
            : post
        )
      );

      // Update saved posts immediately for real-time UI feedback
      setSavedPosts(prevSaved => {
        if (isBookmarked) {
          // Add to saved posts if not already there and we have the post data
          if (currentPost) {
            const alreadySaved = prevSaved.find(post => post.id === postId);
            if (!alreadySaved) {
              return [...prevSaved, { ...currentPost, isBookmarkedByCurrentUser: true }]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            } else {
              // Update existing saved post
              return prevSaved.map(post =>
                post.id === postId
                  ? { ...post, isBookmarkedByCurrentUser: true }
                  : post
              );
            }
          }
          return prevSaved;
        } else {
          // Remove from saved posts and update bookmark status
          return prevSaved
            .map(post =>
              post.id === postId
                ? { ...post, isBookmarkedByCurrentUser: false }
                : post
            )
            .filter(post => post.id !== postId); // Remove the unbookmarked post
        }
      });

      // Emit WebSocket event for real-time update
      if (global.WebSocketService && global.WebSocketService.sendGenericEvent) {
        global.WebSocketService.sendGenericEvent('BOOKMARK_UPDATED', { postId, isBookmarked });
      }

      // Immediately refresh saved posts for real-time update
      if (activeTab === 1) {
        setTimeout(() => {
          refreshSavedPosts();
        }, 100);
      }

      // Refresh all data to ensure consistency with server
      setTimeout(() => {
        fetchData();
      }, 500);
      
    } catch (err) {
      Alert.alert('Error', 'Failed to update bookmark');
      // Revert optimistic updates on error
      fetchData();
    }
  };

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
  // ...existing code...
  // (all other logic, handlers, and the return JSX)
// The closing brace for ProfileScreen should be after the return JSX at the end of the component.
  const handleBioUpdate = async () => {
    if (bioLoading) return;
    
    try {
      setBioLoading(true);
      const response = await axios.put(
        `${BASE_URL}/api/auth/me/bio`,
        { bio: bioContent },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Update user in Redux store
      dispatch(loginSuccess({ token, user: response.data }));
      setBioModal({ visible: false });
      Alert.alert('Success', 'Bio updated successfully');
    } catch (err) {
      console.error('Bio update failed:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to update bio: ' + (err.response?.data?.message || err.message));
    } finally {
      setBioLoading(false);
    }
  };

  const openBioModal = () => {
    setBioContent(user?.bio || '');
    setBioModal({ visible: true });
  };

  const closeBioModal = () => {
    setBioModal({ visible: false });
    setBioContent('');
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
    // Refresh saved posts when switching to saved tab
    if (tabIndex === 1) {
      refreshSavedPosts();
    }
  };

  const handlePageSelected = (event) => {
    const newTab = event.nativeEvent.position;
    setActiveTab(newTab);
    // Refresh saved posts when switching to saved tab
    if (newTab === 1) {
      refreshSavedPosts();
    }
  };

  // Function to refresh only saved posts
  const refreshSavedPosts = useCallback(async () => {
    try {
      const savedPostsRes = await axios.get(`${BASE_URL}/api/bookmarks/my-bookmarks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const sortedSavedPosts = savedPostsRes.data
        .map(post => ({
          ...post,
          isLikedByCurrentUser: post.likedByCurrentUser || post.isLikedByCurrentUser || post.isLiked || post.liked || false
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setSavedPosts(sortedSavedPosts);
    } catch (err) {
      console.error('Error refreshing saved posts:', err);
    }
  }, [BASE_URL, token]);

  const handleLike = async (postId) => {
    // Find the current post to determine current like state
    const currentPost = posts.find(p => p.id === postId) || savedPosts.find(p => p.id === postId);
    
    // Optimistic update - immediately update UI for both posts and savedPosts
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { 
              ...post, 
              isLikedByCurrentUser: !post.isLikedByCurrentUser,
              likes: post.isLikedByCurrentUser ? post.likes - 1 : post.likes + 1
            }
          : post
      )
    );

    setSavedPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { 
              ...post, 
              isLikedByCurrentUser: !post.isLikedByCurrentUser,
              likes: post.isLikedByCurrentUser ? post.likes - 1 : post.likes + 1
            }
          : post
      )
    );

    try {
      // Use the new notification-integrated service
      const res = await NotificationIntegrationService.likePost(postId, token, currentPost?.isLikedByCurrentUser);

      // Update with server response for consistency
      const serverLikeState = res.isLiked || res.likedByCurrentUser || res.liked;
      const serverLikeCount = res.likesCount || res.likes;

      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                likes: serverLikeCount,
                isLikedByCurrentUser: serverLikeState
              }
            : post
        )
      );

      setSavedPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                likes: serverLikeCount,
                isLikedByCurrentUser: serverLikeState
              }
            : post
        )
      );
    } catch (err) {
      console.error('Like error:', err.message);
      // Revert optimistic update on error
      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                isLikedByCurrentUser: !post.isLikedByCurrentUser,
                likes: post.isLikedByCurrentUser ? post.likes + 1 : post.likes - 1
              }
            : post
        )
      );
      
      setSavedPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                isLikedByCurrentUser: !post.isLikedByCurrentUser,
                likes: post.isLikedByCurrentUser ? post.likes + 1 : post.likes - 1
              }
            : post
        )
      );
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
      // Use the new notification-integrated service
      const res = await NotificationIntegrationService.addComment(
        commentsModal.postId, 
        newComment.trim(), 
        token
      );

      // Enhance the comment with current user data for real-time display
      const enhancedComment = {
        ...res.data,
        username: user?.username || res.data.username,
        userId: user?.id || res.data.userId,
        createdAt: res.data.createdAt || new Date().toISOString(),
        user: {
          ...res.data.user,
          id: user?.id || res.data.user?.id,
          username: user?.username || res.data.user?.username,
          profilePicture: user?.profilePicture || user?.avatar || res.data.user?.profilePicture,
          avatar: user?.avatar || user?.profilePicture || res.data.user?.avatar
        },
        commenterId: user?.id || res.data.commenterId
      };

      setComments(prev => [enhancedComment, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Add comment error:', err.message);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await axios.delete(`${BASE_URL}/api/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err.message);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  // Edit Post Functions
  const openEditModal = (post) => {
    setEditContent(post.content || '');
    setEditPostModal({ visible: true, post });
  };

  const closeEditModal = () => {
    setEditPostModal({ visible: false, post: null });
    setEditContent('');
  };

  const updatePost = async () => {
    if (!editContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty');
      return;
    }

    try {
      setEditLoading(true);
      const response = await axios.put(`${BASE_URL}/api/posts/${editPostModal.post.id}`, {
        content: editContent.trim(),
        imageUrl: editPostModal.post.imageUrl,
        videoUrl: editPostModal.post.videoUrl,
        pdfUrl: editPostModal.post.pdfUrl,
        isPublic: editPostModal.post.isPublic
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Update the post in state
      setPosts(prev => prev.map(post => 
        post.id === editPostModal.post.id 
          ? { ...post, content: editContent.trim() }
          : post
      ));

      setSavedPosts(prev => prev.map(post => 
        post.id === editPostModal.post.id 
          ? { ...post, content: editContent.trim() }
          : post
      ));

      closeEditModal();
      Alert.alert('Success', 'Post updated successfully');
    } catch (err) {
      console.error('Update post error:', err);
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setEditLoading(false);
    }
  };

  const deletePost = async (postId) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${BASE_URL}/api/posts/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              // Remove the post from state
              setPosts(prev => prev.filter(post => post.id !== postId));
              setSavedPosts(prev => prev.filter(post => post.id !== postId));

              Alert.alert('Success', 'Post deleted successfully');
            } catch (err) {
              console.error('Delete post error:', err);
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  const showPostOptions = (post) => {
    Alert.alert(
      'Post Options',
      'What would you like to do with this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => openEditModal(post),
          style: 'default'
        },
        { 
          text: 'Delete', 
          onPress: () => deletePost(post.id),
          style: 'destructive'
        }
      ]
    );
  };

  // Edit Comment Functions
  const openEditCommentModal = (comment) => {
    console.log('openEditCommentModal called with comment:', comment);
    setEditCommentContent(comment.content || '');
    setEditCommentModal({ visible: true, comment });
    console.log('Modal should be visible now');
  };

  const closeEditCommentModal = () => {
    setEditCommentModal({ visible: false, comment: null });
    setEditCommentContent('');
  };

  const updateComment = async () => {
    if (!editCommentContent.trim()) {
      Alert.alert('Error', 'Comment content cannot be empty');
      return;
    }

    try {
      setEditCommentLoading(true);
      const response = await axios.put(`${BASE_URL}/api/comments/${editCommentModal.comment.id}`, {
        content: editCommentContent.trim()
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Update the comment in state
      setComments(prev => prev.map(comment => 
        comment.id === editCommentModal.comment.id 
          ? { ...comment, content: editCommentContent.trim(), edited: true }
          : comment
      ));

      closeEditCommentModal();
      Alert.alert('Success', 'Comment updated successfully');
    } catch (err) {
      console.error('Update comment error:', err);
      Alert.alert('Error', 'Failed to update comment');
    } finally {
      setEditCommentLoading(false);
    }
  };

  const showCommentOptions = (comment) => {
    console.log('showCommentOptions called with comment:', comment);
    Alert.alert(
      'Comment Options',
      'What would you like to do with this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => {
            console.log('Edit button pressed');
            openEditCommentModal(comment);
          },
          style: 'default'
        },
        { 
          text: 'Delete', 
          onPress: () => deleteComment(comment.id),
          style: 'destructive'
        }
      ]
    );
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Image 
          source={{ 
            uri: (() => {
              // For comments, get user ID from various possible fields
              const commentUserId = item.userId || item.user?.id || item.authorId || item.commenterId;
              
              // Check if it's the current user first (since this is ProfileScreen, use user from Redux)
              if (commentUserId === user?.id && (user?.avatar || user?.profilePicture)) {
                return user.avatar || user.profilePicture;
              }
              // Otherwise check comment user data
              return item.user?.avatar || item.user?.profilePicture || item.avatar || item.profilePicture
                ? (item.user?.avatar || item.user?.profilePicture || item.avatar || item.profilePicture)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'User')}&background=6C7CE7&color=fff&size=32`;
            })()
          }} 
          style={styles.commentAvatar} 
        />
        <View style={styles.commentContent}>
          <TouchableOpacity onPress={() => {
            // Check if this is the current user's comment
            const commentUserId = item.userId || item.user?.id || item.authorId || item.commenterId;
            if (commentUserId === user?.id) {
              // Current user clicked on their own comment - no navigation needed (already on own profile)
              return;
            } else if (item.username) {
              // Navigate to other user's profile
              navigation.navigate('ShowProfile', { 
                username: item.username,
                userId: commentUserId
              });
            }
          }}>
            <Text style={styles.commentUsername}>{item.username}</Text>
          </TouchableOpacity>
          <Text style={styles.commentText}>{item.content}</Text>
          <View style={styles.commentTimeContainer}>
            <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
            {item.edited && <Text style={styles.editedText}>• edited</Text>}
          </View>
        </View>
        {(() => {
          const commentUserId = item.userId || item.user?.id || item.authorId || item.commenterId;
          const currentUserId = user?.id;
          const isOwner = commentUserId === currentUserId;
          console.log('Comment ownership check:', { commentUserId, currentUserId, isOwner, item });
          return isOwner;
        })() && (
          <TouchableOpacity 
            onPress={() => {
              console.log('Comment options button pressed for comment:', item);
              showCommentOptions(item);
            }}
            style={styles.commentOptionsBtn}
          >
            <MaterialIcons name="more-vert" size={16} color="#999" />
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
            source={{ 
              uri: (() => {
                // For posts in ProfileScreen, prioritize current user's avatar since these are mostly your posts
                if (user?.avatar || user?.profilePicture) {
                  return user.avatar || user.profilePicture;
                }
                // Fallback to post user data
                return item.user?.avatar || item.user?.profilePicture || item.avatar || item.profilePicture
                  ? (item.user?.avatar || item.user?.profilePicture || item.avatar || item.profilePicture)
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'User')}&background=6C7CE7&color=fff&size=40`;
              })()
            }} 
            style={styles.postAvatar} 
          />
          <View style={styles.userInfo}>
            <Text style={styles.postUsername}>{item.username}</Text>
            <Text style={styles.postTime}>{formatDate(item.createdAt)}</Text>
          </View>
          {/* Options Menu - Only show for current user's posts */}
          {(item.userId === user?.id || item.user?.id === user?.id) && (
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={() => showPostOptions(item)}
            >
              <MaterialIcons name="more-vert" size={24} color="#666" />
            </TouchableOpacity>
          )}
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
            <TouchableOpacity onPress={async () => {
              console.log('ProfileScreen - Attempting to open PDF URL:', pdfUrl);
              
              try {
                // Handle spaces and special characters in PDF URLs
                // First decode any existing encoding, then re-encode properly
                let cleanUrl = decodeURIComponent(pdfUrl);
                let finalUrl = encodeURI(cleanUrl);
                
                console.log('ProfileScreen - Original URL:', pdfUrl);
                console.log('ProfileScreen - Cleaned URL:', cleanUrl);
                console.log('ProfileScreen - Final encoded URL:', finalUrl);
                
                const supported = await Linking.canOpenURL(finalUrl);
                if (supported) {
                  await Linking.openURL(finalUrl);
                } else {
                  // Fallback: try the original URL
                  await Linking.openURL(pdfUrl);
                }
              } catch (err) {
                console.error('ProfileScreen - Failed to open PDF:', err);
                Alert.alert('Error', 'Unable to open PDF file: ' + err.message);
              }
            }}>
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
            
            {/* Loading overlay when uploading */}
            {uploadingAvatar && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            
            <TouchableOpacity 
              style={[
                styles.editAvatarButton,
                uploadingAvatar && styles.editAvatarButtonDisabled
              ]} 
              onPress={pickAndUploadAvatar} 
              disabled={uploadingAvatar}
            >
              <Ionicons 
                name={uploadingAvatar ? "hourglass" : "camera"} 
                size={12} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.username}>{user?.username}</Text>
            
            {/* Bio Section */}
            <TouchableOpacity style={styles.bioContainer} onPress={openBioModal}>
              {user?.bio ? (
                <Text style={styles.bioText} numberOfLines={3}>
                  {user.bio}
                </Text>
              ) : (
                <Text style={styles.bioPlaceholder}>
                  Add a bio to tell others about yourself
                </Text>
              )}
              <Ionicons 
                name="create-outline" 
                size={14} 
                color="#666" 
                style={styles.bioEditIcon}
              />
            </TouchableOpacity>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{posts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followersCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followeesCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={closeComments}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <CommentComponent
                comment={item}
                onCommentUpdate={(updatedComment) => {
                  setComments(prev => prev.map(comment => 
                    comment.id === updatedComment.id ? updatedComment : comment
                  ));
                }}
                onCommentDelete={deleteComment}
                onUserPress={(comment) => {
                  const commentUserId = comment.userId || comment.user?.id || comment.authorId || comment.commenterId;
                  if (commentUserId !== user?.id && comment.username) {
                    navigation.navigate('ShowProfile', { 
                      username: comment.username,
                      userId: commentUserId
                    });
                  }
                }}
                isOwner={item.userId === user?.id || item.user?.id === user?.id}
                currentUser={user}
                formatDate={formatDate}
              />
            )}
            style={styles.commentsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
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
        </View>
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

      {/* Edit Post Modal */}
      <Modal
        visible={editPostModal.visible}
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.editModalContainer}
        >
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={closeEditModal}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Post</Text>
            <TouchableOpacity 
              onPress={updatePost}
              disabled={editLoading}
              style={[styles.saveButton, editLoading && styles.saveButtonDisabled]}
            >
              {editLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.editModalContent}>
            <TextInput
              style={styles.editTextInput}
              value={editContent}
              onChangeText={setEditContent}
              placeholder="What's on your mind?"
              multiline
              autoFocus
            />
            
            {/* Show existing media preview */}
            {editPostModal.post?.imageUrl && (
              <View style={styles.mediaPreview}>
                <Text style={styles.mediaLabel}>Image attached</Text>
                <Image 
                  source={{ 
                    uri: editPostModal.post.imageUrl.startsWith('http') 
                      ? editPostModal.post.imageUrl 
                      : `${BASE_URL}${editPostModal.post.imageUrl}` 
                  }} 
                  style={styles.mediaPreviewImage} 
                />
              </View>
            )}
            
            {editPostModal.post?.videoUrl && (
              <View style={styles.mediaPreview}>
                <Text style={styles.mediaLabel}>Video attached</Text>
                <MaterialIcons name="videocam" size={24} color="#666" />
              </View>
            )}
            
            {editPostModal.post?.pdfUrl && (
              <View style={styles.mediaPreview}>
                <Text style={styles.mediaLabel}>PDF attached</Text>
                <MaterialIcons name="picture-as-pdf" size={24} color="#ff4444" />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Comment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editCommentModal.visible}
        onRequestClose={closeEditCommentModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Comment</Text>
              <TouchableOpacity 
                onPress={closeEditCommentModal}
                style={styles.closeModalBtn}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.editCommentInput}
                multiline
                numberOfLines={4}
                value={editCommentContent}
                onChangeText={setEditCommentContent}
                placeholder="Write your comment..."
                placeholderTextColor="#999"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                onPress={closeEditCommentModal}
                style={[styles.modalBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={updateComment}
                style={[styles.modalBtn, styles.saveBtn]}
                disabled={editCommentLoading}
              >
                {editCommentLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bio Edit Modal */}
      <Modal visible={bioModal.visible} animationType="slide" onRequestClose={closeBioModal}>
        <KeyboardAvoidingView 
          style={styles.bioModalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.bioModalHeader}>
            <TouchableOpacity onPress={closeBioModal}>
              <Text style={styles.bioModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.bioModalTitle}>Edit Bio</Text>
            <TouchableOpacity 
              onPress={handleBioUpdate}
              disabled={bioLoading}
              style={[styles.bioModalSave, bioLoading && styles.bioModalSaveDisabled]}
            >
              {bioLoading ? (
                <ActivityIndicator size="small" color="#007bff" />
              ) : (
                <Text style={styles.bioModalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.bioModalContent}>
            <TextInput
              style={styles.bioInput}
              placeholder="Write something about yourself..."
              value={bioContent}
              onChangeText={setBioContent}
              multiline
              maxLength={150}
              autoFocus
              textAlignVertical="top"
            />
            <Text style={styles.bioCharacterCount}>
              {bioContent.length}/150
            </Text>
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
  editAvatarButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32.5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  bioContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 50,
  },
  bioText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bioPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  bioEditIcon: {
    marginLeft: 8,
    marginTop: 2,
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
    backgroundColor: '#fff',
    minHeight: 60,
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
  
  // Edit Post Modal Styles
  optionsButton: {
    padding: 8,
    borderRadius: 20,
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  editModalContent: {
    flex: 1,
    padding: 16,
  },
  editTextInput: {
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 120,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  mediaPreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  mediaPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginLeft: 8,
  },

  // Comment Options and Edit Styles
  commentOptionsBtn: {
    padding: 4,
    borderRadius: 12,
  },
  editCommentInput: {
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 80,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  commentTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editedText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },

  // Modal Styles for Edit Comment
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 50,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeModalBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelBtn: {
    backgroundColor: '#f5f5f5',
  },
  saveBtn: {
    backgroundColor: '#007bff',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Bio Modal Styles
  bioModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bioModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  bioModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  bioModalCancel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  bioModalSave: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioModalSaveDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  bioModalSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  bioModalContent: {
    flex: 1,
    padding: 16,
  },
  bioInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    minHeight: 120,
    maxHeight: 200,
  },

  bioCharacterCount: {
    textAlign: 'right',
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
});


export default ProfileScreen;

