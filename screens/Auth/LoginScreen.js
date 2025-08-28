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
  Platform
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

  const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert("Error", "Please enter both email and password.");
    return;
  }

  try {
    const response = await fetch("http://192.168.43.36:8080/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json(); // correct way to extract response body

    console.log('Login response status:', response.status);
    console.log('Login response data:', JSON.stringify(data, null, 2)); // ✅ show actual parsed data

    if (response.ok) {
      // Check for different possible token field names
      const token = data.token || data.accessToken || data.access_token || data.authToken;
      console.log('Login successful, token from response:', token ? token.substring(0, 30) + '...' : 'No token found');
      console.log('Available fields in response:', Object.keys(data));
      
      if (!token) {
        console.error('No token found in login response!');
        Alert.alert("Login Error", "No authentication token received from server.");
        return;
      }
      
      // First set the auth token and wait for it to be stored
      await ChatAPI.setAuthToken(token);
      
      // Test the token immediately by making a simple API call
      try {
        console.log('Testing token with a simple API call...');
        
        // First try to verify the token with the profile endpoint or a simpler endpoint
        const profileResponse = await fetch(`http://192.168.43.36:8080/api/auth/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (profileResponse.ok) {
          console.log('Token validation successful with profile endpoint');
        } else {
          console.log('Profile endpoint failed, trying chats endpoint...');
        }
        
        const testResult = await ChatAPI.getUserChatsList();
        console.log('Token test successful, got chats:', testResult?.length || 0);
      } catch (tokenTestError) {
        console.error('Token test failed:', tokenTestError);
        console.log('Proceeding with login despite token test failure - maybe no chats exist yet');
        // Don't block login for this - maybe the user just has no chats yet
      }
      
      // Dispatch the login success action
      dispatch(loginSuccess({
        token: token,
        user: data.user,
      }));

      // Reset and connect WebSocket with a longer delay to ensure everything is ready
      WebSocketService.resetConnection();
      setTimeout(() => {
        console.log('Attempting WebSocket connection after login...');
        WebSocketService.connect();
      }, 1000);
      
      // Add a small delay before navigation to ensure everything is set up
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: "Authenticated" }] });
      }, 1500);
    } else {
      Alert.alert("Login Failed", data.message || "Invalid credentials");
    }

  } catch (error) {
    console.log("Login error:", error);
    Alert.alert("Error", "Something went wrong.");
  }
};

const STATUSBAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight : 44;


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: "#38bdf8" }} />
      <ScrollView>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
                    style={styles.inputBox}
                  >
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor={"gray"}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </Animated.View>

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
                    <TouchableOpacity onPress={handleLogin} style={styles.loginButton}>
                      <Text style={styles.loginButtonText}>Login</Text>
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
          </ScrollView>
        </TouchableWithoutFeedback>
      </ScrollView>
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
});
