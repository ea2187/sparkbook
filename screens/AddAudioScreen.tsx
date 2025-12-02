import React, { FC, useState, useEffect } from 'react';
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

  useEffect(() => {
    initializeAudio();
    fetchBoards();

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
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
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setAudioUri(null);
      setRecordingDuration(0);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording.');
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
        }
      } else {
        // Load and play audio
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        );
        
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
          <View style={[styles.micIcon, recording && styles.micIconRecording]}>
            <Ionicons 
              name={recording ? 'mic' : 'mic-outline'} 
              size={60} 
              color={recording ? '#EF4444' : theme.colors.primary} 
            />
          </View>

          <Text style={styles.statusText}>
            {recording 
              ? 'Recording...' 
              : audioUri 
                ? 'Recording complete!' 
                : 'Ready to record'}
          </Text>

          {recording && (
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          )}

          <TouchableOpacity
            style={[styles.recordButton, recording && styles.recordButtonActive]}
            onPress={recording ? stopRecording : startRecording}
            disabled={uploading}
          >
            <Ionicons
              name={recording ? 'square' : 'mic'}
              size={32}
              color={theme.colors.white}
            />
          </TouchableOpacity>

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
              placeholder="Name your audio recording"
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
    paddingTop: 50,
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
  micIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8EFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  micIconRecording: {
    backgroundColor: '#FEE2E2',
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
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  recordButtonActive: {
    backgroundColor: '#EF4444',
  },
  postRecordingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
