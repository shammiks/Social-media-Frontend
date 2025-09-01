import React, { useState , useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

const API_URL = 'http://192.168.43.36:8080/api/posts/upload';

const CreatePostScreen = () => {
  const navigation = useNavigation();
  const token = useSelector((state) => state.auth.token);
  
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    });
    if (!result.canceled) setVideo(result.assets[0].uri);
  };

  const pickPdf = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      const pdfObj = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
      };

      setPdf(pdfObj);
    }
  } catch (error) {
    console.error("PDF selection failed:", error);
  }
};

  const removeMedia = (type) => {
    if (type === 'image') setImage(null);
    if (type === 'video') setVideo(null);
    if (type === 'pdf') setPdf(null);
  };

  const handleSubmit = async () => {
    // For polls, content is optional - only require poll question and options
    if (showPoll) {
      const nonEmptyOptions = pollOptions.filter(opt => opt.trim() !== '');
      if (!pollQuestion.trim() || nonEmptyOptions.length < 2) {
        Alert.alert('Validation', 'Poll must have a question and at least 2 options.');
        return;
      }
    } else {
      // For regular posts, content is still required
      if (!content.trim()) {
        Alert.alert('Validation', 'Content is required.');
        return;
      }
    }

    setLoading(true);
    try {
      // Add token validation
      if (!token) {
        Alert.alert('Authentication Error', 'Please login again to create posts.');
        setLoading(false);
        return;
      }

      console.log('Creating post with token:', token ? 'Token present' : 'No token');

      const formData = new FormData();

      // Always append content field - empty string if no content for polls
      if (content.trim()) {
        formData.append('content', content);
      } else {
        // Send empty string for content when creating polls without description
        formData.append('content', '');
      }
      if (image)
        formData.append('image', {
          uri: image,
          name: 'image.jpg',
          type: 'image/jpeg',
        });
      if (video)
        formData.append("video", {
          uri: video,
          name: "video.mp4",
          type: "video/mp4",
        });

      if (pdf) {
  formData.append('pdf', {
    uri: pdf.uri,
    name: pdf.name,
    type: pdf.type,
  });
}

      if (showPoll) {
        formData.append("pollQuestion", pollQuestion);
        pollOptions.forEach((opt, idx) => {
          if (opt.trim()) {
            formData.append(`pollOptions[${idx}]`, opt.trim());
          }
        });
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for FormData - let it be set automatically
        },
        body: formData,
      });

      if (response.ok) {
        setContent('');
        setImage(null);
        setVideo(null);
        setPdf(null);
        setShowPoll(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        
        Alert.alert(
          'Success', 
          'Post created successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back and trigger ProfileScreen/UserProfileScreen refresh
                navigation.navigate('Profile', { refresh: true });
              }
            }
          ]
        );
      } else {
        const text = await response.text();
        let message = 'Failed to create post';
        try {
          const json = JSON.parse(text);
          message = json.message || message;
        } catch {}
        Alert.alert('Error', message);
      }
    } catch (err) {
      console.error('Post error:', err);
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (text, index) => {
    const updatedOptions = [...pollOptions];
    updatedOptions[index] = text;
    setPollOptions(updatedOptions);
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions([...pollOptions, '']);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp.delay(0)} style={styles.topBar}>
          <Text style={styles.pageTitle}>Post</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#0ea5e9" />
            ) : (
              <Text style={styles.postButton}>Post</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.row}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-circle-outline" size={40} color="#94a3b8" />
          </View>
          <TextInput
            style={styles.input}
            placeholder={showPoll ? "Add optional description..." : "Write anonymously..."}
            placeholderTextColor="#94a3b8"
            multiline
            value={content}
            onChangeText={setContent}
          />
        </View>

        <View style={styles.mediaRow}>
          <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickVideo} style={styles.iconBtn}>
            <Ionicons name="videocam-outline" size={22} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickPdf} style={styles.iconBtn}>
            <MaterialIcons name="picture-as-pdf" size={22} color="#f43f5e" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPoll(!showPoll)} style={styles.iconBtn}>
            <Ionicons name="bar-chart-outline" size={22} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {image && (
          <View style={styles.mediaWrapper}>
            <Image source={{ uri: image }} style={styles.preview} />
            <TouchableOpacity onPress={() => removeMedia('image')} style={styles.deleteIcon}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        {video && (
          <View style={styles.mediaWrapper}>
            <Text style={styles.mediaText}>🎥 {video.split('/').pop()}</Text>
            <TouchableOpacity onPress={() => removeMedia('video')} style={styles.deleteIcon}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        {pdf && (
          <View style={styles.mediaWrapper}>
            <Text style={styles.mediaText}>📄 {pdf.name}</Text>
            <TouchableOpacity onPress={() => removeMedia('pdf')} style={styles.deleteIcon}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {showPoll && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.pollLabel}>🗳️ Create a Poll</Text>
            <TextInput
              placeholder="Poll question..."
              style={styles.pollQuestion}
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((option, index) => (
              <TextInput
                key={index}
                placeholder={`Option ${index + 1}`}
                style={styles.pollOption}
                value={option}
                onChangeText={(text) => handleOptionChange(text, index)}
              />
            ))}
            {pollOptions.length < 4 && (
              <TouchableOpacity onPress={addPollOption}>
                <Text style={{ color: '#0ea5e9', marginTop: 6 }}>+ Add option</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  postButton: {
    backgroundColor: '#0ea5e9',
    color: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    fontWeight: '600',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarPlaceholder: {
    marginRight: 10,
    marginTop: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 14,
  },
  mediaWrapper: {
    position: 'relative',
    marginTop: 14,
  },
  deleteIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  mediaText: {
    fontSize: 14,
    color: '#475569',
  },
  pollLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  pollQuestion: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    color: '#0f172a',
  },
  pollOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    color: '#0f172a',
  },
});

export default CreatePostScreen;
