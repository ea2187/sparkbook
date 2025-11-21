import React, { FC } from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import BoardScreen from '../screens/BoardScreen';
import AddNoteScreen from '../screens/AddNoteScreen';
import AddAudioScreen from '../screens/AddAudioScreen';
import ImportFileScreen from '../screens/ImportFileScreen';
import AddMusicScreen from '../screens/AddMusicScreen';
import PhotoPickerScreen from '../screens/PhotoPickerScreen';
import AddPhotoDetailsScreen from '../screens/AddPhotoDetailsScreen';
import SparkDetailsScreen from '../screens/SparkDetailsScreen';
import type { HomeStackParamList } from '../types';

const Stack = createStackNavigator<HomeStackParamList>();

const HomeStackNavigator: FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#336BC8',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontFamily: 'Inter_600SemiBold',
        },
        ...TransitionPresets.SlideFromRightIOS,
        gestureDirection: 'horizontal',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen}
        options={{
          title: 'Home',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Board"
        component={BoardScreen}
        options={{
          headerShown: false,
          animationTypeForReplace: 'push',
        }}
      />
      <Stack.Screen
        name="AddNote"
        component={AddNoteScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddAudio"
        component={AddAudioScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ImportFile"
        component={ImportFileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddMusic"
        component={AddMusicScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PhotoPicker"
        component={PhotoPickerScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddPhotoDetails"
        component={AddPhotoDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SparkDetails"
        component={SparkDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;

