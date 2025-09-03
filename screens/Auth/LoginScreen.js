import {
  SafeAreaView,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator
} from "react-native";
import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../redux/authSlice'; // adjust path
import WebSocketService from '../../services/WebSocketService';
import ChatAPI from '../../services/ChatApi'; 

export default function LoginScreen() {

const dispatch = useDispatch();

const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Email validation states
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Handle email input changes
  const handleEmailChange = (text) => {
    setEmail(text);
    setEmailTouched(true);
    
    if (text === '') {
      setEmailError('Email is required');
    } else if (!validateEmail(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://192.168.43.36:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Handle new response structure with refresh tokens
        const accessToken = data.accessToken || data.token;
        const refreshToken = data.refreshToken;
        const expiresIn = data.expiresIn || 300; // Default to 5 minutes
        const user = data.user;
        
        if (!accessToken) {
          Alert.alert("Login Error", "No authentication token received from server.");
          return;
        }
        
        // Set the auth token for ChatAPI
        await ChatAPI.setAuthToken(accessToken);
        
        // Dispatch the login success action with new structure
        dispatch(loginSuccess({
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: expiresIn,
          user: user,
        }));

        // Reset and connect WebSocket
        WebSocketService.resetConnection();
        setTimeout(() => {
          WebSocketService.connect();
        }, 1000);
        
        // Navigate to authenticated area
        setTimeout(() => {
          setIsLoading(false);
          navigation.reset({ index: 0, routes: [{ name: "Authenticated" }] });
        }, 1500);
      } else {
        setIsLoading(false);
        Alert.alert("Login Failed", data.message || "Invalid credentials");
      }

    } catch (error) {
      setIsLoading(false);
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong.");
    }
  };

const STATUSBAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight : 44;


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

              {/* lights */}
              <View style={styles.lightsContainer}>
                <Animated.Image
                  entering={FadeInUp.delay(200).duration(1000).springify()}
                  style={styles.lightOne}
                  source={require("../../assets/images/light.png")}
                />
                <Animated.Image
                  entering={FadeInUp.delay(400).duration(1000).springify()}
                  style={styles.lightTwo}
                  source={require("../../assets/images/light.png")}
                />
              </View>

              {/* title and form */}
              <View style={styles.contentContainer}>
                <View style={styles.titleContainer}>
                  <Animated.Text
                    entering={FadeInUp.duration(1000).springify()}
                    style={styles.title}
                  >
                    Login
                  </Animated.Text>
                </View>

                <View style={styles.formContainer}>
                  <Animated.View
                    entering={FadeInDown.duration(1000).springify()}
                    style={[styles.inputBox, emailError && emailTouched ? styles.inputError : null]}
                  >
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor={"gray"}
                      value={email}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </Animated.View>
                  
                  {/* Email validation error message */}
                  {emailError && emailTouched && (
                    <Animated.View
                      entering={FadeInDown.duration(300).springify()}
                      style={styles.errorContainer}
                    >
                      <Text style={styles.errorText}>{emailError}</Text>
                    </Animated.View>
                  )}

                  <Animated.View
                    entering={FadeInDown.duration(1000).delay(200).springify()}
                    style={[styles.inputBox, { marginBottom: 12 }]}
                  >
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor={"gray"}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(1000).delay(400).springify()}
                    style={{ width: "100%" }}
                  >
                    <TouchableOpacity 
                      onPress={handleLogin} 
                      style={[
                        styles.loginButton,
                        isLoading && styles.loginButtonDisabled
                      ]}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={[styles.loginButtonText, { marginLeft: 10 }]}>
                            Signing In...
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.loginButtonText}>Login</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(1000).delay(600).springify()}
                    style={styles.signupRow}
                  >
                    <Text>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                      <Text style={styles.signupText}>SignUp</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  container: {
    flex: 1,
    width: "100%",
  },
  backgroundImage: {
    height: "100%",
    width: "100%",
    position: "absolute",
  },
  lightsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    position: "absolute",
  },
  lightOne: {
    height: 225,
    width: 90,
  },
  lightTwo: {
    height: 160,
    width: 65,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-around",
    paddingTop: 120,
    paddingBottom: 40,
  },
  titleContainer: {
    alignItems: "center",
  },
  title: {
    color: "white",
    fontWeight: "bold",
    letterSpacing: 1,
    fontSize: 40,
  },
  formContainer: {
    alignItems: "center",
    marginHorizontal: 16,
    gap: 16,
    marginTop: 250,
  },
  inputBox: {
    backgroundColor: "rgba(0,0,0,0.05)",
    padding: 20,
    borderRadius: 16,
    width: "100%",
  },
  loginButton: {
    backgroundColor: "#38bdf8",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  signupText: {
    color: "#0284c7",
  },
  
  // Email validation styles
  inputError: {
    borderColor: "#ff4444",
    borderWidth: 1,
  },
  errorContainer: {
    marginBottom: 10,
    marginHorizontal: 0,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 12,
    textAlign: "left",
    marginLeft: 5,
  },
  
  // Loading styles
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
