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
  ActivityIndicator,
  Modal,
} from "react-native";
import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

export default function RegisterScreen() {
  const navigation = useNavigation();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setIsLoading(true);

    // Debug: Log what we're sending
    const requestData = { username: username, email, password };
    console.log("🚀 Sending registration request:", {
      username: requestData.username,
      email: requestData.email,
      password: "***hidden***"
    });

    try {
      const response = await fetch("http://192.168.43.36:8080/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      console.log("📡 Response status:", response.status);
      console.log("📡 Response headers:", response.headers);

      const text = await response.text(); // get raw text
      console.log("📡 Raw response:", text);
      
      let data;
      try {
        data = JSON.parse(text); // try parsing JSON
      } catch {
        data = { message: text }; // fallback to plain text
      }

      console.log("📡 Parsed response:", data);

      if (response.ok) {
        console.log("Registration success:", data);
        setRegisteredEmail(email);
        setShowSuccessModal(true);
      } else {
        console.log("Registration failed:", data);
        
        // Handle specific error messages
        const errorMessage = data?.message || "Something went wrong.";
        
        if (errorMessage.toLowerCase().includes("email") && 
            errorMessage.toLowerCase().includes("already")) {
          Alert.alert(
            "Email Already Registered", 
            "This email is already registered. Please use a different email or try logging in.",
            [
              { text: "Try Different Email", style: "default" },
              { 
                text: "Go to Login", 
                onPress: () => navigation.replace("Login"),
                style: "default"
              }
            ]
          );
        } else if (errorMessage.toLowerCase().includes("username") && 
                   errorMessage.toLowerCase().includes("already")) {
          Alert.alert(
            "Username Already Taken", 
            "This username is already taken. Please choose a different username."
          );
        } else {
          Alert.alert("Registration Failed", errorMessage);
        }
      }
    } catch (error) {
      console.error("Register Error:", error);
      Alert.alert("Error", "Network error or server unreachable.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView>
        <View style={{ backgroundColor: '#000', paddingTop: StatusBar.currentHeight }}>
       <StatusBar translucent barStyle="light-content" />
        </View>

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
                    Signup
                  </Animated.Text>
                </View>

                <View style={styles.formContainer}>
                  <Animated.View
                    entering={FadeInDown.duration(1000).springify()}
                    style={styles.inputBox}
                  >
                    <TextInput
                      placeholder="Enter unique Username"
                      placeholderTextColor={"gray"}
                      value={username}
                      onChangeText={setUsername}
                      keyboardType="text"
                      autoCapitalize="none"
                    />
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(1000).delay(200).springify()}
                    style={styles.inputBox}
                  >
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor={"gray"}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="text"
                      autoCapitalize="none"
                    />
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(1000).delay(400).springify()}
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
                    entering={FadeInDown.duration(1000).delay(600).springify()}
                    style={{ width: "100%" }}
                  >
                    <TouchableOpacity 
                      onPress={handleRegister} 
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
                            Creating Account...
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.loginButtonText}>Signup</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(1000).delay(800).springify()}
                    style={styles.signupRow}
                  >
                    <Text>{'Already have an account?' }</Text>
                    <TouchableOpacity onPress={() => navigation.push("Login")}>
                      <Text style={styles.signupText}>{'Login'}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Beautiful Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={styles.modalContent}
            entering={FadeInUp.duration(500).springify()}
          >
            {/* Success Icon */}
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✅</Text>
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Check Your Email</Text>

            {/* Message */}
            <Text style={styles.modalMessage}>
              Account created successfully!
            </Text>

            <Text style={styles.modalSubMessage}>
              We've sent a verification link to:
            </Text>

            {/* Email Display */}
            <View style={styles.emailContainer}>
              <Text style={styles.emailText}>{registeredEmail}</Text>
            </View>

            <Text style={styles.modalInstructions}>
              Please check your email and click the verification link to activate your account.
            </Text>

            {/* Button */}
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.replace("Login");
              }}
            >
              <Text style={styles.modalButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
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
    top: 20,
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
  loginButtonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: "90%",
    maxWidth: 400,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 60,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 15,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 18,
    color: "#059669",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  modalSubMessage: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 15,
  },
  emailContainer: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
  },
  modalInstructions: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 25,
  },
  modalButton: {
    backgroundColor: "#38bdf8",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 150,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
