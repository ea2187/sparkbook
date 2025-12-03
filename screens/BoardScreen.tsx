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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
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
import NoteComposerModal from '../components/NoteComposerModal';
import { createNoteSpark } from '../lib/createNoteSpark';
import QuickAddMenu from '../components/QuickAddMenu';
import AudioRecorderModal from '../components/AudioRecorderModal';
import MoreMenu from '../components/MoreMenu'; 


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
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  
  // Undo/Redo state
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef({ history: [] as any[][], index: -1 });


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
      // Initialize history with current state only if history is empty
      if (historyRef.current.history.length === 0) {
        addToHistory(data);
      }
    }
  }

  // Add current state to history
  function addToHistory(currentSparks: any[]) {
    const newHistory = [...historyRef.current.history.slice(0, historyRef.current.index + 1)];
    newHistory.push(JSON.parse(JSON.stringify(currentSparks))); // Deep copy
    historyRef.current.history = newHistory;
    historyRef.current.index = newHistory.length - 1;
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  // Undo
  function handleUndo() {
    if (historyRef.current.index > 0) {
      historyRef.current.index--;
      const previousState = historyRef.current.history[historyRef.current.index];
      setSparks(JSON.parse(JSON.stringify(previousState))); // Deep copy
      setHistoryIndex(historyRef.current.index);
      
      // Update database with previous state
      previousState.forEach((spark: any) => {
        supabase
          .from("sparks")
          .update({ x: spark.x, y: spark.y, width: spark.width, height: spark.height })
          .eq("id", spark.id);
      });
    }
  }

  // Redo
  function handleRedo() {
    if (historyRef.current.index < historyRef.current.history.length - 1) {
      historyRef.current.index++;
      const nextState = historyRef.current.history[historyRef.current.index];
      setSparks(JSON.parse(JSON.stringify(nextState))); // Deep copy
      setHistoryIndex(historyRef.current.index);
      
      // Update database with next state
      nextState.forEach((spark: any) => {
        supabase
          .from("sparks")
          .update({ x: spark.x, y: spark.y, width: spark.width, height: spark.height })
          .eq("id", spark.id);
      });
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
    setSparks((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s));
      // Add to history after move completes
      setTimeout(() => addToHistory(updated), 100);
      return updated;
    });

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
    // Save state before deletion
    const currentState = [...sparks];
    
    // Remove from UI
    setSparks(prev => {
      const updated = prev.filter(s => s.id !== id);
      addToHistory(updated);
      return updated;
    });

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
    setSparks((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, width: newWidth, height: newHeight } : s));
      // Add to history after resize completes
      setTimeout(() => addToHistory(updated), 100);
      return updated;
    });

    // Update database
    const { error } = await supabase
      .from("sparks")
      .update({ width: newWidth, height: newHeight })
      .eq("id", id);

    if (error) {
      console.error("Failed to update spark size:", error);
    }
  }

  // Handle import file
  function handleImportFile() {
    navigation.navigate('ImportFile', { boardId });
  }

  // Handle toggle grid
  function handleToggleGrid() {
    setGridVisible(!gridVisible);
  }

  // Handle export as image
  function handleExportAsImage() {
    Alert.alert(
      "Export as Image",
      "This feature will export your board as an image. Coming soon!",
      [{ text: "OK" }]
    );
  }

  // Handle rename board
  function handleRenameBoard() {
    setNewBoardName(boardName);
    setRenameModalVisible(true);
  }

  async function handleRenameSubmit() {
    if (!newBoardName || !newBoardName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    const { error } = await supabase
      .from("boards")
      .update({ name: newBoardName.trim() })
      .eq("id", boardId);

    if (error) {
      Alert.alert("Error", "Failed to rename board");
      return;
    }

    setBoardName(newBoardName.trim());
    setRenameModalVisible(false);
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

    setSparks((prev) => {
      const updated = [...prev, spark];
      addToHistory(updated);
      return updated;
    });
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.leftHeaderContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={26} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{boardName}</Text>
          {uploading && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
          )}
        </View>
        <View style={styles.rightHeaderContainer}>
          {/* UNDO/REDO BUTTONS */}
          <View style={styles.undoRedoContainer}>
            <TouchableOpacity 
              style={[styles.undoRedoButton, historyIndex <= 0 && styles.undoRedoButtonDisabled]}
              onPress={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Ionicons 
                name="arrow-undo" 
                size={20} 
                color={historyIndex <= 0 ? theme.colors.textLight : theme.colors.textPrimary} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.undoRedoButton, historyIndex >= history.length - 1 && styles.undoRedoButtonDisabled]}
              onPress={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <Ionicons 
                name="arrow-redo" 
                size={20} 
                color={historyIndex >= history.length - 1 ? theme.colors.textLight : theme.colors.textPrimary} 
              />
            </TouchableOpacity>
          </View>
          {/* ORGANIZE BUTTON */}
          <View style={styles.organizeContainer}>
            <TouchableOpacity style={styles.organizeButton}>
              <Ionicons name="sparkles" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
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
        {gridVisible && (
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
        )}

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
        <TouchableOpacity style={styles.bottomBarIcon} onPress ={() => setNoteModalVisible(true)}>
          <Image source={require("../assets/note.png")} style={styles.bottomBarIconImage} />
          <Text style={styles.bottomBarLabel}>Note</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon} onPress={() => setAudioModalVisible(true)}>
          <Image source={require("../assets/voice.png")} style={styles.bottomBarIconImage} />
          <Text style={styles.bottomBarLabel}>Audio</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bottomBarIcon} 
          onPress={() => navigation.navigate('AddMusic', { boardId })}
        >
          <Ionicons name="musical-notes" size={32} color={theme.colors.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.bottomBarLabel}>Music</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon} onPress={handlePhotoButton}>
          <Image source={require("../assets/photo.png")} style={styles.bottomBarIconImage} />
          <Text style={styles.bottomBarLabel}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon} onPress={() => setMoreMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={32} color={theme.colors.textPrimary} style={{ marginBottom: 6 }} />
          <Text style={styles.bottomBarLabel}>More</Text>
        </TouchableOpacity>
      </View>

      <NoteComposerModal
  visible={noteModalVisible}
  onClose={() => setNoteModalVisible(false)}
  onSubmit={async (title, text) => {
    // spawn near center like photos
    const spawnX = BOARD_WIDTH / 2 - 80 + (Math.random() * 120 - 60);
    const spawnY = BOARD_HEIGHT / 2 - 80 + (Math.random() * 120 - 60);

    const spark = await createNoteSpark(boardId, title, text, spawnX, spawnY);
    if (spark) {
      setSparks(prev => {
        const updated = [...prev, spark];
        addToHistory(updated);
        return updated;
      });
    }
    setNoteModalVisible(false);
  }}
/>

      <AudioRecorderModal
        visible={audioModalVisible}
        onClose={() => setAudioModalVisible(false)}
        boardId={boardId}
        onAudioCreated={(spark: any) => {
          setSparks(prev => {
            const updated = [...prev, spark];
            addToHistory(updated);
            return updated;
          });
          setAudioModalVisible(false);
        }}
      />

      <MoreMenu
        visible={moreMenuVisible}
        onClose={() => setMoreMenuVisible(false)}
        onImportFile={handleImportFile}
        onToggleGrid={handleToggleGrid}
        onExportAsImage={handleExportAsImage}
        onRenameBoard={handleRenameBoard}
        gridVisible={gridVisible}
      />

      {/* Rename Board Modal */}
      <Modal
        visible={renameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.renameModalOverlay}>
            <TouchableOpacity
              style={styles.renameModalBackdrop}
              activeOpacity={1}
              onPress={() => setRenameModalVisible(false)}
            />
            <View style={styles.renameModalContent}>
              <Text style={styles.renameModalTitle}>Rename Board</Text>
              <TextInput
                style={styles.renameModalInput}
                value={newBoardName}
                onChangeText={setNewBoardName}
                placeholder="Enter board name"
                placeholderTextColor={theme.colors.textLight}
                autoFocus
                onSubmitEditing={handleRenameSubmit}
              />
              <View style={styles.renameModalButtons}>
                <TouchableOpacity
                  style={[styles.renameModalButton, styles.renameModalButtonCancel]}
                  onPress={() => setRenameModalVisible(false)}
                >
                  <Text style={styles.renameModalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameModalButton, styles.renameModalButtonSave]}
                  onPress={handleRenameSubmit}
                >
                  <Text style={styles.renameModalButtonSaveText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.light },
  header: {
  flexDirection: "row",
  alignItems: "center",
  paddingTop: 60,
  paddingHorizontal: 20,
  height: 110,
  backgroundColor: theme.colors.white,
  zIndex: 10000,
  elevation: 12,
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
},

  leftHeaderContainer: {
    position: "absolute",
    top: 65,
    left: 20,
    zIndex: 10001,
  },
  rightHeaderContainer: {
    position: "absolute",
    top: 65,
    right: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    zIndex: 10001,
  },
  backButton: {
    zIndex: 10001,
  },
  headerCenter: {
    position: "absolute",
    top: 65,
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
  undoRedoContainer: {
    flexDirection: "row",
    gap: 6,
    zIndex: 10001,
    alignItems: "center",
  },
  undoRedoButton: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.md,
  },
  undoRedoButtonDisabled: {
    opacity: 0.4,
  },
  organizeContainer: {
    zIndex: 10001,
  },
  organizeButton: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.md,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    height: 100,
    width: "100%",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 5,
    paddingBottom: 8,
  },
  bottomBarIcon: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    padding: 4,
  },
  bottomBarIconImage: { 
    width: 36, 
    height: 36,
    resizeMode: "contain",
    marginBottom: 6,
  },
  bottomBarLabel: {
    fontSize: 11,
    color: theme.colors.textPrimary,
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: 0.2,
  },
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
  renameModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  renameModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  renameModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  renameModalTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  renameModalInput: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 20,
  },
  renameModalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  renameModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  renameModalButtonCancel: {
    backgroundColor: theme.colors.light,
  },
  renameModalButtonCancelText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  renameModalButtonSave: {
    backgroundColor: theme.colors.primary,
  },
  renameModalButtonSaveText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default BoardScreen;
