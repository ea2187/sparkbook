import React, { useRef, useEffect } from "react";
import { Image, Animated, PanResponder, StyleSheet } from "react-native";

export default function DraggableSpark({
  spark,
  selected,
  onSelect,
  onMoveEnd,
  onDragStart,
  onDragEnd,
}) {
  // Track if this spark is actively being dragged
  const isDraggingRef = useRef(false);

  // Animated position — initialized to spark.x, spark.y
  const position = useRef(
    new Animated.ValueXY({ x: spark.x, y: spark.y })
  ).current;

  /**
   * 🔥 VERY IMPORTANT:
   * Only update the position from props when NOT dragging.
   * Otherwise re-renders will overwrite the drag movement → flicker.
   */
  useEffect(() => {
    if (isDraggingRef.current) return;
    position.setValue({ x: spark.x, y: spark.y });
  }, [spark.x, spark.y]);

  // Create drag gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        onSelect(spark.id);
        onDragStart?.();
        isDraggingRef.current = true;

        // Store current offset
        position.setOffset({
          x: position.x.__getValue(),
          y: position.y.__getValue(),
        });

        // Reset movement
        position.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event(
        [
          null,
          {
            dx: position.x,
            dy: position.y,
          },
        ],
        { useNativeDriver: false }
      ),

      onPanResponderRelease: (_, gesture) => {
        onDragEnd?.();
        isDraggingRef.current = false;

        // Merge offset + movement
        position.flattenOffset();

        const finalX = position.x.__getValue();
        const finalY = position.y.__getValue();

        // Save new position back to parent + database
        onMoveEnd(spark.id, finalX, finalY);
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
          styles.image,
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
  image: {
    width: 160,
    height: 160,
    borderRadius: 14,
  },
  selected: {
    borderWidth: 3,
    borderColor: "#3A7AFE",
  },
});
