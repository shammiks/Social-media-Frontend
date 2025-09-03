// utils/migrationHelper.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export class MigrationHelper {
  static async migrateFromOldTokenSystem() {
    try {
      // Check if we have old token structure
      const oldToken = await AsyncStorage.getItem('token'); // Old key
      const newToken = await AsyncStorage.getItem('authToken'); // New key
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      // If we have old token but no new structure, clear everything
      if (oldToken && !newToken && !refreshToken) {
        await AsyncStorage.multiRemove(['token', 'authToken', 'refreshToken', 'user', 'tokenExpiry']);
        return { needsLogin: true };
      }
      
      // If we have tokens but no expiry, clear everything for safety
      if ((newToken || oldToken) && !refreshToken) {
        await AsyncStorage.multiRemove(['token', 'authToken', 'refreshToken', 'user', 'tokenExpiry']);
        return { needsLogin: true };
      }
      
      return { needsLogin: false };
      
    } catch (error) {
      console.error('Migration error:', error);
      // On error, clear everything for safety
      await AsyncStorage.multiRemove(['token', 'authToken', 'refreshToken', 'user', 'tokenExpiry']);
      return { needsLogin: true };
    }
  }
  
  static async clearAllTokens() {
    try {
      await AsyncStorage.multiRemove(['token', 'authToken', 'refreshToken', 'user', 'tokenExpiry']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

export default MigrationHelper;
