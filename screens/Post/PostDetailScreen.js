import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Image
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_ENDPOINTS } from '../../utils/apiConfig';

const PostDetailScreen = ({ route, navigation }) => {
  const { postId, commentId, highlightCommentId } = route.params || {};
  const { token } = useSelector(state => state.auth);
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comments, setComments] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [commentAvatarErrors, setCommentAvatarErrors] = useState({});

  useEffect(() => {
    if (postId) {
      fetchPostDetails();
    } else {
      Alert.alert('Error', 'No post ID provided');
      navigation.goBack();
    }
  }, [postId]);

  const fetchPostDetails = async () => {
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Get all posts and find the specific one (fallback approach)
      const allPostsResponse = await axios.get(
        `http://192.168.43.36:8080/api/posts?page=0&size=100&sort=createdAt,desc`,
        { headers }
      );
      
      const allPosts = allPostsResponse.data?.content || allPostsResponse.data || [];
      
      // Find the specific post by ID
      const foundPost = allPosts.find(post => 
        post.id?.toString() === postId?.toString()
      );
      
      if (!foundPost) {
        throw new Error(`Post with ID ${postId} not found in posts list`);
      }
      
      // Try to fetch the user's full profile to get their actual avatar
      let userProfileData = null;
      try {
        const userProfileResponse = await fetch(`${API_ENDPOINTS.USERS}/${foundPost.userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (userProfileResponse.ok) {
          userProfileData = await userProfileResponse.json();
        }
      } catch (userError) {
        // Error fetching user profile, continue with basic data
      }
      
      // Map the post data correctly
      const mappedPost = {
        ...foundPost,
        user: {
          id: foundPost.userId,
          username: foundPost.username,
          avatar: userProfileData?.profilePicture || userProfileData?.avatar || foundPost.userAvatar || foundPost.avatar || null,
        }
      };
      
      setPost(mappedPost);
      
      // Map like status correctly
      setLiked(foundPost.likedByCurrentUser || foundPost.isLikedByCurrentUser || foundPost.liked || foundPost.isLiked || false);
      
      // Map like count correctly
      const likeCount = foundPost.likes || foundPost.likesCount || foundPost.likeCount || 0;
      setLikesCount(likeCount);

      // Fetch comments
      try {
        const commentsResponse = await axios.get(
          `http://192.168.43.36:8080/api/comments/posts/${postId}/comments?page=0&size=50`,
          { headers }
        );
        
        setComments(commentsResponse.data?.content || commentsResponse.data || []);
      } catch (commentError) {
        setComments([]);
      }

    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert(
          'Authentication Error', 
          'Your session has expired. Please log in again.',
          [
            { text: 'OK', onPress: () => navigation.navigate('Login') }
          ]
        );
      } else if (error.response?.status === 404) {
        Alert.alert(
          'Post Not Found', 
          'This post may have been deleted or is no longer available.',
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        Alert.alert(
          'Error', 
          `Failed to load post details: ${error.response?.data?.message || error.message}`,
          [
            { text: 'Retry', onPress: () => fetchPostDetails() },
            { text: 'Go Back', onPress: () => navigation.goBack() }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPostDetails();
    setRefreshing(false);
  };

  const handleLike = async () => {
    try {
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      const newLikedState = !liked;
      const newLikesCount = liked ? likesCount - 1 : likesCount + 1;

      // Optimistic update
      setLiked(newLikedState);
      setLikesCount(newLikesCount);

      // Use the same endpoint pattern as FeedScreen
      const likeEndpoint = `http://192.168.43.36:8080/api/posts/${postId}/like`;

      if (!liked) {
        // Like the post
        await axios.post(likeEndpoint, {}, { headers });
      } else {
        // Unlike the post (try DELETE first, then POST toggle)
        try {
          await axios.delete(likeEndpoint, { headers });
        } catch (deleteError) {
          // If DELETE doesn't work, try POST toggle
          await axios.post(likeEndpoint, {}, { headers });
        }
      }

    } catch (error) {
      // Revert on error
      setLiked(!liked);
      setLikesCount(liked ? likesCount + 1 : likesCount - 1);
      
      if (error.response?.status === 401) {
        Alert.alert('Error', 'Authentication required');
      } else {
        Alert.alert('Error', 'Failed to update like status');
      }
    }
  };

  const renderComment = (comment, index) => {
    const isHighlighted = comment.id?.toString() === highlightCommentId?.toString();
    
    return (
      <View 
        key={comment.id || index} 
        style={[
          styles.commentContainer,
          isHighlighted && styles.highlightedComment
        ]}
      >
        <View style={styles.commentHeader}>
          <View style={styles.commentAvatarContainer}>
            <Image 
              source={{ 
                uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user?.username || comment.username || 'User')}&size=40&background=34C759&color=fff&format=png`
              }}
              style={styles.commentAvatar}
              onError={() => {
                setCommentAvatarErrors(prev => ({
                  ...prev,
                  [comment.id]: true
                }));
              }}
              onLoad={() => {
                setCommentAvatarErrors(prev => ({
                  ...prev,
                  [comment.id]: false
                }));
              }}
            />
            {commentAvatarErrors[comment.id] && (
              <View style={styles.commentFallbackAvatar}>
                <Text style={styles.commentFallbackAvatarText}>
                  {(comment.user?.username || comment.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.commentUserInfo}>
            <Text style={styles.commentUsername}>
              {comment.user?.username || comment.username || 'Unknown User'}
            </Text>
            <Text style={styles.commentTime}>
              {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Unknown time'}
            </Text>
          </View>
        </View>
        <Text style={styles.commentContent}>{comment.content}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchPostDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Post Content */}
        <View style={styles.postContainer}>
          {/* Post Header */}
          <View style={styles.postHeader}>
            <View style={styles.avatarContainer}>
              <Image 
                source={{ 
                  uri: post.user?.avatar || 
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.username || 'User')}&size=50&background=007AFF&color=fff&format=png`
                }}
                style={styles.userAvatar}
                onError={() => {
                  setAvatarError(true);
                }}
                onLoad={() => {
                  setAvatarError(false);
                }}
              />
              {avatarError && (
                <View style={styles.fallbackAvatar}>
                  <Text style={styles.fallbackAvatarText}>
                    {(post.user?.username || post.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username}>{post.user?.username || post.username || 'Unknown User'}</Text>
              <Text style={styles.postTime}>
                {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown time'}
              </Text>
            </View>
          </View>

          {/* Post Content */}
          <Text style={styles.postContent}>{post.content}</Text>

          {/* Post Image */}
          {post.imageUrl && (
            <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
          )}

          {/* Post Actions */}
          <View style={styles.postActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Ionicons 
                name={liked ? "heart" : "heart-outline"} 
                size={24} 
                color={liked ? "#FF3040" : "#8E8E93"} 
              />
              <Text style={[styles.actionText, liked && styles.likedText]}>
                {likesCount}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={24} color="#8E8E93" />
              <Text style={styles.actionText}>{comments.length}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsHeader}>Comments ({comments.length})</Text>
          {comments.length > 0 ? (
            comments.map(renderComment)
          ) : (
            <Text style={styles.noCommentsText}>No comments yet</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerRight: {
    width: 40,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fallbackAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fallbackAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  postTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  postContent: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#8E8E93',
  },
  likedText: {
    color: '#FF3040',
  },
  commentsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  commentsHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  noCommentsText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 20,
  },
  commentContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  highlightedComment: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  commentAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  commentFallbackAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  commentFallbackAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentUserInfo: {
    marginLeft: 8,
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  commentContent: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
    marginLeft: 40,
  },
});

export default PostDetailScreen;
