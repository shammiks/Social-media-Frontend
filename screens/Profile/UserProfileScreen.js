import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  FlatList,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
  Dimensions
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import * as Animatable from 'react-native-animatable';
import { API_ENDPOINTS, getUserProfileEndpoint, createAuthHeaders } from '../../utils/apiConfig';
import ChatAPI from '../../services/ChatApi';
import { loadChats } from '../../redux/ChatSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// ReadMoreText Component
function ReadMoreText({ text, numberOfLines = 3 }) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded(!expanded);
  const shouldTrim = text?.length > 100;

  return (
    <>
      <Text style={styles.textContent} numberOfLines={expanded ? undefined : numberOfLines}>
        {text}
      </Text>
      {shouldTrim && (
        <TouchableOpacity onPress={toggleExpanded}>
          <Text style={styles.readMoreText}>{expanded ? 'Read less' : 'Read more'}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}



// Comments Modal Component (unchanged)
function CommentsModal({ visible, onClose, postId, token, currentUserId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_ENDPOINTS.COMMENTS}/posts/${postId}/comments?page=0&size=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data.content || []);
    } catch (err) {
      console.error('Fetch comments error:', err.message);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_ENDPOINTS.COMMENTS}/${postId}`, {
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
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await axios.delete(`${COMMENTS_URL}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err.message);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  useEffect(() => {
    if (visible) {
      fetchComments();
    }
  }, [visible, postId]);

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Image 
          source={{ 
            uri: (() => {
              // For comments, get user ID from various possible fields
              const commentUserId = item.userId || item.user?.id || item.authorId || item.commenterId;
              
              // Check if it's the current user first
              if (commentUserId === currentUserId && (currentUser?.avatar || currentUser?.profilePicture)) {
                return currentUser.avatar || currentUser.profilePicture;
              }
              // If comment is from the profile owner, use profile data
              if (commentUserId === (userId || profile?.id) && (profile?.imageUrl || profile?.avatar || profile?.profilePicture)) {
                return profile.imageUrl || profile.avatar || profile.profilePicture;
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
          <Text style={styles.commentUsername}>{item.username}</Text>
          <Text style={styles.commentText}>{item.content}</Text>
          <Text style={styles.commentTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => deleteComment(item.id)}
          style={styles.deleteCommentBtn}
        >
          <Ionicons name="trash-outline" size={16} color="#999" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderComment}
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={() => (
            <View style={styles.emptyComments}>
              {loading ? (
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
              disabled={submitting || !newComment.trim()}
              style={[styles.sendBtn, { opacity: (submitting || !newComment.trim()) ? 0.5 : 1 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const UserProfileScreen = ({ route, navigation }) => {
  const { userId, username } = route.params;
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const currentUserId = useSelector((state) => state.auth.userId || state.auth.user?.id || state.user?.id);
  const currentUser = useSelector((state) => state.auth.user);
  const authState = useSelector((state) => state.auth);
  
  // Add token validation
  useEffect(() => {
    if (!token) {
      Alert.alert(
        'Authentication Error', 
        'You must be logged in to view profiles. Please log in again.',
        [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }]
      );
      return;
    }
    
    // Validate token format (basic JWT validation)
    if (typeof token !== 'string' || !token.includes('.')) {
      Alert.alert(
        'Invalid Token', 
        'Your session token is invalid. Please log in again.',
        [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }]
      );
      return;
    }
  }, [token, navigation]);
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false); // NEW: Prevent duplicate follow requests
  const [followAuthError, setFollowAuthError] = useState(false); // NEW: Track follow auth issues
  const [chatLoading, setChatLoading] = useState(false); // NEW: Chat creation loading
  const [error, setError] = useState(null);
  const [commentsModal, setCommentsModal] = useState({ visible: false, postId: null });
  const [followCache, setFollowCache] = useState(new Map());
  const getFollowCacheKey = (currentUserId, targetUserId) => `${currentUserId}-${targetUserId}`;

  const handleAuthError = () => {
    Alert.alert('Session Expired', 'Please log in again', [
      { text: 'OK', onPress: () => navigation.navigate('Login') }
    ]);
  };

  // IMPROVED: Better follow status checking with multiple fallback strategies
const checkFollowStatus = async (targetUserId, headers) => {
  if (!currentUserId || currentUserId === targetUserId) {
    return { isFollowing: false, followersCount: 0 };
  }

  const cacheKey = getFollowCacheKey(currentUserId, targetUserId);
  const cachedStatus = followCache.get(cacheKey);

  // Try to get fresh status from server
  try {
    
    const requestHeaders = {
      ...headers,
      'Accept': 'application/json',
    };
    
    const response = await axios.get(`${API_ENDPOINTS.FOLLOW}/status?followeeId=${targetUserId}`, { 
      headers: requestHeaders
    });
    
    const freshStatus = {
      isFollowing: response.data.isFollowing || response.data.following || false,
      followersCount: response.data.followersCount || 0
    };
    
    // Update cache with fresh data
    setFollowCache(prev => new Map(prev).set(cacheKey, freshStatus));
    return freshStatus;
    
  } catch (statusError) {
    console.warn(`Follow status check failed: ${statusError.message}`);
    
    // If this is a 401 error, the follow endpoints have authorization issues
    if (statusError.response?.status === 401) {
      // Try to get basic follower count from user profile if available
      try {
        const userProfileResponse = await axios.get(`${API_ENDPOINTS.USERS}/${targetUserId}`, { headers });
        const followerCount = userProfileResponse.data.followersCount || 0;
        
        const fallbackStatus = {
          isFollowing: false, // Default to false since we can't check
          followersCount: followerCount,
          authError: true // Flag to indicate auth issues
        };
        
        setFollowAuthError(true); // Set the error flag for UI
        setFollowCache(prev => new Map(prev).set(cacheKey, fallbackStatus));
        return fallbackStatus;
        
      } catch (profileError) {
        const minimalStatus = { 
          isFollowing: false, 
          followersCount: 0,
          authError: true
        };
        setFollowAuthError(true); // Set the error flag for UI
        return minimalStatus;
      }
    }
    
    // Method 2: Try alternative status endpoint format (for non-401 errors)
    try {
      const altResponse = await axios.get(`${API_ENDPOINTS.FOLLOW}/status/${targetUserId}`, { headers });
      
      const altStatus = {
        isFollowing: altResponse.data.isFollowing || altResponse.data.following || false,
        followersCount: altResponse.data.followersCount || 0
      };
      
      setFollowCache(prev => new Map(prev).set(cacheKey, altStatus));
      return altStatus;
      
    } catch (altError) {
      // If this is also a 401 error, skip remaining follow endpoint attempts
      if (altError.response?.status === 401) {
        // Try to get basic follower count from user profile
        try {
          const userProfileResponse = await axios.get(`${API_ENDPOINTS.USERS}/${targetUserId}`, { headers });
          const followerCount = userProfileResponse.data.followersCount || 0;
          
          const fallbackStatus = { isFollowing: false, followersCount: followerCount };
          return fallbackStatus;
          
        } catch (profileError) {
          return { isFollowing: false, followersCount: 0 };
        }
      }
    }
  }

  // Method 3: Try to get followers list and check if current user is in it
  try {
    const followersResponse = await axios.get(`${API_ENDPOINTS.FOLLOW}/followers/${targetUserId}`, { headers });
    const followers = followersResponse.data.content || followersResponse.data || [];
    
    const isFollowing = followers.some(follow => 
      (follow.follower && follow.follower.id === currentUserId) ||
      (follow.followerId === currentUserId) ||
      (follow.id === currentUserId)
    );
    
    const fallbackStatus = {
      isFollowing: isFollowing,
      followersCount: followers.length
    };
    
    setFollowCache(prev => new Map(prev).set(cacheKey, fallbackStatus));
    return fallbackStatus;
    
  } catch (followersError) {
    // If this is a 401 error, skip the followers endpoint
    if (followersError.response?.status === 401) {
      // Skip to final fallback without trying more follow endpoints
      if (cachedStatus) {
        return cachedStatus;
      }
      
      return { isFollowing: false, followersCount: 0 };
    }
  }

  // Method 4: Get just the follower count
  try {
    const countResponse = await axios.get(`${API_ENDPOINTS.FOLLOW}/count/followers/${targetUserId}`, { headers });
    const followersCount = countResponse.data || 0;
    
    // If we have cached status, use it with updated count
    if (cachedStatus) {
      const updatedStatus = { ...cachedStatus, followersCount };
      setFollowCache(prev => new Map(prev).set(cacheKey, updatedStatus));
      return updatedStatus;
    }
    
    // No cached status, default to not following but with correct count
    const defaultStatus = { isFollowing: false, followersCount };
    return defaultStatus;
    
  } catch (countError) {
    console.warn(`Follower count failed (${countError.response?.status}):`, countError.message);
  }

  // Final fallback: use cached data or defaults
  if (cachedStatus) {
    return cachedStatus;
  }
  
  return { isFollowing: false, followersCount: 0 };
};

  const fetchProfileData = async (isRefresh = false) => {
  if (!token) {
    setError("Authentication required");
    handleAuthError();
    return;
  }

  const headers = createAuthHeaders(token);

  try {
    setError(null);
    if (!isRefresh) setLoading(true);

    // Fetch profile
    const profileResponse = await axios.get(
      getUserProfileEndpoint(userId, username),
      { headers }
    );
    
    const profileData = profileResponse.data;
    setProfile(profileData);

    // Fetch posts and bookmarks in parallel
    const [postsRes, bookmarksRes] = await Promise.all([
      axios.get(`${API_ENDPOINTS.POSTS}/user/${profileData.id}`, { headers }),
      axios.get(`${API_ENDPOINTS.BOOKMARKS}/my-bookmarks`, { headers }).catch(err => {
        console.warn('Bookmarks fetch failed:', err.message);
        return { data: [] };
      })
    ]);

    // Process posts with bookmarks
    const bookmarkedPostIds = new Set(
      (bookmarksRes.data || []).map(post => post.id)
    );

    const postsWithBookmarks = (postsRes.data.content || []).map(post => ({
      ...post,
      isBookmarkedByCurrentUser: bookmarkedPostIds.has(post.id),
      isLikedByCurrentUser: post.likedByCurrentUser || post.isLikedByCurrentUser || post.isLiked || post.liked || false
    }));

    setPosts(postsWithBookmarks);

    // Handle follow status for other users
    if (currentUserId && currentUserId !== profileData.id) {
      const followResult = await checkFollowStatus(profileData.id, headers);
      
      setIsFollowing(followResult.isFollowing);
      setFollowersCount(followResult.followersCount);
    } else {
      // For own profile, just get follower count
      try {
        const followerCountResponse = await axios.get(`${API_ENDPOINTS.FOLLOW}/count/followers/${profileData.id}`, { headers });
        setFollowersCount(followerCountResponse.data || 0);
      } catch (countError) {
        setFollowersCount(profileData.followersCount || 0);
      }
    }

  } catch (error) {
    console.error("Profile loading failed:", error.message);
    setError(error.message);
    
    if (error.response?.status === 401) {
      Alert.alert(
        'Authentication Failed',
        `Access denied. This could be due to:\n• Expired session\n• Invalid token\n• Server authentication issue\n\nError: ${error.response?.data?.message || 'Unauthorized'}`,
        [{ text: 'Login Again', onPress: handleAuthError }]
      );
    } else {
      Alert.alert("Error", error.response?.data?.message || "Failed to load profile");
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};
  // IMPROVED: Better follow handling with loading state and optimistic updates
  const handleFollow = async () => {
  if (followLoading) {
    return;
  }

  if (!token || !currentUserId) {
    Alert.alert('Error', 'Please log in to follow users');
    return;
  }

  const targetUserId = userId || profile?.id;
  if (currentUserId === targetUserId) {
    Alert.alert('Error', 'You cannot follow yourself');
    return;
  }

  const previousFollowState = isFollowing;
  const previousFollowersCount = followersCount;
  const cacheKey = getFollowCacheKey(currentUserId, targetUserId);

  try {
    setFollowLoading(true);

    // Optimistic update
    const newFollowState = !isFollowing;
    const newFollowersCount = isFollowing ? Math.max(0, followersCount - 1) : followersCount + 1;
    
    setIsFollowing(newFollowState);
    setFollowersCount(newFollowersCount);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    let response;
    let success = false;
    
    // Try different follow endpoints in order of preference
    const followEndpoints = [
      {
        name: 'toggle',
        method: 'post',
        url: `${API_ENDPOINTS.FOLLOW}/toggle?followeeId=${targetUserId}`,
        data: {}
      },
      {
        name: previousFollowState ? 'unfollow' : 'follow',
        method: 'post', 
        url: `${API_ENDPOINTS.FOLLOW}/${previousFollowState ? 'unfollow' : 'follow'}/${targetUserId}`,
        data: {}
      }
    ];
    
    for (const endpoint of followEndpoints) {
      try {
        if (endpoint.method === 'post') {
          response = await axios.post(endpoint.url, endpoint.data, { headers });
        }
        
        success = true;
        break;
      } catch (endpointError) {
        console.warn(`${endpoint.name} endpoint failed:`, endpointError.response?.status, endpointError.message);
        continue;
      }
    }
    
    if (!success) {
      throw new Error('All follow endpoints failed');
    }
    
    // Extract final state from response
    let finalFollowState = newFollowState;
    let finalFollowersCount = newFollowersCount;
    
    if (response?.data) {
      if (response.data.isFollowing !== undefined) {
        finalFollowState = response.data.isFollowing;
      } else if (response.data.following !== undefined) {
        finalFollowState = response.data.following;
      }
      
      if (response.data.followersCount !== undefined) {
        finalFollowersCount = response.data.followersCount;
      }
    }

    // Update UI state
    setIsFollowing(finalFollowState);
    setFollowersCount(finalFollowersCount);
    
    // CRITICAL: Update cache with new follow state
    const newCacheEntry = {
      isFollowing: finalFollowState,
      followersCount: finalFollowersCount,
      timestamp: Date.now()
    };
    
    setFollowCache(prev => new Map(prev).set(cacheKey, newCacheEntry));
    
  } catch (err) {
    console.error('Follow error:', err);
    
    // Revert optimistic updates
    setIsFollowing(previousFollowState);
    setFollowersCount(previousFollowersCount);
    
    if (err.response?.status === 401) {
      Alert.alert(
        'Authorization Issue', 
        'Follow functionality is currently experiencing authorization issues. This might be due to backend configuration. Your session is still valid for viewing profiles.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update follow status');
    }
  } finally {
    setFollowLoading(false);
  }
};

// Cache user information for chat list display
const cacheUserForChat = async (userData) => {
  try {
    const cached = await AsyncStorage.getItem('userCache');
    const userCache = cached ? new Map(JSON.parse(cached)) : new Map();
    userCache.set(userData.id.toString(), userData);
    await AsyncStorage.setItem('userCache', JSON.stringify([...userCache]));
  } catch (error) {
    // Silent failure for cache saving
  }
};

const startChat = async () => {
  if (!profile || chatLoading) return;
  
  try {
    setChatLoading(true);
    
    // Cache user information for chat list display
    await cacheUserForChat({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName || profile.username,
      imageUrl: profile.imageUrl
    });
    
    // Call createChat with individual parameters as expected by the API
    const response = await ChatAPI.createChat(
      [profile.id], // participantIds array
      '', // chatName (empty for private chats)
      'PRIVATE', // chatType
      '', // chatImageUrl
      '' // description
    );
    
    if (response && response.id) {
      // Wait a moment for backend to populate participant details, then refresh
      setTimeout(() => {
        dispatch(loadChats());
      }, 1000);
      
      // Navigate directly to the chat screen with additional user context
      navigation.navigate('ChatScreen', { 
        chat: response,
        // Pass the target user info for display purposes
        targetUser: {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName || profile.username,
          imageUrl: profile.imageUrl
        }
      });
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error) {
    console.error('Error creating chat:', error);
    Alert.alert(
      'Error', 
      error.message || 'Failed to create chat. Please try again.',
      [{ text: 'OK' }]
    );
  } finally {
    setChatLoading(false);
  }
};

const renderFollowButton = () => {
  if (currentUserId === (userId || profile?.id)) {
    return null; // Don't show follow button on own profile
  }

  // Show disabled button with info message if there are auth errors
  if (followAuthError) {
    return (
      <TouchableOpacity 
        disabled={true}
        style={[styles.followButton, styles.followDisabledButton]}
        onPress={() => {
          Alert.alert(
            'Follow Feature Unavailable', 
            'Follow functionality is currently experiencing backend authorization issues. The development team is working on a fix.',
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={styles.followButtonContent}>
          <Ionicons name="warning-outline" size={16} color="#999" />
          <Text style={[styles.followButtonText, { color: '#999', marginLeft: 8 }]}>
            Follow Unavailable
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      onPress={handleFollow}
      disabled={followLoading}
      style={[
        styles.followButton, 
        isFollowing && styles.followingButton,
        followLoading && styles.followLoadingButton
      ]}
    >
      <View style={styles.followButtonContent}>
        {followLoading ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.followButtonText, { marginLeft: 8 }]}>
              {isFollowing ? 'Unfollowing...' : 'Following...'}
            </Text>
          </>
        ) : (
          <>
            <Ionicons 
              name={isFollowing ? "person-remove" : "person-add"} 
              size={18} 
              color="#fff" 
            />
            <Text style={[styles.followButtonText, { marginLeft: 8 }]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};


  // Like functionality with optimistic updates
  const handleLike = async (postId) => {
    // Optimistic update - immediately update UI
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

    try {
      const res = await axios.post(`${API_ENDPOINTS.POSTS}/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update with server response for consistency
      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                likes: res.data.likesCount || res.data.likes,
                isLikedByCurrentUser: res.data.isLiked || res.data.likedByCurrentUser || res.data.liked
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
      Alert.alert('Error', 'Failed to like post');
    }
  };

  // Bookmark functionality (unchanged)
  const handleBookmark = async (postId) => {
    try {
      const res = await axios.post(`${API_ENDPOINTS.BOOKMARKS}/${postId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Bookmark response:', res.data);

      const isBookmarked = res.data.bookmarked;

      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? {
                ...post,
                isBookmarkedByCurrentUser: isBookmarked
              }
            : post
        )
      );

      if (isBookmarked) {
        Alert.alert('Bookmarked!', 'Post added to your bookmarks');
      } else {
        Alert.alert('Removed', 'Post removed from bookmarks');
      }
    } catch (err) {
      console.error('Bookmark error:', err.message);
      Alert.alert('Error', 'Failed to bookmark post');
    }
  };

  // Share functionality (unchanged)
  const handleShare = async (post) => {
    try {
      let shareMessage = `Check out this post by ${post.username}!\n\n`;
      
      if (post.content) {
        shareMessage += `"${post.content}"\n\n`;
      }
      
      shareMessage += `Shared from Social App`;

      const shareOptions = {
        message: shareMessage,
        title: 'Share Post',
      };

      if (post.imageUrl) {
        shareOptions.url = post.imageUrl;
      }

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with:', result.activityType);
        } else {
          // Share successful
        }
      } else if (result.action === Share.dismissedAction) {
        // Share dismissed
      }
    } catch (error) {
      console.error('Share error:', error.message);
      Alert.alert('Error', 'Failed to share post');
    }
  };

  const openComments = (postId) => {
    setCommentsModal({ visible: true, postId });
  };

  const closeComments = () => {
    setCommentsModal({ visible: false, postId: null });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData(true); // Pass true to indicate this is a refresh
  };

  useEffect(() => {
    if (!userId && !username) {
      Alert.alert('Error', 'User information is missing');
      navigation.goBack();
      return;
    }
    
    if (!token) {
      Alert.alert('Error', 'Please log in to view profiles');
      navigation.goBack();
      return;
    }
    
    fetchProfileData();
  }, [userId, username, token]);

  // Render post (unchanged)
  const renderPost = ({ item, index }) => (
    <Animatable.View animation="slideInUp" delay={index * 150} style={styles.card}>
      <View style={styles.userRow}>
        <Image 
          source={{ 
            uri: (() => {
              // In UserProfileScreen, all posts belong to the profile being viewed
              // So use the profile data for avatar, not the individual post user data
              if (profile?.imageUrl || profile?.avatar || profile?.profilePicture) {
                return profile.imageUrl || profile.avatar || profile.profilePicture;
              }
              // If it's the current user's profile, use their avatar from Redux
              if (currentUserId === (userId || profile?.id) && (currentUser?.avatar || currentUser?.profilePicture)) {
                return currentUser.avatar || currentUser.profilePicture;
              }
              // Fallback to post user data
              return item.user?.avatar || item.user?.profilePicture || item.avatar || item.profilePicture
                ? (item.user?.avatar || item.user?.profilePicture || item.avatar || item.profilePicture)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || profile?.username || 'User')}&background=6C7CE7&color=fff&size=40`;
            })()
          }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleBookmark(item.id)}
          style={styles.bookmarkBtn}
        >
          <Ionicons 
            name={item.isBookmarkedByCurrentUser ? "bookmark" : "bookmark-outline"} 
            size={20} 
            color={item.isBookmarkedByCurrentUser ? "#1e90ff" : "#666"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.contentArea}>
        {item.content && <ReadMoreText text={item.content} />}
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}
        {item.videoUrl && (
          <Video
            source={{ uri: item.videoUrl }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="cover"
            useNativeControls
            style={styles.video}
          />
        )}
        {item.pdfUrl && (
          <TouchableOpacity onPress={() => Alert.alert('PDF tapped', item.pdfUrl)}>
            <View style={styles.pdfContainer}>
              <MaterialIcons name="picture-as-pdf" size={24} color="#ff4444" />
              <Text style={styles.pdfText}>View attached PDF</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => handleLike(item.id)}
        >
          <Ionicons 
            name={item.isLikedByCurrentUser ? "heart" : "heart-outline"} 
            size={20} 
            color={item.isLikedByCurrentUser ? "#ff3040" : "#444"} 
          />
          <Text style={styles.actionText}>{item.likes}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => openComments(item.id)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#444" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => handleShare(item)}
        >
          <Feather name="share" size={20} color="#444" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={50} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchProfileData} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {profile?.username || username || 'Profile'}
        </Text>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
       ListHeaderComponent={
  <>
    <View style={styles.profileInfo}>
      <Image 
        source={{ 
          uri: profile?.imageUrl || profile?.avatar || profile?.profilePicture
            ? (profile.imageUrl || profile.avatar || profile.profilePicture)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.username || 'User')}&background=6C7CE7&color=fff&size=80`
        }} 
        style={styles.profileAvatar} 
      />
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statCount}>{followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statCount}>{posts.length}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
      </View>
    </View>

    {/* Action Buttons Row */}
    {profile?.id !== currentUserId && (
      <View style={styles.actionButtonsRow}>
        {renderFollowButton()}
        <TouchableOpacity
          style={[
            styles.messageButton,
            chatLoading && styles.messageButtonDisabled
          ]}
          onPress={startChat}
          disabled={chatLoading}
        >
          {chatLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="chatbubble-outline" size={18} color="#007AFF" />
          )}
          <Text style={styles.messageButtonText}>
            {chatLoading ? 'Creating...' : 'Message'}
          </Text>
        </TouchableOpacity>
      </View>
    )}

    <Text style={styles.postsTitle}>Posts</Text>
  </>
}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1e90ff']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Ionicons name="images-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <CommentsModal
        visible={commentsModal.visible}
        onClose={closeComments}
        postId={commentsModal.postId}
        token={token}
        currentUserId={currentUserId}
        currentUser={currentUser}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  listContainer: {
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
  },
  loaderContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  followLoadingButton: {
    opacity: 0.7,
  },
  followButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa'
  },
  errorText: { 
    color: '#ff6b6b', 
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 15
  },
  retryButton: {
    backgroundColor: '#1e90ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10
  },
  retryText: { 
    color: '#fff',
    fontWeight: 'bold'
  },
  backButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10
  },
  backText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff'
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginLeft: 20,
    color: '#333'
  },
  profileInfo: { 
    flexDirection: 'row', 
    padding: 20, 
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  profileAvatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40,
    backgroundColor: '#f0f0f0'
  },
  stats: { 
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 20
  },
  statItem: {
    alignItems: 'center'
  },
  statCount: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#333'
  },
  statLabel: { 
    fontSize: 14, 
    color: '#666',
    marginTop: 4
  },
  actionButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  followButton: {
    flex: 1,
    backgroundColor: '#1e90ff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  messageButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  messageButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#f8f8f8',
  },
  messageButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  followingButton: {
    backgroundColor: '#6c757d'
  },
  followDisabledButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  followButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginBottom: 16,
    color: '#333'
  },
  // Post styles from FeedScreen
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  postTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  bookmarkBtn: {
    padding: 4,
  },
  contentArea: {
    marginVertical: 10,
  },
  textContent: {
    fontSize: 15,
    color: '#555',
    lineHeight: 20,
  },
  readMoreText: {
    color: '#1e90ff',
    marginTop: 4,
    fontSize: 14,
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
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    marginLeft: 4,
    color: '#444',
    fontSize: 14,
  },
  emptyPosts: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10
  },
  // Comments Modal Styles (from FeedScreen)
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
});

export default UserProfileScreen;