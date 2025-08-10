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

  const handleRegister = async () => {
  if (!username || !email || !password) {
    Alert.alert("Error", "Please fill all fields");
    return;
  }

  try {
    const response = await fetch("http://192.168.1.3:8080/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: username, email, password }),
    });

    const text = await response.text(); // get raw text
    let data;
    try {
      data = JSON.parse(text); // try parsing JSON
    } catch {
      data = { message: text }; // fallback to plain text
    }

    if (response.ok) {
      console.log("Registration success:", data);
      Alert.alert("Success", "Account created!");
      navigation.replace("Login");
    } else {
      Alert.alert("Registration failed", data?.message || "Something went wrong.");
    }
  } catch (error) {
    console.error("Register Error:", error);
    Alert.alert("Error", "Network error or server unreachable.");
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
                    <TouchableOpacity onPress={handleRegister} style={styles.loginButton}>
                      <Text style={styles.loginButtonText}>{'Signup'}</Text>
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
