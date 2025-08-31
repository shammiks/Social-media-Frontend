import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { hideNotificationPopup, markNotificationAsSeen } from '../../redux/notificationSlice';
import notificationApiService from '../../services/NotificationApiService';

const { width, height } = Dimensions.get('window');
const POPUP_HEIGHT = 100;
const POPUP_MARGIN = 20;

const NotificationPopup = ({ navigation }) => {
  const dispatch = useDispatch();
  const { showPopup, popupNotification } = useSelector(state => state.notifications);
  
  const translateY = useRef(new Animated.Value(-POPUP_HEIGHT - 50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const autoHideTimer = useRef(null);

  // Show/hide animation
  useEffect(() => {
    if (showPopup && popupNotification) {
      showNotification();
      // Auto-hide after 4 seconds
      autoHideTimer.current = setTimeout(() => {
        hideNotification();
      }, 4000);
    } else {
      hideNotification();
    }

    return () => {
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
    };
  }, [showPopup, popupNotification]);

  const showNotification = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -POPUP_HEIGHT - 50,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dispatch(hideNotificationPopup());
    });
  };

  const handleNotificationPress = () => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
    }

    // Mark as seen
    dispatch(markNotificationAsSeen(popupNotification.id));
    
    // Hide popup
    hideNotification();

    // Navigate based on notification
    if (popupNotification.actionUrl) {
      const url = popupNotification.actionUrl;
      
      if (url.includes('/posts/')) {
        const postId = url.split('/posts/')[1];
        navigation.navigate('PostDetail', { postId });
      } else if (url.includes('/users/')) {
        const userId = url.split('/users/')[1];
        navigation.navigate('ShowProfile', { userId });
      } else if (url.includes('/comments/')) {
        const commentId = url.split('/comments/')[1];
        // Navigate to post and highlight the comment
        navigation.navigate('PostDetail', { postId: popupNotification.entityId, highlightCommentId: commentId });
      }
    } else {
      // Navigate to notifications screen
      navigation.navigate('Notifications');
    }
  };

  const handleSwipeUp = (event) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
      if (translationY < -50 || velocityY < -500) {
        hideNotification();
      }
    }
  };

  const getActorAvatar = () => {
    if (popupNotification?.actor?.avatar) {
      return { uri: popupNotification.actor.avatar };
    }
    return require('../../assets/default-avatar.png');
  };

  const renderNotificationIcon = () => {
    if (!popupNotification) return null;

    const typeIcon = notificationApiService.getNotificationTypeIcon(popupNotification.type);
    const typeColor = notificationApiService.getNotificationTypeColor(popupNotification.type);

    if (popupNotification.actor && ['LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'MENTION', 'TAG'].includes(popupNotification.type)) {
      return (
        <View style={styles.avatarContainer}>
          <Image source={getActorAvatar()} style={styles.avatar} />
          <View style={[styles.typeIconBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.typeIconText}>{typeIcon}</Text>
          </View>
        </View>
      );
    } else {
      return (
        <View style={[styles.iconContainer, { backgroundColor: typeColor }]}>
          <Text style={styles.iconText}>{typeIcon}</Text>
        </View>
      );
    }
  };

  if (!showPopup || !popupNotification) {
    return null;
  }

  return (
    <PanGestureHandler onHandlerStateChange={handleSwipeUp}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.notificationCard}
          onPress={handleNotificationPress}
          activeOpacity={0.9}
        >
          {/* Swipe indicator */}
          <View style={styles.swipeIndicator} />
          
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={hideNotification}
          >
            <Ionicons name="close" size={16} color="#8E8E93" />
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.content}>
            {/* Icon/Avatar */}
            {renderNotificationIcon()}
            
            {/* Text content */}
            <View style={styles.textContent}>
              <Text style={styles.title} numberOfLines={1}>
                {popupNotification.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {popupNotification.message}
              </Text>
              <Text style={styles.timeAgo}>
                {popupNotification.timeAgo || 'just now'}
              </Text>
            </View>
          </View>

          {/* Priority indicator */}
          {(popupNotification.priority === 'HIGH' || popupNotification.priority === 'URGENT') && (
            <View style={[
              styles.priorityStripe,
              { backgroundColor: notificationApiService.getPriorityColor(popupNotification.priority) }
            ]} />
          )}
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: POPUP_MARGIN,
    right: POPUP_MARGIN,
    zIndex: 9999,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  swipeIndicator: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -15,
    width: 30,
    height: 3,
    backgroundColor: '#C7C7CC',
    borderRadius: 1.5,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  
  // Icon/Avatar styles
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
  },
  typeIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  typeIconText: {
    fontSize: 8,
    color: '#FFFFFF',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  
  // Text content styles
  textContent: {
    flex: 1,
    paddingRight: 20,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 16,
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 11,
    color: '#C7C7CC',
  },
  
  // Priority indicator
  priorityStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});

export default NotificationPopup;
