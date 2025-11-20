import React, { FC, useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Text,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import theme from '../styles/theme';
import type { HomeStackParamList } from '../types';

type BoardScreenRouteProp = RouteProp<HomeStackParamList, 'Board'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Board dimensions (less infinite)
const BOARD_WIDTH = SCREEN_WIDTH * 5;
const BOARD_HEIGHT = SCREEN_HEIGHT * 5;

// Grid cell size (like Freeform's grid)
const GRID_SIZE = 20;

const BoardScreen: FC = () => {
  const route = useRoute<BoardScreenRouteProp>();
  const navigation = useNavigation();
  const { boardId } = route.params;
  const [boardName, setBoardName] = useState('Board');
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchBoard();
  }, [boardId]);

  useEffect(() => {
    // Center the canvas on mount
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: (BOARD_WIDTH - SCREEN_WIDTH) / 2,
          y: (BOARD_HEIGHT - SCREEN_HEIGHT) / 2,
          animated: false,
        });
      }, 100);
    }
  }, []);

  async function fetchBoard() {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

      if (error) {
        console.error('Error fetching board:', error);
      } else if (data) {
        setBoardName(data.name);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }


  async function requestPermissions() {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Sorry, we need camera and media library permissions to add photos!'
      );
      return false;
    }
    return true;
  }

  async function handlePhotoButton() {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: takePhoto,
        },
        {
          text: 'Photo Library',
          onPress: pickImageFromLibrary,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }

  async function takePhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Photo taken:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }

  async function pickImageFromLibrary() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.6,
        exif: false,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Photo selected:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {boardName}
        </Text>
        <View style={styles.headerRight}>
          {/* Placeholder for future actions */}
        </View>
      </View>

      {/* Infinite Canvas */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.canvasContainer}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEventThrottle={16}
      >
        {/* Grid Background - Using a more efficient pattern */}
        <View style={styles.gridContainer}>
          {/* Render grid lines instead of individual cells for better performance */}
          {Array.from({ length: Math.ceil(BOARD_HEIGHT / GRID_SIZE) + 1 }).map((_, i) => (
            <View
              key={`h-line-${i}`}
              style={[
                styles.gridLine,
                styles.gridLineHorizontal,
                { top: i * GRID_SIZE },
              ]}
            />
          ))}
          {Array.from({ length: Math.ceil(BOARD_WIDTH / GRID_SIZE) + 1 }).map((_, i) => (
            <View
              key={`v-line-${i}`}
              style={[
                styles.gridLine,
                styles.gridLineVertical,
                { left: i * GRID_SIZE },
              ]}
            />
          ))}
        </View>

        {/* Canvas Content Area - This is where elements will go later */}
        <View style={styles.canvasContent}>
          {/* Empty state message - centered */}
          <View style={styles.emptyState}>
            <Ionicons
              name="albums-outline"
              size={64}
              color={theme.colors.textLight}
            />
            <Text style={styles.emptyStateText}>
              Your infinite canvas is ready
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Pan around to explore the space
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomBarIcon}>
          <Image 
            source={require('../assets/note.png')} 
            style={styles.bottomBarIconImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarIcon}>
          <Image 
            source={require('../assets/voice.png')} 
            style={styles.bottomBarIconImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarIcon}>
          <Ionicons name="star" size={36} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarIcon} onPress={handlePhotoButton}>
          <Image 
            source={require('../assets/photo.png')} 
            style={styles.bottomBarIconImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBarIcon}>
          <Ionicons name="ellipsis-horizontal" size={32} color={theme.colors.light} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingTop: 50, // Account for status bar
    height: 100,
    position: 'relative',
  },
  backButton: {
    padding: theme.spacing.xs,
    zIndex: 1,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 60,
    textAlign: 'center',
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    zIndex: 0,
  },
  headerRight: {
    width: 40,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
  },
  canvasContainer: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    backgroundColor: theme.colors.light,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: theme.colors.border,
  },
  gridLineHorizontal: {
    width: BOARD_WIDTH,
    height: 0.5,
  },
  gridLineVertical: {
    width: 0.5,
    height: BOARD_HEIGHT,
  },
  canvasContent: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  emptyState: {
    position: 'absolute',
    top: BOARD_HEIGHT / 2 - 100,
    left: BOARD_WIDTH / 2 - 150,
    width: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: theme.colors.light, // Light blue background
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...theme.shadows.md,
  },
  bottomBarIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  bottomBarIconImage: {
    width: 36,
    height: 36,
  },
});

export default BoardScreen;

