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
    const response = await fetch("http://192.168.1.3:8080/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
     
    const data = await response.json();

    if (response.ok) {
  dispatch(loginSuccess({
    token: data.token,
    user: data.user,
  }));

  navigation.reset({ index: 0, routes: [{ name: "Main" }] });
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
