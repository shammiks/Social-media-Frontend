import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView
} from 'react-native';
import { Video } from 'expo-av';
import Swiper from 'react-native-swiper';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import CommentComponent from '../../components/Comments/CommentComponent';
import API from '../../utils/api';
import { API_ENDPOINTS } from '../../utils/apiConfig';

const PostDetailScreen = ({ route, navigation }) => {
  const { postId, commentId, highlightCommentId } = route.params || {};
  const { token, user: currentUser } = useSelector(state => state.auth);
  
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
      const allPostsResponse = await API.get(
        `/posts?page=0&size=100&sort=createdAt,desc`
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
        const commentsResponse = await API.get(
          `/comments/posts/${postId}/comments?page=0&size=50`
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
    const prevLiked = liked;
    const prevLikesCount = likesCount;
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

      const newLikedState = !prevLiked;
      const newLikesCount = prevLiked ? prevLikesCount - 1 : prevLikesCount + 1;

      // Optimistic update
      setLiked(newLikedState);
      setLikesCount(newLikesCount);

      // Use relative endpoint for API calls (baseURL is already set in API instance)
      const likeEndpoint = `/posts/${postId}/like`;

      if (!prevLiked) {
        // Like the post
        await API.post(likeEndpoint, {});
      } else {
        // Unlike the post (try DELETE first, then POST toggle)
        try {
          await API.delete(likeEndpoint);
        } catch (deleteError) {
          // If DELETE doesn't work, try POST toggle
          await API.post(likeEndpoint, {});
        }
      }

      // After successful like/unlike, re-fetch post details for real-time sync
      fetchPostDetails();

    } catch (error) {
      // Revert on error using previous state
      setLiked(prevLiked);
      setLikesCount(prevLikesCount);
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
      <View key={comment.id || index} style={isHighlighted ? styles.highlightedComment : undefined}>
        <CommentComponent
          comment={comment}
          currentUser={currentUser}
          onCommentUpdate={() => {}}
          onCommentDelete={() => {}}
          onUserPress={(userOrComment) => {
            // userOrComment can be comment or user object
            const userId = userOrComment?.userId || userOrComment?.user?.id || userOrComment?.id;
            const username = userOrComment?.username || userOrComment?.user?.username;
            if (userId) {
              navigation.navigate('ShowProfile', { userId, username });
            }
          }}
          isOwner={comment.userId === currentUser?.id}
          formatDate={date => new Date(date).toLocaleDateString()}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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

  // Debug: log the post object to inspect media fields
  console.log('PostDetailScreen post object:', post);
  return (
    <View style={styles.proContainer}>
      {/* Header */}
      <View style={styles.proHeader}>
        <TouchableOpacity style={styles.proBackButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1976D2" />
        </TouchableOpacity>
        <Text style={styles.proHeaderTitle}>Post</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.proContent}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Post Card */}
        <View style={styles.proPostCard}>
          <View style={styles.proPostHeader}>
            <Image
              source={{
                uri: post.user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.username || 'User')}&size=50&background=1976D2&color=fff&format=png`
              }}
              style={styles.proUserAvatar}
              onError={() => setAvatarError(true)}
              onLoad={() => setAvatarError(false)}
            />
            {avatarError && (
              <View style={styles.proFallbackAvatar}>
                <Text style={styles.proFallbackAvatarText}>
                  {(post.user?.username || post.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.proUserInfo}>
              <TouchableOpacity onPress={() => {
                if (post.user?.id) {
                  navigation.navigate('ShowProfile', { userId: post.user.id, username: post.user.username });
                }
              }}>
                <Text style={styles.proUsername}>{post.user?.username || post.username || 'Unknown User'}</Text>
              </TouchableOpacity>
              <Text style={styles.proPostTime}>
                {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown time'}
              </Text>
            </View>
          </View>
          <Text style={styles.proPostContent}>{post.content}</Text>

          {/* MEDIA CAROUSEL (image, video, pdf) */}
          {(() => {
            const prependBase = (url) => {
              if (!url) return null;
              if (url.startsWith('http')) return url;
              return `http://192.168.1.5:8081${url}`;
            };
            // Collect all media into an array for the carousel
            const mediaItems = [];
            if (post.imageUrl) mediaItems.push({ type: 'image', url: prependBase(post.imageUrl) });
            if (post.videoUrl) mediaItems.push({ type: 'video', url: prependBase(post.videoUrl) });
            if (post.pdfUrl) mediaItems.push({ type: 'pdf', url: prependBase(post.pdfUrl) });
            if (mediaItems.length === 0) return null;
            
            // For single media item, use dynamic sizing directly
            if (mediaItems.length === 1) {
              const media = mediaItems[0];
              return (
                <View style={{ marginBottom: 10, marginTop: 10, paddingHorizontal: 8 }}>
                  {media.type === 'image' && (
                    <DynamicFeedImage imageUrl={media.url} onPress={() => {}} />
                  )}
                  {media.type === 'video' && (
                    <DynamicFeedVideo videoUrl={media.url} />
                  )}
                  {media.type === 'pdf' && (
                    <TouchableOpacity
                      style={{ height: 300, backgroundColor: '#e3e3e3', justifyContent: 'center', alignItems: 'center', borderRadius: 20 }}
                      onPress={() => {
                        if (media.url) {
                          import('react-native').then(({ Linking }) => Linking.openURL(media.url));
                        }
                      }}
                    >
                      <Text style={{ color: '#1976D2', fontWeight: 'bold', fontSize: 20 }}>View PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }
            
            // For multiple media items, use swiper with dynamic sizing for each
            return (
              <View style={{ marginBottom: 10, marginTop: 10, paddingHorizontal: 8 }}>
                <Swiper
                  style={{ height: 400 }}
                  dotColor="#C4C4C4"
                  activeDotColor="#1976D2"
                  paginationStyle={{ bottom: 10 }}
                  loop={false}
                  showsPagination={true}
                >
                  {mediaItems.map((item, idx) => {
                    if (item.type === 'image') {
                      return (
                        <DynamicFeedImage key={idx} imageUrl={item.url} onPress={() => {}} />
                      );
                    } else if (item.type === 'video') {
                      return (
                        <DynamicFeedVideo key={idx} videoUrl={item.url} />
                      );
                    } else if (item.type === 'pdf') {
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={{ height: 300, backgroundColor: '#e3e3e3', justifyContent: 'center', alignItems: 'center', borderRadius: 20 }}
                          onPress={() => {
                            if (item.url) {
                              import('react-native').then(({ Linking }) => Linking.openURL(item.url));
                            }
                          }}
                        >
                          <Text style={{ color: '#1976D2', fontWeight: 'bold', fontSize: 20 }}>View PDF</Text>
                        </TouchableOpacity>
                      );
                    }
                    return null;
                  })}
                </Swiper>
              </View>
            );
          })()}
          <View style={styles.proPostActions}>
            <TouchableOpacity style={styles.proActionButton} onPress={handleLike}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? "#FF3040" : "#1976D2"}
              />
              <Text style={[styles.proActionText, liked && styles.proLikedText]}>{likesCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.proActionButton}>
              <Ionicons name="chatbubble-outline" size={22} color="#1976D2" />
              <Text style={styles.proActionText}>{comments.length}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.proDivider} />

        {/* Comments Section */}
        <View style={styles.proCommentsSection}>
          <Text style={styles.proCommentsHeader}>Comments ({comments.length})</Text>
          <View style={{ gap: 10 }}>
            {comments.length > 0 ? (
              comments.map(renderComment)
            ) : (
              <Text style={styles.proNoCommentsText}>No comments yet</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  proContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 32, // reduced from 48
    paddingBottom: 6, // reduced from 12
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF2',
    elevation: 0,
  },
  proBackButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F4F8FE',
  },
  proHeaderTitle: {
    fontSize: 17, // reduced from 22
    fontWeight: '700',
    color: '#222',
    letterSpacing: 0.1,
  },
  proContent: {
    flex: 1,
  },
  proPostCard: {
    backgroundColor: 'white',
    marginHorizontal: 8,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F1F3',
  },
  proPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  proUserAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E5E5EA',
    borderWidth: 2,
    borderColor: '#E5EAF2',
  },
  proFallbackAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  proFallbackAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  proUserInfo: {
    marginLeft: 14,
    flex: 1,
  },
  proUsername: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  proPostTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  proPostContent: {
    fontSize: 17,
    color: '#222',
    lineHeight: 26,
    marginBottom: 16,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  // proPostImage is now handled inline for more control
  proPostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F3',
    marginTop: 8,
  },
  proActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 28,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F4F8FE',
  },
  proActionText: {
    marginLeft: 7,
    fontSize: 15,
    color: '#1976D2',
    fontWeight: '600',
  },
  proLikedText: {
    color: '#FF3040',
  },
  proDivider: {
    height: 1,
    backgroundColor: '#E5EAF2',
    marginHorizontal: 24,
    marginVertical: 10,
    borderRadius: 1,
  },
  proCommentsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  proCommentsHeader: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1976D2',
    marginBottom: 14,
  },
  proNoCommentsText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 18,
  },
  dynamicImage: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    marginBottom: 10,
  },
  dynamicVideo: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#000',
    marginBottom: 10,
  },
});

// Dynamically sized image for feed/profile based on aspect ratio
function DynamicFeedImage({ imageUrl, onPress }) {
  const [dimensions, setDimensions] = React.useState({ width: 1, height: 1 });

  React.useEffect(() => {
    if (imageUrl) {
      Image.getSize(
        imageUrl,
        (width, height) => setDimensions({ width, height }),
        () => setDimensions({ width: 1, height: 1 })
      );
    }
  }, [imageUrl]);

  const isLandscape = dimensions.width > dimensions.height;
  const dynamicStyle = isLandscape
    ? { height: 300 }
    : { height: 500 };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: imageUrl }}
        style={[styles.dynamicImage, dynamicStyle]}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}

// Dynamically sized video for feed/profile based on aspect ratio
function DynamicFeedVideo({ videoUrl }) {
  const [dimensions, setDimensions] = React.useState({ width: 1, height: 1 });

  React.useEffect(() => {
    if (videoUrl) {
      // Use Image.getSize as a workaround to get video thumbnail size
      const thumbUrl = videoUrl.replace(/\.[^.]+$/, '.jpg');
      Image.getSize(
        thumbUrl,
        (width, height) => setDimensions({ width, height }),
        () => setDimensions({ width: 1, height: 1 })
      );
    }
  }, [videoUrl]);

  const isLandscape = dimensions.width > dimensions.height;
  const dynamicStyle = isLandscape
    ? { height: 300 }
    : { height: 500 };

  return (
    <Video
      source={{ uri: videoUrl }}
      rate={1.0}
      volume={1.0}
      isMuted={false}
      resizeMode="cover"
      useNativeControls
      style={[styles.dynamicVideo, dynamicStyle]}
    />
  );
}

export default PostDetailScreen;
