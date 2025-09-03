// utils/tokenManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './apiConfig';

export class TokenManager {
  static async isTokenExpired() {
    try {
      const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
      if (!tokenExpiry) return true;
      
      const expiry = parseInt(tokenExpiry);
      const now = Date.now();
      
      // Consider token expired if it expires in the next 30 seconds
      return (expiry - now) <= 30000;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }

  static async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_ENDPOINTS.AUTH}/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newExpiry = Date.now() + (data.expiresIn * 1000);

      // Store new tokens
      await AsyncStorage.setItem('authToken', data.accessToken);
      if (data.refreshToken) {
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
      }
      await AsyncStorage.setItem('tokenExpiry', newExpiry.toString());

      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
        expiresIn: data.expiresIn,
        tokenExpiry: newExpiry,
      };
    } catch (error) {
      // Clear tokens on refresh failure
      await this.clearTokens();
      throw error;
    }
  }

  static async clearTokens() {
    try {
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'tokenExpiry']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  static async getValidToken() {
    try {
      const isExpired = await this.isTokenExpired();
      
      if (isExpired) {
        const refreshResult = await this.refreshToken();
        return refreshResult.accessToken;
      }
      
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  static async logout() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (refreshToken) {
        // Call logout endpoint to revoke refresh token
        try {
          await fetch(`${API_ENDPOINTS.AUTH}/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });
        } catch (logoutError) {
          console.error('Logout API call failed:', logoutError);
        }
      }
      
      await this.clearTokens();
    } catch (error) {
      console.error('Error during logout:', error);
      await this.clearTokens(); // Clear tokens anyway
    }
  }
}

export default TokenManager;
