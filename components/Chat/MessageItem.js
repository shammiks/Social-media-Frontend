import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ActionSheetIOS,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';


import { useState } from 'react';

const MessageItem = ({ 
  message, 
  user, 
  chat, 
  onMessageLongPress, 
  onReactionPress, 
  isMessageMine 
}) => {
  // State for media modal
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [modalMediaType, setModalMediaType] = useState('IMAGE');

  // Null check for message
  if (!message) {
    console.warn('MessageItem: Received null/undefined message, skipping render');
    return null;
  }

  const messageTime = new Date(message.createdAt);
  const timeString = messageTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Better sender name logic
  const getSenderDisplayName = (message) => {
    // Null check for message
    if (!message) {
      return 'Unknown User';
    }
    
    // If it's my message, use my user info
    if (isMessageMine && user) {
      return user.displayName || user.username || 'You';
    }
    
    // For other users' messages
    if (message.senderName) return message.senderName;
    if (message.senderDisplayName) return message.senderDisplayName;
    
    // Check if sender object exists (this is where the backend puts the sender info)
    if (message.sender) {
      return message.sender.displayName || 
             message.sender.username || 
             'Unknown User';
    }
    
    // Try to find sender from chat participants
    const sender = chat.participants?.find(p => p.user?.id === (message.senderId || message.sender?.id));
    if (sender?.user) {
      return sender.user.displayName || 
             sender.user.username || 
             'Unknown User';
    }
    
    // If we can't find the sender info but we know the senderId
    if (message.senderId === user?.id || message.senderId === 'CURRENT_USER_MESSAGE') {
      return user?.displayName || user?.username || 'You';
    }
    
    return 'Unknown User';
  };

  // Get sender profile picture
  const getSenderProfilePicture = (message) => {
    // Null check for message
    if (!message) {
      return null;
    }
    
    // If it's my message, use my user info from auth state (most reliable)
    if (isMessageMine && user) {
      const myAvatar = user.avatar || user.profileImageUrl || user.profilePicture;
      return myAvatar;
    }
    
    // For other users' messages, check sender object first
    if (message.sender) {
      const profilePic = message.sender.avatar || 
                        message.sender.profileImageUrl ||
                        message.sender.profilePicture;
      if (profilePic) {
        return profilePic;
      }
    }
    
    // Try to find sender from chat participants
    const sender = chat.participants?.find(p => 
      p.user?.id === (message.senderId || message.sender?.id)
    );
    if (sender?.user) {
      const profilePic = sender.user.avatar || 
                        sender.user.profileImageUrl ||
                        sender.user.profilePicture;
      if (profilePic) {
        return profilePic;
      }
    }
    
    return null;
  };

  const senderDisplayName = getSenderDisplayName(message);
  const senderProfilePicture = getSenderProfilePicture(message);

  return (
    <TouchableOpacity
      onLongPress={() => onMessageLongPress(message)}
      activeOpacity={0.7}
      style={[
        styles.messageWrapper,
        isMessageMine ? styles.myMessageWrapper : styles.otherMessageWrapper,
      ]}
    >
      {!isMessageMine && (
        <View style={styles.avatarContainer}>
          <Image 
            source={{ 
              uri: senderProfilePicture 
                ? senderProfilePicture 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(senderDisplayName)}&background=random&color=fff&size=40&rounded=true&bold=true`
            }} 
            style={styles.avatar}
            defaultSource={require('../../assets/default-avatar.png')}
            onError={() => {
              console.log('Failed to load profile picture for:', senderDisplayName);
            }}
          />
        </View>
      )}
      
      <View style={[
        styles.messageContainer,
        isMessageMine ? styles.myMessage : styles.otherMessage,
      ]}>
        {!isMessageMine && senderDisplayName && (
          <Text style={styles.senderName}>{senderDisplayName}</Text>
        )}
        
        {message.isPinned && (
          <View style={styles.pinnedIndicator}>
            <Ionicons name="pin" size={12} color="#FF6B6B" />
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}
        

        {/* Fullscreen media modal */}
        {showMediaModal && (
          <Modal
            visible={showMediaModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowMediaModal(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 2 }} onPress={() => setShowMediaModal(false)}>
                <Ionicons name="close" size={36} color="#fff" />
              </TouchableOpacity>
              {modalMediaType === 'IMAGE' ? (
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={{ width: '95%', height: '70%', borderRadius: 16, resizeMode: 'contain' }}
                />
              ) : (
                <Video
                  source={{ uri: message.mediaUrl }}
                  style={{ width: '95%', height: 320, borderRadius: 16, backgroundColor: '#000' }}
                  useNativeControls
                  resizeMode="contain"
                  shouldPlay
                />
              )}
            </View>
          </Modal>
        )}

        {/* Show image if messageType is IMAGE and mediaUrl exists */}
        {message.messageType === 'IMAGE' && message.mediaUrl ? (
          <TouchableOpacity onPress={() => { setModalMediaType('IMAGE'); setShowMediaModal(true); }} activeOpacity={0.85}>
            <Image
              source={{ uri: message.mediaUrl }}
              style={{
                width: '100%',
                maxWidth: 320,
                height: undefined,
                aspectRatio: 1,
                borderRadius: 12,
                marginBottom: 6,
                alignSelf: 'center',
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : null}

        {/* Show video if messageType is VIDEO and mediaUrl exists */}
        {message.messageType === 'VIDEO' && message.mediaUrl ? (
          <TouchableOpacity onPress={() => { setModalMediaType('VIDEO'); setShowMediaModal(true); }} activeOpacity={0.85}>
            <Video
              source={{ uri: message.mediaUrl }}
              style={{
                width: '95%',
                minWidth: 280,
                maxWidth: 400,
                height: 250,
                borderRadius: 12,
                marginBottom: 6,
                alignSelf: 'center',
                backgroundColor: '#000',
              }}
              useNativeControls
              resizeMode="contain"
              shouldPlay={false}
            />
          </TouchableOpacity>
        ) : null}

        {/* Show text content for non-media or as caption */}
        {message.content ? (
          <Text style={[
            styles.messageText,
            isMessageMine ? styles.myMessageText : styles.otherMessageText,
          ]}>
            {message.content}
          </Text>
        ) : null}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <View style={styles.reactionsContainer}>
            {message.reactions.map((reaction, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionBubble}
                onPress={() => onReactionPress(message.id, reaction.emoji)}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                <Text style={styles.reactionCount}>{reaction.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isMessageMine ? styles.myMessageTime : styles.otherMessageTime,
          ]}>
            {timeString}
          </Text>
          
          {message.edited && (
            <Text style={styles.editedLabel}>edited</Text>
          )}
          
          {isMessageMine && (
            <Ionicons
              name={message.isRead ? "checkmark-done" : "checkmark"}
              size={14}
              color={message.isRead ? "#00BFA5" : "#B0BEC5"}
              style={styles.readIndicator}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  messageContainer: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 13,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: {
    backgroundColor: '#6C7CE7',
    borderBottomRightRadius: 6,
    marginLeft: 50,
  },
  otherMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    marginRight: 50,
    borderWidth: 0.6,
    borderColor: '#E5E5E5',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C7CE7',
    marginBottom: 2,
  },
  pinnedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  pinnedText: {
    fontSize: 11,
    color: '#FF6B6B',
    marginLeft: 3,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#2C3E50',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 2,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 11,
    color: '#666',
    marginLeft: 3,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: '#8E8E93',
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    marginRight: 4,
    color: '#999',
  },
  readIndicator: {
    marginLeft: 4,
  },
});


export default MessageItem;
