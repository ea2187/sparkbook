import React, { FC } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';
import { formatRelativeTime } from '../utils/formatRelativeTime';

interface PreviewItem {
  id: string;
  type: 'image' | 'note' | 'music' | 'audio';
  imageUrl: string | null;
  textContent?: string | null;
}

interface BoardPreviewCardProps {
  title: string;
  previewImages?: string[];
  previewItems?: PreviewItem[];
  lastModified?: Date | string | number | null;
  onPress: () => void;
  onLongPress?: () => void;
  onMenuPress?: () => void;
}

const BoardPreviewCard: FC<BoardPreviewCardProps> = ({
  title,
  previewImages = [],
  previewItems = [],
  lastModified,
  onPress,
  onLongPress,
  onMenuPress,
}) => {
  // Use previewItems if available, otherwise fallback to previewImages for backwards compatibility
  const displayItems = previewItems.length > 0 
    ? previewItems 
    : previewImages.map((url, index) => ({
        id: `img-${index}`,
        type: 'image' as const,
        imageUrl: url,
      }));

  const getIconName = (type: 'image' | 'note' | 'music' | 'audio'): "image-outline" | "document-text" | "musical-notes" | "play-circle" => {
    switch (type) {
      case 'note': return 'document-text';
      case 'music': return 'musical-notes';
      case 'audio': return 'play-circle';
      case 'image': return 'image-outline';
      default: return 'image-outline';
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Preview thumbnails row - scrollable */}
      <View style={styles.previewRowContainer}>
        {displayItems.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewRow}
            nestedScrollEnabled={true}
          >
            {displayItems.map((item) => (
              <View key={item.id} style={styles.thumbnailContainer}>
                {item.imageUrl ? (
                  <Image 
                    source={{ uri: item.imageUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    {item.type === 'note' && item.textContent ? (
                      <View style={styles.notePreview}>
                        <Text style={styles.noteText} numberOfLines={2}>
                          {item.textContent}
                        </Text>
                      </View>
                    ) : (
                      <Ionicons 
                        name={getIconName(item.type)} 
                        size={24} 
                        color={theme.colors.textLight} 
                      />
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          // Empty state - show placeholder
          <View style={styles.previewRow}>
            <View style={styles.thumbnailContainer}>
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="sparkles" size={24} color={theme.colors.textLight} />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Divider line */}
      <View style={styles.divider} />

      {/* Bottom section with title and menu */}
      <View style={styles.bottomSection}>
        <View style={styles.titleSection}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {lastModified && (
            <Text style={styles.lastModified}>
              Updated {formatRelativeTime(lastModified)}
            </Text>
          )}
        </View>

        {/* Three dots menu icon */}
        <TouchableOpacity 
          style={styles.menuIcon}
          onPress={(e) => {
            e.stopPropagation();
            onMenuPress?.();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
    position: 'relative',
    alignSelf: 'stretch',
    width: '100%',
  },
  previewRowContainer: {
    width: '100%',
    alignSelf: 'stretch',
    height: 90,
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingRight: 8,
  },
  thumbnailContainer: {
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.light,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  noteText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    lineHeight: 14,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginTop: 4,
    marginBottom: 8,
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    minHeight: 44,
  },
  titleSection: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  lastModified: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  menuIcon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
});

export default BoardPreviewCard;
