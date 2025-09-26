import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../../utils/api';

const ReportModal = ({ visible, onClose, postId, postAuthor }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const reportReasons = [
    { value: 'SPAM', label: 'Spam' },
    { value: 'HARASSMENT', label: 'Harassment or bullying' },
    { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
    { value: 'MISINFORMATION', label: 'False information' },
    { value: 'HATE_SPEECH', label: 'Hate speech' },
    { value: 'VIOLENCE', label: 'Violence or threats' },
    { value: 'COPYRIGHT', label: 'Copyright violation' },
    { value: 'ADULT_CONTENT', label: 'Adult content' },
    { value: 'SELF_HARM', label: 'Self-harm or suicide' },
    { value: 'OTHER', label: 'Other' }
  ];

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    setLoading(true);
    try {
      console.log('📤 Submitting report:', {
        postId: postId,
        reason: selectedReason,
        description: description.trim()
      });

      const response = await API.post('/reports', {
        postId: parseInt(postId, 10),
        reason: selectedReason,
        description: description.trim()
      });

      console.log('✅ Report submission response:', response.data);

      if (response.data) {
        Alert.alert(
          'Report Submitted', 
          'Thank you for your report. We will review it shortly.',
          [{ text: 'OK', onPress: () => {
            resetForm();
            onClose();
          }}]
        );
      }
    } catch (error) {
      console.error('❌ Report submission error:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error headers:', error.response?.headers);
      
      const errorMessage = error.response?.data?.error || 'Failed to submit report. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedReason('');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Report Post</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Report post by {postAuthor}
          </Text>
          <Text style={styles.description}>
            Help us understand what's happening with this post. Your report is anonymous.
          </Text>

          <Text style={styles.sectionTitle}>Why are you reporting this post?</Text>
          
          {reportReasons.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                styles.reasonItem,
                selectedReason === reason.value && styles.selectedReasonItem
              ]}
              onPress={() => setSelectedReason(reason.value)}
            >
              <View style={styles.reasonContent}>
                <Text style={[
                  styles.reasonText,
                  selectedReason === reason.value && styles.selectedReasonText
                ]}>
                  {reason.label}
                </Text>
                {selectedReason === reason.value && (
                  <Ionicons name="checkmark-circle" size={20} color="#1976D2" />
                )}
              </View>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Additional details (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Provide more context about why you're reporting this post..."
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
          />
          <Text style={styles.characterCount}>{description.length}/500</Text>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReason || loading) && styles.disabledButton
            ]}
            onPress={handleSubmitReport}
            disabled={!selectedReason || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            False reporting is against our community guidelines and may result in action on your account.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  reasonItem: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedReasonItem: {
    borderColor: '#1976D2',
    backgroundColor: '#F3F8FF',
  },
  reasonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  reasonText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  selectedReasonText: {
    color: '#1976D2',
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 32,
  },
});

export default ReportModal;