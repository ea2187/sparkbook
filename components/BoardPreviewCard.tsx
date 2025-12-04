import React, { FC } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';

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
  onPress: () => void;
  onLongPress?: () => void;
  onMenuPress?: () => void;
}

const BoardPreviewCard: FC<BoardPreviewCardProps> = ({
  title,
  previewImages = [],
  previewItems = [],
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

      {/* Board title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

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
    height: 60,
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingRight: 8,
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
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
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    lineHeight: 10,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginTop: 4,
    paddingRight: 30,
  },
  menuIcon: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
});

export default BoardPreviewCard;
