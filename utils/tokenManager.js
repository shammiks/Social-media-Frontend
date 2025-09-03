// utils/tokenManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './apiConfig';

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
      
      // Consider token expired if it expires in the next 30 seconds
      return timeUntilExpiry <= 30000;
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
        throw new Error('No refresh token available');
      }

      console.log('📡 TokenManager - Making refresh API call...');
      const response = await fetch('http://192.168.43.36:8080/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ TokenManager - Refresh API failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Token refresh failed: ${response.status}`);
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
        const refreshResult = await this.refreshToken();
        return refreshResult.accessToken;
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
          await fetch('http://192.168.43.36:8080/api/auth/logout', {
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
