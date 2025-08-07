// App.js or App.tsx
import React, { useEffect , useState} from 'react';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../redux/store';
import MainNavigator from '../navigation/MainNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreToken } from '../redux/authSlice';
import { View , Platform , StatusBar , Text , ActivityIndicator } from 'react-native'; // <-- Add ActivityIndicator

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 44; // Define here


const AppWrapper = () => (
  <Provider store={store}>
    <AuthLoader />
  </Provider>
);

const AuthLoader = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
useEffect(() => {
  const loadToken = async () => {
    const token = await AsyncStorage.getItem('token');
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
      <MainNavigator />
    </View>
  );
};

export default AppWrapper;
