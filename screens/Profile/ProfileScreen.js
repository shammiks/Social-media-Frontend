import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import * as Linking from 'expo-linking';
import { useSelector, useDispatch } from 'react-redux';
import { logout, loginSuccess } from '../../redux/authSlice';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

const ProfileScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { token, user } = useSelector((state) => state.auth);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('my');

  const BASE_URL = 'http://192.168.1.3:8080';

  useEffect(() => {
    fetchUserPosts();
  }, []);

  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/posts/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setPosts(res.data);
    } catch (err) {
      console.error('Failed to fetch user posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions to change your avatar.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.cancelled && !result.canceled) {
        setUploadingAvatar(true);
        const uri = result.assets[0].uri;
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        });

        const res = await axios.put(`${BASE_URL}/api/auth/me/avatar`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        dispatch(loginSuccess({ token, user: res.data }));
        Alert.alert('Success', 'Avatar updated successfully');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to update avatar: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            dispatch(logout());
            navigation.replace('Login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderPost = ({ item }) => {
    const imageUrl = item.imageUrl
      ? item.imageUrl.startsWith('http') ? item.imageUrl : `${BASE_URL}${item.imageUrl}`
      : null;

    const videoUrl = item.videoUrl
      ? item.videoUrl.startsWith('http') ? item.videoUrl : `${BASE_URL}${item.videoUrl}`
      : null;

    const pdfUrl = item.pdfUrl
      ? item.pdfUrl.startsWith('http') ? item.pdfUrl : `${BASE_URL}${item.pdfUrl}`
      : null;

    return (
      <Animated.View entering={FadeInUp} style={styles.postContainer}>
        {item.content && <Text style={styles.postContent}>{item.content}</Text>}

        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={styles.postImage}
            resizeMode="cover"
          />
        )}

        {videoUrl && (
          <Video
            source={{ uri: videoUrl }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="contain"
            useNativeControls
            style={styles.postVideo}
          />
        )}

        {pdfUrl && (
          <TouchableOpacity
            onPress={() => {
              console.log('Opening PDF:', pdfUrl);
              Linking.openURL(pdfUrl).catch((err) => {
                console.error('PDF open error:', err);
                Alert.alert('Error', 'Something went wrong while opening PDF.');
              });
            }}
            style={styles.pdfButton}
          >
            <Text style={styles.pdfButtonText}>📄 Open PDF</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Logout */}
      <View style={styles.logoutWrapper}>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View style={styles.profileHeader}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Text style={{ fontSize: 18, color: '#555' }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={{ marginLeft: 12 }}>
          <Text style={styles.username}>{user?.username}</Text>
          <TouchableOpacity onPress={pickAndUploadAvatar} disabled={uploadingAvatar}>
            <Text style={[styles.editAvatar, uploadingAvatar && { color: '#ccc' }]}>
              {uploadingAvatar ? 'Uploading...' : 'Edit Avatar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>My Posts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'saved' && styles.activeTab]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>Saved Posts</Text>
        </TouchableOpacity>
      </View>

      {/* Section Title */}
      <Text style={styles.sectionTitle}>
        {activeTab === 'my' ? 'Your Posts' : 'Saved Posts'}
      </Text>

      {/* Posts List */}
      {loading ? (
        <ActivityIndicator size="large" />
      ) : activeTab === 'my' ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPost}
          contentContainerStyle={styles.postList}
        />
      ) : (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: '#999' }}>No saved posts yet</Text>
        </View>
      )}
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
  },
  postVideo: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginTop: 10,
  },
  pdfButton: {
    marginTop: 10,
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  pdfButtonText: {
    color: '#007bff',
    fontWeight: '500',
  },
  logoutWrapper: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  logoutText: {
    color: 'red',
    fontSize: 16,
    fontWeight: '500',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  placeholderAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  editAvatar: {
    color: '#007bff',
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 12,
  },
  postList: {
    paddingBottom: 20,
  },
  postContainer: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  postContent: {
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  activeTab: {
    backgroundColor: '#007bff',
  },
  tabText: {
    fontSize: 14,
    color: '#555',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
}); 