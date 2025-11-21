import React, { useRef, useEffect, useState } from "react";
import { Image, Animated, PanResponder, StyleSheet, TouchableOpacity } from "react-native";

export default function DraggableSpark({
  spark,
  selected,
  onSelect,
  onMoveEnd,
  onDragStart,
  onDragEnd,
  onTap,
  onLongPress,
  onResize,
}) {
  // Track if this spark is actively being dragged
  const isDraggingRef = useRef(false);
  const tapStartTime = useRef(0);
  const hasMoved = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Animated position — initialized to spark.x, spark.y
  const position = useRef(
    new Animated.ValueXY({ x: spark.x, y: spark.y })
  ).current;

  // Track size for pinch/resize (use spark width/height)
  const [size, setSize] = useState({ width: spark.width || 160, height: spark.height || 160 });

  /**
   * 🔥 VERY IMPORTANT:
   * Only update the position from props when NOT dragging.
   * Otherwise re-renders will overwrite the drag movement → flicker.
   */
  useEffect(() => {
    if (isDraggingRef.current) return;
    position.setValue({ x: spark.x, y: spark.y });
  }, [spark.x, spark.y]);

  // Update size when spark dimensions change
  useEffect(() => {
    setSize({ width: spark.width || 160, height: spark.height || 160 });
  }, [spark.width, spark.height]);

  // Create drag gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        onSelect(spark.id);
        tapStartTime.current = Date.now();
        hasMoved.current = false;

        // Start long press timer
        if (onLongPress) {
          longPressTimer.current = setTimeout(() => {
            if (!hasMoved.current) {
              onLongPress(spark.id);
            }
          }, 500);
        }

        onDragStart?.();
        isDraggingRef.current = true;

        // Store current offset
        position.setOffset({
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        });

        // Reset movement
        position.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: (_, gesture) => {
        // Clear long press if moved
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

      onPanResponderRelease: (_, gesture) => {
        // Clear long press timer
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        onDragEnd?.();
        isDraggingRef.current = false;

        // Merge offset + movement
        position.flattenOffset();

        const finalX = (position.x as any)._value;
        const finalY = (position.y as any)._value;

        // Check if it was a tap (quick touch with minimal movement)
        const tapDuration = Date.now() - tapStartTime.current;
        if (!hasMoved.current && tapDuration < 300 && onTap) {
          onTap(spark.id);
          return;
        }

        // Save new position back to parent + database
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
      <Image
        source={{ uri: spark.content_url }}
        style={[
          {
            width: size.width,
            height: size.height,
            borderRadius: 14,
          },
          selected && styles.selected,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
  },
  selected: {
    borderWidth: 3,
    borderColor: "#3A7AFE",
  },
});
