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

const BanModal = ({ visible, onClose, onSubmit, post }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const predefinedReasons = [
    'Repeated content policy violations',
    'Harassment and bullying behavior',
    'Spam and promotional abuse',
    'Sharing inappropriate content',
    'Spreading false information',
    'Creating multiple fake accounts',
    'Violating terms of service',
    'Inappropriate behavior towards other users',
    'Other (specify below)',
  ];

  const handleSubmit = () => {
    const reason = selectedReason === 'Other (specify below)' ? customReason : selectedReason;
    
    if (!reason.trim()) {
      Alert.alert('Error', 'Please select or specify a reason for banning.');
      return;
    }

    if (selectedReason === 'Other (specify below)' && !customReason.trim()) {
      Alert.alert('Error', 'Please specify the custom reason.');
      return;
    }

    Alert.alert(
      'Confirm Ban',
      `Are you sure you want to permanently ban @${post?.username}?\n\nThis action cannot be undone. The user will:\n• Lose access to their account\n• Be unable to create new accounts\n• Have all content remain but be inaccessible to them`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban User',
          style: 'destructive',
          onPress: () => {
            onSubmit({
              reason: reason.trim(),
            });

            // Reset form
            setSelectedReason('');
            setCustomReason('');
          }
        }
      ]
    );
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    onClose();
  };

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
                <Icon name="block" size={24} color="#e74c3c" />
                <Text style={styles.title}>Ban User</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Icon name="close" size={24} color="#657786" />
              </TouchableOpacity>
            </View>

            {/* Warning Banner */}
            <View style={styles.warningBanner}>
              <Icon name="warning" size={20} color="#e74c3c" />
              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>Permanent Action</Text>
                <Text style={styles.warningText}>
                  Banning a user is permanent and cannot be undone. Please ensure this action is justified.
                </Text>
              </View>
            </View>

            {/* User Info */}
            {post && (
              <View style={styles.userInfo}>
                <Text style={styles.userInfoText}>
                  <Text style={styles.bold}>User:</Text> @{post.username} ({post.userEmail})
                </Text>
                <Text style={styles.userInfoText}>
                  <Text style={styles.bold}>Previous Warnings:</Text> {post.warningCount || 0}
                </Text>
                {post.lastWarningReason && (
                  <Text style={styles.userInfoText}>
                    <Text style={styles.bold}>Last Warning:</Text> {post.lastWarningReason}
                  </Text>
                )}
              </View>
            )}

            {/* Post Preview */}
            {post?.content && (
              <View style={styles.postPreview}>
                <Text style={styles.sectionTitle}>Current Post:</Text>
                <Text style={styles.postContent} numberOfLines={3}>
                  {post.content}
                </Text>
              </View>
            )}

            {/* Reason Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reason for Ban *</Text>
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
                  placeholder="Please specify the reason for banning..."
                  multiline
                  maxLength={200}
                />
                <Text style={styles.characterCount}>
                  {customReason.length}/200 characters
                </Text>
              </View>
            )}

            {/* Ban Consequences */}
            <View style={styles.consequencesSection}>
              <Text style={styles.sectionTitle}>Ban Consequences:</Text>
              <View style={styles.consequencesList}>
                <View style={styles.consequenceItem}>
                  <Icon name="block" size={16} color="#e74c3c" />
                  <Text style={styles.consequenceText}>
                    Immediate account suspension and login prevention
                  </Text>
                </View>
                <View style={styles.consequenceItem}>
                  <Icon name="visibility-off" size={16} color="#e74c3c" />
                  <Text style={styles.consequenceText}>
                    User loses access to all content and messages
                  </Text>
                </View>
                <View style={styles.consequenceItem}>
                  <Icon name="email" size={16} color="#e74c3c" />
                  <Text style={styles.consequenceText}>
                    Automatic email notification will be sent
                  </Text>
                </View>
                <View style={styles.consequenceItem}>
                  <Icon name="no-accounts" size={16} color="#e74c3c" />
                  <Text style={styles.consequenceText}>
                    Prevention of creating new accounts
                  </Text>
                </View>
              </View>
            </View>

            {/* Email Preview */}
            <View style={styles.previewSection}>
              <Text style={styles.sectionTitle}>Ban Email Preview:</Text>
              <View style={styles.emailPreview}>
                <Text style={styles.emailSubject}>
                  Subject: 🚫 Account Suspended - Content Policy Violation
                </Text>
                <Text style={styles.emailContent}>
                  Dear @{post?.username || 'User'},
                  {'\n\n'}
                  Your account has been <Text style={styles.bold}>permanently suspended</Text> due to repeated content policy violations.
                  {'\n\n'}
                  <Text style={styles.bold}>Final Violation: </Text>
                  {selectedReason === 'Other (specify below)' ? customReason : selectedReason}
                  {'\n\n'}
                  This decision was made after you received {post?.warningCount || 0} previous warning(s) and continued to violate our community guidelines.
                  {'\n\n'}
                  If you believe this suspension was issued in error, you may appeal by contacting our support team within 30 days.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.banButton} onPress={handleSubmit}>
              <Icon name="block" size={16} color="#fff" />
              <Text style={styles.banButtonText}>Ban User</Text>
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: '#721c24',
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
    marginBottom: 5,
  },
  bold: {
    fontWeight: 'bold',
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
    backgroundColor: '#ffe6e6',
    borderColor: '#e74c3c',
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
    borderColor: '#e74c3c',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#657786',
    textAlign: 'right',
    marginTop: 5,
  },
  consequencesSection: {
    backgroundColor: '#fff5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#e74c3c',
  },
  consequencesList: {
    marginTop: 5,
  },
  consequenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  consequenceText: {
    fontSize: 12,
    color: '#721c24',
    marginLeft: 8,
    flex: 1,
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
    borderLeftColor: '#e74c3c',
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
  banButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
    marginLeft: 10,
  },
  banButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

export default BanModal;