// utils/api.js
import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './apiConfig';

const API = axios.create({
  baseURL: "http://192.168.1.5:8080/api", // Use consistent baseURL
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor to add auth token
API.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
API.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.log('🔍 API Interceptor - Request failed:', {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method,
      hasRetryFlag: !!originalRequest._retry
    });

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🔄 API Interceptor - Handling 401 error, attempting token refresh...');
      
      if (isRefreshing) {
        console.log('⏳ API Interceptor - Already refreshing, queueing request...');
        // If we're already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return API(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        console.log('🎫 API Interceptor - Retrieved refresh token:', !!refreshToken);
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        console.log('📡 API Interceptor - Making refresh token request...');
        const response = await axios.post('http://192.168.1.5:8080/api/auth/refresh-token', {
          refreshToken: refreshToken
        });

        console.log('✅ API Interceptor - Refresh token request successful:', {
          hasAccessToken: !!response.data.accessToken,
          hasRefreshToken: !!response.data.refreshToken,
          expiresIn: response.data.expiresIn
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        // Store new tokens
        await AsyncStorage.setItem('authToken', newAccessToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);
        
        console.log('💾 API Interceptor - Stored new tokens successfully');

        // Update the authorization header
        API.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        
        console.log('🔄 API Interceptor - Retrying original request...');
        return API(originalRequest);
      } catch (refreshError) {
        console.error('❌ API Interceptor - Token refresh failed:', refreshError);
        processQueue(refreshError, null);
        
        // Clear tokens and redirect to login
        await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user']);
        
        console.log('🚪 API Interceptor - Cleared tokens, user needs to login again');
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        console.log('🏁 API Interceptor - Refresh process completed');
      }
    }

    console.log('🚫 API Interceptor - Request failed, not attempting refresh:', {
      status: error.response?.status,
      hasRetryFlag: !!originalRequest._retry
    });
    return Promise.reject(error);
  }
);

export default API;
