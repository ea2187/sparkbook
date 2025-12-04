import React, { useRef, useEffect, useState } from "react";
import {
  Image,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  Linking,
  TouchableOpacity,
  GestureResponderEvent,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import theme from "../styles/theme";

type DraggableSparkProps = {
  spark: any;
  selected: boolean;
  onSelect: (id: string) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onTap?: (id: string) => void;
  onLongPress?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export default function DraggableSpark({
  spark,
  selected,
  onSelect,
  onMoveEnd,
  onResize,
  onDragStart,
  onDragEnd,
  onTap,
  onLongPress,
  onDelete,
}: DraggableSparkProps) {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isPinchingRef = useRef(false);
  const tapStartTime = useRef(0);
  const hasMoved = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef(0);
  const pinchStartSize = useRef({ width: 0, height: 0 });

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

  const [size, setSize] = useState({
    width: spark.width || 160,
    height: spark.height || 160,
  });
  const [cropMode, setCropMode] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Update size when spark prop changes
  useEffect(() => {
    if (spark.width && spark.height) {
      setSize({ width: spark.width, height: spark.height });
    }
  }, [spark.width, spark.height]);

  // Reset crop mode when spark is deselected
  useEffect(() => {
    if (!selected) {
      setCropMode(false);
    }
  }, [selected]);

  // Check if spark is newly created (within last 3 seconds)
  useEffect(() => {
    const createdAt = new Date(spark.created_at).getTime();
    const now = Date.now();
    const isNewSpark = now - createdAt < 3000; // 3 seconds
    
    if (isNewSpark) {
      setIsNew(true);
      
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
        { iterations: 3 }
      ).start(() => setIsNew(false));
    }
  }, [spark.created_at]);

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

  // Resize state
  const currentResizeSize = useRef({ width: size.width, height: size.height });
  const resizeHandleType = useRef<'corner' | 'side' | null>(null);
  const resizeCorner = useRef<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const resizeSide = useRef<'top' | 'bottom' | 'left' | 'right' | null>(null);
  const resizeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    currentResizeSize.current = size;
  }, [size]);

  function createResizePanResponder(
    handleType: 'corner' | 'side',
    corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    side?: 'top' | 'bottom' | 'left' | 'right'
  ) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        isResizingRef.current = true;
        resizeHandleType.current = handleType;
        if (corner) resizeCorner.current = corner;
        if (side) resizeSide.current = side;
        resizeStartSize.current = { width: size.width, height: size.height };
        resizeStartPos.current = {
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        };
        onSelect(spark.id);
        onDragStart?.();
      },

      onPanResponderMove: (_, gesture) => {
        if (!isResizingRef.current) return;

        let newWidth = resizeStartSize.current.width;
        let newHeight = resizeStartSize.current.height;
        let positionAdjustX = 0;
        let positionAdjustY = 0;
        const aspectRatio = resizeStartSize.current.width / resizeStartSize.current.height;
        const minSize = 80;

        if (handleType === 'corner' && corner) {
          const deltaX = gesture.dx;
          const deltaY = gesture.dy;
          
          let widthDelta = 0;
          let heightDelta = 0;
          
          // Calculate resize direction based on corner
          if (corner === 'bottom-right') {
            widthDelta = deltaX;
            heightDelta = deltaY;
          } else if (corner === 'bottom-left') {
            widthDelta = -deltaX;
            heightDelta = deltaY;
          } else if (corner === 'top-right') {
            widthDelta = deltaX;
            heightDelta = -deltaY;
          } else if (corner === 'top-left') {
            widthDelta = -deltaX;
            heightDelta = -deltaY;
          }

          if (!cropMode) {
            // Maintain aspect ratio - use diagonal distance for smoother scaling
            const diagonal = Math.sqrt(widthDelta * widthDelta + heightDelta * heightDelta);
            const sign = (widthDelta + heightDelta) >= 0 ? 1 : -1;
            const scaleFactor = (resizeStartSize.current.width + (diagonal * sign)) / resizeStartSize.current.width;
            
            newWidth = Math.max(minSize, resizeStartSize.current.width * scaleFactor);
            newHeight = Math.max(minSize, resizeStartSize.current.height * scaleFactor);
          } else {
            // Crop mode: free resize
            newWidth = Math.max(minSize, resizeStartSize.current.width + widthDelta);
            newHeight = Math.max(minSize, resizeStartSize.current.height + heightDelta);
          }

          // Adjust position when resizing from top or left corners
          if (corner === 'top-left') {
            positionAdjustX = resizeStartSize.current.width - newWidth;
            positionAdjustY = resizeStartSize.current.height - newHeight;
          } else if (corner === 'top-right') {
            positionAdjustY = resizeStartSize.current.height - newHeight;
          } else if (corner === 'bottom-left') {
            positionAdjustX = resizeStartSize.current.width - newWidth;
          }
        } else if (handleType === 'side' && side) {
          // Side handles: non-proportional resizing
          if (side === 'right') {
            newWidth = Math.max(minSize, resizeStartSize.current.width + gesture.dx);
          } else if (side === 'left') {
            newWidth = Math.max(minSize, resizeStartSize.current.width - gesture.dx);
            positionAdjustX = resizeStartSize.current.width - newWidth;
          } else if (side === 'bottom') {
            newHeight = Math.max(minSize, resizeStartSize.current.height + gesture.dy);
          } else if (side === 'top') {
            newHeight = Math.max(minSize, resizeStartSize.current.height - gesture.dy);
            positionAdjustY = resizeStartSize.current.height - newHeight;
          }
        }
        
        // Apply position adjustment
        if (positionAdjustX !== 0 || positionAdjustY !== 0) {
          position.setValue({
            x: resizeStartPos.current.x + positionAdjustX,
            y: resizeStartPos.current.y + positionAdjustY,
          });
        }
        
        setSize({ width: newWidth, height: newHeight });
        currentResizeSize.current = { width: newWidth, height: newHeight };
      },

      onPanResponderRelease: () => {
        if (isResizingRef.current && onResize) {
          const roundedWidth = Math.round(currentResizeSize.current.width);
          const roundedHeight = Math.round(currentResizeSize.current.height);
          
          // Update position if adjusted
          const finalX = Math.round((position.x as any)._value);
          const finalY = Math.round((position.y as any)._value);
          
          // Debounce database update slightly for smoother UX
          if (resizeTimeout.current) {
            clearTimeout(resizeTimeout.current);
          }
          resizeTimeout.current = setTimeout(() => {
            onResize(spark.id, roundedWidth, roundedHeight);
            if (finalX !== spark.x || finalY !== spark.y) {
              onMoveEnd(spark.id, finalX, finalY);
            }
          }, 50);
        }
        isResizingRef.current = false;
        resizeHandleType.current = null;
        resizeCorner.current = null;
        resizeSide.current = null;
        onDragEnd?.();
      },
    });
  }

  const resizeHandles = {
    'top-left': useRef(createResizePanResponder('corner', 'top-left')),
    'top-right': useRef(createResizePanResponder('corner', 'top-right')),
    'bottom-left': useRef(createResizePanResponder('corner', 'bottom-left')),
    'bottom-right': useRef(createResizePanResponder('corner', 'bottom-right')),
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isResizingRef.current && !isPinchingRef.current,

      onPanResponderGrant: () => {
        if (isResizingRef.current || isPinchingRef.current) return;
        
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
            // Check if this is a music spark (Spotify)
            let isMusic = false;
            try {
              if (spark.text_content && spark.text_content.startsWith('{')) {
                const metadata = JSON.parse(spark.text_content);
                isMusic = !!metadata;
              }
            } catch (e) {
              // Not music
            }

            if (isMusic) {
              // For music sparks, call onTap to select (for resize/delete)
              if (onTap) {
                onTap(spark.id);
              }
            } else {
              // For voice recordings, toggle playback on tap
              toggleAudioPlayback();
            }
            return;
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

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.8)']
  });

  const glowWidth = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4]
  });

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
        isNew && {
          borderWidth: glowWidth,
          borderColor: glowColor,
          borderRadius: 12,
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowAnim,
          shadowRadius: 12,
          elevation: isNew ? 8 : 0,
        },
      ]}
    >
      {isImage && !isFile && (
        <View style={{ position: 'relative' }}>
          <Animated.View
            style={[
              isNew && {
                borderWidth: glowWidth,
                borderColor: glowColor,
                borderRadius: 8,
              }
            ]}
          >
            <View>
              <Image
                source={{ uri: spark.content_url }}
                style={[
                  styles.image,
                  { width: size.width, height: size.height },
                  selected && styles.selected,
                ]}
              />
              {/* Show attribution if this is a saved image from community */}
              {spark.text_content && spark.text_content.startsWith('{') && (() => {
                try {
                  const metadata = JSON.parse(spark.text_content);
                  if (metadata.is_saved_from_community && metadata.original_creator_name) {
                    return (
                      <View style={styles.imageAttribution}>
                        <Text style={styles.imageAttributionText}>
                          Photo by {metadata.original_creator_name}
                        </Text>
                      </View>
                    );
                  }
                } catch (e) {
                  // Not JSON metadata
                }
                return null;
              })()}
            </View>
          </Animated.View>
          {selected && (
            <>
              {/* Crop toggle button - only show when not in crop mode */}
              {!cropMode && (
                <TouchableOpacity
                  style={[styles.cropButton, { bottom: -8, left: -8 }]}
                  onPress={() => setCropMode(!cropMode)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="resize"
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              )}

              {/* Delete button - hide when in crop mode */}
              {onDelete && !cropMode && (
                <TouchableOpacity
                  style={[styles.deleteButton, { top: -8, right: -8 }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onDelete(spark.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {/* Corner handles - only show in crop mode for non-proportional resize */}
              {cropMode && (
                <>
                  <View
                    {...resizeHandles['top-left'].current.panHandlers}
                    style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, left: -8 }]}
                  >
                    <Ionicons name="resize" size={12} color={theme.colors.white} />
                  </View>
                  <View
                    {...resizeHandles['top-right'].current.panHandlers}
                    style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, right: -8 }]}
                  >
                    <Ionicons name="resize" size={12} color={theme.colors.white} />
                  </View>
                  <View
                    {...resizeHandles['bottom-left'].current.panHandlers}
                    style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, left: -8 }]}
                  >
                    <Ionicons name="resize" size={12} color={theme.colors.white} />
                  </View>
                  <View
                    {...resizeHandles['bottom-right'].current.panHandlers}
                    style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, right: -8 }]}
                  >
                    <Ionicons name="resize" size={12} color={theme.colors.white} />
                  </View>
                </>
              )}
            </>
          )}
        </View>
      )}

      {isFile && (
        <View style={{ position: 'relative' }}>
          <View
            style={[
              styles.fileCard,
              { width: size.width, height: size.height },
              selected && styles.selectedFile,
            ]}
          >
            <Image
              source={require("../assets/file.png")}
              style={styles.fileIcon}
            />
            <Text style={styles.fileName} numberOfLines={2}>
              {spark.title}
            </Text>
            <Text style={styles.fileType} numberOfLines={1}>
              {spark.text_content?.split('/').pop()?.toUpperCase() || 'FILE'}
            </Text>
          </View>
          {selected && onDelete && (
            <TouchableOpacity
              style={[styles.deleteButton, { top: -8, right: -8 }]}
              onPress={(e) => {
                e.stopPropagation();
                onDelete(spark.id);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isNote && (() => {
        // Check if this is a saved sparklette
        let isSavedSparklette = false;
        let sparkletteData: any = null;
        
        if (spark.text_content && spark.text_content.startsWith('{')) {
          try {
            const parsed = JSON.parse(spark.text_content);
            if (parsed.isSavedSparklette) {
              isSavedSparklette = true;
              sparkletteData = parsed;
            }
          } catch (e) {
            // Not JSON, treat as regular note
          }
        }

        // Render saved sparklette as preview
        if (isSavedSparklette && sparkletteData) {
          return (
            <View style={{ position: 'relative' }}>
              <View
                style={[
                  styles.sparklettePreviewCard,
                  { width: size.width, height: size.height },
                  selected && styles.selectedNote,
                ]}
              >
                <Text style={styles.sparklettePreviewTitle} numberOfLines={1}>
                  {spark.title || 'Saved Sparklette'}
                </Text>
                {sparkletteData.caption && (
                  <Text style={styles.sparklettePreviewCaption} numberOfLines={1}>
                    {sparkletteData.caption}
                  </Text>
                )}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.sparklettePreviewScroll}
                  contentContainerStyle={styles.sparklettePreviewContent}
                >
                  {(sparkletteData.attachments || []).slice(0, 4).map((attachment: any, idx: number) => {
                    if (attachment.image_url && (attachment.media_type === "image" || attachment.media_type === "music")) {
                      return (
                        <Image 
                          key={idx} 
                          source={{ uri: attachment.image_url }} 
                          style={styles.sparklettePreviewTile} 
                        />
                      );
                    }
                    let iconName: "sparkles" | "document-text" | "musical-notes" | "image-outline" | "play-circle" = "sparkles";
                    if (attachment.media_type === "note") iconName = "document-text";
                    else if (attachment.media_type === "music") iconName = "musical-notes";
                    else if (attachment.media_type === "image") iconName = "image-outline";
                    else if (attachment.media_type === "spark") iconName = "play-circle";
                    return (
                      <View key={idx} style={styles.sparklettePreviewTilePlaceholder}>
                        <Ionicons name={iconName} size={16} color={theme.colors.textLight} />
                      </View>
                    );
                  })}
                </ScrollView>
                <Text style={styles.sparklettePreviewAttribution}>
                  by {sparkletteData.creator_name}
                </Text>
              </View>
            </View>
          );
        }

        // Regular note rendering
        const maxLength = 120;
        const isTruncated = spark.text_content && spark.text_content.length > maxLength;
        const displayText = isTruncated 
          ? spark.text_content.substring(0, maxLength) + '...'
          : spark.text_content;

        return (
          <View style={{ position: 'relative' }}>
            <View
              style={[
                styles.noteCard,
                { width: size.width, height: size.height },
                selected && styles.selectedNote,
              ]}
            >
              {spark.title ? (
                <Text style={styles.noteTitle} numberOfLines={1}>
                  {spark.title}
                </Text>
              ) : null}
              {spark.text_content ? (
                <>
                  <Text style={styles.noteBody} numberOfLines={isTruncated ? 4 : undefined}>
                    {displayText}
                  </Text>
                  {isTruncated && (
                    <Text style={styles.readMore}>Tap to read more</Text>
                  )}
                </>
              ) : null}
            </View>
            {selected && (
              <>
                {/* Resize toggle button - only show when not in crop mode */}
                {!cropMode && (
                  <TouchableOpacity
                    style={[styles.cropButton, { bottom: -8, left: -8 }]}
                    onPress={() => setCropMode(!cropMode)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="resize"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </TouchableOpacity>
                )}

                {/* Delete button - hide when in crop mode */}
                {onDelete && !cropMode && (
                  <TouchableOpacity
                    style={[styles.deleteButton, { top: -8, right: -8 }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      onDelete(spark.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {/* Corner handles - only show in crop mode */}
                {cropMode && (
                  <>
                    <View
                      {...resizeHandles['top-left'].current.panHandlers}
                      style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, left: -8 }]}
                    >
                      <Ionicons name="resize" size={12} color={theme.colors.white} />
                    </View>
                    <View
                      {...resizeHandles['top-right'].current.panHandlers}
                      style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, right: -8 }]}
                    >
                      <Ionicons name="resize" size={12} color={theme.colors.white} />
                    </View>
                    <View
                      {...resizeHandles['bottom-left'].current.panHandlers}
                      style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, left: -8 }]}
                    >
                      <Ionicons name="resize" size={12} color={theme.colors.white} />
                    </View>
                    <View
                      {...resizeHandles['bottom-right'].current.panHandlers}
                      style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, right: -8 }]}
                    >
                      <Ionicons name="resize" size={12} color={theme.colors.white} />
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        );
      })()}

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
              {selected && (
                <>
                  {/* Resize toggle button - only show when not in crop mode */}
                  {!cropMode && (
                    <TouchableOpacity
                      style={[styles.cropButton, { bottom: -8, left: -8 }]}
                      onPress={() => setCropMode(!cropMode)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="resize"
                        size={20}
                        color={theme.colors.primary}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Delete button - hide when in crop mode */}
                  {onDelete && !cropMode && (
                    <TouchableOpacity
                      style={[styles.deleteButton, { top: -8, right: -8 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onDelete(spark.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}

                  {/* Corner handles - only show in crop mode */}
                  {cropMode && (
                    <>
                      <View
                        {...resizeHandles['top-left'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, left: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['top-right'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, right: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['bottom-left'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, left: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['bottom-right'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, right: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          );
        } else if (isMusic && displayMode === 'text') {
          // Show text card for music
          return (
            <View style={{ position: 'relative' }}>
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
              {selected && (
                <>
                  {/* Resize toggle button - only show when not in crop mode */}
                  {!cropMode && (
                    <TouchableOpacity
                      style={[styles.cropButton, { bottom: -8, left: -8 }]}
                      onPress={() => setCropMode(!cropMode)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="resize"
                        size={20}
                        color={theme.colors.primary}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Delete button - hide when in crop mode */}
                  {onDelete && !cropMode && (
                    <TouchableOpacity
                      style={[styles.deleteButton, { top: -8, right: -8 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onDelete(spark.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}

                  {/* Corner handles - only show in crop mode */}
                  {cropMode && (
                    <>
                      <View
                        {...resizeHandles['top-left'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, left: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['top-right'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, right: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['bottom-left'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, left: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['bottom-right'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, right: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          );
        } else {
          // Voice recording - original style
          return (
            <View style={{ position: 'relative' }}>
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
              {selected && (
                <>
                  {/* Resize toggle button - only show when not in crop mode */}
                  {!cropMode && (
                    <TouchableOpacity
                      style={[styles.cropButton, { bottom: -8, left: -8 }]}
                      onPress={() => setCropMode(!cropMode)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="resize"
                        size={20}
                        color={theme.colors.primary}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Delete button - hide when in crop mode */}
                  {onDelete && !cropMode && (
                    <TouchableOpacity
                      style={[styles.deleteButton, { top: -8, right: -8 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onDelete(spark.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}

                  {/* Corner handles - only show in crop mode */}
                  {cropMode && (
                    <>
                      <View
                        {...resizeHandles['top-left'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, left: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['top-right'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { top: -8, right: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['bottom-left'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, left: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                      <View
                        {...resizeHandles['bottom-right'].current.panHandlers}
                        style={[styles.resizeHandle, styles.resizeHandleCorner, { bottom: -8, right: -8 }]}
                      >
                        <Ionicons name="resize" size={12} color={theme.colors.white} />
                      </View>
                    </>
                  )}
                </>
              )}
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
  readMore: {
    fontSize: 11,
    color: "#A78BFA",
    fontStyle: "italic",
    marginTop: 6,
  },
  sparklettePreviewCard: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#FFFBEA",
    borderWidth: 1,
    borderColor: "#FACC15",
  },
  sparklettePreviewTitle: {
    fontWeight: "600",
    marginBottom: 4,
    fontSize: 14,
  },
  sparklettePreviewCaption: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  sparklettePreviewScroll: {
    flex: 1,
    marginBottom: 6,
  },
  sparklettePreviewContent: {
    gap: 6,
  },
  sparklettePreviewTile: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  sparklettePreviewTilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: theme.colors.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparklettePreviewAttribution: {
    fontSize: 9,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    textAlign: "right",
  },
  imageAttribution: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  imageAttributionText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontStyle: 'italic',
    textAlign: 'center',
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
  fileIcon: {
    width: 48,
    height: 48,
    resizeMode: "contain",
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
  resizeHandle: {
    position: "absolute",
    zIndex: 10,
  },
  resizeHandleCorner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  resizeHandleSide: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  resizeHandleInner: {
    width: 8,
    height: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  cropButton: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#3A7AFE",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    ...theme.shadows.md,
  },
  deleteButton: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    ...theme.shadows.md,
  },
});
