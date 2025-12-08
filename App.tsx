import React, { FC, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import HomeStackNavigator from './navigators/HomeStackNavigator';
import SocialScreen from './screens/SocialScreen';
import LoginScreen from './screens/LoginScreen';
import theme from './styles/theme';
import type { RootTabParamList } from './types';
import { supabase } from './lib/supabase';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import MainTabBar from './components/MainTabBar';



// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator<RootTabParamList>();

const App: FC = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Check if user is already logged in and listen for auth state changes
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      setAuthChecked(true);
      console.log('Current logged user:', data.session?.user);
    };
    checkAuth();

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (!fontsLoaded || !authChecked) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
  tabBar={(props) => {
    const route = props.state.routes[props.state.index];
    const routeName = getFocusedRouteNameFromRoute(route) ?? "HomeMain";
    
    // Hide tab bar on Board, PhotoPicker, AddPhotoDetails, SparkDetails, ImportFile, Profile, EditProfile, AddNote, and AddAudio screens
    if (routeName === "Board" || routeName === "PhotoPicker" || routeName === "AddPhotoDetails" || routeName === "SparkDetails" || routeName === "ImportFile" || routeName === "Profile" || routeName === "EditProfile" || routeName === "AddNote" || routeName === "AddAudio") {
      return null;
    }
    
    return <MainTabBar {...props} />;
  }}
  screenOptions={{
    headerShown: false,
  }}
>
<Tab.Screen
  name="Home"
  component={HomeStackNavigator}
  options={{
    headerShown: false,
  }}
/>
  <Tab.Screen 
    name="Social" 
    component={SocialScreen}
  />
</Tab.Navigator>

    </NavigationContainer>
  );
};

export default App;
