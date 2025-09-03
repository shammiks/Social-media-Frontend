// App.js or App.tsx
import React, { useEffect , useState} from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from '../redux/store';
import MainNavigator from '../navigation/MainNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreToken } from '../redux/authSlice';
import { View , Platform , StatusBar , Text , ActivityIndicator } from 'react-native'; // <-- Add ActivityIndicator
import NotificationWebSocketService from '../services/NotificationWebSocketService';
import NotificationPopup from '../components/Notifications/NotificationPopup';
import { fetchNotificationCounts } from '../redux/notificationSlice';
import MigrationHelper from '../utils/migrationHelper';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 44; // Define here


const AppWrapper = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <Provider store={store}>
      <AuthLoader />
    </Provider>
  </GestureHandlerRootView>
);

const AuthLoader = () => {
  const dispatch = useDispatch();
  const { user, token } = useSelector(state => state.auth);
  const [loading, setLoading] = useState(true);
  const [navigationRef, setNavigationRef] = useState(null);

  // Initialize WebSocket when user is authenticated
  useEffect(() => {
    if (user?.id && token) {
      NotificationWebSocketService.connect(user.id, token, dispatch);
      // Fetch initial notification counts
      dispatch(fetchNotificationCounts());
    } else {
      NotificationWebSocketService.disconnect();
    }

    // Cleanup on unmount
    return () => {
      if (!user || !token) {
        NotificationWebSocketService.disconnect();
      }
    };
  }, [user?.id, token, dispatch]);

useEffect(() => {
  const loadToken = async () => {
    try {
      // Run migration check first
      const migrationResult = await MigrationHelper.migrateFromOldTokenSystem();
      
      if (migrationResult.needsLogin) {
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
      
      // Check if token is expired
      const now = Date.now();
      const expiry = tokenExpiry ? parseInt(tokenExpiry) : 0;
      
      if (token && expiry > now) {
        // Token is still valid
        dispatch(restoreToken({
          token,
          refreshToken,
          user: user ? JSON.parse(user) : null,
          tokenExpiry: expiry,
        }));
      } else if (refreshToken) {
        // Token expired but we have refresh token, try to refresh
        try {
          const response = await fetch('http://192.168.43.36:8080/api/auth/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const newExpiry = Date.now() + (data.expiresIn * 1000);
            
            // Store new tokens
            await AsyncStorage.setItem('authToken', data.accessToken);
            if (data.refreshToken) {
              await AsyncStorage.setItem('refreshToken', data.refreshToken);
            }
            await AsyncStorage.setItem('tokenExpiry', newExpiry.toString());
            
            dispatch(restoreToken({
              token: data.accessToken,
              refreshToken: data.refreshToken || refreshToken,
              user: user ? JSON.parse(user) : null,
              tokenExpiry: newExpiry,
            }));
          } else {
            // Refresh failed, clear tokens
            await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'tokenExpiry']);
            dispatch(restoreToken({
              token: null,
              refreshToken: null,
              user: null,
              tokenExpiry: null,
            }));
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
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
        // No valid tokens
        dispatch(restoreToken({
          token: null,
          refreshToken: null,
          user: null,
          tokenExpiry: null,
        }));
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
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
}, []);


   if (loading) {
    // Show ActivityIndicator spinner while loading
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  

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
