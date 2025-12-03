import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';
import { createMusicSpark } from '../lib/createMusicSpark';
import type { HomeStackParamList } from '../types';

type AddMusicDetailsScreenRouteProp = RouteProp<HomeStackParamList, 'AddMusicDetails'>;
type AddMusicDetailsScreenNavigationProp = NavigationProp<HomeStackParamList>;

const AddMusicDetailsScreen: FC = () => {
  const navigation = useNavigation<AddMusicDetailsScreenNavigationProp>();
  const route = useRoute<AddMusicDetailsScreenRouteProp>();
  const { track, boardId } = route.params;

  const [displayMode, setDisplayMode] = useState<'album' | 'text'>('album');
  const [adding, setAdding] = useState(false);

  const albumImage = track.album?.images?.[0]?.url;
  const artistNames = track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

  async function openInSpotify() {
    const spotifyUri = track.uri; // e.g., spotify:track:xxxxx
    const spotifyUrl = track.external_urls?.spotify; // Web URL
    
    try {
      // Try to open in Spotify app first
      if (spotifyUri) {
        const canOpen = await Linking.canOpenURL(spotifyUri);
        if (canOpen) {
          await Linking.openURL(spotifyUri);
          return;
        }
      }
      
      // Fallback to web URL
      if (spotifyUrl) {
        await Linking.openURL(spotifyUrl);
      } else {
        Alert.alert('Error', 'Could not open Spotify link');
      }
    } catch (error) {
      console.error('Error opening Spotify:', error);
      Alert.alert('Error', 'Could not open Spotify');
    }
  }

  async function handleAddToBoard() {
    setAdding(true);

    const sparkData = {
      ...track,
      displayMode,
    };

    const spark = await createMusicSpark(boardId, sparkData);
    setAdding(false);

    if (!spark) {
      Alert.alert('Error', 'Failed to add music spark');
      return;
    }

    navigation.navigate('Board', { boardId });
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customize Music</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Preview Section */}
        <View style={styles.previewSection}>
          <View style={styles.previewCard}>
            {displayMode === 'album' && albumImage ? (
              <Image source={{ uri: albumImage }} style={styles.previewAlbum} />
            ) : (
              <View style={styles.previewText}>
                <Ionicons name="musical-notes" size={48} color={theme.colors.primary} />
                <Text style={styles.previewSongName} numberOfLines={2}>
                  {track.name}
                </Text>
                <Text style={styles.previewArtist} numberOfLines={1}>
                  {artistNames}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.playButton}
              onPress={openInSpotify}
            >
              <Ionicons
                name="musical-notes"
                size={32}
                color={theme.colors.white}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.trackTitle}>{track.name}</Text>
          <Text style={styles.trackArtist}>{artistNames}</Text>
          <Text style={styles.previewHint}>Tap Spotify icon to preview</Text>
        </View>

        {/* Display Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Display Mode</Text>
          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[styles.modeButton, displayMode === 'album' && styles.modeButtonActive]}
              onPress={() => setDisplayMode('album')}
            >
              <Ionicons
                name="image"
                size={24}
                color={displayMode === 'album' ? theme.colors.white : theme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  displayMode === 'album' && styles.modeButtonTextActive,
                ]}
              >
                Album Cover
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, displayMode === 'text' && styles.modeButtonActive]}
              onPress={() => setDisplayMode('text')}
            >
              <Ionicons
                name="text"
                size={24}
                color={displayMode === 'text' ? theme.colors.white : theme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  displayMode === 'text' && styles.modeButtonTextActive,
                ]}
              >
                Song Name
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Add Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addButton, adding && styles.addButtonDisabled]}
          onPress={handleAddToBoard}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.addButtonText}>Add to Board</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  previewSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  previewCard: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
    ...theme.shadows.lg,
  },
  previewAlbum: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  previewText: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.light,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  previewSongName: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
  },
  previewArtist: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  playButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  trackTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  previewHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.light,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  modeButtonTextActive: {
    color: theme.colors.white,
  },
  spacer: {
    height: 40,
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
});

export default AddMusicDetailsScreen;
