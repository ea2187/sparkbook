import React, { FC, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';
import { uploadAudioAsync } from '../lib/uploadAudio';
import { createAudioSpark } from '../lib/createAudioSpark';
import { supabase } from '../lib/supabase';
import type { HomeStackParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Board {
  id: string;
  name: string;
  created_at: string;
}

// Wave Animation Component
const WaveAnimation: FC<{ isRecording: boolean }> = ({ isRecording }) => {
  const wave1 = useRef(new Animated.Value(0.3)).current;
  const wave2 = useRef(new Animated.Value(0.5)).current;
  const wave3 = useRef(new Animated.Value(0.4)).current;
  const wave4 = useRef(new Animated.Value(0.6)).current;
  const wave5 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isRecording) {
      // Reset to base heights when not recording
      wave1.setValue(0.3);
      wave2.setValue(0.5);
      wave3.setValue(0.4);
      wave4.setValue(0.6);
      wave5.setValue(0.4);
      return;
    }

    // Create staggered animations for each wave bar
    const createAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0.2,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = [
      createAnimation(wave1, 0),
      createAnimation(wave2, 100),
      createAnimation(wave3, 200),
      createAnimation(wave4, 300),
      createAnimation(wave5, 150),
    ];

    Animated.parallel(animations).start();

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [isRecording, wave1, wave2, wave3, wave4, wave5]);

  const getScaleY = (animValue: Animated.Value) => {
    return animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.15, 1],
    });
  };

  return (
    <View style={styles.waveContainer}>
      {[wave1, wave2, wave3, wave4, wave5].map((animValue, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              transform: [{ scaleY: getScaleY(animValue) }],
            },
          ]}
        />
      ))}
    </View>
  );
};

const AddAudioScreen: FC = () => {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  useEffect(() => {
    initializeAudio();
    fetchBoards();

    return () => {
      // Cleanup on unmount
      const cleanup = async () => {
        if (recording) {
          try {
            await recording.stopAndUnloadAsync();
          } catch (e) {
            console.log('Cleanup recording error:', e);
          }
        }
        if (sound) {
          try {
            await sound.unloadAsync();
          } catch (e) {
            console.log('Cleanup sound error:', e);
          }
        }
      };
      cleanup();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recording]);

  async function initializeAudio() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need microphone access to record audio.');
        navigation.goBack();
        return;
      }
    } catch (err) {
      console.error('Audio permission error:', err);
    }
  }

  async function fetchBoards() {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        Alert.alert('Error', 'Failed to load boards');
        return;
      }

      setBoards(data || []);
      
      if (data && data.length > 0) {
        setSelectedBoardId(data[0].id);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoadingBoards(false);
    }
  }

  async function startRecording() {
    // Prevent starting if already recording
    if (recording) {
      console.log('Already recording, stopping first...');
      await stopRecording();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      // Clean up existing sound if any
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch (e) {
          console.log('Sound cleanup:', e);
        }
        setSound(null);
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setAudioUri(null);
      setRecordingDuration(0);
      setTotalDuration(null);
      setPlaybackPosition(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording. Please try again.');
      // Reset recording state on error
      setRecording(null);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (uri) {
        setAudioUri(uri);
        // Store the total duration from recordingDuration state
        // This is the most reliable way since we track it during recording
        setTotalDuration(recordingDuration);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Could not stop recording.');
    }
  }

  async function handleAddToBoard() {
    if (!audioUri || !selectedBoardId) {
      Alert.alert('Missing info', 'Record audio and pick a board first.');
      return;
    }

    setUploading(true);
    
    try {
      const url = await uploadAudioAsync(audioUri, selectedBoardId);
      
      if (!url) {
        Alert.alert('Error', 'Upload failed.');
        setUploading(false);
        return;
      }

      // Spawn near center
      const spawnX = (SCREEN_WIDTH * 5) / 2 - 80 + (Math.random() * 120 - 60);
      const spawnY = (SCREEN_HEIGHT * 5) / 2 - 40 + (Math.random() * 120 - 60);

      const spark = await createAudioSpark(selectedBoardId, url, spawnX, spawnY, title || undefined);
      
      if (!spark) {
        Alert.alert('Error', 'Could not create audio spark.');
        setUploading(false);
        return;
      }

      navigation.navigate('Board', { boardId: selectedBoardId });
    } catch (err) {
      console.error('Error adding audio to board:', err);
      Alert.alert('Error', 'Failed to add audio to board.');
      setUploading(false);
    }
  }

  async function togglePlayback() {
    if (!audioUri) return;

    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
          // Update position and duration from current status
          if (status.positionMillis !== undefined) {
            setPlaybackPosition(Math.floor(status.positionMillis / 1000));
          }
          if (status.durationMillis !== undefined && totalDuration === null) {
            setTotalDuration(Math.floor(status.durationMillis / 1000));
          }
        }
      } else {
        // Load and play audio
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true }
        );
        
        // Set up playback status listener
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
            } else {
              // Update playback position and total duration
              if (status.positionMillis !== undefined) {
                setPlaybackPosition(Math.floor(status.positionMillis / 1000));
              }
              if (status.durationMillis !== undefined && totalDuration === null) {
                setTotalDuration(Math.floor(status.durationMillis / 1000));
              }
            }
          }
        });
        
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Audio</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recording Interface */}
        <View style={styles.recordingSection}>
          {recording && (
            <>
              <WaveAnimation isRecording={!!recording} />
              <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
            </>
          )}

          <Text style={styles.statusText}>
            {recording 
              ? 'Recording...' 
              : audioUri 
                ? 'Recording complete!' 
                : 'Ready to record'}
          </Text>

          {audioUri && !recording && totalDuration !== null && (
            <Text style={styles.totalDurationText}>
              {isPlaying 
                ? `${formatDuration(totalDuration - playbackPosition)} remaining`
                : `Total: ${formatDuration(totalDuration)}`}
            </Text>
          )}

          {!audioUri && !recording && (
            <TouchableOpacity
              style={[
                styles.recordButton, 
                styles.recordButtonLarge
              ]}
              onPress={startRecording}
              disabled={uploading}
            >
              <Ionicons
                name="mic"
                size={48}
                color={theme.colors.white}
              />
            </TouchableOpacity>
          )}

          {recording && (
            <TouchableOpacity
              style={[
                styles.recordButton,
                styles.recordButtonActive
              ]}
              onPress={stopRecording}
              disabled={uploading}
            >
              <Ionicons
                name="stop"
                size={32}
                color={theme.colors.white}
              />
            </TouchableOpacity>
          )}

          {audioUri && !recording && (
            <View style={styles.postRecordingButtons}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={togglePlayback}
                disabled={uploading}
              >
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={24} 
                  color={theme.colors.white} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reRecordButton}
                onPress={startRecording}
                disabled={uploading}
              >
                <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                <Text style={styles.reRecordText}>Re-record</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Title Input */}
        {audioUri && (
          <View style={styles.section}>
            <Text style={styles.label}>Title (optional)</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter audio name"
              placeholderTextColor="#999"
              maxLength={50}
            />
          </View>
        )}

        {/* Board Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Choose Board</Text>
          
          {loadingBoards ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : boards.length === 0 ? (
            <Text style={styles.noBoardsText}>No boards available. Create a board first.</Text>
          ) : (
            <View style={styles.boardList}>
              {boards.map((board) => (
                <TouchableOpacity
                  key={board.id}
                  style={[
                    styles.boardItem,
                    selectedBoardId === board.id && styles.boardItemSelected,
                  ]}
                  onPress={() => setSelectedBoardId(board.id)}
                  disabled={uploading}
                >
                  <View style={styles.boardItemContent}>
                    <View
                      style={[
                        styles.radioOuter,
                        selectedBoardId === board.id && styles.radioOuterSelected,
                      ]}
                    >
                      {selectedBoardId === board.id && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.boardItemText,
                        selectedBoardId === board.id && styles.boardItemTextSelected,
                      ]}
                    >
                      {board.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.addButton,
            (!selectedBoardId || !audioUri || uploading || recording) && styles.addButtonDisabled,
          ]}
          onPress={handleAddToBoard}
          disabled={!selectedBoardId || !audioUri || uploading || !!recording}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.addButtonText}>Add to Board</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  recordingSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 120,
    marginBottom: 16,
    gap: 8,
  },
  waveBar: {
    width: 8,
    height: 60,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  durationText: {
    fontSize: 32,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#EF4444',
    marginBottom: 24,
  },
  totalDurationText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  recordButtonLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
  },
  recordButtonActive: {
    backgroundColor: '#EF4444',
  },
  postRecordingButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  reRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  reRecordText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noBoardsText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  boardList: {
    gap: 8,
  },
  boardItem: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  boardItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E8EFFF',
  },
  boardItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  boardItemText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  boardItemTextSelected: {
    color: theme.colors.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  titleInput: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
});

export default AddAudioScreen;
