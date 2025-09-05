// utils/tokenManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './apiConfig';

const API_BASE_URL = 'http://192.168.1.5:8080/api';

export class TokenManager {
  static async isTokenExpired() {
    try {
      const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
      if (!tokenExpiry) {
        console.log('🕒 TokenManager - No token expiry found, considering expired');
        return true;
      }
      
      const expiry = parseInt(tokenExpiry);
      const now = Date.now();
      const timeUntilExpiry = expiry - now;
      
      console.log('🕒 TokenManager - Token expiry check:', {
        expiryTime: new Date(expiry).toISOString(),
        currentTime: new Date(now).toISOString(),
        timeUntilExpiryMs: timeUntilExpiry,
        timeUntilExpiryMin: Math.round(timeUntilExpiry / 60000),
        isExpired: timeUntilExpiry <= 30000
      });
      
      // Consider token expired if it expires in the next 60 seconds (more aggressive refresh)
      return timeUntilExpiry <= 60000;
    } catch (error) {
      console.error('❌ TokenManager - Error checking token expiry:', error);
      return true;
    }
  }

  static async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      console.log('🔄 TokenManager - Starting token refresh:', !!refreshToken);
      
      if (!refreshToken) {
        console.error('❌ TokenManager - No refresh token found in AsyncStorage');
        throw new Error('No refresh token available');
      }

      console.log('📡 TokenManager - Making refresh API call to backend...');
      console.log('🎫 TokenManager - Using refresh token:', refreshToken.substring(0, 20) + '...');
      
      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      console.log('📡 TokenManager - Refresh response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ TokenManager - Refresh API failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // If refresh token is invalid/expired, clear all tokens
        if (response.status === 400 || response.status === 401) {
          console.log('🧹 TokenManager - Clearing tokens due to invalid refresh token');
          await this.clearTokens();
        }
        
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const newExpiry = Date.now() + (data.expiresIn * 1000);

      console.log('✅ TokenManager - Token refresh successful:', {
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken,
        expiresIn: data.expiresIn,
        newExpiryTime: new Date(newExpiry).toISOString()
      });

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
      console.error('❌ TokenManager - Token refresh failed:', error);
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
      console.log('🎫 TokenManager - Getting valid token...');
      const isExpired = await this.isTokenExpired();
      
      if (isExpired) {
        console.log('⏰ TokenManager - Token expired, refreshing...');
        try {
          const refreshResult = await this.refreshToken();
          return refreshResult.accessToken;
        } catch (refreshError) {
          console.error('❌ TokenManager - Token refresh failed:', refreshError);
          return null;
        }
      }
      
      const token = await AsyncStorage.getItem('authToken');
      console.log('✅ TokenManager - Returning existing valid token:', !!token);
      return token;
    } catch (error) {
      console.error('❌ TokenManager - Error getting valid token:', error);
      return null;
    }
  }

  static async logout() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (refreshToken) {
        // Call logout endpoint to revoke refresh token
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
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
