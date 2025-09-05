// services/NotificationIntegrationService.js
import API from '../utils/api';
import { API_ENDPOINTS } from '../utils/apiConfig';

class NotificationIntegrationService {
  constructor() {
    this.baseURL = API_ENDPOINTS.BASE;
  }

  // Enhanced Like function that triggers notifications
  async likePost(postId, token, currentLikeState) {
    try {
      // Call your existing like API
      const response = await API.post(
        `${this.baseURL}/posts/${postId}/like`, 
        {}
      );

      // The backend should automatically send notifications via WebSocket
      // Your Spring Boot NotificationService should handle this in the like endpoint

      return response.data;
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Enhanced Follow function that triggers notifications
  async toggleFollow(targetUserId, token, currentFollowState) {
    try {
      // Try the toggle endpoint first
      let response;
      try {
        response = await API.post(
          `${API_ENDPOINTS.FOLLOW}/toggle?followeeId=${targetUserId}`,
          {}
        );
      } catch (error) {
        // Fallback to the alternative endpoint
        response = await API.post(
          `${API_ENDPOINTS.FOLLOW}/${currentFollowState ? 'unfollow' : 'follow'}/${targetUserId}`,
          {}
        );
      }

      // The backend should automatically send notifications via WebSocket
      // Your Spring Boot NotificationService should handle this in the follow endpoint

      return response.data;
    } catch (error) {
      console.error('Error toggling follow:', error);
      throw error;
    }
  }

  // Enhanced Comment function that triggers notifications
  async addComment(postId, content, token) {
    try {
      // Call your existing comment API
      const response = await API.post(
        `${API_ENDPOINTS.COMMENTS}/${postId}`,
        { content }
      );

      // The backend should automatically send notifications via WebSocket
      // Your Spring Boot NotificationService should handle this in the comment endpoint

      return response.data;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Enhanced Comment Like function
  async likeComment(commentId, token) {
    try {
      const response = await API.post(
        `${API_ENDPOINTS.COMMENTS}/${commentId}/like`,
        {}
      );

      return response.data;
    } catch (error) {
      console.error('Error liking comment:', error);
      throw error;
    }
  }

  // Enhanced Reply function
  async addReply(commentId, content, token) {
    try {
      const response = await API.post(
        `${API_ENDPOINTS.COMMENTS}/${commentId}/reply`,
        { content }
      );

      return response.data;
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }
}

export default new NotificationIntegrationService();
