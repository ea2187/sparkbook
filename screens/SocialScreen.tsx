import React, { FC, useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';
import { fetchCommunityFeed, CommunityPost } from '../lib/fetchCommunityFeed';
import { COMMUNITY_USER_LOOKUP } from '../lib/communityUsers';

const SocialScreen: FC = () => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    setLoading(true);
    const data = await fetchCommunityFeed();
    setPosts(data);
    setLoading(false);
  }

  function getUserInfo(userId: string) {
    return COMMUNITY_USER_LOOKUP[userId] || { name: 'Community member', initial: '?' };
  }

  function toggleSavePost(postId: string) {
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

  function isPostSaved(postId: string): boolean {
    return savedPosts.has(postId);
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
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
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
    const sparkAttachments = post.attachments.filter(a => a.media_type === 'spark');

    return (
      <View style={styles.card}>
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
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
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
        <TouchableOpacity 
          style={styles.starButton}
          onPress={() => toggleSavePost(post.id)}
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
      default:
        return `${userInfo.name} shared something`;
    }
  }

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
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {posts.map((post) => {
          const userInfo = getUserInfo(post.user_id);
          
          return (
            <View key={post.id} style={styles.postContainer}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{userInfo.initial}</Text>
                </View>
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
              </View>
              
              {renderPostCard(post)}
            </View>
          );
        })}

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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  postContainer: {
    marginBottom: theme.spacing.lg,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
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
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
    position: 'relative',
    minHeight: 140,
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
  sparkletteScroll: {
    marginBottom: theme.spacing.sm,
  },
  sparkletteTile: {
    width: 80,
    height: 80,
    marginRight: theme.spacing.sm,
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
