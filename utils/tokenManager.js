// utils/tokenManager.js - SIMPLIFIED VERSION
// Remove refresh logic since it's now handled by API interceptor
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  static async clearTokens() {
    try {
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'tokenExpiry']);
      console.log('🧹 TokenManager - All tokens cleared');
    } catch (error) {
      console.error('❌ TokenManager - Error clearing tokens:', error);
    }
  }

  static async getStoredToken() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      console.log('🎫 TokenManager - Retrieved stored token:', !!token);
      return token;
    } catch (error) {
      console.error('❌ TokenManager - Error getting stored token:', error);
      return null;
    }
  }

  static async hasValidTokens() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const isExpired = await this.isTokenExpired();
      
      const hasValidTokens = !!(token && refreshToken && !isExpired);
      
      console.log('✅ TokenManager - Token validation:', {
        hasAccessToken: !!token,
        hasRefreshToken: !!refreshToken,
        isExpired: isExpired,
        hasValidTokens: hasValidTokens
      });
      
      return hasValidTokens;
    } catch (error) {
      console.error('❌ TokenManager - Error validating tokens:', error);
      return false;
    }
  }

  static async logout() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (refreshToken) {
        // Call logout endpoint to revoke refresh token
        try {
          await fetch('http://192.168.1.5:8080/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });
          console.log('🚪 TokenManager - Logout API call successful');
        } catch (logoutError) {
          console.error('❌ TokenManager - Logout API call failed:', logoutError);
        }
      }
      
      await this.clearTokens();
      console.log('✅ TokenManager - Logout completed');
    } catch (error) {
      console.error('❌ TokenManager - Error during logout:', error);
      await this.clearTokens(); // Clear tokens anyway
    }
  }

  // Store tokens after login/refresh (called by login component or API)
  static async storeTokens(accessToken, refreshToken, expiresIn) {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000);
      
      await AsyncStorage.multiSet([
        ['authToken', accessToken],
        ['refreshToken', refreshToken],
        ['tokenExpiry', expiryTime.toString()]
      ]);
      
      console.log('💾 TokenManager - Tokens stored successfully:', {
        expiryTime: new Date(expiryTime).toISOString()
      });
    } catch (error) {
      console.error('❌ TokenManager - Error storing tokens:', error);
      throw error;
    }
  }
}

export default TokenManager;