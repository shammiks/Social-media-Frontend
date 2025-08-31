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
    // Use the same key as ChatAPI ('authToken' instead of 'token')
    const token = await AsyncStorage.getItem('authToken');
    const user = await AsyncStorage.getItem('user');
    dispatch(restoreToken({
      token,
      user: user ? JSON.parse(user) : null,
    }));
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
