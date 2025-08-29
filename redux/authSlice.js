import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  isAuthenticated: false,
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
   loginSuccess: (state, action) => {
  state.token = action.payload.token;
  state.user = action.payload.user;
  state.isAuthenticated = true;

  // Use consistent keys with ChatAPI
  AsyncStorage.setItem('authToken', action.payload.token);
  AsyncStorage.setItem('user', JSON.stringify(action.payload.user));
},



    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      
      // Clear both possible token keys to be safe
      AsyncStorage.removeItem('authToken');
      AsyncStorage.removeItem('token');
      AsyncStorage.removeItem('user');
    },
    restoreToken: (state, action) => {
      const { token, user } = action.payload;
      
      state.token = token;
      state.user = user;
      state.isAuthenticated = !!token;
    },


  },
});

export const { loginSuccess, logout, restoreToken } = authSlice.actions;
export default authSlice.reducer;
