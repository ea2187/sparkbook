import React, { FC, useEffect, useState, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import theme from '../styles/theme';
import { supabase } from '../lib/supabase';
import { CommunityPost } from '../lib/fetchCommunityFeed';
import type { HomeStackParamList } from '../types';

type ProfileScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'Profile'>;

const ProfileScreen: FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ firstName: string; lastName: string; username?: string; profilePicture?: string } | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      loadUserPosts();
    }, [])
  );

  // Refresh when screen comes into focus (e.g., after editing profile)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });
    return unsubscribe;
  }, [navigation]);

  async function loadUserData() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      
      // Get user data from authentication metadata
      if (currentUser) {
        const metadata = currentUser.user_metadata || {};
        setUserProfile({
          firstName: metadata.first_name || metadata.firstName || '',
          lastName: metadata.last_name || metadata.lastName || '',
          username: metadata.username || '',
          profilePicture: metadata.profile_picture || metadata.profilePicture || '',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  async function loadUserPosts() {
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('community_posts')
        .select(
          `
          id,
          user_id,
          type,
          caption,
          created_at,
          attachments:community_attachments(
            id,
            post_id,
            spark_id,
            title,
            subtitle,
            image_url,
            spotify_url,
            media_type,
            created_at
          )
        `
        )
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user posts:', error);
        Alert.alert('Error', 'Failed to load your posts');
        setLoading(false);
        return;
      }

      setPosts((data as CommunityPost[]) || []);
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadUserPosts();
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: '2-digit' });
    const day = date.toLocaleDateString('en-US', { day: '2-digit' });
    const year = date.toLocaleDateString('en-US', { year: '2-digit' });
    return `${month}/${day}/${year}`;
  }

  function renderPostCard(post: CommunityPost) {
    switch (post.type) {
      case 'music':
        return renderMusicCard(post);
      case 'sparklette':
        return renderSparkletteCard(post);
      case 'image':
        return renderImageCard(post);
      case 'note':
        return renderNoteCard(post);
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
      <View style={styles.cardContent}>
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
    );
  }

  function renderSparkletteCard(post: CommunityPost) {
    const sparkAttachments = post.attachments.filter(a => a.media_type === 'spark');
    const title = post.attachments[0]?.title || 'Untitled Sparklette';

    return (
      <View style={styles.cardContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sparkletteScroll}>
          {sparkAttachments.map((attachment) => (
            <View key={attachment.id} style={styles.sparkletteTile}>
              {attachment.image_url ? (
                <Image source={{ uri: attachment.image_url }} style={styles.sparkletteImage} />
              ) : (
                <View style={styles.sparklettePlaceholder}>
                  <Ionicons name="sparkles" size={24} color={theme.colors.textLight} />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderImageCard(post: CommunityPost) {
    const attachment = post.attachments[0];
    if (!attachment?.image_url) return null;

    return (
      <View style={styles.cardContent}>
        <Image source={{ uri: attachment.image_url }} style={styles.postImage} />
        {post.caption && (
          <Text style={styles.imageCaption}>{post.caption}</Text>
        )}
      </View>
    );
  }

  function renderNoteCard(post: CommunityPost) {
    const attachment = post.attachments[0];

    return (
      <View style={styles.cardContent}>
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
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '?';
    if (userProfile?.firstName && userProfile?.lastName) {
      return (userProfile.firstName[0] + userProfile.lastName[0]).toUpperCase();
    }
    const email = user.email || '';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0]?.toUpperCase() || '?';
  };

  const getUsername = () => {
    if (userProfile?.username) {
      return userProfile.username;
    }
    if (!user) return 'User';
    const email = user.email || '';
    return email.split('@')[0];
  };

  const getFullName = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`;
    }
    if (userProfile?.firstName) {
      return userProfile.firstName;
    }
    if (userProfile?.lastName) {
      return userProfile.lastName;
    }
    return user?.email || 'User';
  };

  return (
    <View style={styles.container}>
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
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.profilePictureContainer}>
            {userProfile?.profilePicture ? (
              <Image
                source={{ uri: userProfile.profilePicture }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={styles.profilePicture}>
                <Text style={styles.profilePictureText}>{getUserInitials()}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{getUsername()}</Text>
            <Text style={styles.realName}>{getFullName()}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Your Shared Works Section */}
        <View style={styles.sharedWorksSection}>
          <Text style={styles.sharedWorksTitle}>Your Shared Works</Text>
          <View style={styles.sectionDivider} />

          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="share-outline" size={64} color={theme.colors.textLight} />
              <Text style={styles.emptyStateText}>No shared works yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Share your Sparklettes to see them here
              </Text>
            </View>
          ) : (
            posts.map((post) => {
              const title = post.attachments[0]?.title || 
                           (post.type === 'sparklette' ? 'Untitled Sparklette' :
                            post.type === 'image' ? 'Image' :
                            post.type === 'music' ? 'Music' : 'Note');

              return (
                <View key={post.id} style={styles.postCard}>
                  {renderPostCard(post)}
                  <View style={styles.postCardFooter}>
                    <View style={styles.postCardInfo}>
                      <Text style={styles.postCardTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.postCardDate}>Posted {formatDate(post.created_at)}</Text>
                    </View>
                    <TouchableOpacity style={styles.menuButton}>
                      <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollContent: {
    paddingBottom: 100,
    backgroundColor: theme.colors.white,
  },
  profileHeader: {
    backgroundColor: theme.colors.white,
    paddingTop: 70,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 70,
    left: theme.spacing.lg,
    padding: 8,
    zIndex: 10,
  },
  backButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  profilePictureContainer: {
    marginRight: theme.spacing.md,
    marginLeft: 40, // Space for back button
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profilePictureText: {
    fontSize: 48,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.white,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontSize: theme.typography.fontSize.xxxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  realName: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  editButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 50,
    borderRadius: 20,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  editButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
    textAlign: 'center',
  },
  sharedWorksSection: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: theme.colors.secondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sharedWorksTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  postCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  postCardInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  postCardTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  postCardDate: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  menuButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    tintColor: theme.colors.textLight,
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  // Post content styles (reused from SocialScreen)
  albumArt: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
  },
  musicInfo: {
    marginTop: theme.spacing.sm,
  },
  trackTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  artistName: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  sparkletteScroll: {
    marginVertical: -theme.spacing.md,
  },
  sparkletteTile: {
    width: 120,
    height: 120,
    marginRight: theme.spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  sparkletteImage: {
    width: '100%',
    height: '100%',
  },
  sparklettePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
  },
  imageCaption: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  noteContent: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
  },
  noteTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  notePreview: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

export default ProfileScreen;

