// App.js or App.tsx
import React, { useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from '../redux/store';
import MainNavigator from '../navigation/MainNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreToken } from '../redux/authSlice';
import { View, Platform, StatusBar, Text, ActivityIndicator } from 'react-native';
import NotificationWebSocketService from '../services/NotificationWebSocketService';
import WebSocketService from '../services/WebSocketService';
import NotificationPopup from '../components/Notifications/NotificationPopup';
import { fetchNotificationCounts } from '../redux/notificationSlice';
import { loadChats } from '../redux/ChatSlice';
import tokenManager from '../utils/tokenManager';
import MigrationHelper from '../utils/migrationHelper';
import API from '../utils/api';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 44;

const AppWrapper = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <Provider store={store}>
      <AuthLoader />
    </Provider>
  </GestureHandlerRootView>
);

const AuthLoader = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated } = useSelector(state => state.auth);
  const [loading, setLoading] = useState(true);
  const [navigationRef, setNavigationRef] = useState(null);

  // Initialize both WebSocket services when user is authenticated
  useEffect(() => {
    const checkTokenAsync = async () => {
      const storedToken = await AsyncStorage.getItem('authToken');
      console.log('App: Authentication state changed:', { 
        isAuthenticated, 
        userId: user?.id, 
        hasToken: !!token,
        hasStoredToken: !!storedToken,
        userType: typeof user?.id 
      });
    };
    
    checkTokenAsync();
    
    // Use stored token if Redux token is missing but we're authenticated
    const initializeWebSocket = async () => {
      const storedToken = await AsyncStorage.getItem('authToken');
      const effectiveToken = token || storedToken;
      
      if (isAuthenticated && user?.id && effectiveToken) {
        console.log('App: Setting up WebSocket services for authenticated user:', user.id);
        console.log('App: User object details:', { 
          userId: user.id, 
          userIdType: typeof user.id, 
          userName: user.username || user.email,
          fullUser: user,
          usingStoredToken: !token && !!storedToken
        });
        
        // Existing notification WebSocket
        try {
          NotificationWebSocketService.connect(user.id, effectiveToken, dispatch);
          dispatch(fetchNotificationCounts());
          console.log('App: Notification WebSocket setup completed');
        } catch (error) {
          console.error('App: Failed to setup Notification WebSocket:', error);
        }
        
        // Chat WebSocket setup
        try {
          console.log('App: Setting up Chat WebSocket...');
          WebSocketService.setDispatch(dispatch);
          
          // Pass async actions to WebSocket service
          WebSocketService.setAsyncActions({ loadChats });
          
          // Ensure user ID is numeric for WebSocket service
          const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
          console.log('App: Setting chat WebSocket user ID:', userId, 'type:', typeof userId);
          
          if (!userId || isNaN(userId)) {
            console.error('App: Invalid user ID for WebSocket:', userId);
            return;
          }
          
          WebSocketService.setCurrentUserId(userId);
          
          // Connect chat WebSocket
          WebSocketService.connect()
            .then(() => {
              console.log('App: Chat WebSocket connected successfully');
              
              // Log connection status after successful connection
              setTimeout(() => {
                const status = WebSocketService.getConnectionStatus();
                console.log('App: Chat WebSocket final status:', status);
              }, 1000);
            })
            .catch(error => {
              console.error('App: Failed to connect Chat WebSocket:', error);
            });
            
        } catch (error) {
          console.error('App: Error setting up Chat WebSocket:', error);
        }
      } else {
        console.log('App: User not authenticated, disconnecting WebSocket services');
        
        // Disconnect both WebSocket services
        try {
          NotificationWebSocketService.disconnect();
          console.log('App: Notification WebSocket disconnected');
        } catch (error) {
          console.error('App: Error disconnecting Notification WebSocket:', error);
        }
        
        try {
          WebSocketService.disconnect();
          console.log('App: Chat WebSocket disconnected');
        } catch (error) {
          console.error('App: Error disconnecting Chat WebSocket:', error);
        }
      }
    };
    
    initializeWebSocket();

    // Cleanup on unmount or auth state change
    return () => {
      if (!isAuthenticated || !user) {
        console.log('App: Cleanup - disconnecting WebSocket services');
        try {
          NotificationWebSocketService.disconnect();
          WebSocketService.disconnect();
        } catch (error) {
          console.error('App: Error during WebSocket cleanup:', error);
        }
      }
    };
  }, [isAuthenticated, user?.id, dispatch]); // Removed token dependency to prevent disconnects

  useEffect(() => {
    const loadToken = async () => {
      try {
        console.log('App: Loading authentication tokens...');
        
        // Run migration check first
        const migrationResult = await MigrationHelper.migrateFromOldTokenSystem();
        
        if (migrationResult.needsLogin) {
          console.log('App: Migration required login');
          // Migration cleared tokens, user needs to login
          dispatch(restoreToken({
            token: null,
            refreshToken: null,
            user: null,
            tokenExpiry: null,
          }));
          setLoading(false);
          return;
        }
        
        // Load all auth-related data
        const token = await AsyncStorage.getItem('authToken');
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const user = await AsyncStorage.getItem('user');
        const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
        
        console.log('App: Loaded auth data:', {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
          hasUser: !!user,
          tokenExpiry: tokenExpiry ? new Date(parseInt(tokenExpiry)).toISOString() : null,
          userContent: user ? JSON.parse(user) : null
        });
        
        // Check if token is expired
        const now = Date.now();
        const expiry = tokenExpiry ? parseInt(tokenExpiry) : 0;
        
        if (token && expiry > now) {
          console.log('App: Token is valid, restoring authentication');
          
          // Always fetch fresh user data to ensure admin status is up to date
          let userData = user ? JSON.parse(user) : null;
          try {
            API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            console.log('App: Fetching fresh user profile to check admin status...');
            const userResponse = await API.get('/auth/me');
            userData = userResponse.data;
            console.log('App: Fresh user profile fetched:', userData);
            console.log('App: User isAdmin status:', userData?.isAdmin);
            
            // Store fresh user data
            await AsyncStorage.setItem('user', JSON.stringify(userData));
          } catch (userError) {
            console.error('App: Failed to fetch fresh user profile:', userError);
            // Continue with stored user data
          }
          
          // Token is still valid
          dispatch(restoreToken({
            token,
            refreshToken,
            user: userData,
            tokenExpiry: expiry,
          }));
        } else if (refreshToken) {
          console.log('App: Token expired, attempting refresh');
          // Token expired but we have refresh token, try to refresh
          try {
            const response = await API.post('/auth/refresh-token', { refreshToken });
            
            const data = response.data;
            const newExpiry = Date.now() + (data.expiresIn * 1000);
              
            // Store new tokens
            await AsyncStorage.setItem('authToken', data.accessToken);
            if (data.refreshToken) {
              await AsyncStorage.setItem('refreshToken', data.refreshToken);
            }
            await AsyncStorage.setItem('tokenExpiry', newExpiry.toString());
            
            console.log('App: Token refresh successful');
            
            // If we don't have user data, fetch it using the new token
            let userData = user ? JSON.parse(user) : null;
            if (!userData) {
              console.log('App: No user data found, fetching user profile...');
              try {
                // Set the new token in API headers before making the request
                API.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
                const userResponse = await API.get('/auth/me'); // Assuming this endpoint exists
                userData = userResponse.data;
                console.log('App: User profile fetched:', userData);
                
                // Store user data
                await AsyncStorage.setItem('user', JSON.stringify(userData));
              } catch (userError) {
                console.error('App: Failed to fetch user profile:', userError);
                // Continue with null user data
              }
            }
            
            dispatch(restoreToken({
              token: data.accessToken,
              refreshToken: data.refreshToken || refreshToken,
              user: userData,
              tokenExpiry: newExpiry,
            }));
          } catch (refreshError) {
            console.error('App: Token refresh failed:', refreshError);
            // Clear tokens on refresh failure
            await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'tokenExpiry']);
            dispatch(restoreToken({
              token: null,
              refreshToken: null,
              user: null,
              tokenExpiry: null,
            }));
          }
        } else {
          console.log('App: No valid tokens found');
          // No valid tokens
          dispatch(restoreToken({
            token: null,
            refreshToken: null,
            user: null,
            tokenExpiry: null,
          }));
        }
      } catch (error) {
        console.error('App: Error loading tokens:', error);
        dispatch(restoreToken({
          token: null,
          refreshToken: null,
          user: null,
          tokenExpiry: null,
        }));
      }
      
      setLoading(false);
    };
    
    loadToken();
  }, [dispatch]);

  // Debug WebSocket connection status periodically
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      console.log('App: Setting up WebSocket status monitoring');
      
    // Removed periodic WebSocket status check to stop continuous logging

      return () => {
        console.log('App: Clearing WebSocket status monitoring');
        // No interval to clear
      };
    }
  }, [isAuthenticated, user?.id]);

  if (loading) {
    console.log('App: Showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10, color: "#666" }}>Loading...</Text>
      </View>
    );
  }

  console.log('App: Rendering main app interface');
  
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: "#fff" }} />
      <NavigationContainer ref={setNavigationRef}>
        <MainNavigator />
        {/* Notification Popup - shows over all screens */}
        {navigationRef && <NotificationPopup navigation={navigationRef} />}
      </NavigationContainer>
    </View>
  );
};

export default AppWrapper;