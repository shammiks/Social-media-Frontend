import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../utils/api';

const BASE_URL = 'http://192.168.1.5:8080';

// Async thunk to fetch bookmarked posts
export const fetchBookmarkedPosts = createAsyncThunk(
  'bookmarks/fetchBookmarkedPosts',
  async (token, thunkAPI) => {
    try {
      const res = await API.get(`${BASE_URL}/api/bookmarks`);
      return res.data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data || err.message);
    }
  }
);

const bookmarkSlice = createSlice({
  name: 'bookmarks',
  initialState: {
    posts: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookmarkedPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookmarkedPosts.fulfilled, (state, action) => {
        state.posts = action.payload;
        state.loading = false;
      })
      .addCase(fetchBookmarkedPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch';
      });
  },
});

export default bookmarkSlice.reducer;
