import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchNotifications,
  fetchNotificationCounts,
  markNotificationAsRead,
  markNotificationAsSeen,
  markAllAsRead,
  markAllAsSeen,
  deleteNotification,
  markAsReadLocally, // Add this import
  NOTIFICATION_TYPES,
} from '../../redux/notificationSlice';
import NotificationWebSocketService from '../../services/NotificationWebSocketService';
import NotificationItem from '../../components/Notifications/NotificationItem';

const { width } = Dimensions.get('window');

const NotificationsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, token } = useSelector(state => state.auth);
  const {
    notifications,
    loading,
    refreshing,
    error,
    unreadCount,
    unseenCount,
    hasMore,
    currentPage,
    connected,
  } = useSelector(state => state.notifications);

  const [loadingMore, setLoadingMore] = useState(false);

  // Initialize WebSocket connection when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (user?.id && token) {
        // Connect to WebSocket
        NotificationWebSocketService.connect(user.id, token, dispatch);
        
        // Fetch initial notifications and counts
        dispatch(fetchNotifications({ page: 0, size: 20 }));
        dispatch(fetchNotificationCounts());
        
        // Mark all notifications as seen when viewing the screen
        if (unseenCount > 0) {
          dispatch(markAllAsSeen());
        }
      }

      return () => {
        // Don't disconnect WebSocket here as it should persist
        // across screen navigations for real-time notifications
      };
    }, [dispatch, user?.id, token]) // FIXED: Removed unseenCount dependency to prevent infinite loops
  );

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    try {
      // Set refreshing state
      dispatch({ type: 'notifications/fetchNotifications/pending', meta: { arg: { page: 0 } } });
      
      // Fetch fresh notifications and counts
      await Promise.all([
        dispatch(fetchNotifications({ page: 0, size: 20 })).unwrap(),
        dispatch(fetchNotificationCounts()).unwrap()
      ]);
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
    }
  }, [dispatch]);

  // Handle load more notifications
  const loadMoreNotifications = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      dispatch(fetchNotifications({ page: currentPage + 1, size: 20 }))
        .finally(() => setLoadingMore(false));
    }
  }, [dispatch, hasMore, loadingMore, loading, currentPage]);

  // FIXED: Handle notification press with better error handling and state management
  const handleNotificationPress = useCallback(async (notification) => {
    try {
      // Apply optimistic update immediately for better UX
      if (!notification.isRead) {
        dispatch(markAsReadLocally(notification.id));
      }

      // Make the API call to persist the change
      if (!notification.isRead) {
        // This will handle the actual API call and update counts
        dispatch(markNotificationAsRead(notification.id));
      }

      // Navigate based on notification type and actionUrl
      if (notification.actionUrl) {
        const url = notification.actionUrl;
        
        if (url.includes('/posts/')) {
          const postId = url.split('/posts/')[1];
          navigation.navigate('PostDetail', { postId });
        } else if (url.includes('/users/')) {
          const userId = url.split('/users/')[1];
          navigation.navigate('ShowProfile', { userId });
        } else if (url.includes('/comments/')) {
          // Handle comment navigation
          const commentId = url.split('/comments/')[1];
          // Navigate to the post with the comment highlighted
          navigation.navigate('PostDetail', { postId: notification.entityId, highlightCommentId: commentId });
        }
      }
    } catch (error) {
      console.error('Failed to handle notification press:', error);
      
      // Navigate anyway even if marking as read fails
      if (notification.actionUrl) {
        const url = notification.actionUrl;
        
        if (url.includes('/posts/')) {
          const postId = url.split('/posts/')[1];
          navigation.navigate('PostDetail', { postId });
        } else if (url.includes('/users/')) {
          const userId = url.split('/users/')[1];
          navigation.navigate('ShowProfile', { userId });
        } else if (url.includes('/comments/')) {
          const commentId = url.split('/comments/')[1];
          navigation.navigate('PostDetail', { postId: notification.entityId, highlightCommentId: commentId });
        }
      }
    }
  }, [dispatch, navigation]);

  // Handle notification long press (for additional actions)
  const handleNotificationLongPress = useCallback((notification) => {
    const options = [
      notification.isRead ? 'Mark as Unread' : 'Mark as Read',
      'Delete',
      'Cancel'
    ];
    
    Alert.alert(
      'Notification Actions',
      'Choose an action for this notification',
      [
        {
          text: options[0],
          onPress: () => {
            if (notification.isRead) {
              // Mark as unread (you'd need to implement this action)
              console.log('Mark as unread:', notification.id);
            } else {
              dispatch(markNotificationAsRead(notification.id));
            }
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Notification',
              'Are you sure you want to delete this notification?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel'
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    dispatch(deleteNotification(notification.id));
                  }
                }
              ]
            );
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }, [dispatch]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    if (unreadCount > 0) {
      Alert.alert(
        'Mark All as Read',
        `Mark all ${unreadCount} notifications as read?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark All',
            onPress: () => dispatch(markAllAsRead())
          }
        ]
      );
    }
  }, [dispatch, unreadCount]);

  // FIXED: Add key extractor that includes read status to force re-render
  const keyExtractor = useCallback((item) => {
    return `${item.id}-${item.isRead}-${item.isSeen}`;
  }, []);

  // Render notification item
  const renderNotification = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
      onLongPress={() => handleNotificationLongPress(item)}
    />
  ), [handleNotificationPress, handleNotificationLongPress]);

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyStateTitle}>No Notifications</Text>
      <Text style={styles.emptyStateText}>
        You're all caught up! New notifications will appear here.
      </Text>
    </View>
  );

  // Render footer (load more indicator)
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  };

  // Render error state
  if (error && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerCompact}>
          <Text style={styles.headerTitleLarge}>Notifications</Text>
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerCompact}>
        <Text style={styles.headerTitleLarge}>Notifications</Text>
        <View style={styles.headerActionsCompact}>
          <View style={[styles.connectionIndicatorCompact, { backgroundColor: connected ? '#1976D2' : '#B0B0B0' }]} />
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.markAllButtonCompact, { flexDirection: 'row', alignItems: 'center' }]}
              onPress={handleMarkAllAsRead}
              activeOpacity={0.8}
              accessibilityLabel="Mark all notifications as read"
            >
              <MaterialCommunityIcons name="email-check-outline" size={18} color="#1976D2" />
              <Text style={styles.markAllButtonText}>Mark All</Text>
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <View style={styles.unreadBadgeCompact}>
              <Text style={styles.unreadBadgeTextCompact}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Notifications list */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        eyExtractor={keyExtractor}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        onEndReached={loadMoreNotifications}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={notifications.length === 0 ? styles.emptyListContainer : styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF2',
    elevation: 0,
  },
  headerTitleLarge: {
    fontSize: 21,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.1,
    marginLeft: 2,
    padding:10,
    borderRadius: 10,
    left:-6
  },
  headerActionsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicatorCompact: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
    backgroundColor: '#1976D2',
  },
  markAllButtonCompact: {
    backgroundColor: '#F4F8FE',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E3EAFD',
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
   markAllButtonText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 5,
  },
  unreadBadgeCompact: {
    backgroundColor: '#FF3B30',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  unreadBadgeTextCompact: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoaderText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
});

export default NotificationsScreen;
