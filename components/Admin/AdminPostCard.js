import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { format } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Video } from 'expo-av';

const SERVER_BASE_URL = 'http://192.168.1.5:8081';

const AdminPostCard = ({ post, onWarnUser, onBanUser, onDeletePost, navigation }) => {
  const prependBase = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${SERVER_BASE_URL}${url}`;
  };
  
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusBadge = () => {
    if (post.userBanned) {
      return (
        <View style={[styles.badge, styles.bannedBadge]}>
          <Icon name="block" size={12} color="#fff" />
          <Text style={styles.badgeText}>BANNED</Text>
        </View>
      );
    } else if (post.warningCount > 0) {
      return (
        <View style={[styles.badge, styles.warningBadge]}>
          <Icon name="warning" size={12} color="#fff" />
          <Text style={styles.badgeText}>
            {post.warningCount} WARNING{post.warningCount > 1 ? 'S' : ''}
          </Text>
        </View>
      );
    } else if (post.reported) {
      return (
        <View style={[styles.badge, styles.reportedBadge]}>
          <Icon name="flag" size={12} color="#fff" />
          <Text style={styles.badgeText}>REPORTED</Text>
        </View>
      );
    }
    return null;
  };

  const handleWarnPress = () => {
    if (post.userBanned) {
      Alert.alert('User Banned', 'This user is already banned.');
      return;
    }
    onWarnUser(post);
  };

  const handleBanPress = () => {
    if (post.userBanned) {
      Alert.alert('User Banned', 'This user is already banned.');
      return;
    }
    onBanUser(post);
  };

  const handleDeletePress = () => {
    onDeletePost(post.id);
  };

  const handleUserPress = () => {
    if (navigation && post.userId) {
      navigation.navigate('ShowProfile', { userId: post.userId });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with user info and status */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          <Image
            source={{
              uri: post.userAvatar || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(post.username)}&background=6C7CE7&color=fff&size=40`
            }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={[styles.username, styles.clickableUsername]}>@{post.username}</Text>
              {post.userIsAdmin && (
                <View style={styles.adminBadge}>
                  <Icon name="verified-user" size={12} color="#6C7CE7" />
                  <Text style={styles.adminBadgeText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail}>{post.userEmail}</Text>
            <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        {getStatusBadge()}
      </View>

      {/* Post content */}
      <View style={styles.content}>
        {post.content && (
          <Text style={styles.postText} numberOfLines={3}>
            {post.content}
          </Text>
        )}
        
        {post.imageUrl && (
          <Image source={{ uri: prependBase(post.imageUrl) }} style={styles.postImage} />
        )}
        
        {post.videoUrl && (
          <Video
            source={{ uri: prependBase(post.videoUrl) }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="cover"
            useNativeControls
            style={styles.video}
          />
        )}
        
        {post.pdfUrl && (
          <TouchableOpacity 
            onPress={async () => {
              try {
                const fullPdfUrl = prependBase(post.pdfUrl);
                let cleanUrl = decodeURIComponent(fullPdfUrl);
                let finalUrl = encodeURI(cleanUrl);
                const supported = await Linking.canOpenURL(finalUrl);
                if (supported) {
                  await Linking.openURL(finalUrl);
                } else {
                  await Linking.openURL(fullPdfUrl);
                }
              } catch (err) {
                console.error('Failed to open PDF:', err);
                Alert.alert('Error', 'Unable to open PDF file: ' + err.message);
              }
            }}
          >
            <View style={styles.pdfContainer}>
              <Icon name="picture-as-pdf" size={24} color="#ff4444" />
              <Text style={styles.pdfText}>View attached PDF</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Post stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Icon name="favorite-border" size={16} color="#657786" />
          <Text style={styles.statText}>{post.likesCount}</Text>
        </View>
        <View style={styles.stat}>
          <Icon name="comment" size={16} color="#657786" />
          <Text style={styles.statText}>{post.commentsCount}</Text>
        </View>
        <View style={styles.stat}>
          <Icon name={post.isPublic ? "public" : "lock"} size={16} color="#657786" />
          <Text style={styles.statText}>{post.isPublic ? "Public" : "Private"}</Text>
        </View>
        {post.reported && (
          <View style={styles.stat}>
            <Icon name="flag" size={16} color="#e74c3c" />
            <Text style={[styles.statText, { color: '#e74c3c' }]}>Reported</Text>
          </View>
        )}
      </View>

      {/* Warning info (if any) */}
      {post.hasWarnings && (
        <View style={styles.warningInfo}>
          <Icon name="warning" size={16} color="#f39c12" />
          <Text style={styles.warningInfoText}>
            Last warning: {post.lastWarningReason} 
            {post.lastWarningDate && ` (${formatDate(post.lastWarningDate)})`}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.warnButton]}
          onPress={handleWarnPress}
          disabled={post.userBanned}
        >
          <Icon name="warning" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>
            {post.warningCount > 0 ? 'Final Warning' : 'Warn User'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.banButton, post.userBanned && styles.disabledButton]}
          onPress={handleBanPress}
          disabled={post.userBanned}
        >
          <Icon name="block" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Ban User</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDeletePress}
        >
          <Icon name="delete" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginRight: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6C7CE7',
    marginLeft: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#657786',
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
    color: '#657786',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bannedBadge: {
    backgroundColor: '#e74c3c',
  },
  warningBadge: {
    backgroundColor: '#f39c12',
  },
  reportedBadge: {
    backgroundColor: '#e67e22',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
  },
  content: {
    marginBottom: 12,
  },
  postText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  mediaPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  mediaText: {
    fontSize: 14,
    color: '#657786',
    marginLeft: 8,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  pdfContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pdfText: {
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 12,
    color: '#657786',
    marginLeft: 4,
  },
  warningInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningInfoText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
  },
  warnButton: {
    backgroundColor: '#f39c12',
  },
  banButton: {
    backgroundColor: '#e74c3c',
  },
  deleteButton: {
    backgroundColor: '#95a5a6',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
  },
  clickableUsername: {
    textDecorationLine: 'underline',
    color: '#007AFF',
  },
});

export default AdminPostCard;