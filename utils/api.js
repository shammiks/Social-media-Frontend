// utils/api.js - FIXED VERSION
import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

const API = axios.create({
  baseURL: "http://192.168.1.5:8081/api",
});

// Global refresh management to prevent race conditions
let refreshPromise = null;
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

const refreshTokens = async () => {
  // Prevent multiple simultaneous refresh attempts
  if (refreshPromise) {
    console.log('⏳ API - Token refresh already in progress, waiting...');
    return refreshPromise;
  }

  console.log('🔄 API - Starting new token refresh...');
  
  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('📡 API - Making refresh request to backend...');
      
      // Create a new axios instance to avoid interceptor loops
      const refreshAPI = axios.create({
        baseURL: "http://192.168.1.5:8081/api",
        timeout: 15000, // 15 second timeout
      });

      const response = await refreshAPI.post('/auth/refresh-token', {
        refreshToken: refreshToken
      });

      const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
      const newExpiry = Date.now() + (expiresIn * 1000);

      // Store new tokens atomically
      await AsyncStorage.multiSet([
        ['authToken', accessToken],
        ['refreshToken', newRefreshToken],
        ['tokenExpiry', newExpiry.toString()]
      ]);

      console.log('✅ API - Token refresh successful, stored new tokens');

      // Update default headers
      API.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      // Notify WebSocket service
      try {
        const { default: WebSocketService } = await import('../services/WebSocketService');
        WebSocketService.reconnectWithNewToken();
      } catch (importError) {
        console.warn('Could not update WebSocket:', importError);
      }

      return accessToken;
    } catch (error) {
      console.error('❌ API - Token refresh failed:', error.message);
      
      // Clear tokens on refresh failure
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'tokenExpiry']);
      
      throw error;
    }
  })();

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    // Clear the promise after completion (success or failure)
    refreshPromise = null;
  }
};

// Request interceptor
API.interceptors.request.use(
  async (config) => {
    // Don't add auth to refresh token requests
    if (config.url?.includes('/auth/refresh-token')) {
      return config;
    }

    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with proper queue management
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    console.log('🔍 API - Request failed:', {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method,
      hasRetryFlag: !!originalRequest._retry
    });

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🔄 API - Handling 401 error...');
      
      // If already refreshing, queue this request
      if (isRefreshing) {
        console.log('⏳ API - Queueing request while refresh in progress...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return API(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshTokens();
        
        // Process queued requests
        processQueue(null, newToken);
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        console.log('🔄 API - Retrying original request with new token...');
        
        return API(originalRequest);
      } catch (refreshError) {
        console.error('❌ API - Refresh failed, clearing queue:', refreshError.message);
        processQueue(refreshError, null);
        
        console.log('🚪 API - User needs to login again');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default API;