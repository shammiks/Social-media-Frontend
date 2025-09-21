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
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { View, Text } from "react-native";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Notification Badge Component
const NotificationBadge = ({ count }) => {
  if (!count || count === 0) return null;
  
  return (
    <View style={{
      position: 'absolute',
      right: -6,
      top: -3,
      backgroundColor: '#FF3B30',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    }}>
      <Text style={{
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
      }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
};

// Admin Bottom Tab Navigator - Only Admin and Notifications screens
const AdminBottomTabNavigator = () => {
  const { unreadCount } = useSelector(state => state.notifications);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Admin") {
            iconName = focused ? "shield" : "shield-outline";
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline";
            // Return icon with notification badge
            return (
              <View style={{ position: 'relative' }}>
                <Ionicons name={iconName} size={size} color={color} />
                <NotificationBadge count={unreadCount} />
              </View>
            );
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "600",
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#fff",
          paddingBottom: 5,
          paddingTop: 5,
          height: 80,
          borderTopWidth: 2,
          elevation: 10,
          borderTopColor: "#dcdcdc",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Admin" 
        component={AdminScreen}
        options={{
          tabBarLabel: 'Admin Panel',
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Notifications',
        }}
      />
    </Tab.Navigator>
  );
};

// Regular User Bottom Tab Navigator - All screens except Admin
const RegularBottomTabNavigator = () => {
  const { unreadCount } = useSelector(state => state.notifications);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Feed") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline";
            // Return icon with notification badge
            return (
              <View style={{ position: 'relative' }}>
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
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "600",
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#fff",
          paddingBottom: 5,
          paddingTop: 5,
          height: 80,
          borderTopWidth: 2,
          elevation: 10,
          borderTopColor: "#dcdcdc",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Post" component={CreatePostScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Main Bottom Tab Navigator that chooses between admin and regular based on user role
const BottomTabNavigator = () => {
  const { user } = useSelector(state => state.auth);

  // Debug logging for user admin status
  console.log('🔍 MainNavigator - User object:', user);
  console.log('🔍 MainNavigator - User isAdmin:', user?.isAdmin);
  console.log('🔍 MainNavigator - User keys:', user ? Object.keys(user) : 'null');

  // Return different tab navigators based on user role
  if (user?.isAdmin) {
    return <AdminBottomTabNavigator />;
  } else {
    return <RegularBottomTabNavigator />;
  }
};

// Stack navigator for Admin users - only allows access to UserProfile and limited screens
const AdminAuthenticatedStack = () => {
  const Stack = createNativeStackNavigator();
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen 
        name="ShowProfile" 
        component={UserProfileScreen}
        options={{ 
          presentation: 'modal',
          gestureEnabled: true 
        }}
      />
      {/* Admin can access notifications through the tab navigator */}
    </Stack.Navigator>
  );
};

// Stack navigator for Regular users - full access to all screens
const RegularAuthenticatedStack = () => {
  const Stack = createNativeStackNavigator();
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen 
        name="ShowProfile" 
        component={UserProfileScreen}
        options={{ 
          presentation: 'modal',
          gestureEnabled: true 
        }}
      />
      {/* Post Detail Screen */}
      <Stack.Screen 
        name="PostDetail" 
        component={PostDetailScreen}
        options={{ 
          headerShown: false,
          gestureEnabled: true 
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ 
          headerShown: false,
          gestureEnabled: true 
        }}
      />
      {/* Add Chat-related screens */}
      <Stack.Screen 
        name="ChatScreen" 
        component={ChatScreen}
        options={{
          headerShown: true,
          title: 'Chat',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack.Navigator>
  );
};

// Main Authenticated Stack that chooses between admin and regular based on user role
const AuthenticatedStack = () => {
  const { user } = useSelector(state => state.auth);
  
  // Return different stack navigators based on user role
  if (user?.isAdmin) {
    return <AdminAuthenticatedStack />;
  } else {
    return <RegularAuthenticatedStack />;
  }
};

export default function MainNavigator() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const token = useSelector((state) => state.auth.token);
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
