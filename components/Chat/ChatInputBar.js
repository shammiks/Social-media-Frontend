import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MediaShareButton from './MediaShareButton';

const ChatInputBar = ({
  newMessage,
  onTextChange,
  onSendMessage,
  onMediaUploaded,
  token,
  apiBase,
  isTyping,
  disabled = false,
  showEmojiPicker = false,
  onEmojiToggle,
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.inputContainer}
    >
      <View style={styles.inputRow}>
        <MediaShareButton
          token={token}
          onMediaUploaded={onMediaUploaded}
          apiBase={apiBase}
          disabled={disabled}
        />
        
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={onTextChange}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            editable={!disabled}
          />
        </View>
        
        <TouchableOpacity
          style={styles.emojiButton}
          onPress={onEmojiToggle}
          disabled={disabled}
        >
          <Ionicons
            name="happy-outline"
            size={24}
            color={showEmojiPicker ? "#6C7CE7" : "#666"}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || disabled) && styles.sendButtonDisabled
          ]}
          onPress={onSendMessage}
          disabled={!newMessage.trim() || disabled}
        >
          <Ionicons
            name="send"
            size={24}
            color={(!newMessage.trim() || disabled) ? "#CCC" : "#6C7CE7"}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#F1F3F4',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 15,
    color: '#2C3E50',
    minHeight: 22,
  },
  emojiButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6C7CE7',
    shadowColor: '#6C7CE7',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
  },
});

export default ChatInputBar;
