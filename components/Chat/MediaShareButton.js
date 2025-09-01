import React, { useState } from 'react';
import { TouchableOpacity, Text, Platform, Alert, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

/**
 * MediaShareButton component for picking and uploading media, then calling onMediaUploaded callback with backend response.
 * Props:
 * - token: auth token for backend
 * - onMediaUploaded: function(mediaData) => void
 * - apiBase: base API endpoint (e.g. API_ENDPOINTS.BASE)
 * - disabled: boolean (optional)
 */
const MediaShareButton = ({ token, onMediaUploaded, apiBase, disabled }) => {
  const [uploading, setUploading] = useState(false);

  const handleAttachPress = async () => {
    console.log('Attach button pressed');
    const options = ['Photo/Video', 'Document', 'Cancel'];
    const cancelButtonIndex = 2;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) handlePickImageOrVideo();
          else if (buttonIndex === 1) handlePickDocument();
        }
      );
    } else {
      Alert.alert('Attach', 'Choose file type', [
        { text: 'Photo/Video', onPress: () => handlePickImageOrVideo() },
        { text: 'Document', onPress: handlePickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handlePickImageOrVideo = async () => {
    try {
      console.log('Photo/Video picker requested');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Media library permission status:', status);
      if (status !== 'granted') {
        Alert.alert('Permission required', 'You need to grant media library permission to select photos or videos.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Updated to use non-deprecated MediaType
        quality: 0.8 
      });
      
      console.log('ImagePicker result:', result);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Determine type from asset
        let type = 'document';
        if (asset.type) type = asset.type;
        else if (asset.mimeType) {
          if (asset.mimeType.startsWith('image/')) type = 'image';
          else if (asset.mimeType.startsWith('video/')) type = 'video';
        }
        
        uploadMedia(asset.uri, type, asset.fileName);
      } else {
        Alert.alert('No media selected', 'No photo or video was selected.');
      }
    } catch (err) {
      console.error('Error opening image/video picker:', err);
      Alert.alert('Picker error', err.message || 'Could not open photo/video picker.');
    }
  };

  const handlePickDocument = async () => {
    try {
      console.log('Document picker requested');
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      console.log('DocumentPicker result:', result);
      if (result.type === 'success') {
        uploadMedia(result.uri, 'document', result.name);
      } else {
        Alert.alert('No document selected', 'No document was selected.');
      }
    } catch (err) {
      console.error('Error opening document picker:', err);
      Alert.alert('Picker error', err.message || 'Could not open document picker.');
    }
  };

  const uploadMedia = async (uri, fileType, fileName) => {
    try {
      setUploading(true);
      let name = fileName;
      if (!name) {
        name = uri.split('/').pop();
      }
      
      const formData = new FormData();
      formData.append('file', {
        uri,
        name,
        type: fileType === 'image' ? 'image/jpeg' : fileType === 'video' ? 'video/mp4' : 'application/octet-stream',
      });
      
      console.log('Uploading media:', { uri, name, fileType });
      
      const response = await axios.post(
        `${apiBase}/media/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      console.log('Upload response:', response.data);
      setUploading(false);
      
      if (response.data && response.data.fileUrl) {
        // Determine the correct message type based on file type
        let messageType = 'DOCUMENT'; // default
        if (fileType === 'image') messageType = 'IMAGE';
        else if (fileType === 'video') messageType = 'VIDEO';
        else if (response.data.mimeType && response.data.mimeType.startsWith('audio/')) messageType = 'AUDIO';
        
        // Create media data object with standardized field names that match backend DTO
        const mediaData = {
          // Backend DTO expects these field names:
          mediaUrl: response.data.fileUrl,
          mediaType: response.data.fileType,
          mediaSize: response.data.fileSize,
          thumbnailUrl: response.data.thumbnailUrl,
          messageType: messageType,
          
          // Keep original fields for backward compatibility
          ...response.data,
        };
        
        console.log('Calling onMediaUploaded with:', mediaData);
        onMediaUploaded(mediaData);
      } else {
        Alert.alert('Upload failed', 'No file URL returned');
      }
    } catch (e) {
      setUploading(false);
      console.error('Upload failed:', e);
      Alert.alert('Upload failed', e.message || 'Unknown error');
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={{ padding: 12, justifyContent: 'center', alignItems: 'center' }} 
        onPress={handleAttachPress} 
        disabled={uploading || disabled}
      >
        <Ionicons 
          name="add" 
          size={24} 
          color={uploading || disabled ? '#ccc' : '#6C7CE7'} 
        />
      </TouchableOpacity>
      {uploading && (
        <Text style={{ color: '#6C7CE7', marginLeft: 4, fontSize: 12 }}>
          Uploading...
        </Text>
      )}
    </>
  );
};

export default MediaShareButton;