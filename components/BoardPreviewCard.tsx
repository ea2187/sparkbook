import React, { FC } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import theme from '../styles/theme';

// Placeholder images for empty boards
const PLACEHOLDER_IMAGES = [
  'https://via.placeholder.com/60/919FD5/FFFFFF?text=1',
  'https://via.placeholder.com/60/336BC8/FFFFFF?text=2',
  'https://via.placeholder.com/60/D4A518/FFFFFF?text=3',
  'https://via.placeholder.com/60/E8EFFF/666666?text=4',
];

interface BoardPreviewCardProps {
  title: string;
  previewImages?: string[];
  onPress: () => void;
  onLongPress?: () => void;
}

const BoardPreviewCard: FC<BoardPreviewCardProps> = ({
  title,
  previewImages = [],
  onPress,
  onLongPress,
}) => {
  // Use provided images or fallback to placeholders
  const displayImages = previewImages.length > 0 
    ? previewImages.slice(0, 4) 
    : PLACEHOLDER_IMAGES;

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Preview thumbnails row */}
      <View style={styles.previewRow}>
        {displayImages.map((imageUrl, index) => (
          <View key={index} style={styles.thumbnailContainer}>
            <Image 
              source={{ uri: imageUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </View>
        ))}
      </View>

      {/* Divider line */}
      <View style={styles.divider} />

      {/* Board title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
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
  },
  previewRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
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
  },
});

export default BoardPreviewCard;
