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

  AsyncStorage.setItem('token', action.payload.token);
  AsyncStorage.setItem('user', JSON.stringify(action.payload.user));
},



    logout: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      AsyncStorage.removeItem('token');
    },
    restoreToken: (state, action) => {
  state.token = action.payload.token;
  state.user = action.payload.user;
  state.isAuthenticated = !!action.payload.token;
},


  },
});

export const { loginSuccess, logout, restoreToken } = authSlice.actions;
export default authSlice.reducer;
