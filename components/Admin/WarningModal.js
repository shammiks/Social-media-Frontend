import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const WarningModal = ({ visible, onClose, onSubmit, post }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [message, setMessage] = useState('');

  const predefinedReasons = [
    'Inappropriate content',
    'Spam or promotional content',
    'Harassment or bullying',
    'False or misleading information',
    'Off-topic content',
    'Violation of community guidelines',
    'Inappropriate language',
    'Copyright infringement',
    'Other (specify below)',
  ];

  const handleSubmit = () => {
    const reason = selectedReason === 'Other (specify below)' ? customReason : selectedReason;
    
    if (!reason.trim()) {
      Alert.alert('Error', 'Please select or specify a reason for the warning.');
      return;
    }

    if (selectedReason === 'Other (specify below)' && !customReason.trim()) {
      Alert.alert('Error', 'Please specify the custom reason.');
      return;
    }

    onSubmit({
      reason: reason.trim(),
      message: message.trim(),
    });

    // Reset form
    setSelectedReason('');
    setCustomReason('');
    setMessage('');
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    setMessage('');
    onClose();
  };

  const isFirstWarning = !post?.warningCount || post.warningCount === 0;
  const warningType = isFirstWarning ? 'Warning' : 'Final Warning';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Icon 
                  name="warning" 
                  size={24} 
                  color={isFirstWarning ? "#f39c12" : "#e74c3c"} 
                />
                <Text style={styles.title}>{warningType}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Icon name="close" size={24} color="#657786" />
              </TouchableOpacity>
            </View>

            {/* User Info */}
            {post && (
              <View style={styles.userInfo}>
                <Text style={styles.userInfoText}>
                  <Text style={styles.bold}>User:</Text> @{post.username} ({post.userEmail})
                </Text>
                {!isFirstWarning && (
                  <View style={styles.warningAlert}>
                    <Icon name="error" size={16} color="#e74c3c" />
                    <Text style={styles.warningAlertText}>
                      This user already has {post.warningCount} warning(s). 
                      This will be their FINAL WARNING.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Post Preview */}
            {post?.content && (
              <View style={styles.postPreview}>
                <Text style={styles.sectionTitle}>Post Content:</Text>
                <Text style={styles.postContent} numberOfLines={3}>
                  {post.content}
                </Text>
              </View>
            )}

            {/* Reason Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reason for Warning *</Text>
              {predefinedReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <View style={[
                    styles.radio,
                    selectedReason === reason && styles.radioSelected,
                  ]}>
                    {selectedReason === reason && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Reason Input */}
            {selectedReason === 'Other (specify below)' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Custom Reason *</Text>
                <TextInput
                  style={styles.textInput}
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Please specify the reason..."
                  multiline
                  maxLength={200}
                />
                <Text style={styles.characterCount}>
                  {customReason.length}/200 characters
                </Text>
              </View>
            )}

            {/* Additional Message */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Message (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.messageInput]}
                value={message}
                onChangeText={setMessage}
                placeholder="Additional context or instructions for the user..."
                multiline
                maxLength={500}
              />
              <Text style={styles.characterCount}>
                {message.length}/500 characters
              </Text>
            </View>

            {/* Warning Preview */}
            <View style={styles.previewSection}>
              <Text style={styles.sectionTitle}>Email Preview:</Text>
              <View style={styles.emailPreview}>
                <Text style={styles.emailSubject}>
                  Subject: {warningType} - Content Policy Violation
                </Text>
                <Text style={styles.emailContent}>
                  Dear @{post?.username || 'User'},
                  {'\n\n'}
                  We are writing to inform you about a content policy violation on our platform.
                  {'\n\n'}
                  <Text style={styles.bold}>Reason: </Text>
                  {selectedReason === 'Other (specify below)' ? customReason : selectedReason}
                  {message && (
                    <>
                      {'\n\n'}
                      <Text style={styles.bold}>Additional Information: </Text>
                      {message}
                    </>
                  )}
                  {!isFirstWarning && (
                    <>
                      {'\n\n'}
                      <Text style={[styles.bold, { color: '#e74c3c' }]}>
                        ⚠️ This is your FINAL WARNING. Any future violations will result in permanent account suspension.
                      </Text>
                    </>
                  )}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.submitButton,
                { backgroundColor: isFirstWarning ? '#f39c12' : '#e74c3c' }
              ]} 
              onPress={handleSubmit}
            >
              <Icon name="send" size={16} color="#fff" />
              <Text style={styles.submitButtonText}>Send {warningType}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  userInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  userInfoText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 10,
  },
  bold: {
    fontWeight: 'bold',
  },
  warningAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    padding: 10,
    borderRadius: 6,
  },
  warningAlertText: {
    fontSize: 12,
    color: '#721c24',
    marginLeft: 8,
    flex: 1,
  },
  postPreview: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  postContent: {
    fontSize: 14,
    color: '#657786',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  reasonOptionSelected: {
    backgroundColor: '#e8f2ff',
    borderColor: '#6C7CE7',
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#bdc3c7',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#6C7CE7',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C7CE7',
  },
  reasonText: {
    fontSize: 14,
    color: '#657786',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#1a1a1a',
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    textAlignVertical: 'top',
  },
  messageInput: {
    minHeight: 80,
  },
  characterCount: {
    fontSize: 12,
    color: '#657786',
    textAlign: 'right',
    marginTop: 5,
  },
  previewSection: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  emailPreview: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#6C7CE7',
  },
  emailSubject: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emailContent: {
    fontSize: 12,
    color: '#657786',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#657786',
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  submitButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

export default WarningModal;