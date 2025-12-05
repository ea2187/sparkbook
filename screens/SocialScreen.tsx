import React, { FC, useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import theme from '../styles/theme';
import { fetchCommunityFeed, CommunityPost } from '../lib/fetchCommunityFeed';
import { COMMUNITY_USER_LOOKUP } from '../lib/communityUsers';
import { supabase } from '../lib/supabase';
import type { RootTabParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SocialScreen: FC = () => {
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [userCache, setUserCache] = useState<Record<string, { name: string; initial: string; profilePicture?: string }>>({});
  const [showBoardSelectModal, setShowBoardSelectModal] = useState(false);
  const [selectedPostForSave, setSelectedPostForSave] = useState<CommunityPost | null>(null);
  const [userBoards, setUserBoards] = useState<any[]>([]);
  const [savingToBoard, setSavingToBoard] = useState(false);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedBoardNames, setAddedBoardNames] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: { sound: Audio.Sound; isPlaying: boolean; position: number; duration: number } }>({});
  const [loadingAudio, setLoadingAudio] = useState<{ [key: string]: boolean }>({});
  const soundRefs = useRef<{ [key: string]: Audio.Sound }>({});

  useEffect(() => {
    loadFeed();
    getCurrentUser();
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(soundRefs.current).forEach(async (sound) => {
        try {
          await sound.unloadAsync();
        } catch (error) {
          console.error('Error unloading audio:', error);
        }
      });
    };
  }, []);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function handleDeletePost(postId: string) {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete attachments first
              const { error: attachError } = await supabase
                .from('community_attachments')
                .delete()
                .eq('post_id', postId);

              if (attachError) throw attachError;

              // Delete the post
              const { error: postError } = await supabase
                .from('community_posts')
                .delete()
                .eq('id', postId);

              if (postError) throw postError;

              // Update UI
              setPosts(prev => prev.filter(p => p.id !== postId));
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  }

  async function loadFeed() {
    setLoading(true);
    const data = await fetchCommunityFeed();
    setPosts(data);
    
    // Fetch user info for all unique user IDs
    const uniqueUserIds = [...new Set(data.map(post => post.user_id))];
    await Promise.all(uniqueUserIds.map(userId => fetchUserInfo(userId)));
    
    setLoading(false);
  }

  async function fetchUserInfo(userId: string) {
    // Check cache first; if we already have a profile picture, return immediately.
    // But if cached entry exists without profilePicture, still refetch to get it
    const cached = userCache[userId];
    if (cached && cached.profilePicture) {
      return cached;
    }

    // Check static lookup table first (for usernames)
    if (COMMUNITY_USER_LOOKUP[userId]) {
      const lookupInfo = COMMUNITY_USER_LOOKUP[userId];
      
      // Try to fetch from profiles table for profile picture only
      try {
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_initial, profile_picture')
          .eq('id', userId)
          .single();

        if (!error && profile) {
          // Always use lookup table name for users in lookup, but use profile username if it exists and is different
          // For users in lookup table, prioritize lookup name to ensure consistency
          let name = lookupInfo.name; // Always use lookup name for users in lookup table
          // Replace "Jonathan" with "jontheartist" if it appears
          if (name === "Jonathan") {
            name = "jontheartist";
          }
          let profilePicture = (profile as any).profile_picture || null;
          // If missing, try auth metadata for current user
          if (!profilePicture) {
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser && currentUser.id === userId) {
                const metaPic = currentUser.user_metadata?.profile_picture || currentUser.user_metadata?.profilePicture || null;
                if (metaPic) {
                  profilePicture = metaPic;
                }
              }
            } catch (e) {
              // ignore auth metadata fallback failure
            }
          }
          const userInfo = { 
            name: name, 
            initial: lookupInfo.initial, 
            profilePicture: profilePicture || undefined
          };
          setUserCache(prev => ({ ...prev, [userId]: userInfo }));
          return userInfo;
        }
      } catch (profileError) {
        // If profiles table doesn't exist or has error, use lookup
      }
      
      // Use lookup table info, but replace "Jonathan" with "jontheartist"
      let name = lookupInfo.name;
      if (name === "Jonathan") {
        name = "jontheartist";
      }
      const userInfo = { name, initial: lookupInfo.initial };
      setUserCache(prev => ({ ...prev, [userId]: userInfo }));
      return userInfo;
    }

    // Try to fetch from profiles table if not in lookup
    try {
      // First attempt: schema with full_name + avatar_initial (+ username, profile_picture)
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_initial, profile_picture')
        .eq('id', userId)
        .single();

      // If the column doesn't exist (older schema), retry with first_name/last_name
      if (error && error.code === '42703') {
        const fallbackColumns = 'username, first_name, last_name, profile_picture';
        const { data: profileFallback, error: fallbackError } = await supabase
          .from('profiles')
          .select(fallbackColumns)
          .eq('id', userId)
          .single();

        if (!fallbackError && profileFallback) {
          const firstName = (profileFallback as any).first_name || '';
          const lastName = (profileFallback as any).last_name || '';
          const username = (profileFallback as any).username || '';
          let name = username || [firstName, lastName].filter(Boolean).join(' ').trim();
          let initial = '?';
          if (firstName) {
            initial = firstName.charAt(0).toUpperCase();
          } else if (username) {
            initial = username.charAt(0).toUpperCase();
          }
          if (name === "Jonathan") name = "jontheartist";
          if (!name) name = 'Community member';
          let profilePicture = (profileFallback as any).profile_picture || null;
          // If missing and this is the current user, try auth metadata
          if (!profilePicture) {
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser && currentUser.id === userId) {
                const metaPic = currentUser.user_metadata?.profile_picture || currentUser.user_metadata?.profilePicture || null;
                if (metaPic) {
                  profilePicture = metaPic;
                }
              }
            } catch (e) {
              // ignore auth metadata fallback failure
            }
          }

          const userInfo = {
            name,
            initial,
            profilePicture: profilePicture || undefined,
          };
          setUserCache(prev => ({ ...prev, [userId]: { ...prev[userId], ...userInfo } }));
          return userInfo;
        }
      }

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist - it should be created by trigger, but if not, use fallback
          // Profile missing
        } else if (error.code === '42501') {
          // Permission denied - RLS issue
          console.error('RLS Permission denied for profiles table:', error.message);
        } else {
          console.error('Error fetching profile:', error.code, error.message);
        }
      }

      if (!error && profile) {
        // Prioritize username, then full_name
        const username = (profile as any).username || '';
        const fullName = (profile as any).full_name || '';
        let name = username || fullName; // Show username first, fallback to full_name
        const initial = (profile as any).avatar_initial || (name ? name.charAt(0).toUpperCase() : '?');
        
        // Replace "Jonathan" with "jontheartist" if it appears
        if (name === "Jonathan") {
          name = "jontheartist";
        }
        if (!name) {
          name = 'Community member';
        }

        let profilePicture = (profile as any).profile_picture || null;
        // If missing, try auth metadata for current user
        if (!profilePicture) {
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser && currentUser.id === userId) {
              const metaPic = currentUser.user_metadata?.profile_picture || currentUser.user_metadata?.profilePicture || null;
              if (metaPic) {
                profilePicture = metaPic;
              }
            }
          } catch (e) {
            // ignore auth metadata fallback failure
          }
        }
        const userInfo = { 
          name, 
          initial, 
          profilePicture: profilePicture || undefined
        };
        setUserCache(prev => ({ ...prev, [userId]: { ...prev[userId], ...userInfo } }));
        return userInfo;
      }
    } catch (profileError) {
      // Profiles table might not exist, try auth metadata for current user
      console.error('Exception fetching profile:', profileError);
    }

    // Try to get current user's info if it matches (fallback)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.id === userId) {
        const metadata = currentUser.user_metadata || {};
        const firstName = metadata.first_name || metadata.firstName || '';
        const lastName = metadata.last_name || metadata.lastName || '';
        const username = metadata.username || '';
        
        let name = username;
        if (!name && (firstName || lastName)) {
          name = `${firstName} ${lastName}`.trim();
        }
        if (!name && currentUser.email) {
          name = currentUser.email.split('@')[0];
        }
        // Replace "Jonathan" with "jontheartist" if it appears
        if (name === "Jonathan") {
          name = "jontheartist";
        }
        if (!name) {
          name = 'Community member';
        }

        let initial = '?';
        if (firstName) {
          initial = firstName.charAt(0).toUpperCase();
        } else if (username) {
          initial = username.charAt(0).toUpperCase();
        } else if (currentUser.email) {
          initial = currentUser.email.charAt(0).toUpperCase();
        }

        const profilePicture = metadata.profile_picture || metadata.profilePicture;
        const userInfo = { name, initial, profilePicture };
        setUserCache(prev => ({ ...prev, [userId]: { ...prev[userId], ...userInfo } }));
        return userInfo;
      }
    } catch (error) {
      console.error('Error fetching current user info:', error);
    }

    // Fallback
    const fallback = { name: 'Community member', initial: '?', profilePicture: undefined as string | undefined };
    setUserCache(prev => ({ ...prev, [userId]: { ...prev[userId], ...fallback } }));
    return fallback;
  }

  async function onRefresh() {
    setRefreshing(true);
    const data = await fetchCommunityFeed();
    setPosts(data);
    
    // Fetch user info for all unique user IDs
    const uniqueUserIds = [...new Set(data.map(post => post.user_id))];
    await Promise.all(uniqueUserIds.map(userId => fetchUserInfo(userId)));
    
    setRefreshing(false);
  }

  function getUserInfo(userId: string): { name: string; initial: string; profilePicture?: string } {
    // Check cache first
    if (userCache[userId]) {
      return userCache[userId];
    }

    // Check static lookup table
    if (COMMUNITY_USER_LOOKUP[userId]) {
      return COMMUNITY_USER_LOOKUP[userId];
    }

    // Fallback
    return { name: 'Community member', initial: '?' };
  }

  async function toggleSavePost(postId: string) {
    // If it's a sparklette or image, show board selection modal
    const post = posts.find(p => p.id === postId);
    if (post && (post.type === 'sparklette' || post.type === 'image')) {
      setSelectedPostForSave(post);
      setSelectedBoardIds(new Set()); // Reset selection - start with no boards selected
      await fetchUserBoards();
      setShowBoardSelectModal(true);
    } else {
      // For other post types, just toggle saved state
      setSavedPosts(prev => {
        const newSaved = new Set(prev);
        if (newSaved.has(postId)) {
          newSaved.delete(postId);
        } else {
          newSaved.add(postId);
        }
        return newSaved;
      });
    }
  }

  function toggleBoardSelection(boardId: string) {
    setSelectedBoardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(boardId)) {
        newSet.delete(boardId);
      } else {
        newSet.add(boardId);
      }
      return newSet;
    });
  }

  async function fetchUserBoards() {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        return;
      }

      setUserBoards(data || []);
    } catch (error) {
      console.error('Error fetching boards:', error);
    }
  }

  async function saveSparkletteToBoards() {
    if (!selectedPostForSave || selectedBoardIds.size === 0) return;

    setSavingToBoard(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save sparklettes');
        return;
      }

      // Get creator info for attribution
      const creatorInfo = getUserInfo(selectedPostForSave.user_id);

      // Calculate spawn position
      const centerX = (SCREEN_WIDTH * 5) / 2;
      const centerY = (SCREEN_HEIGHT * 5) / 2;
      const x = centerX + (Math.random() * 200 - 100);
      const y = centerY + (Math.random() * 200 - 100);

      // Save sparklette as a single preview item
      // Store post data and attachments in metadata
      const sparkletteMetadata = JSON.stringify({
        isSavedSparklette: true,
        post_id: selectedPostForSave.id,
        caption: selectedPostForSave.caption,
        creator_id: selectedPostForSave.user_id,
        creator_name: creatorInfo.name,
        attachments: selectedPostForSave.attachments,
      });

      // Save to all selected boards
      await Promise.all(
        Array.from(selectedBoardIds).map(boardId =>
          supabase.from('sparks').insert({
            board_id: boardId,
            user_id: user.id,
            type: 'note', // Use note type but with special metadata
            title: `Sparklette by ${creatorInfo.name}`,
            text_content: sparkletteMetadata,
            x,
            y,
            width: 300,
            height: 200,
          })
        )
      );

      // Get board names for success message
      const addedBoards = userBoards.filter(board => selectedBoardIds.has(board.id));
      const boardNames = addedBoards.map(board => board.name);

      setShowBoardSelectModal(false);
      
      if (selectedBoardIds.size === 1) {
        // Single board: navigate to that board
        const boardId = Array.from(selectedBoardIds)[0];
        setSelectedPostForSave(null);
        setSelectedBoardIds(new Set());
        (navigation as any).navigate('Home', { screen: 'Board', params: { boardId } });
      } else {
        // Multiple boards: show success message then go home
        setAddedBoardNames(boardNames);
        setShowSuccessModal(true);
        setSelectedPostForSave(null);
        setSelectedBoardIds(new Set());
        // Auto-dismiss after 2 seconds and navigate home
        setTimeout(() => {
          setShowSuccessModal(false);
          (navigation as any).navigate('Home');
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving sparklette:', error);
      Alert.alert('Error', 'Failed to save sparklette to board');
    } finally {
      setSavingToBoard(false);
    }
  }

  async function saveImageToBoards() {
    if (!selectedPostForSave || selectedBoardIds.size === 0) return;
    const attachment = selectedPostForSave.attachments[0];
    if (!attachment?.image_url) return;

    setSavingToBoard(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save images');
        return;
      }

      // Get creator info for attribution
      const creatorInfo = getUserInfo(selectedPostForSave.user_id);

      // Calculate spawn position
      const centerX = (SCREEN_WIDTH * 5) / 2;
      const centerY = (SCREEN_HEIGHT * 5) / 2;
      const x = centerX + (Math.random() * 200 - 100);
      const y = centerY + (Math.random() * 200 - 100);

      // Store creator attribution in metadata
      const attributionMetadata = JSON.stringify({
        original_creator_id: selectedPostForSave.user_id,
        original_creator_name: creatorInfo.name,
        is_saved_from_community: true,
      });

      // Save to all selected boards
      await Promise.all(
        Array.from(selectedBoardIds).map(boardId =>
          supabase.from('sparks').insert({
            board_id: boardId,
            user_id: user.id,
            type: 'image',
            content_url: attachment.image_url,
            title: attachment.title || null,
            text_content: attributionMetadata, // Store attribution in text_content
            x,
            y,
            width: 200,
            height: 200,
          })
        )
      );

      // Get board names for success message
      const addedBoards = userBoards.filter(board => selectedBoardIds.has(board.id));
      const boardNames = addedBoards.map(board => board.name);

      setShowBoardSelectModal(false);
      
      if (selectedBoardIds.size === 1) {
        // Single board: navigate to that board
        const boardId = Array.from(selectedBoardIds)[0];
        setSelectedPostForSave(null);
        setSelectedBoardIds(new Set());
        (navigation as any).navigate('Home', { screen: 'Board', params: { boardId } });
      } else {
        // Multiple boards: show success message then go home
        setAddedBoardNames(boardNames);
        setShowSuccessModal(true);
        setSelectedPostForSave(null);
        setSelectedBoardIds(new Set());
        // Auto-dismiss after 2 seconds and navigate home
        setTimeout(() => {
          setShowSuccessModal(false);
          (navigation as any).navigate('Home');
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image to board');
    } finally {
      setSavingToBoard(false);
    }
  }

  function isPostSaved(postId: string): boolean {
    return savedPosts.has(postId);
  }

  function renderPostCard(post: CommunityPost) {
    // Check if it's a single spark with audio_url (voice recording) FIRST
    if (post.attachments.length === 1 && post.attachments[0].audio_url) {
      return renderAudioCard(post);
    }

    switch (post.type) {
      case 'music':
        return renderMusicCard(post);
      case 'sparklette':
        return renderSparkletteCard(post);
      case 'image':
        return renderImageCard(post);
      case 'note':
        return renderNoteCard(post);
      case 'audio':
        return renderAudioCard(post);
      default:
        return null;
    }
  }

  function renderMusicCard(post: CommunityPost) {
    const attachment = post.attachments[0];
    if (!attachment) return null;

    const handleMusicPress = async () => {
      if (attachment.spotify_url) {
        try {
          const canOpen = await Linking.canOpenURL(attachment.spotify_url);
          if (canOpen) {
            await Linking.openURL(attachment.spotify_url);
          } else {
            Alert.alert('Error', 'Cannot open Spotify link');
          }
        } catch (error) {
          console.error('Error opening Spotify:', error);
          Alert.alert('Error', 'Could not open Spotify');
        }
      }
    };

    return (
      <View style={styles.card}>
        <View style={styles.musicContent}>
          {attachment.image_url && (
            <TouchableOpacity onPress={handleMusicPress} activeOpacity={0.7}>
              <Image source={{ uri: attachment.image_url }} style={styles.albumArt} />
            </TouchableOpacity>
          )}
          <View style={styles.musicInfo}>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {attachment.title || 'Unknown Track'}
            </Text>
            {attachment.subtitle && (
              <Text style={styles.artistName} numberOfLines={1}>
                {attachment.subtitle}
              </Text>
            )}
          </View>
        </View>
        {post.caption && (
          <Text style={styles.imageCaption}>{post.caption}</Text>
        )}
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isPostSaved(post.id) ? "star" : "star-outline"} 
            size={20} 
            color={theme.colors.secondary} 
          />
        </TouchableOpacity>
      </View>
    );
  }

  function renderSparkletteCard(post: CommunityPost) {
    // Show all attachments for sparklettes (not just those with media_type === 'spark')
    const sparkAttachments = post.attachments;

    return (
      <View style={styles.card}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.sparkletteScroll}
          contentContainerStyle={styles.sparkletteScrollContent}
        >
          {sparkAttachments.map((attachment) => {
            // Show image/album art if available (for images or music with album art)
            if (attachment.image_url && (attachment.media_type === "image" || attachment.media_type === "music")) {
              return (
                <View key={attachment.id} style={styles.sparkletteTile}>
                  <Image source={{ uri: attachment.image_url }} style={styles.sparkletteImage} />
                </View>
              );
            }
            
            // Show note text if it's a note
            if (attachment.media_type === "note" && attachment.subtitle) {
              return (
                <View key={attachment.id} style={styles.sparkletteTile}>
                  <View style={styles.sparklettePlaceholder}>
                    <View style={styles.sparkletteNotePreview}>
                      <Text style={styles.sparkletteNoteText} numberOfLines={2}>
                        {attachment.subtitle}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }
            
            // Show icon placeholder based on media type
            let iconName: "sparkles" | "document-text" | "musical-notes" | "image-outline" | "play-circle" = "sparkles";
            if (attachment.media_type === "note") {
              iconName = "document-text";
            } else if (attachment.media_type === "music") {
              iconName = "musical-notes";
            } else if (attachment.media_type === "image") {
              iconName = "image-outline";
            } else if (attachment.media_type === "spark" && !attachment.image_url) {
              // Audio sparks are marked as "spark" but don't have image_url - show play button
              iconName = "play-circle";
            }
            
            return (
              <View key={attachment.id} style={styles.sparkletteTile}>
                <View style={styles.sparklettePlaceholder}>
                  <Ionicons name={iconName} size={24} color={theme.colors.textLight} />
                </View>
              </View>
            );
          })}
        </ScrollView>
        {post.caption && (
          <Text style={styles.imageCaption}>{post.caption}</Text>
        )}
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isPostSaved(post.id) ? "star" : "star-outline"} 
            size={20} 
            color={theme.colors.secondary} 
          />
        </TouchableOpacity>
      </View>
    );
  }

  function renderImageCard(post: CommunityPost) {
    const attachment = post.attachments[0];
    if (!attachment?.image_url) return null;

    return (
      <View style={styles.card}>
        <Image source={{ uri: attachment.image_url }} style={styles.postImage} />
        {post.caption && (
          <Text style={styles.imageCaption}>{post.caption}</Text>
        )}
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isPostSaved(post.id) ? "star" : "star-outline"} 
            size={20} 
            color={theme.colors.secondary} 
          />
        </TouchableOpacity>
      </View>
    );
  }

  function renderNoteCard(post: CommunityPost) {
    const attachment = post.attachments[0];

    return (
      <View style={styles.card}>
        <View style={styles.noteContent}>
          <Ionicons name="document-text" size={32} color={theme.colors.primary} />
          {attachment?.title && (
            <Text style={styles.noteTitle} numberOfLines={2}>
              {attachment.title}
            </Text>
          )}
          {attachment?.subtitle && (
            <Text style={styles.notePreview} numberOfLines={3}>
              {attachment.subtitle}
            </Text>
          )}
        </View>
        {post.caption && (
          <Text style={styles.imageCaption}>{post.caption}</Text>
        )}
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isPostSaved(post.id) ? "star" : "star-outline"} 
            size={20} 
            color={theme.colors.secondary} 
          />
        </TouchableOpacity>
      </View>
    );
  }

  async function handleAudioPlayback(postId: string, audioUrl: string) {
    try {
      
      // If loading, prevent multiple clicks
      if (loadingAudio[postId]) {
        return;
      }

      const existingSound = soundRefs.current[postId];

      // If this audio is already loaded, toggle play/pause
      if (existingSound) {
        const status = await existingSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            // pause
            await existingSound.pauseAsync();
            setPlayingAudio(prev => ({
              ...prev,
              [postId]: { ...prev[postId], isPlaying: false }
            }));
          } else {
            // resume
            await existingSound.playAsync();
            setPlayingAudio(prev => ({
              ...prev,
              [postId]: { ...prev[postId], isPlaying: true }
            }));
          }
          return;
        }
      }


      // Show loading state
      setLoadingAudio(prev => ({ ...prev, [postId]: true }));

      // Stop any other playing audio
      for (const [id, otherSound] of Object.entries(soundRefs.current)) {
        if (id !== postId) {
          const status = await otherSound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await otherSound.pauseAsync();
          }
        }
      }

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Load and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      const initialStatus = await sound.getStatusAsync();

      if (!initialStatus.isLoaded) {
        throw new Error('Sound failed to load');
      }

      // Store the sound in ref
      soundRefs.current[postId] = sound;

      // Store the sound object in state for UI
      setPlayingAudio(prev => ({
        ...prev,
        [postId]: { 
          sound, 
          isPlaying: initialStatus.isPlaying,
          position: 0,
          duration: initialStatus.durationMillis || 0
        }
      }));

      // Then set up the playback status callback
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            // Reset to play icon when finished
            setPlayingAudio(prev => {
              if (!prev[postId]?.sound) return prev;
              return {
                ...prev,
                [postId]: { ...prev[postId], isPlaying: false, position: 0 }
              };
            });
          } else {
            // Update playback state
            setPlayingAudio(prev => {
              if (!prev[postId]?.sound) return prev;
              return {
                ...prev,
                [postId]: {
                  ...prev[postId],
                  isPlaying: status.isPlaying,
                  position: status.positionMillis || 0,
                  duration: status.durationMillis || 0
                }
              };
            });
          }
        }
      });


      // Clear loading state
      setLoadingAudio(prev => ({ ...prev, [postId]: false }));
    } catch (error) {
      console.error('Error playing audio:', error);
      setLoadingAudio(prev => ({ ...prev, [postId]: false }));
      Alert.alert('Playback Error', 'Unable to play this audio recording. Please try again.');
    }
  }

  function formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function renderAudioCard(post: CommunityPost) {
    const attachment = post.attachments[0];
    const audioState = playingAudio[post.id];
    const isPlaying = audioState?.isPlaying || false;
    const isLoading = loadingAudio[post.id] || false;
    const position = audioState?.position || 0;
    const duration = audioState?.duration || 0;
    const progress = duration > 0 ? position / duration : 0;


    return (
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.audioContentMain}
          onPress={() => {
            // audio card press
            if (attachment?.audio_url && !isLoading) {
              handleAudioPlayback(post.id, attachment.audio_url);
            }
          }}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <View style={[styles.audioIconContainerLarge, isPlaying && styles.audioIconPlaying]}>
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.colors.white} />
            ) : (
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={48} 
                color={theme.colors.white} 
              />
            )}
          </View>
          <View style={styles.audioInfoMain}>
            <Ionicons name="mic" size={24} color={theme.colors.primary} style={{ marginBottom: 8 }} />
            {attachment?.title && (
              <Text style={styles.audioTitle} numberOfLines={2}>
                {attachment.title}
              </Text>
            )}
            <Text style={styles.audioSubtitle}>
              {attachment?.subtitle || 'Audio recording'}
            </Text>
            {duration > 0 && (
              <Text style={styles.audioTime}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {duration > 0 && (
          <View style={styles.audioProgressContainer}>
            <View style={styles.audioProgressBar}>
              <View style={[styles.audioProgressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        )}
        {post.caption && (
          <Text style={styles.imageCaption}>{post.caption}</Text>
        )}
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isPostSaved(post.id) ? "star" : "star-outline"} 
            size={20} 
            color={theme.colors.secondary} 
          />
        </TouchableOpacity>
      </View>
    );
  }

  function getPostDescription(post: CommunityPost) {
    const userInfo = getUserInfo(post.user_id);
    
    // Check if it's audio first (single attachment with audio_url)
    if (post.attachments.length === 1 && post.attachments[0].audio_url) {
      return `${userInfo.name} shared an audio recording`;
    }
    
    switch (post.type) {
      case 'music':
        return `${userInfo.name} is listening to`;
      case 'sparklette':
        const title = post.attachments[0]?.title || 'a collection';
        return `${userInfo.name} shared a Sparklette: ${title}`;
      case 'image':
        return `${userInfo.name} shared a photo`;
      case 'note':
        return `${userInfo.name} shared a note`;
      case 'audio':
        return `${userInfo.name} shared an audio recording`;
      default:
        return `${userInfo.name} shared something`;
    }
  }

  // Filter posts based on search query
  const filteredPosts = posts.filter(post => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const userInfo = getUserInfo(post.user_id);
    const userName = userInfo.name.toLowerCase();
    const userInitial = userInfo.initial.toLowerCase();
    const description = getPostDescription(post).toLowerCase();
    
    // Search by user name (exact match or partial)
    if (userName.includes(query) || userName === query) return true;
    
    // Search by user initial
    if (userInitial === query) return true;
    
    // Search by description
    if (description.includes(query)) return true;
    
    // Search by caption
    if (post.caption?.toLowerCase().includes(query)) return true;
    
    // Search by attachment titles/subtitles
    const hasMatchingAttachment = post.attachments.some(attachment => {
      const title = attachment.title?.toLowerCase() || '';
      const subtitle = attachment.subtitle?.toLowerCase() || '';
      return title.includes(query) || subtitle.includes(query);
    });
    
    return hasMatchingAttachment;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <Text style={styles.headerSubtitle}>
          See what's creating sparks in the community
        </Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, posts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {filteredPosts.map((post) => {
          const userInfo = getUserInfo(post.user_id);
          
          return (
            <View key={post.id} style={styles.postContainer}>
              <View style={styles.postHeader}>
                {userInfo.profilePicture && userInfo.profilePicture.trim() ? (
                  <Image source={{ uri: userInfo.profilePicture }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{userInfo.initial}</Text>
                  </View>
                )}
                <View style={styles.postHeaderText}>
                  <Text style={styles.postDescription}>{getPostDescription(post)}</Text>
                  <Text style={styles.postTime}>
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {currentUserId === post.user_id && (
                  <TouchableOpacity
                    style={styles.deletePostButton}
                    onPress={() => handleDeletePost(post.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
              
              {renderPostCard(post)}
            </View>
          );
        })}

        {filteredPosts.length === 0 && posts.length > 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyStateText}>No posts found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your search terms
            </Text>
          </View>
        )}

        {posts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyStateText}>No posts yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Check back later to see what the community is sharing
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Board Selection Modal */}
      <Modal
        visible={showBoardSelectModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowBoardSelectModal(false);
          setSelectedPostForSave(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => {
            setShowBoardSelectModal(false);
            setSelectedPostForSave(null);
          }}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Save to Board</Text>
              <Text style={styles.modalSubtitle}>
                {selectedBoardIds.size === 0 
                  ? "Select at least one board" 
                  : `${selectedBoardIds.size} board${selectedBoardIds.size > 1 ? 's' : ''} selected`}
              </Text>
              
              <ScrollView style={styles.boardsList} showsVerticalScrollIndicator={false}>
                {userBoards.length === 0 ? (
                  <View style={styles.emptyBoardsContainer}>
                    <Ionicons name="folder-outline" size={48} color={theme.colors.textLight} />
                    <Text style={styles.emptyBoardsText}>No boards available</Text>
                    <Text style={styles.emptyBoardsSubtext}>Create a board first to save sparklettes</Text>
                  </View>
                ) : (
                  userBoards.map((board) => {
                    const isSelected = selectedBoardIds.has(board.id);
                    return (
                      <TouchableOpacity
                        key={board.id}
                        style={[
                          styles.boardOption,
                          isSelected && styles.boardOptionSelected,
                        ]}
                        onPress={() => toggleBoardSelection(board.id)}
                        disabled={savingToBoard}
                      >
                        <Ionicons 
                          name={isSelected ? "checkbox" : "square-outline"} 
                          size={24} 
                          color={isSelected ? theme.colors.primary : theme.colors.textLight} 
                        />
                        <Text style={[
                          styles.boardOptionText,
                          isSelected && styles.boardOptionTextSelected,
                        ]}>
                          {board.name}
                        </Text>
                        {savingToBoard && isSelected && (
                          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowBoardSelectModal(false);
                    setSelectedPostForSave(null);
                    setSelectedBoardIds(new Set());
                  }}
                  disabled={savingToBoard}
                >
                  <Text style={[styles.modalButtonText, { color: theme.colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonSave,
                    (selectedBoardIds.size === 0 || savingToBoard) && styles.modalButtonDisabled,
                  ]}
                  onPress={() => {
                    if (selectedPostForSave?.type === 'image') {
                      saveImageToBoards();
                    } else {
                      saveSparkletteToBoards();
                    }
                  }}
                  disabled={selectedBoardIds.size === 0 || savingToBoard}
                >
                  {savingToBoard ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: theme.colors.white }]}>
                      Save to {selectedBoardIds.size > 0 ? `${selectedBoardIds.size} board${selectedBoardIds.size > 1 ? 's' : ''}` : 'board'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {selectedPostForSave && selectedPostForSave.type === 'image' && (
                <Text style={styles.attributionNote}>
                  Photo by {getUserInfo(selectedPostForSave.user_id).name}
                </Text>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success Modal for Multiple Boards */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          (navigation as any).navigate('Home');
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowSuccessModal(false);
          (navigation as any).navigate('Home');
        }}>
          <View style={styles.successModalOverlay}>
            <View style={styles.successModalContent}>
              <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              <Text style={styles.successModalTitle}>
                {selectedPostForSave?.type === 'image' ? 'Photo Added!' : 'Sparklette Added!'}
              </Text>
              <Text style={styles.successModalSubtitle}>
                Added to {addedBoardNames.length} board{addedBoardNames.length > 1 ? 's' : ''}:
              </Text>
              <View style={styles.successBoardList}>
                {addedBoardNames.map((name, index) => (
                  <Text key={index} style={styles.successBoardName}>
                    • {name}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
  },
  header: {
    backgroundColor: theme.colors.white,
    paddingTop: 60,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xxxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    marginTop: theme.spacing.sm,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    marginLeft: theme.spacing.xs,
    padding: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  postContainer: {
    marginBottom: theme.spacing.xl,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  avatarText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: theme.spacing.sm,
  },
  postHeaderText: {
    flex: 1,
  },
  postDescription: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  postTime: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textLight,
  },
  deletePostButton: {
    padding: 8,
    marginLeft: 8,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
    position: 'relative',
    minHeight: 100,
  },
  musicContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingRight: theme.spacing.xl,
  },
  albumArt: {
    width: 140,
    height: 140,
    borderRadius: theme.borderRadius.md,
  },
  musicInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  artistName: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  audioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  audioContentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
  },
  audioIconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.light,
    borderRadius: theme.borderRadius.md,
  },
  audioIconContainerLarge: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 40,
  },
  audioIconPlaying: {
    backgroundColor: theme.colors.secondary,
  },
  audioInfoMain: {
    flex: 1,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  audioSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  audioTime: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textLight,
  },
  audioProgressContainer: {
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 2,
  },
  audioProgressBar: {
    height: 4,
    backgroundColor: theme.colors.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.secondary,
    borderRadius: 2,
  },
  sparkletteScroll: {
    marginBottom: theme.spacing.xs,
  },
  sparkletteScrollContent: {
    paddingLeft: 0,
    paddingRight: theme.spacing.xl,
    gap: theme.spacing.md, // Add consistent spacing between tiles
  },
  sparkletteTile: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  sparkletteImage: {
    width: '100%',
    height: '100%',
  },
  sparklettePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkletteNotePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.light,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  sparkletteNoteText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    lineHeight: 10,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  boardsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  emptyBoardsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyBoardsText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: 12,
  },
  emptyBoardsSubtext: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.light,
    marginBottom: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  boardOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E8EFFF',
  },
  boardOptionText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  boardOptionTextSelected: {
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.light,
  },
  modalButtonSave: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  successModalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  successModalSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successBoardList: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  successBoardName: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  attributionNote: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  imageCaption: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
    paddingRight: theme.spacing.xl,
  },
  noteContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  noteTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  notePreview: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  starButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default SocialScreen;
