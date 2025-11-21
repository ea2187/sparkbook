import React, { FC, useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import type { RouteProp, NavigationProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import theme from "../styles/theme";
import type { HomeStackParamList } from "../types";
import { uploadImageAsync } from "../lib/uploadImage";
import { createSpark } from "../lib/createSpark";
import DraggableSpark from "../components/DraggableSpark";

// ROUTE TYPES
type BoardScreenRouteProp = RouteProp<HomeStackParamList, "Board">;
type BoardScreenNavigationProp = NavigationProp<HomeStackParamList>;

// CANVAS DIMENSIONS
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BOARD_WIDTH = SCREEN_WIDTH * 5;
const BOARD_HEIGHT = SCREEN_HEIGHT * 5;
const GRID_SIZE = 20;

const BoardScreen: FC = () => {
  const route = useRoute<BoardScreenRouteProp>();
  const navigation = useNavigation<BoardScreenNavigationProp>();
  const { boardId } = route.params;

  const [boardName, setBoardName] = useState("Board");
  const [sparks, setSparks] = useState<any[]>([]);
  const [selectedSparkId, setSelectedSparkId] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Refetch sparks when screen comes into focus (e.g., after editing spark details)
  useFocusEffect(
    useCallback(() => {
      fetchSparks();
    }, [boardId])
  );

  // Load board + sparks
  useEffect(() => {
    fetchBoard();
    fetchSparks();

    // Listen for uploads and refetch when complete
    const checkUploadStatus = setInterval(() => {
      const isUploading = (global as any).__uploadingPhoto;
      const wasUploading = uploading;
      
      setUploading(isUploading || false);
      
      // Refetch sparks when upload completes
      if (wasUploading && !isUploading) {
        fetchSparks();
      }
    }, 300);

    return () => clearInterval(checkUploadStatus);
  }, [boardId, uploading]);

  // Center canvas on initial load
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: (BOARD_WIDTH - SCREEN_WIDTH) / 2,
          y: (BOARD_HEIGHT - SCREEN_HEIGHT) / 2,
          animated: false,
        });
      }, 100);
    }
  }, []);

  // Fetch board title
  async function fetchBoard() {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .single();

    if (!error && data) {
      setBoardName(data.name);
    }
  }

  // Fetch sparks for this board
  async function fetchSparks() {
    const { data, error } = await supabase
      .from("sparks")
      .select("*")
      .eq("board_id", boardId);

    if (!error && data) {
      setSparks(data);
    }
  }

  // Disable scroll when dragging
  function handleDragStart() {
    setScrollEnabled(false);
  }
  function handleDragEnd() {
    setScrollEnabled(true);
  }

  // Update spark position in database
  function handleSparkMove(id: string, newX: number, newY: number) {
    // Update UI immediately
    setSparks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s))
    );

    // Update database in background
    supabase
      .from("sparks")
      .update({ x: newX, y: newY })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("❌ Failed to update spark position:", error);
        }
      });
  }

  // Handle tap to deselect
  function handleSparkTap(id: string) {
    setSelectedSparkId(null);
  }

  // Handle long press to view details
  function handleSparkLongPress(id: string) {
    navigation.navigate("SparkDetails", { sparkId: id, boardId });
  }

  async function handleDeleteSpark(id: string) {
    // Remove from UI
    setSparks(prev => prev.filter(s => s.id !== id));

    // Delete from database
    const { error } = await supabase.from("sparks").delete().eq("id", id);
    
    if (error) {
      console.error("Failed to delete spark:", error);
      Alert.alert("Error", "Failed to delete spark");
      // Refetch to restore UI
      fetchSparks();
    }
  }

  // Handle resize
  async function handleSparkResize(id: string, newWidth: number, newHeight: number) {
    // Update UI
    setSparks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, width: newWidth, height: newHeight } : s))
    );

    // Update database
    const { error } = await supabase
      .from("sparks")
      .update({ width: newWidth, height: newHeight })
      .eq("id", id);

    if (error) {
      console.error("Failed to update spark size:", error);
    }
  }

  // ---- IMAGE PICKING & UPLOAD ----

  async function requestPermissions() {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (camera.status !== "granted" || media.status !== "granted") {
      Alert.alert(
        "Permissions Needed",
        "Camera + photo library permissions required."
      );
      return false;
    }
    return true;
  }

  async function handlePhotoButton() {
    const ok = await requestPermissions();
    if (!ok) return;

    Alert.alert("Add Photo", "Choose an option", [
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImageFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function takePhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });

      if (!result.canceled) {
        await handleImageSelected(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to open camera.");
    }
  }

  async function pickImageFromLibrary() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        selectionLimit: 1,
      });

      if (!result.canceled) {
        await handleImageSelected(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to pick image.");
    }
  }

  // Upload → create spark → add to canvas
  async function handleImageSelected(uri: string) {
    const url = await uploadImageAsync(uri, boardId);
    if (!url) {
      Alert.alert("Error", "Image upload failed.");
      return;
    }

    // spawn near center
    const spawnX = BOARD_WIDTH / 2 - 80 + (Math.random() * 120 - 60);
    const spawnY = BOARD_HEIGHT / 2 - 80 + (Math.random() * 120 - 60);

    const spark = await createSpark(boardId, url, spawnX, spawnY);
    if (!spark) return;

    setSparks((prev) => [...prev, spark]);
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("HomeMain" as never)}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{boardName}</Text>
          {uploading && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ height: 100 }} />
      {/* UPLOADING OVERLAY */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.uploadingText}>Uploading photo...</Text>
          </View>
        </View>
      )}

      {/* INFINITE CANVAS */}
      <ScrollView
        ref={scrollViewRef}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.canvasContainer}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        {/* GRID */}
        <View style={styles.gridContainer}>
          {Array.from({
            length: Math.ceil(BOARD_HEIGHT / GRID_SIZE),
          }).map((_, i) => (
            <View
              key={`h-${i}`}
              style={[styles.gridLine, styles.gridLineHorizontal, { top: i * GRID_SIZE }]}
            />
          ))}
          {Array.from({
            length: Math.ceil(BOARD_WIDTH / GRID_SIZE),
          }).map((_, i) => (
            <View
              key={`v-${i}`}
              style={[styles.gridLine, styles.gridLineVertical, { left: i * GRID_SIZE }]}
            />
          ))}
        </View>

        {/* SPARKS */}
        <View style={styles.canvasContent}>
          {/* Tap background to deselect */}
          <TouchableOpacity
            style={styles.canvasBackground}
            activeOpacity={1}
            onPress={() => setSelectedSparkId(null)}
          />

          {sparks.map((spark) => (
            <DraggableSpark
              key={spark.id + "-" + spark.x + "-" + spark.y}
              spark={spark}
              selected={selectedSparkId === spark.id}
              onSelect={setSelectedSparkId}
              onMoveEnd={handleSparkMove}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTap={handleSparkTap}
              onLongPress={handleSparkLongPress}
              onResize={handleSparkResize}
            />
          ))}

          {/* EMPTY STATE */}
          {sparks.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="albums-outline" size={64} color={theme.colors.textLight} />
              <Text style={styles.emptyStateText}>Canvas is ready</Text>
              <Text style={styles.emptyStateSubtext}>Add images to begin</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomBarIcon}>
          <Image source={require("../assets/note.png")} style={styles.bottomBarIconImage} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon}>
          <Image source={require("../assets/voice.png")} style={styles.bottomBarIconImage} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon}>
          <Ionicons name="star" size={36} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon} onPress={handlePhotoButton}>
          <Image source={require("../assets/photo.png")} style={styles.bottomBarIconImage} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon}>
          <Ionicons name="ellipsis-horizontal" size={32} color={theme.colors.light} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.light },
  header: {
  flexDirection: "row",
  alignItems: "center",
  paddingTop: 50,
  paddingHorizontal: 20,
  height: 100,
  backgroundColor: theme.colors.light,
  zIndex: 10000,
  elevation: 12,
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
},

  headerCenter: {
    position: "absolute",
    top: 55,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  canvasContainer: { width: BOARD_WIDTH, height: BOARD_HEIGHT},
  gridContainer: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: "absolute", backgroundColor: "#d9d9d9" },
  gridLineHorizontal: { width: BOARD_WIDTH, height: 0.5 },
  gridLineVertical: { height: BOARD_HEIGHT, width: 0.5 },
  canvasContent: { ...StyleSheet.absoluteFillObject },
  canvasBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
  },
  emptyState: {
    position: "absolute",
    top: BOARD_HEIGHT / 2 - 100,
    left: BOARD_WIDTH / 2 - 150,
    width: 300,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#777",
    marginTop: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    height: 90,
    width: "100%",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 5,
  
  },
  bottomBarIcon: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomBarIconImage: { width: 36, height: 36 },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  },
  uploadingCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    ...theme.shadows.lg,
  },
  uploadingText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
});

export default BoardScreen;
