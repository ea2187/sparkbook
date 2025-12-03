import React, { useRef, useEffect, useState } from "react";
import {
  Image,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import theme from "../styles/theme";

type DraggableSparkProps = {
  spark: any;
  selected: boolean;
  onSelect: (id: string) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onTap?: (id: string) => void;
  onLongPress?: (id: string) => void;
};

export default function DraggableSpark({
  spark,
  selected,
  onSelect,
  onMoveEnd,
  onDragStart,
  onDragEnd,
  onTap,
  onLongPress,
}: DraggableSparkProps) {
  const isDraggingRef = useRef(false);
  const tapStartTime = useRef(0);
  const hasMoved = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isImage = spark.type === "image";
  const isNote = spark.type === "note";
  const isAudio = spark.type === "audio";
  
  // Check if this is a file (has mime type in text_content and title)
  const isFile = isImage && spark.text_content && 
    !spark.text_content.startsWith('{') && 
    spark.text_content.includes('/') && 
    spark.title;

  const position = useRef(
    new Animated.ValueXY({ x: spark.x, y: spark.y })
  ).current;

  const [size] = useState({
    width: spark.width || 160,
    height: spark.height || 160,
  });

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Only sync from props when not dragging
  useEffect(() => {
    if (isDraggingRef.current) return;
    position.setValue({ x: spark.x, y: spark.y });
  }, [spark.x, spark.y]);

  async function toggleAudioPlayback() {
    if (!isAudio || !spark.content_url) return;

    // Check if this is a music spark (has JSON metadata)
    let isMusic = false;
    let spotifyUri = null;
    let spotifyUrl = null;
    try {
      if (spark.text_content && spark.text_content.startsWith('{')) {
        const metadata = JSON.parse(spark.text_content);
        isMusic = true;
        spotifyUri = metadata.spotifyUri;
        spotifyUrl = metadata.spotifyUrl || spark.content_url;
      }
    } catch (e) {
      // Not music
    }

    // Open music sparks in Spotify
    if (isMusic) {
      try {
        // Try Spotify app first
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
        }
      } catch (error) {
        console.error('Error opening Spotify:', error);
      }
      return;
    }

    // Only play voice recordings
    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else if (status.isLoaded) {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        // Load and play audio recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: spark.content_url },
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
      if (sound) {
        try { await sound.unloadAsync(); } catch (e) {}
        setSound(null);
      }
      setIsPlaying(false);
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        onSelect(spark.id);
        tapStartTime.current = Date.now();
        hasMoved.current = false;

        // long press
        if (onLongPress) {
          longPressTimer.current = setTimeout(() => {
            if (!hasMoved.current) {
              onLongPress(spark.id);
            }
          }, 500);
        }

        onDragStart?.();
        isDraggingRef.current = true;

        position.setOffset({
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        });
        position.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10) {
          hasMoved.current = true;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }

        Animated.event(
          [
            null,
            {
              dx: position.x,
              dy: position.y,
            },
          ],
          { useNativeDriver: false }
        )(_, gesture);
      },

      onPanResponderRelease: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        onDragEnd?.();
        isDraggingRef.current = false;

        position.flattenOffset();

        const finalX = (position.x as any)._value;
        const finalY = (position.y as any)._value;

        const tapDuration = Date.now() - tapStartTime.current;
        if (!hasMoved.current && tapDuration < 300) {
          if (isAudio) {
            // For audio sparks, toggle playback on tap (don't call onTap)
            toggleAudioPlayback();
            return; // Early return to prevent onTap call
          } else if (isFile) {
            // For file sparks, open the file URL
            if (spark.content_url) {
              Linking.openURL(spark.content_url).catch(err => {
                console.error('Error opening file:', err);
              });
            }
            return;
          } else if (onTap) {
            // For other sparks, call onTap
            onTap(spark.id);
            return;
          }
          return;
        }

        if (hasMoved.current) {
          onMoveEnd(spark.id, finalX, finalY);
        }
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
          ],
        },
      ]}
    >
      {isImage && !isFile && (
        <Image
          source={{ uri: spark.content_url }}
          style={[
            styles.image,
            { width: size.width, height: size.height },
            selected && styles.selected,
          ]}
        />
      )}

      {isFile && (
        <View
          style={[
            styles.fileCard,
            { width: size.width, height: size.height },
            selected && styles.selectedFile,
          ]}
        >
          <Ionicons 
            name="document-text" 
            size={48} 
            color={theme.colors.primary} 
          />
          <Text style={styles.fileName} numberOfLines={2}>
            {spark.title}
          </Text>
          <Text style={styles.fileType} numberOfLines={1}>
            {spark.text_content?.split('/').pop()?.toUpperCase() || 'FILE'}
          </Text>
        </View>
      )}

      {isNote && (
        <View
          style={[
            styles.noteCard,
            selected && styles.selectedNote,
          ]}
        >
          {spark.title ? (
            <Text style={styles.noteTitle} numberOfLines={1}>
              {spark.title}
            </Text>
          ) : null}
          {spark.text_content ? (
            <Text style={styles.noteBody} numberOfLines={3}>
              {spark.text_content}
            </Text>
          ) : null}
        </View>
      )}

      {isAudio && (() => {
        // Parse metadata if it exists (music sparks store JSON in text_content)
        let metadata = null;
        try {
          if (spark.text_content && spark.text_content.startsWith('{')) {
            metadata = JSON.parse(spark.text_content);
          }
        } catch (e) {
          // Not JSON, treat as regular audio
        }

        const isMusic = !!metadata;
        const displayMode = metadata?.displayMode || 'album';

        if (isMusic && displayMode === 'album' && metadata.albumImage) {
          // Show album art for music
          return (
            <View style={styles.musicContainer}>
              <Image
                source={{ uri: metadata.albumImage }}
                style={[
                  styles.albumArt,
                  { width: size.width, height: size.height },
                  selected && styles.selected,
                ]}
              />
              {isPlaying && (
                <View style={styles.playOverlay}>
                  <Ionicons name="pause-circle" size={48} color="rgba(255,255,255,0.9)" />
                </View>
              )}
              {/* Song name and artist overlay at bottom */}
              <View style={styles.songNameOverlay}>
                <Text style={styles.songNameText} numberOfLines={1}>
                  {spark.title}
                </Text>
                {metadata.artists && (
                  <Text style={styles.artistNameText} numberOfLines={1}>
                    {metadata.artists}
                  </Text>
                )}
              </View>
            </View>
          );
        } else if (isMusic && displayMode === 'text') {
          // Show text card for music
          return (
            <View
              style={[
                styles.musicTextCard,
                { width: size.width, height: size.height },
                selected && styles.selectedAudio,
                isPlaying && styles.audioCardPlaying,
              ]}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={28} 
                color="#8B5CF6" 
              />
              <Text style={styles.musicTitle} numberOfLines={2}>
                {spark.title}
              </Text>
              {metadata.artists && (
                <Text style={styles.musicArtist} numberOfLines={1}>
                  {metadata.artists}
                </Text>
              )}
            </View>
          );
        } else {
          // Voice recording - original style
          return (
            <View
              style={[
                styles.audioCard,
                { width: size.width, height: size.height },
                selected && styles.selectedAudio,
                isPlaying && styles.audioCardPlaying,
              ]}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "mic"} 
                size={32} 
                color="#10B981" 
              />
              <Text style={styles.audioLabel} numberOfLines={1}>
                {spark.title || 'Audio'}
              </Text>
            </View>
          );
        }
      })()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
  },
  image: {
    borderRadius: 14,
  },
  selected: {
    borderWidth: 3,
    borderColor: "#3A7AFE",
  },
  noteCard: {
    width: 180,
    minHeight: 120,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#FFFBEA",
    borderWidth: 1,
    borderColor: "#FACC15",
  },
  selectedNote: {
    borderWidth: 2,
    borderColor: "#3A7AFE",
  },
  noteTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  noteBody: {
    fontSize: 13,
  },
  audioCard: {
    borderRadius: 14,
    backgroundColor: "#F0FDF4",
    borderWidth: 2,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  audioCardPlaying: {
    backgroundColor: "#D1FAE5",
  },
  selectedAudio: {
    borderWidth: 3,
    borderColor: "#3A7AFE",
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  musicContainer: {
    position: "relative",
  },
  albumArt: {
    borderRadius: 14,
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 14,
  },
  musicTextCard: {
    borderRadius: 14,
    backgroundColor: "#FAF5FF",
    borderWidth: 2,
    borderColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  musicTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8B5CF6",
    textAlign: "center",
  },
  musicArtist: {
    fontSize: 11,
    color: "#A78BFA",
    textAlign: "center",
  },
  songNameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  songNameText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  artistNameText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "400",
    textAlign: "center",
  },
  fileCard: {
    borderRadius: 14,
    backgroundColor: "#F0F4FF",
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  selectedFile: {
    borderWidth: 3,
    borderColor: "#3A7AFE",
  },
  fileName: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  fileType: {
    fontSize: 9,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
