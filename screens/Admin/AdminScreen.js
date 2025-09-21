import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import AdminPostCard from '../../components/Admin/AdminPostCard';
import WarningModal from '../../components/Admin/WarningModal';
import BanModal from '../../components/Admin/BanModal';
import { adminAPI } from '../../services/AdminApi';
import { logout } from '../../redux/authSlice';
import Icon from 'react-native-vector-icons/MaterialIcons';

const AdminScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Modal states
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // Check if user is admin
  useEffect(() => {
    if (!user?.isAdmin) {
      Alert.alert(
        'Access Denied', 
        'You do not have permission to access this screen.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [user, navigation]);

  // Load posts
  const loadPosts = useCallback(async (pageNum = 0, isRefresh = false) => {
    try {
      if (!isRefresh && pageNum === 0) {
        setLoading(true);
      }
      
      const response = await adminAPI.getAllPosts(pageNum, 20);
      
      if (pageNum === 0) {
        setPosts(response.content || []);
      } else {
        setPosts(prev => [...prev, ...(response.content || [])]);
      }
      
      setHasMore(!response.last);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load posts:', error);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user?.isAdmin) {
      loadPosts();
    }
  }, [loadPosts, user?.isAdmin]);

  // Refresh posts
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    loadPosts(0, true);
  }, [loadPosts]);

  // Load more posts
  const loadMorePosts = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      loadPosts(page + 1);
    }
  }, [hasMore, loadingMore, loading, page, loadPosts]);

  // Handle warning user
  const handleWarnUser = (post) => {
    setSelectedPost(post);
    setWarningModalVisible(true);
  };

  // Handle ban user
  const handleBanUser = (post) => {
    if (post.warningCount === 0) {
      Alert.alert(
        'Warning Required',
        'You must issue a warning to the user before banning them.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Issue Warning', onPress: () => handleWarnUser(post) }
        ]
      );
      return;
    }
    
    setSelectedPost(post);
    setBanModalVisible(true);
  };

  // Handle warning submission
  const handleWarningSubmit = async (warningData) => {
    try {
      const result = await adminAPI.warnUser({
        postId: selectedPost.id,
        userId: selectedPost.userId,
        reason: warningData.reason,
        warningMessage: warningData.message,
      });

      Alert.alert('Success', result.message || 'Warning sent successfully!');
      setWarningModalVisible(false);
      onRefresh(); // Refresh the posts list
    } catch (error) {
      console.error('Failed to send warning:', error);
      Alert.alert('Error', 'Failed to send warning. Please try again.');
    }
  };

  // Handle ban submission
  const handleBanSubmit = async (banData) => {
    try {
      const result = await adminAPI.banUser({
        userId: selectedPost.userId,
        reason: banData.reason,
      });

      Alert.alert('Success', result.message || 'User banned successfully!');
      setBanModalVisible(false);
      onRefresh(); // Refresh the posts list
    } catch (error) {
      console.error('Failed to ban user:', error);
      Alert.alert('Error', 'Failed to ban user. Please try again.');
    }
  };

  // Handle delete post
  const handleDeletePost = async (postId) => {
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
              const result = await adminAPI.deletePost(postId);
              Alert.alert('Success', result.message || 'Post deleted successfully!');
              onRefresh();
            } catch (error) {
              console.error('Failed to delete post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    dispatch(logout());
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const renderPost = ({ item }) => (
    <AdminPostCard
      post={item}
      onWarnUser={handleWarnUser}
      onBanUser={handleBanUser}
      onDeletePost={handleDeletePost}
      navigation={navigation}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6C7CE7" />
        <Text style={styles.footerText}>Loading more posts...</Text>
      </View>
    );
  };

  if (!user?.isAdmin) {
    return null; // Don't render anything for non-admin users
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C7CE7" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Moderation</Text>
        <Text style={styles.headerSubtitle}>
          {posts.length} posts • Manage content and users
        </Text>
      </View>

      {/* Logout Button */}
      <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <TouchableOpacity onPress={handleLogout} style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(231,76,60,0.1)' }}>
          <Icon name="logout" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6C7CE7']}
          />
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts found</Text>
          </View>
        }
      />

      {/* Warning Modal */}
      <WarningModal
        visible={warningModalVisible}
        onClose={() => setWarningModalVisible(false)}
        onSubmit={handleWarningSubmit}
        post={selectedPost}
      />

      {/* Ban Modal */}
      <BanModal
        visible={banModalVisible}
        onClose={() => setBanModalVisible(false)}
        onSubmit={handleBanSubmit}
        post={selectedPost}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#657786',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#657786',
    fontSize: 16,
  },
  listContainer: {
    paddingVertical: 10,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  footerText: {
    marginLeft: 10,
    color: '#657786',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#657786',
  },
});

export default AdminScreen;