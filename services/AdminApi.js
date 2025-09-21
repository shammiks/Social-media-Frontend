import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/apiConfig';

class AdminApiService {
  async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async getAllPosts(page = 0, size = 20, sortBy = 'createdAt', sortDir = 'desc') {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${API_BASE_URL}/admin/posts?page=${page}&size=${size}&sortBy=${sortBy}&sortDir=${sortDir}`;
      
      console.log('🔍 AdminAPI - Calling URL:', url);
      console.log('🔍 AdminAPI - Headers:', headers);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('🔍 AdminAPI - Response status:', response.status);
      console.log('🔍 AdminAPI - Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 AdminAPI - Error response:', errorText);
        throw new Error(`Failed to fetch posts: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AdminAPI - getAllPosts error:', error);
      console.error('AdminAPI - Error details:', error.message);
      throw error;
    }
  }

  async getReportedPosts() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/reported-posts`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch reported posts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AdminAPI - getReportedPosts error:', error);
      throw error;
    }
  }

  async warnUser(warningData) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/warn-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify(warningData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error issuing warning: ${errorText}`);
      }

      const successMessage = await response.text();
      return { success: true, message: successMessage };
    } catch (error) {
      console.error('AdminAPI - warnUser error:', error);
      throw error;
    }
  }

  async banUser(banData) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/ban-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify(banData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error banning user: ${errorText}`);
      }

      const successMessage = await response.text();
      return { success: true, message: successMessage };
    } catch (error) {
      console.error('AdminAPI - banUser error:', error);
      throw error;
    }
  }

  async deletePost(postId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/posts/${postId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error deleting post: ${errorText}`);
      }

      const successMessage = await response.text();
      return { success: true, message: successMessage };
    } catch (error) {
      console.error('AdminAPI - deletePost error:', error);
      throw error;
    }
  }

  async getUserWarnings(userId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/warnings`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user warnings: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AdminAPI - getUserWarnings error:', error);
      throw error;
    }
  }
}

export const adminAPI = new AdminApiService();