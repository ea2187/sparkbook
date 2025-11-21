import React, { FC } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Board } from '../types';
import theme from '../styles/theme';

interface BoardCardProps {
  board: Board;
  onPress: () => void;
}

const BoardCard: FC<BoardCardProps> = ({ board, onPress }) => {
  const thumbnails = board.thumbnail_urls || [];
  const displayThumbnails = thumbnails.slice(0, 5);

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      {/* Thumbnail Preview Strip */}
      <View style={styles.thumbnailStrip}>
        {displayThumbnails.length > 0 ? (
          displayThumbnails.map((url, index) => (
            <View key={index} style={styles.thumbnailWrapper}>
              <Image 
                source={{ uri: url }} 
                style={styles.thumbnail}
                resizeMode="cover"
              />
            </View>
          ))
        ) : (
          // Empty state - show placeholder boxes
          <>
            <View style={[styles.thumbnailWrapper, styles.thumbnailPlaceholder]} />
            <View style={[styles.thumbnailWrapper, styles.thumbnailPlaceholder]} />
            <View style={[styles.thumbnailWrapper, styles.thumbnailPlaceholder]} />
            <View style={[styles.thumbnailWrapper, styles.thumbnailPlaceholder]} />
          </>
        )}
      </View>

      {/* Board Title */}
      <Text style={styles.boardTitle} numberOfLines={1}>
        {board.name}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  thumbnailStrip: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    height: 80,
  },
  thumbnailWrapper: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    backgroundColor: theme.colors.light,
  },
  boardTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,

  },
});

export default BoardCard;
