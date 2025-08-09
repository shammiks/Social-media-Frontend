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
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import * as Animatable from 'react-native-animatable';

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

// Comments Modal Component
function CommentsModal({ visible, onClose, postId, token }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const COMMENTS_URL = 'http://192.168.1.3:8080/api/comments';

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${COMMENTS_URL}/posts/${postId}/comments?page=0&size=50`, {
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
      const res = await axios.post(`${COMMENTS_URL}/${postId}`, {
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
          source={{ uri: `https://ui-avatars.com/api/?name=${item.username}` }} 
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
      <KeyboardAvoidingView 
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
    </Modal>
  );
}

const UserProfileScreen = ({ route, navigation }) => {
  const { userId, username } = route.params;
  const token = useSelector((state) => state.auth.token);
  const currentUserId = useSelector((state) => state.auth.userId);
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [commentsModal, setCommentsModal] = useState({ visible: false, postId: null });

  const API_BASE_URL = 'http://192.168.1.3:8080/api';
  const POSTS_URL = 'http://192.168.1.3:8080/api/posts';
  const BOOKMARKS_URL = 'http://192.168.1.3:8080/api/bookmarks';

  const handleAuthError = () => {
    Alert.alert('Session Expired', 'Please log in again', [
      { text: 'OK', onPress: () => navigation.navigate('Login') }
    ]);
  };

  const fetchProfileData = async () => {
    console.log("🔍 Debug: Fetching profile data...");
    
    if (!token) {
      setError("Authentication required");
      handleAuthError();
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    try {
      setError(null);
      setLoading(true);

      // Fetch profile
      console.log("⏳ Attempting to fetch profile...");
      const profileResponse = await axios.get(
        userId 
          ? `${API_BASE_URL}/users/${userId}`
          : `${API_BASE_URL}/users/by-username/${username}`,
        { headers }
      );
      
      const profileData = profileResponse.data;
      setProfile(profileData);
      setFollowersCount(profileData.followersCount || 0);

      // Fetch posts and bookmarks in parallel (like FeedScreen)
      const [postsRes, bookmarksRes] = await Promise.all([
        axios.get(`${POSTS_URL}/user/${profileData.id}`, { headers }),
        axios.get(`${BOOKMARKS_URL}/my-bookmarks`, { headers })
      ]);

      // Create a Set of bookmarked post IDs for O(1) lookups
      const bookmarkedPostIds = new Set(
        bookmarksRes.data.map(post => post.id)
      );

      // Merge bookmark status into posts (exactly like FeedScreen)
      const postsWithBookmarks = (postsRes.data.content || []).map(post => ({
        ...post,
        isBookmarkedByCurrentUser: bookmarkedPostIds.has(post.id)
      }));

      setPosts(postsWithBookmarks);

      // Check follow status
      if (currentUserId !== profileData.id) {
        try {
          const followStatusResponse = await axios.get(
            `${API_BASE_URL}/follow/status/${profileData.id}`,
            { headers }
          );
          setIsFollowing(followStatusResponse.data.isFollowing);
        } catch (followError) {
          console.warn("Follow status check failed:", followError.message);
          setIsFollowing(false);
        }
      }

    } catch (error) {
      console.error("Request failed:", error.response?.data || error.message);
      setError(error.message);
      
      if (error.response?.status === 401) {
        handleAuthError();
      } else {
        Alert.alert(
          "Error",
          error.response?.data?.message || "Failed to load profile"
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Like functionality (exactly from FeedScreen)
  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${POSTS_URL}/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

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
    } catch (err) {
      console.error('Like error:', err.message);
      Alert.alert('Error', 'Failed to like post');
    }
  };

  // Bookmark functionality (exactly from FeedScreen)
  const handleBookmark = async (postId) => {
    try {
      const res = await axios.post(`${BOOKMARKS_URL}/${postId}`, {}, {
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

  // Share functionality (exactly from FeedScreen)
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
          console.log('Post shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
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

  const handleFollow = async () => {
    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      const res = await axios.post(
        `${API_BASE_URL}/follow/${endpoint}/${userId || profile?.id}`,
        {},
        { headers }
      );
      
      setIsFollowing(!isFollowing);
      setFollowersCount(res.data.followersCount);
    } catch (err) {
      console.error('Follow error:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update follow status');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData();
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

  // Render post exactly like FeedScreen
  const renderPost = ({ item, index }) => (
    <Animatable.View animation="slideInUp" delay={index * 150} style={styles.card}>
      <View style={styles.userRow}>
        <Image source={{ uri: `https://ui-avatars.com/api/?name=${item.username}` }} style={styles.avatar} />
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
                  uri: profile?.imageUrl || `https://ui-avatars.com/api/?name=${profile?.username}&background=random` 
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

            {currentUserId !== (userId || profile?.id) && (
              <TouchableOpacity 
                onPress={handleFollow}
                style={[styles.followButton, isFollowing && styles.followingButton]}
              >
                <Text style={styles.followButtonText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
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
  followButton: {
    backgroundColor: '#1e90ff',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center'
  },
  followingButton: {
    backgroundColor: '#6c757d'
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