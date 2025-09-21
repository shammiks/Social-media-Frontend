import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import API from '../../utils/api';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Get Redux authentication state as fallback
  const reduxIsAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  
  // Get navigation params
  const { userEmail, isAuthenticated: paramIsAuthenticated } = route.params || {};
  
  // Use parameter if available, otherwise fallback to Redux state
  const isAuthenticated = paramIsAuthenticated !== undefined ? paramIsAuthenticated : reduxIsAuthenticated;
  
  // Debug logging
  console.log('🔍 ForgotPasswordScreen - Route params:', { userEmail, paramIsAuthenticated, reduxIsAuthenticated, finalIsAuthenticated: isAuthenticated });

  useEffect(() => {
    // Pre-fill email if coming from ProfileScreen
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Additional validation for authenticated users
    if (isAuthenticated && userEmail && email.trim() !== userEmail) {
      Alert.alert('Error', 'You can only reset the password for your own email address');
      return;
    }

    setIsLoading(true);

    try {
      let response;

      if (isAuthenticated) {
        // Use API utility for authenticated requests (handles token automatically)
        response = await API.post('/auth/request-authenticated-password-reset', {
          email: email.trim()
        });
        
        if (response.status === 200) {
          Alert.alert(
            'Code Sent',
            'A 5-digit reset code has been sent to your email.',
            [
              {
                text: 'OK',
                onPress: () => {
                  console.log('🔍 ForgotPasswordScreen (authenticated) - Navigating to VerifyResetCode with:', { 
                    email: email.trim(), 
                    isAuthenticated 
                  });
                  navigation.navigate('VerifyResetCode', { 
                    email: email.trim(),
                    isAuthenticated: isAuthenticated 
                  });
                }
              }
            ]
          );
        }
      } else {
        // Use fetch for non-authenticated requests
        response = await fetch("http://192.168.1.5:8081/api/auth/request-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });

        const data = await response.text();

        if (response.ok) {
          Alert.alert(
            'Code Sent',
            'A 5-digit reset code has been sent to your email.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('VerifyResetCode', { 
                  email: email.trim(),
                  isAuthenticated: isAuthenticated 
                })
              }
            ]
          );
        } else {
          Alert.alert('Error', data || 'Failed to send reset code');
        }
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      
      if (error.response) {
        // API error with response
        const errorMessage = error.response.data?.error || error.response.data || 'Failed to send reset code';
        Alert.alert('Error', errorMessage);
      } else {
        // Network or other error
        Alert.alert('Error', 'Network error. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const STATUSBAR_HEIGHT = Platform.OS === "android" ? 44 : 44;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: "#38bdf8" }} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
              <Image
                style={styles.backgroundImage}
                source={require("../../assets/images/background.png")}
              />

              {/* Header */}
              <Animated.View 
                entering={FadeInUp.duration(1000).springify()}
                style={styles.header}
              >
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reset Password</Text>
                <View style={styles.placeholder} />
              </Animated.View>

              {/* Form */}
              <View style={styles.formContainer}>
                <Animated.View entering={FadeInDown.duration(1000).delay(200).springify()}>
                  <Text style={styles.title}>Forgot Password?</Text>
                  <Text style={styles.subtitle}>
                    Enter your email address and we'll send you a 5-digit code to reset your password
                  </Text>
                </Animated.View>

                <Animated.View 
                  entering={FadeInDown.duration(1000).delay(300).springify()}
                  style={styles.inputContainer}
                >
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={[
                      styles.input, 
                      isAuthenticated && userEmail && { backgroundColor: '#f3f4f6', color: '#6b7280' }
                    ]}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={isAuthenticated && userEmail ? undefined : setEmail}
                    editable={!(isAuthenticated && userEmail)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.duration(1000).delay(400).springify()}
                  style={{ width: "100%" }}
                >
                  <TouchableOpacity 
                    onPress={handleSendCode}
                    style={[
                      styles.sendButton,
                      isLoading && styles.sendButtonDisabled
                    ]}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={[styles.sendButtonText, { marginLeft: 10 }]}>
                          Sending...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.sendButtonText}>Send Reset Code</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.duration(1000).delay(500).springify()}
                  style={styles.backToLoginContainer}
                >
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backToLoginText}>Back to Login</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#38bdf8",
  },
  container: {
    flex: 1,
    backgroundColor: "#38bdf8",
  },
  backgroundImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  formContainer: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    marginTop: 80,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#F9FAFB",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    fontSize: 16,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sendButton: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 18,
    borderRadius: 15,
    marginTop: 10,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  backToLoginContainer: {
    marginTop: 30,
    alignItems: "center",
  },
  backToLoginText: {
    color: "#0284c7",
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});

export default ForgotPasswordScreen;
