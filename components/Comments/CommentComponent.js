import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import API from '../../utils/api';
import { useSelector } from 'react-redux';
import { API_ENDPOINTS } from '../../utils/apiConfig';
import NotificationIntegrationService from '../../services/NotificationIntegrationService';

const CommentComponent = ({ 
  comment, 
  onCommentUpdate, 
  onCommentDelete, 
  onUserPress,
  isOwner,
  currentUser,
  formatDate 
}) => {
  const token = useSelector(state => state.auth.token);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [likingComment, setLikingComment] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [updating, setUpdating] = useState(false);

  // Toggle like functionality
  const toggleLike = async () => {
    if (likingComment) return;
    
    try {
      setLikingComment(true);
      // Use the new notification-integrated service
      const response = await NotificationIntegrationService.likeComment(comment.id, token);
      
      // Update comment like status
      const updatedComment = {
        ...comment,
        likedByCurrentUser: response.liked,
        likeCount: comment.likeCount + (response.liked ? 1 : -1)
      };
      
      onCommentUpdate(updatedComment);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setLikingComment(false);
    }
  };

  // Fetch replies
  const fetchReplies = async () => {
    if (loadingReplies) return;
    
    try {
      setLoadingReplies(true);
      console.log('Fetching replies with URL:', `${API_ENDPOINTS.COMMENTS}/${comment.id}/replies`);
      
      const response = await API.get(
        `${API_ENDPOINTS.COMMENTS}/${comment.id}/replies`
      );
      setReplies(response.data || []);
      setShowReplies(true);
    } catch (error) {
      console.error('Error fetching replies:', error);
      console.error('Error details:', error.response?.data);
      Alert.alert('Error', 'Failed to load replies');
    } finally {
      setLoadingReplies(false);
    }
  };

  // Add reply
  const addReply = async () => {
    if (!replyText.trim() || submittingReply) return;
    
    try {
      setSubmittingReply(true);
      console.log('Adding reply with notification integration');
      console.log('Token exists:', !!token);
      
      // Use the new notification-integrated service
      const response = await NotificationIntegrationService.addReply(
        comment.id, 
        replyText.trim(), 
        token
      );
      
      setReplies(prev => [...prev, response]);
      setReplyText('');
      setShowReplyInput(false);
      setShowReplies(true);
      
      // Update reply count in parent comment
      const updatedComment = {
        ...comment,
        replyCount: (comment.replyCount || 0) + 1
      };
      onCommentUpdate(updatedComment);
    } catch (error) {
      console.error('Error adding reply:', error);
      console.error('Error details:', error.response?.data);
      Alert.alert('Error', 'Failed to add reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Edit comment
  const updateComment = async () => {
    if (!editText.trim() || updating) return;
    
    try {
      setUpdating(true);
      const response = await API.put(
        `${API_ENDPOINTS.COMMENTS}/${comment.id}`,
        { content: editText.trim() }
      );
      
      onCommentUpdate(response.data);
      setEditModalVisible(false);
    } catch (error) {
      console.error('Error updating comment:', error);
      Alert.alert('Error', 'Failed to update comment');
    } finally {
      setUpdating(false);
    }
  };

  // Delete comment
  const deleteComment = () => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onCommentDelete(comment.id)
        }
      ]
    );
  };

  // Show comment options
  const showCommentOptions = () => {
    Alert.alert(
      'Comment Options',
      '',
      [
        { text: 'Edit', onPress: () => setEditModalVisible(true) },
        { text: 'Delete', style: 'destructive', onPress: deleteComment },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Update reply
  const updateReply = (updatedReply) => {
    setReplies(prev => prev.map(reply => 
      reply.id === updatedReply.id ? updatedReply : reply
    ));
  };

  // Delete reply
  const deleteReply = (replyId) => {
    setReplies(prev => prev.filter(reply => reply.id !== replyId));
    
    // Update reply count in parent comment
    const updatedComment = {
      ...comment,
      replyCount: Math.max((comment.replyCount || 0) - 1, 0)
    };
    onCommentUpdate(updatedComment);
  };

  return (
    <View style={styles.commentContainer}>
      {/* Main Comment */}
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => onUserPress(comment)}>
            <Image 
              source={{ 
                uri: (() => {
                  // Check if this is the current user's comment first
                  const commentUserId = comment.userId || comment.user?.id || comment.authorId || comment.commenterId;
                  const isCurrentUser = commentUserId === currentUser?.id;
                  const currentUserPic = currentUser?.profilePicture || currentUser?.avatar;
                  if (isCurrentUser && currentUserPic) {
                    return currentUserPic;
                  }
                  // Try all possible fields for other users
                  if (comment.user?.profilePicture) return comment.user.profilePicture;
                  if (comment.user?.avatar) return comment.user.avatar;
                  if (comment.profilePicture) return comment.profilePicture;
                  if (comment.avatar) return comment.avatar;
                  // Fallback to generated avatar
                  return `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || 'User')}&background=6C7CE7&color=fff&size=32`;
                })()
              }} 
              style={styles.commentAvatar} 
            />
          </TouchableOpacity>
          
          <View style={styles.commentContent}>
            <TouchableOpacity onPress={() => onUserPress(comment)}>
              <Text style={styles.commentUsername}>{comment.username}</Text>
            </TouchableOpacity>
            <Text style={styles.commentText}>{comment.content}</Text>
            
            <View style={styles.commentActions}>
              <Text style={styles.commentTime}>{formatDate(comment.createdAt)}</Text>
              {comment.edited && <Text style={styles.editedText}>• edited</Text>}
              
              {/* Like Button */}
              <TouchableOpacity 
                onPress={toggleLike}
                style={styles.actionButton}
                disabled={likingComment}
              >
                {likingComment ? (
                  <ActivityIndicator size="small" color="#666" />
                ) : (
                  <>
                    <MaterialIcons 
                      name={comment.likedByCurrentUser ? "favorite" : "favorite-border"} 
                      size={14} 
                      color={comment.likedByCurrentUser ? "#e74c3c" : "#666"} 
                    />
                    {comment.likeCount > 0 && (
                      <Text style={styles.actionText}>{comment.likeCount}</Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
              
              {/* Reply Button */}
              <TouchableOpacity 
                onPress={() => setShowReplyInput(!showReplyInput)}
                style={styles.actionButton}
              >
                <MaterialIcons name="reply" size={14} color="#666" />
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
              
              {/* Show Replies Button */}
              {comment.replyCount > 0 && (
                <TouchableOpacity 
                  onPress={showReplies ? () => setShowReplies(false) : fetchReplies}
                  style={styles.actionButton}
                  disabled={loadingReplies}
                >
                  {loadingReplies ? (
                    <ActivityIndicator size="small" color="#666" />
                  ) : (
                    <>
                      <MaterialIcons 
                        name={showReplies ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                        size={14} 
                        color="#666" 
                      />
                      <Text style={styles.actionText}>
                        {showReplies ? 'Hide' : `${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Options Button for Owner */}
          {isOwner && (
            <TouchableOpacity 
              onPress={showCommentOptions}
              style={styles.commentOptionsBtn}
            >
              <MaterialIcons name="more-vert" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Reply Input */}
      {showReplyInput && (
        <View style={styles.replyInputContainer}>
          <Image 
            source={{ 
              uri: currentUser?.profilePicture || currentUser?.avatar || 
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.username || 'You')}&background=6C7CE7&color=fff&size=32`
            }} 
            style={styles.replyAvatar} 
          />
          <View style={styles.replyInputWrapper}>
            <TextInput
              style={styles.replyInput}
              placeholder="Write a reply..."
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={500}
            />
            <View style={styles.replyActions}>
              <TouchableOpacity 
                onPress={() => {
                  setShowReplyInput(false);
                  setReplyText('');
                }}
                style={styles.cancelReplyBtn}
              >
                <Text style={styles.cancelReplyText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={addReply}
                style={[styles.submitReplyBtn, !replyText.trim() && styles.submitReplyBtnDisabled]}
                disabled={!replyText.trim() || submittingReply}
              >
                {submittingReply ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitReplyText}>Reply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {replies.map(reply => (
            <CommentComponent
              key={reply.id}
              comment={reply}
              onCommentUpdate={updateReply}
              onCommentDelete={deleteReply}
              onUserPress={onUserPress}
              isOwner={reply.userId === currentUser?.id}
              currentUser={currentUser}
              formatDate={formatDate}
              isReply={true}
            />
          ))}
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Comment</Text>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                style={styles.editModalCloseBtn}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.editModalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={500}
              placeholder="Edit your comment..."
            />
            
            <View style={styles.editModalActions}>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                style={styles.editModalCancelBtn}
              >
                <Text style={styles.editModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={updateComment}
                style={[styles.editModalSaveBtn, !editText.trim() && styles.editModalSaveBtnDisabled]}
                disabled={!editText.trim() || updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editModalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = {
  commentContainer: {
    marginBottom: 8,
  },
  commentItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  editedText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginRight: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  commentOptionsBtn: {
    padding: 4,
    marginLeft: 8,
  },
  replyInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 44,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  replyInputWrapper: {
    flex: 1,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    maxHeight: 80,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelReplyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelReplyText: {
    color: '#666',
    fontSize: 14,
  },
  submitReplyBtn: {
    backgroundColor: '#6C7CE7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  submitReplyBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitReplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  repliesContainer: {
    marginLeft: 44,
    borderLeftWidth: 2,
    borderLeftColor: '#f0f0f0',
    paddingLeft: 8,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editModalCloseBtn: {
    padding: 4,
  },
  editModalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editModalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  editModalCancelText: {
    color: '#666',
    fontSize: 14,
  },
  editModalSaveBtn: {
    backgroundColor: '#6C7CE7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  editModalSaveBtnDisabled: {
    backgroundColor: '#ccc',
  },
  editModalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
};

export default CommentComponent;
