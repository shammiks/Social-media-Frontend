// services/NotificationIntegrationService.js
import axios from 'axios';
import { API_ENDPOINTS } from '../utils/apiConfig';

class NotificationIntegrationService {
  constructor() {
    this.baseURL = API_ENDPOINTS.BASE;
  }

  // Enhanced Like function that triggers notifications
  async likePost(postId, token, currentLikeState) {
    try {
      // Call your existing like API
      const response = await axios.post(
        `${this.baseURL}/posts/${postId}/like`, 
        {}, 
        {
          headers: { Authorization: `Bearer ${token}` }
        }
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
        response = await axios.post(
          `${API_ENDPOINTS.FOLLOW}/toggle?followeeId=${targetUserId}`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      } catch (error) {
        // Fallback to the alternative endpoint
        response = await axios.post(
          `${API_ENDPOINTS.FOLLOW}/${currentFollowState ? 'unfollow' : 'follow'}/${targetUserId}`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` }
          }
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
      const response = await axios.post(
        `${API_ENDPOINTS.COMMENTS}/${postId}`,
        { content },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
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
      const response = await axios.post(
        `${API_ENDPOINTS.COMMENTS}/${commentId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
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
      const response = await axios.post(
        `${API_ENDPOINTS.COMMENTS}/${commentId}/reply`,
        { content },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }
}

export default new NotificationIntegrationService();
