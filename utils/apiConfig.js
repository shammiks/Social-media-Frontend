// utils/apiConfig.js
// Centralized API configuration to avoid URL mismatches

const API_BASE_IP = '192.168.1.5'; // Updated to current actual IP address
const API_PORT = '8080';
const API_BASE_URL = `http://${API_BASE_IP}:${API_PORT}/api`;

export const API_ENDPOINTS = {
  BASE: API_BASE_URL,
  USERS: `${API_BASE_URL}/users`,
  POSTS: `${API_BASE_URL}/posts`,
  COMMENTS: `${API_BASE_URL}/comments`,
  BOOKMARKS: `${API_BASE_URL}/bookmarks`,
  FOLLOW: `${API_BASE_URL}/follow`,
  AUTH: `${API_BASE_URL}/auth`
};

// Export individual URLs for backward compatibility
export const COMMENTS_URL = API_ENDPOINTS.COMMENTS;

// Helper function to get user profile endpoint
export const getUserProfileEndpoint = (userId, username) => {
  if (userId) {
    return `${API_ENDPOINTS.USERS}/${userId}`;
  }
  return `${API_ENDPOINTS.USERS}/by-username/${username}`;
};

// Helper function to create axios headers with auth token
export const createAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/json',
});

export default API_ENDPOINTS;
