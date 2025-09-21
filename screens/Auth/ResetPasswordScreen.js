import React, { useState } from 'react';
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

const ResetPasswordScreen = ({ route, navigation }) => {
  // Get Redux authentication state as fallback
  const reduxIsAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  
  // Get navigation params
  const { email, code, isAuthenticated: paramIsAuthenticated } = route.params;
  
  // Use parameter if available, otherwise fallback to Redux state
  const isAuthenticated = paramIsAuthenticated !== undefined ? paramIsAuthenticated : reduxIsAuthenticated;
  
  // Debug logging
  console.log('🔍 ResetPasswordScreen - Route params:', { email, code, paramIsAuthenticated, reduxIsAuthenticated, finalIsAuthenticated: isAuthenticated });
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert('Error', 'Please confirm your new password');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('Invalid Password', passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://192.168.1.5:8081/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email,
          code: code,
          newPassword: newPassword 
        }),
      });

      const data = await response.text();

      if (response.ok) {
        Alert.alert(
          'Password Reset Successful',
          isAuthenticated 
            ? 'Your password has been reset successfully.'
            : 'Your password has been reset successfully. Please login with your new password.',
          [
            {
              text: isAuthenticated ? 'OK' : 'Login Now',
              onPress: () => {
                console.log('🔍 ResetPasswordScreen - Navigation decision:', { 
                  paramIsAuthenticated, 
                  reduxIsAuthenticated, 
                  finalIsAuthenticated: isAuthenticated 
                });
                if (isAuthenticated) {
                  console.log('🔍 ResetPasswordScreen - Popping to top for authenticated user');
                  // For authenticated users, pop back to the main stack
                  navigation.popToTop();
                } else {
                  console.log('🔍 ResetPasswordScreen - Resetting to Login for non-authenticated user');
                  // For non-authenticated users, navigate to login
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', data || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/(?=.*[a-z])/.test(password)) strength++;
    if (/(?=.*[A-Z])/.test(password)) strength++;
    if (/(?=.*\d)/.test(password)) strength++;
    if (/(?=.*[@$!%*?&])/.test(password)) strength++;
    return strength;
  };

  const getStrengthColor = (strength) => {
    if (strength <= 1) return '#DC2626';
    if (strength <= 2) return '#F59E0B';
    if (strength <= 3) return '#EAB308';
    return '#10B981';
  };

  const getStrengthText = (strength) => {
    if (strength <= 1) return 'Weak';
    if (strength <= 2) return 'Fair';
    if (strength <= 3) return 'Good';
    return 'Strong';
  };

  const passwordStrength = getPasswordStrength(newPassword);

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
                  <Text style={styles.title}>Set New Password</Text>
                  <Text style={styles.subtitle}>
                    Please create a new password for your account
                  </Text>
                </Animated.View>

                {/* New Password Input */}
                <Animated.View 
                  entering={FadeInDown.duration(1000).delay(300).springify()}
                  style={styles.inputContainer}
                >
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter new password"
                      placeholderTextColor="#9CA3AF"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#9CA3AF" 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Password Strength Indicator */}
                  {newPassword.length > 0 && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBar}>
                        {[...Array(4)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.strengthSegment,
                              i < passwordStrength ? 
                                { backgroundColor: getStrengthColor(passwordStrength) } :
                                { backgroundColor: '#E5E7EB' }
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthText, { color: getStrengthColor(passwordStrength) }]}>
                        {getStrengthText(passwordStrength)}
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Confirm Password Input */}
                <Animated.View 
                  entering={FadeInDown.duration(1000).delay(400).springify()}
                  style={styles.inputContainer}
                >
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm new password"
                      placeholderTextColor="#9CA3AF"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons 
                        name={showConfirmPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#9CA3AF" 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Password Match Indicator */}
                  {confirmPassword.length > 0 && (
                    <View style={styles.matchContainer}>
                      <Ionicons 
                        name={newPassword === confirmPassword ? "checkmark-circle" : "close-circle"} 
                        size={16} 
                        color={newPassword === confirmPassword ? "#10B981" : "#DC2626"} 
                      />
                      <Text style={[
                        styles.matchText,
                        { color: newPassword === confirmPassword ? "#10B981" : "#DC2626" }
                      ]}>
                        {newPassword === confirmPassword ? "Passwords match" : "Passwords don't match"}
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Password Requirements */}
                <Animated.View 
                  entering={FadeInDown.duration(1000).delay(500).springify()}
                  style={styles.requirementsContainer}
                >
                  <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                  <Text style={styles.requirementText}>• At least 8 characters long</Text>
                  <Text style={styles.requirementText}>• One lowercase letter</Text>
                  <Text style={styles.requirementText}>• One uppercase letter</Text>
                  <Text style={styles.requirementText}>• One number</Text>
                </Animated.View>

                {/* Reset Button */}
                <Animated.View
                  entering={FadeInDown.duration(1000).delay(600).springify()}
                  style={{ width: "100%" }}
                >
                  <TouchableOpacity 
                    onPress={handleResetPassword}
                    style={[
                      styles.resetButton,
                      isLoading && styles.resetButtonDisabled
                    ]}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={[styles.resetButtonText, { marginLeft: 10 }]}>
                          Resetting...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.resetButtonText}>Reset Password</Text>
                    )}
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#F9FAFB",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: "#1F2937",
  },
  eyeButton: {
    padding: 15,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthBar: {
    flexDirection: 'row',
    flex: 1,
    height: 4,
    marginRight: 10,
    gap: 2,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  matchText: {
    fontSize: 14,
    marginLeft: 5,
    fontWeight: '500',
  },
  requirementsContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  requirementText: {
    fontSize: 12,
    color: '#6B7280',
    marginVertical: 1,
  },
  resetButton: {
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
  resetButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  resetButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ResetPasswordScreen;
