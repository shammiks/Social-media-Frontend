// utils/api.js
import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './apiConfig';

const API = axios.create({
  baseURL: "http://192.168.1.5:8080/api", // Use consistent baseURL
});

// Separate axios instance for token refresh to avoid interceptor loops
const refreshAPI = axios.create({
  baseURL: "http://192.168.1.5:8080/api",
  timeout: 10000, // 10 second timeout
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
      fullURL: originalRequest?.baseURL + originalRequest?.url,
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
        // Use a separate axios instance to avoid interceptor loops
        const refreshResponse = await refreshAPI.post('/auth/refresh-token', {
          refreshToken: refreshToken
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('✅ API Interceptor - Refresh token request successful:', {
          hasAccessToken: !!refreshResponse.data.accessToken,
          hasRefreshToken: !!refreshResponse.data.refreshToken,
          expiresIn: refreshResponse.data.expiresIn
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } = refreshResponse.data;

        // Calculate new expiry time
        const newExpiry = Date.now() + (expiresIn * 1000);

        // Store new tokens
        await AsyncStorage.setItem('authToken', newAccessToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);
        await AsyncStorage.setItem('tokenExpiry', newExpiry.toString());
        
        console.log('💾 API Interceptor - Stored new tokens successfully with expiry:', new Date(newExpiry).toISOString());

        // Update the authorization header
        API.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Notify WebSocketService about token refresh
        try {
          const { default: WebSocketService } = await import('../services/WebSocketService');
          WebSocketService.reconnectWithNewToken();
        } catch (importError) {
          console.warn('Could not update WebSocket with new token:', importError);
        }

        processQueue(null, newAccessToken);
        
        console.log('🔄 API Interceptor - Retrying original request...', {
          method: originalRequest.method,
          url: originalRequest.url,
          baseURL: originalRequest.baseURL
        });
        
        // Create a fresh request to avoid any URL corruption
        const retryRequest = {
          ...originalRequest,
          headers: {
            ...originalRequest.headers,
            Authorization: `Bearer ${newAccessToken}`
          }
        };
        
        return API(retryRequest);
      } catch (refreshError) {
        console.error('❌ API Interceptor - Token refresh failed:', {
          error: refreshError.message,
          status: refreshError.response?.status,
          data: refreshError.response?.data
        });
        processQueue(refreshError, null);
        
        // Clear tokens and redirect to login
        await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'tokenExpiry']);
        
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
