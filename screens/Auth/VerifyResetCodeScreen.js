import React, { useState, useRef, useEffect } from 'react';
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
import { useSelector } from 'react-redux';

const VerifyResetCodeScreen = ({ route, navigation }) => {
  // Get Redux authentication state as fallback
  const reduxIsAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  
  // Get navigation params
  const { email, isAuthenticated: paramIsAuthenticated } = route.params;
  
  // Use parameter if available, otherwise fallback to Redux state
  const isAuthenticated = paramIsAuthenticated !== undefined ? paramIsAuthenticated : reduxIsAuthenticated;
  
  // Debug logging
  console.log('🔍 VerifyResetCodeScreen - Route params:', { email, paramIsAuthenticated, reduxIsAuthenticated, finalIsAuthenticated: isAuthenticated });
  
  const [code, setCode] = useState(['', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes countdown
  
  const inputRefs = useRef([]);

  useEffect(() => {
    // Countdown timer
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Auto-focus previous input on backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const enteredCode = code.join('');
    
    if (enteredCode.length !== 5) {
      Alert.alert('Error', 'Please enter the complete 5-digit code');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://192.168.1.5:8080/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email,
          code: enteredCode 
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        Alert.alert(
          'Code Verified',
          'Your code has been verified. You can now reset your password.',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('🔍 VerifyResetCodeScreen - Navigating to ResetPassword with:', { 
                  email, 
                  code: enteredCode, 
                  isAuthenticated 
                });
                navigation.navigate('ResetPassword', { 
                  email: email,
                  code: enteredCode,
                  isAuthenticated: isAuthenticated 
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Invalid or expired code');
        // Clear the code inputs
        setCode(['', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Verify code error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);

    try {
      const response = await fetch("http://192.168.1.5:8080/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });

      if (response.ok) {
        Alert.alert('Code Sent', 'A new reset code has been sent to your email.');
        setTimeLeft(300); // Reset timer
        setCode(['', '', '', '', '']); // Clear current code
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', 'Failed to resend code');
      }
    } catch (error) {
      console.error('Resend code error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setResendLoading(false);
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
                <Text style={styles.headerTitle}>Verify Code</Text>
                <View style={styles.placeholder} />
              </Animated.View>

              {/* Form */}
              <View style={styles.formContainer}>
                <Animated.View entering={FadeInDown.duration(1000).delay(200).springify()}>
                  <Text style={styles.title}>Enter Verification Code</Text>
                  <Text style={styles.subtitle}>
                    We've sent a 5-digit code to{'\n'}
                    <Text style={styles.emailText}>{email}</Text>
                  </Text>
                </Animated.View>

                {/* Code Input */}
                <Animated.View 
                  entering={FadeInDown.duration(1000).delay(300).springify()}
                  style={styles.codeContainer}
                >
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => inputRefs.current[index] = ref}
                      style={[
                        styles.codeInput,
                        digit ? styles.codeInputFilled : null
                      ]}
                      value={digit}
                      onChangeText={(text) => handleCodeChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </Animated.View>

                {/* Timer */}
                <Animated.View 
                  entering={FadeInDown.duration(1000).delay(400).springify()}
                  style={styles.timerContainer}
                >
                  <Text style={styles.timerText}>
                    Code expires in: <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
                  </Text>
                </Animated.View>

                {/* Verify Button */}
                <Animated.View
                  entering={FadeInDown.duration(1000).delay(500).springify()}
                  style={{ width: "100%" }}
                >
                  <TouchableOpacity 
                    onPress={handleVerifyCode}
                    style={[
                      styles.verifyButton,
                      isLoading && styles.verifyButtonDisabled
                    ]}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={[styles.verifyButtonText, { marginLeft: 10 }]}>
                          Verifying...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.verifyButtonText}>Verify Code</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {/* Resend Code */}
                <Animated.View
                  entering={FadeInDown.duration(1000).delay(600).springify()}
                  style={styles.resendContainer}
                >
                  <Text style={styles.resendText}>Didn't receive the code? </Text>
                  <TouchableOpacity 
                    onPress={handleResendCode}
                    disabled={resendLoading || timeLeft > 240} // Allow resend after 1 minute
                  >
                    <Text style={[
                      styles.resendLink,
                      (resendLoading || timeLeft > 240) && styles.resendLinkDisabled
                    ]}>
                      {resendLoading ? 'Sending...' : 'Resend Code'}
                    </Text>
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
  },
  emailText: {
    fontWeight: '600',
    color: "#0EA5E9",
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  codeInputFilled: {
    borderColor: '#0EA5E9',
    backgroundColor: '#EFF6FF',
  },
  timerContainer: {
    marginBottom: 30,
  },
  timerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  timerValue: {
    fontWeight: '600',
    color: '#DC2626',
  },
  verifyButton: {
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
  verifyButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  verifyButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
  },
  resendLink: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendLinkDisabled: {
    color: '#9CA3AF',
    textDecorationLine: 'none',
  },
});

export default VerifyResetCodeScreen;
