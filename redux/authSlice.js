import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  user: null,
  tokenExpiry: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      const { accessToken, refreshToken, expiresIn, user } = action.payload;
      
      state.token = accessToken;
      state.refreshToken = refreshToken;
      state.user = user;
      state.isAuthenticated = true;
      
      // Calculate expiry time
      const expiryTime = Date.now() + (expiresIn * 1000);
      state.tokenExpiry = expiryTime;

      // Store tokens in AsyncStorage
      AsyncStorage.setItem('authToken', accessToken);
      AsyncStorage.setItem('refreshToken', refreshToken);
      AsyncStorage.setItem('user', JSON.stringify(user));
      AsyncStorage.setItem('tokenExpiry', expiryTime.toString());
    },

    tokenRefreshSuccess: (state, action) => {
      const { accessToken, refreshToken, expiresIn } = action.payload;
      
      state.token = accessToken;
      if (refreshToken) {
        state.refreshToken = refreshToken;
      }
      
      // Calculate new expiry time
      const expiryTime = Date.now() + (expiresIn * 1000);
      state.tokenExpiry = expiryTime;

      // Update tokens in AsyncStorage
      AsyncStorage.setItem('authToken', accessToken);
      if (refreshToken) {
        AsyncStorage.setItem('refreshToken', refreshToken);
      }
      AsyncStorage.setItem('tokenExpiry', expiryTime.toString());
    },

    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.tokenExpiry = null;
      
      // Clear all auth data from AsyncStorage
      AsyncStorage.multiRemove(['authToken', 'refreshToken', 'token', 'user', 'tokenExpiry']);
    },

    restoreToken: (state, action) => {
      const { token, refreshToken, user, tokenExpiry } = action.payload;
      
      state.token = token;
      state.refreshToken = refreshToken;
      state.user = user;
      state.tokenExpiry = tokenExpiry;
      // Only authenticate if we have both token and user
      state.isAuthenticated = !!(token && user);
    },

    // Add action to sync token state from AsyncStorage
    syncTokenFromStorage: (state, action) => {
      const { token } = action.payload;
      if (token && state.isAuthenticated) {
        state.token = token;
      }
    },
  },
});

export const { loginSuccess, tokenRefreshSuccess, logout, restoreToken, syncTokenFromStorage } = authSlice.actions;
export default authSlice.reducer;
