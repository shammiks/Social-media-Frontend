import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MessageActions = ({
  visible,
  onClose,
  selectedMessage,
  user,
  isMessageMine,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onCopy,
  // Edit modal props
  showEditModal,
  editText,
  setEditText,
  onEditSubmit,
  onEditCancel,
  // Emoji picker props
  showEmojiPicker,
  onEmojiSelect,
}) => {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const handleMessageAction = async (action, message) => {
    switch (action) {
      case 'edit':
        onEdit(message);
        break;
      case 'delete':
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(message.id) }
          ]
        );
        break;
      case 'pin':
        onPin(message.id);
        break;
      case 'react':
        onReact(message);
        break;
      case 'copy':
        onCopy(message.content);
        break;
    }
    onClose();
  };

  const handleMessageLongPress = (message) => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel'];
      const actions = [];
      
      if (isMessageMine(message)) {
        options.push('Edit', 'Delete', 'Copy');
        actions.push('edit', 'delete', 'copy');
      } else {
        options.push('Pin/Unpin', 'Add Reaction', 'Copy');
        actions.push('pin', 'react', 'copy');
      }
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) return;
          const action = actions[buttonIndex - 1];
          handleMessageAction(action, message);
        }
      );
    } else {
      // Android - show custom modal
      // This would need to be implemented based on your needs
    }
  };

  return (
    <>
      {/* Edit Message Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={onEditCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit Message</Text>
              <TouchableOpacity onPress={onEditCancel}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={onEditCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={onEditSubmit}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.emojiModal}>
            <View style={styles.emojiHeader}>
              <Text style={styles.emojiTitle}>Add Reaction</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal style={styles.emojiContainer}>
              {emojis.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => onEmojiSelect(emoji)}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  editTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    color: '#2C3E50',
    backgroundColor: '#FAFAFA',
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#F1F3F4',
  },
  saveButton: {
    backgroundColor: '#6C7CE7',
  },
  cancelButtonText: {
    color: '#444',
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  emojiModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  emojiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  emojiTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
  },
  emojiContainer: {
    flexDirection: 'row',
  },
  emojiButton: {
    padding: 12,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  emoji: {
    fontSize: 28,
  },
});


export default MessageActions;
