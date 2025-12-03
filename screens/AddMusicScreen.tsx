import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';
import { useSpotifyAuth } from '../lib/spotify/useSpotifyAuth';
import { searchSpotifyTracks, getTopTracks } from '../lib/spotify/apiOptions';
import { createMusicSpark } from '../lib/createMusicSpark';
import type { HomeStackParamList } from '../types';

type AddMusicScreenRouteProp = RouteProp<HomeStackParamList, 'AddMusic'>;
type AddMusicScreenNavigationProp = NavigationProp<HomeStackParamList>;

const AddMusicScreen: FC = () => {
  const navigation = useNavigation<AddMusicScreenNavigationProp>();
  const route = useRoute<AddMusicScreenRouteProp>();
  const { boardId } = route.params || {};

  const { authResponse, getSpotifyAuth, isLoading: authLoading } = useSpotifyAuth();
  const [tracks, setTracks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(boardId || null);

  const accessToken = authResponse?.access_token;

  useEffect(() => {
    if (accessToken) {
      loadTopTracks();
      if (!boardId) {
        fetchBoards();
      }
    }
  }, [accessToken]);

  async function fetchBoards() {
    console.log('Fetching boards for music screen...');
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase
      .from('boards')
      .select('id, name')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching boards:', error);
      return;
    }
    
    console.log('Fetched boards:', data);
    if (data && data.length > 0) {
      setBoards(data);
      if (!selectedBoardId) {
        setSelectedBoardId(data[0].id);
        console.log('Auto-selected board:', data[0].id);
      }
    } else {
      Alert.alert('No Boards', 'Please create a board first.');
    }
  }

  useEffect(() => {
    if (accessToken && searchQuery.trim()) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(timer);
    } else if (accessToken && !searchQuery.trim()) {
      loadTopTracks();
    }
  }, [searchQuery, accessToken]);

  async function loadTopTracks() {
    setLoading(true);
    const topTracks = await getTopTracks(accessToken!);
    setTracks(topTracks);
    setLoading(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim() || !accessToken) return;
    
    setLoading(true);
    const results = await searchSpotifyTracks(searchQuery, accessToken);
    setTracks(results);
    setLoading(false);
  }

  async function handleTrackSelect(track: any) {
    if (!selectedBoardId) {
      Alert.alert('No Board Selected', 'Please select a board to add this track to.');
      return;
    }

    navigation.navigate('AddMusicDetails', { track, boardId: selectedBoardId });
  }

  function renderTrack({ item }: { item: any }) {
    const albumImage = item.album?.images?.[0]?.url;
    const artistNames = item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

    return (
      <TouchableOpacity
        style={styles.trackItem}
        onPress={() => handleTrackSelect(item)}
        disabled={adding}
      >
        {albumImage ? (
          <Image source={{ uri: albumImage }} style={styles.albumArt} />
        ) : (
          <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
            <Ionicons name="musical-note" size={24} color="#999" />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {artistNames}
          </Text>
        </View>
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    );
  }

  if (!authResponse) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Music</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.loginContainer}>
          <Ionicons name="musical-notes" size={80} color={theme.colors.primary} />
          <Text style={styles.loginTitle}>Connect Spotify</Text>
          <Text style={styles.loginSubtext}>
            Connect your Spotify account to add music to your board
          </Text>
          <TouchableOpacity
            style={styles.spotifyButton}
            onPress={() => {
              console.log('Connect Spotify pressed');
              console.log('getSpotifyAuth:', typeof getSpotifyAuth);
              getSpotifyAuth();
            }}
          >
            <Ionicons name="musical-notes" size={24} color={theme.colors.white} />
            <Text style={styles.spotifyButtonText}>Connect Spotify</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Music</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for a song or artist"
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {!boardId && (
        <View style={styles.boardSelectorContainer}>
          <Text style={styles.boardSelectorLabel}>Add to:</Text>
          {boards.length > 0 ? (
            <View style={styles.boardPills}>
              {boards.map((board) => (
                <TouchableOpacity
                  key={board.id}
                  style={[
                    styles.boardPill,
                    selectedBoardId === board.id && styles.boardPillSelected,
                  ]}
                  onPress={() => setSelectedBoardId(board.id)}
                >
                  <Text
                    style={[
                      styles.boardPillText,
                      selectedBoardId === board.id && styles.boardPillTextSelected,
                    ]}
                  >
                    {board.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noBoardsText}>No boards available. Create one first!</Text>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrack}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No tracks found' : 'Your top tracks will appear here'}
              </Text>
            </View>
          }
        />
      )}

      {adding && (
        <View style={styles.addingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.white} />
          <Text style={styles.addingText}>Adding to board...</Text>
        </View>
      )}
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
  loginContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loginTitle: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: 24,
  },
  loginSubtext: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  spotifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    ...theme.shadows.md,
  },
  spotifyButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.light,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  albumArt: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  albumArtPlaceholder: {
    backgroundColor: theme.colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    gap: 4,
  },
  trackName: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  artistName: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  addingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  addingText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  boardSelectorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  boardSelectorLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  boardPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  boardPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.light,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  boardPillSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  boardPillText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  boardPillTextSelected: {
    color: theme.colors.white,
  },
  noBoardsText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});

export default AddMusicScreen;
