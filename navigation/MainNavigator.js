import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatScreen from "../screens/Chat/ChatScreen";
import ChatListScreen from "../screens/Chat/ChatListScreen";
import FeedScreen from "../screens/Home/FeedScreen";
import CreatePostScreen from "../screens/Post/CreatePostScreen";
import PostDetailScreen from "../screens/Post/PostDetailScreen";
import ProfileScreen from "../screens/Profile/ProfileScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import RegisterScreen from "../screens/Auth/RegisterScreen";
import UserProfileScreen from "../screens/Profile/UserProfileScreen";
import NotificationsScreen from "../screens/Notifications/NotificationsScreen";
import AdminScreen from "../screens/Admin/AdminScreen";
import SearchScreen from "../screens/Search/SearchScreen";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { View, Text } from "react-native";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 🔔 Notification Badge Component
const NotificationBadge = ({ count }) => {
  if (!count || count === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        right: -8,
        top: -4,
        backgroundColor: "#FF3B30",
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#FFFFFF",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
};

// 🛡️ Admin Bottom Tab Navigator
const AdminBottomTabNavigator = () => {
  const { unreadCount } = useSelector((state) => state.notifications);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Admin") {
            iconName = focused ? "shield" : "shield-outline";
          } else if (route.name === "Search") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline";
            return (
              <View style={{ position: "relative", alignItems: "center" }}>
                <Ionicons name={iconName} size={size} color={color} />
                <NotificationBadge count={unreadCount} />
              </View>
            );
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#fff",
          height: 80,
          borderTopWidth: 2,
          elevation: 10,
          borderTopColor: "#dcdcdc",
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarIconStyle: {
          alignItems: "center",
          justifyContent: "center",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          tabBarLabel: "Admin Panel",
        }}
      />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: "Notifications",
        }}
      />
    </Tab.Navigator>
  );
};

// 👤 Regular User Bottom Tab Navigator
const RegularBottomTabNavigator = () => {
  const { unreadCount } = useSelector((state) => state.notifications);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Feed") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Search") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline";
            return (
              <View style={{ position: "relative", alignItems: "center" }}>
                <Ionicons name={iconName} size={size} color={color} />
                <NotificationBadge count={unreadCount} />
              </View>
            );
          } else if (route.name === "Post") {
            iconName = focused ? "add" : "add-outline";
          } else if (route.name === "Chat") {
            iconName = focused ? "chatbox" : "chatbox-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#fff",
          height: 60,
          borderTopWidth: 2,
          elevation: 10,
          borderTopColor: "#342121ff",
          paddingTop: 10,
          paddingBottom: 10,
          },
        tabBarIconStyle: {
          alignItems: "center",
          justifyContent: "center",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Post" component={CreatePostScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// 🔀 Main Bottom Tab Navigator (chooses admin vs regular)
const BottomTabNavigator = () => {
  const { user } = useSelector((state) => state.auth);

  if (user?.isAdmin) {
    return <AdminBottomTabNavigator />;
  } else {
    return <RegularBottomTabNavigator />;
  }
};

// 🛡️ Admin Authenticated Stack
const AdminAuthenticatedStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="ShowProfile"
        component={UserProfileScreen}
        options={{
          presentation: "modal",
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
};

// 👤 Regular Authenticated Stack
const RegularAuthenticatedStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="ShowProfile"
        component={UserProfileScreen}
        options={{
          presentation: "modal",
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{
          headerShown: true,
          title: "Chat",
          headerStyle: {
            backgroundColor: "#007AFF",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
    </Stack.Navigator>
  );
};

// 🔐 Main Authenticated Stack (admin vs regular)
const AuthenticatedStack = () => {
  const { user } = useSelector((state) => state.auth);

  if (user?.isAdmin) {
    return <AdminAuthenticatedStack />;
  } else {
    return <RegularAuthenticatedStack />;
  }
};

export default function MainNavigator() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const Stack = createNativeStackNavigator();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Authenticated" component={AuthenticatedStack} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
