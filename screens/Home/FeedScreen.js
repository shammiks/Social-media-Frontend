import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Dimensions, ActivityIndicator, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform, Share, Linking
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const { width } = Dimensions.get('window');
const BASE_URL = 'http://192.168.43.36:8080/api/posts';
const SERVER_BASE_URL = 'http://192.168.43.36:8080';
const COMMENTS_URL = 'http://192.168.43.36:8080/api/comments';
const BOOKMARKS_URL = 'http://192.168.43.36:8080/api/bookmarks';

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

function CommentsModal({ visible, onClose, postId, token, currentUser, navigation }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
          source={{ 
            uri: (() => {
              // For comments, get user ID from various possible fields
              const commentUserId = item.userId || item.user?.id || item.authorId || item.commenterId;
              
              // Check if it's the current user first
              if (commentUserId === currentUser?.id && (currentUser?.avatar || currentUser?.profilePicture)) {
                return currentUser.avatar || currentUser.profilePicture;
              }
              // Otherwise check comment user data
              return item.user?.profilePicture || item.profilePicture || item.user?.avatar
                ? (item.user?.profilePicture || item.profilePicture || item.user?.avatar) 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'User')}&background=6C7CE7&color=fff&size=32`;
            })()
          }} 
          style={styles.commentAvatar} 
        />
        <View style={styles.commentContent}>
          <TouchableOpacity onPress={() => {
            // Check if this is the current user's comment
            const commentUserId = item.userId || item.user?.id || item.authorId || item.commenterId;
            if (commentUserId === currentUser?.id) {
              // Navigate to current user's own profile (Profile tab)
              navigation.navigate('Profile');
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
          <Text style={styles.commentTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        {/* Only show delete button for current user's comments */}
        {(item.userId || item.user?.id || item.authorId || item.commenterId) === currentUser?.id && (
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

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsModal, setCommentsModal] = useState({ visible: false, postId: null });
  const [imageModal, setImageModal] = useState({ visible: false, imageUrl: null });
  const [downloading, setDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const token = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);

  const navigation = useNavigation();

  useEffect(() => {
    fetchPosts();
  }, []);

  // Auto-refresh when screen comes into focus (e.g., after creating a post)
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      // Only refresh if it's been more than 2 seconds since last refresh and posts exist
      if (posts.length > 0 && (now - lastRefresh) > 2000) {
        console.log('FeedScreen focused - refreshing posts');
        setLastRefresh(now);
        fetchPosts();
      }
    }, [posts.length, lastRefresh])
  );

  const fetchPosts = async () => {
  try {
    setLoading(true);
    
    // Fetch posts and bookmarks in parallel
    const [postsRes, bookmarksRes] = await Promise.all([
      axios.get(`${BASE_URL}?page=0&size=100&sort=createdAt,desc&t=${Date.now()}`, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        } 
      }),
      axios.get(`${BOOKMARKS_URL}/my-bookmarks`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
    ]);

    console.log('FeedScreen posts count:', postsRes.data.content?.length || postsRes.data.length || 0);
    console.log('Total posts available:', postsRes.data.totalElements || 'N/A');
    console.log('Current page:', postsRes.data.pageable?.pageNumber || 'N/A');
    console.log('Total pages:', postsRes.data.totalPages || 'N/A');
    console.log('First few posts dates:', (postsRes.data.content || postsRes.data).slice(0, 5).map(p => ({
      id: p.id,
      createdAt: p.createdAt,
      content: p.content?.substring(0, 30) + '...',
      username: p.username
    })));

    // Create a Set of bookmarked post IDs for O(1) lookups
    const bookmarkedPostIds = new Set(
      bookmarksRes.data.map(post => post.id)
    );

    // Handle both paginated and non-paginated responses
    const postsData = postsRes.data.content || postsRes.data;

    // Merge bookmark status and like status into posts
    const postsWithBookmarks = postsData.map(post => ({
      ...post,
      isBookmarkedByCurrentUser: bookmarkedPostIds.has(post.id),
      isLikedByCurrentUser: post.likedByCurrentUser || post.isLikedByCurrentUser || post.isLiked || post.liked || false
    }));

    // Sort posts by createdAt in descending order (newest first)
    const sortedPosts = postsWithBookmarks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setPosts(sortedPosts);
  } catch (err) {
    console.error('Fetch error:', err);
    Alert.alert('Error', 'Failed to load posts');
  } finally {
    setLoading(false);
    setRefreshing(false);
    setLastRefresh(Date.now());
  }
};

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
      const res = await axios.post(`${BASE_URL}/${postId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update with server response to ensure consistency
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

  const handleBookmark = async (postId) => {
  try {
    const res = await axios.post(`${BOOKMARKS_URL}/${postId}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });

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

    // ✅ Fix this part
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

      // If there's an image, you can add URL (if your images are publicly accessible)
      if (post.imageUrl) {
        shareOptions.url = post.imageUrl;
      }

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type
        } else {
          // Shared successfully
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

  const renderPost = ({ item, index }) => {
    // Construct proper URLs for media files
    const imageUrl = item.imageUrl
      ? item.imageUrl.startsWith('http') ? item.imageUrl : `${SERVER_BASE_URL}${item.imageUrl}`
      : null;

    const videoUrl = item.videoUrl
      ? item.videoUrl.startsWith('http') ? item.videoUrl : `${SERVER_BASE_URL}${item.videoUrl}`
      : null;

    const pdfUrl = item.pdfUrl
      ? item.pdfUrl.startsWith('http') ? item.pdfUrl : `${SERVER_BASE_URL}${item.pdfUrl}`
      : null;

    return (
    <Animatable.View animation="slideInUp" delay={index * 150} style={styles.card}>
     <TouchableOpacity 
  style={styles.userRow}
  onPress={() => {
    if (!item.username) {
      Alert.alert('Error', 'User information is not available');
      return;
    }
    
    // Check if this is the current user's post
    if (item.userId === currentUser?.id) {
      // Navigate to own profile screen (Profile tab)
      navigation.navigate('Profile');
    } else {
      // Navigate to other user's profile screen
      navigation.navigate('ShowProfile', { 
        username: item.username,
        userId: item.userId
      });
    }
  }}
>
      <Image 
        source={{ 
          uri: (() => {
            // If it's the current user's post, use their profile picture
            if (item.userId === currentUser?.id && (currentUser?.avatar || currentUser?.profilePicture)) {
              return currentUser.avatar || currentUser.profilePicture;
            }
            // Otherwise use post user's profile picture or fallback
            return item.user?.profilePicture || item.profilePicture || item.user?.avatar
              ? (item.user?.profilePicture || item.profilePicture || item.user?.avatar) 
              : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'User')}&background=6C7CE7&color=fff&size=40`;
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
    </TouchableOpacity>

      <View style={styles.contentArea}>
        {item.content && <ReadMoreText text={item.content} />}
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
            try {
              // Handle spaces and special characters in PDF URLs
              // First decode any existing encoding, then re-encode properly
              let cleanUrl = decodeURIComponent(pdfUrl);
              let finalUrl = encodeURI(cleanUrl);
              
              const supported = await Linking.canOpenURL(finalUrl);
              if (supported) {
                await Linking.openURL(finalUrl);
              } else {
                // Fallback: try the original URL
                await Linking.openURL(pdfUrl);
              }
            } catch (err) {
              console.error('Failed to open PDF:', err);
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
  };

  const handleNotificationPress = () => {
    // Navigate to notifications screen when implemented
    // navigation.navigate('Notifications');
    Alert.alert('Notifications', 'Notifications feature coming soon!');
  };

  const openImageModal = (imageUrl) => {
    setImageLoading(true);
    setImageModal({ visible: true, imageUrl });
  };

  const closeImageModal = () => {
    setImageModal({ visible: false, imageUrl: null });
    setImageLoading(true);
  };

  const downloadImage = async (imageUrl) => {
    try {
      setDownloading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save images to your gallery');
        return;
      }

      // Get file info and download
      const fileUri = FileSystem.documentDirectory + 'temp_image.jpg';
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      if (downloadResult.status === 200) {
        // Save to media library
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('SocialApp', asset, false);
        
        Alert.alert('Success', 'Image saved to gallery!');
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download image');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header with App Icon and Notification */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.appIconContainer}>
            <Ionicons name="chatbubbles" size={24} color="#1e90ff" />
          </View>
          <Text style={styles.appName}>SocialApp</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={handleNotificationPress}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
          {/* Add notification badge if needed */}
          <View style={styles.notificationBadge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e90ff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPost}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={fetchPosts}
        />
      )}
      
      <CommentsModal
        visible={commentsModal.visible}
        onClose={closeComments}
        postId={commentsModal.postId}
        token={token}
        currentUser={currentUser}
        navigation={navigation}
      />

      {/* Full Screen Image Modal */}
      <Modal
        visible={imageModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
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
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
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
  // Comments Modal Styles
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
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
    height: '80%',
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