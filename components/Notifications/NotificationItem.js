import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import notificationApiService from '../../services/NotificationApiService';

const NotificationItem = ({ notification, onPress, onLongPress }) => {
  // Custom icon + colors
  const typeIcon = notificationApiService.getNotificationTypeIcon(notification.type);
  const typeColor = notificationApiService.getNotificationTypeColor(notification.type);
  const priorityColor = notificationApiService.getPriorityColor(notification.priority);

  const getActorAvatar = () => {
    if (notification.actor?.avatar) {
      return { uri: notification.actor.avatar };
    }
    return require('../../assets/default-avatar.png');
  };

  const renderPriorityIndicator = () => {
    if (notification.priority === 'HIGH' || notification.priority === 'URGENT') {
      return (
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]}>
          <Ionicons 
            name={notification.priority === 'URGENT' ? "alert" : "chevron-up"} 
            size={12} 
            color="#FFFFFF" 
          />
        </View>
      );
    }
    return null;
  };

  const renderNotificationIcon = () => {
    if (notification.actor && ['LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'MENTION', 'TAG'].includes(notification.type)) {
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

  return (
    <TouchableOpacity
      style={[
        styles.card,
        !notification.isRead && styles.unreadCard,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      {/* Left avatar or type icon */}
      {renderNotificationIcon()}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {notification.title}
          </Text>
          {renderPriorityIndicator()}
        </View>

        <Text style={styles.message} numberOfLines={3}>
          {notification.message}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.timeAgo}>{notification.timeAgo}</Text>
          {notification.type && (
            <Text style={[styles.typeLabel, { color: typeColor }]}>
              {notification.type.replace('_', ' ').toLowerCase()}
            </Text>
          )}
        </View>
      </View>

      {/* Chevron + unread dot */}
      <View style={styles.actionContainer}>
        {!notification.isRead && <View style={styles.unreadDot} />}
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#F0F8FF',
  },

  // Avatar + type icon
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E5EA',
  },
  typeIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  typeIconText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
    color: '#FFFFFF',
  },

  // Content
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // Priority
  priorityIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Action
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    marginBottom: 6,
  },
});

export default NotificationItem;
