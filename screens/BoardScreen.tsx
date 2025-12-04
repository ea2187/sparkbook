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
  Animated,
  TouchableWithoutFeedback,
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
import OrganizeModal from '../components/OrganizeModal';
import { organizeBoardSimple } from '../lib/organizeBoard'; 


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
  const [zoom, setZoom] = useState(1);
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [organizeModalVisible, setOrganizeModalVisible] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [boardNameModalVisible, setBoardNameModalVisible] = useState(false);
  
  // Undo/Redo state
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef({ history: [] as any[][], index: -1 });

  // Track scroll position for viewport-based organization
  const [scrollX, setScrollX] = useState((BOARD_WIDTH - SCREEN_WIDTH) / 2);
  const [scrollY, setScrollY] = useState((BOARD_HEIGHT - SCREEN_HEIGHT) / 2);

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

  // Zoom controls
  function handleZoomIn() {
    const newZoom = Math.min(zoom + 0.25, 3);
    setZoom(newZoom);
    Animated.spring(zoomAnim, {
      toValue: newZoom,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }

  function handleZoomOut() {
    const newZoom = Math.max(zoom - 0.25, 0.1);
    setZoom(newZoom);
    Animated.spring(zoomAnim, {
      toValue: newZoom,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }

  function handleResetZoom() {
    setZoom(1);
    Animated.spring(zoomAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }

  // Update spark position in database
  function handleSparkMove(id: string, newX: number, newY: number) {
    // Validate coordinates
    if (!isFinite(newX) || !isFinite(newY) || isNaN(newX) || isNaN(newY)) {
      console.error("❌ Invalid spark position values:", { newX, newY });
      return;
    }

    // Round to integers to avoid database errors
    const roundedX = Math.round(newX);
    const roundedY = Math.round(newY);

    // Update UI immediately
    setSparks((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, x: roundedX, y: roundedY } : s));
      // Add to history after move completes
      setTimeout(() => addToHistory(updated), 100);
      return updated;
    });

    // Update database in background
    supabase
      .from("sparks")
      .update({ x: roundedX, y: roundedY })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("❌ Failed to update spark position:", error);
          console.error("Attempted values:", { x: roundedX, y: roundedY, id });
        }
      });
  }

  // Handle tap - toggle selection (select if not selected, deselect if already selected)
  function handleSparkTap(id: string) {
    setSelectedSparkId(prev => prev === id ? null : id);
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
    // Update UI immediately for smooth feedback
    setSparks((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, width: newWidth, height: newHeight } : s));
      // Add to history after resize completes
      setTimeout(() => addToHistory(updated), 150);
      return updated;
    });

    // Update database
    const { error } = await supabase
      .from("sparks")
      .update({ width: newWidth, height: newHeight })
      .eq("id", id);

    if (error) {
      console.error("Failed to update spark size:", error);
      // Revert on error
      fetchSparks();
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

  // Handle organize with preset options
  async function handleOrganize(method: 'grid' | 'spacing' | 'byType') {
    if (sparks.length === 0) {
      Alert.alert("No Sparks", "Add some sparks to your board before organizing.");
      setOrganizeModalVisible(false);
      return;
    }

    setIsOrganizing(true);
    try {
      // Prepare spark info
      const sparkInfo = sparks.map(spark => ({
        id: spark.id,
        type: spark.type,
        title: spark.title || undefined,
        text_content: spark.text_content || undefined,
        x: spark.x,
        y: spark.y,
        width: spark.width,
        height: spark.height,
      }));

      // Calculate viewport bounds (current visible area)
      const viewportX = scrollX;
      const viewportY = scrollY;
      const viewportWidth = SCREEN_WIDTH;
      const viewportHeight = SCREEN_HEIGHT;
      
      // Get organized positions using simple organization within viewport
      const organizedPositions = organizeBoardSimple(
        sparkInfo,
        method,
        viewportWidth,
        viewportHeight,
        viewportX,
        viewportY
      );

      // Save current state to history before organizing
      addToHistory([...sparks]);

      // Update all sparks with new positions
      const updatedSparks = sparks.map(spark => {
        const newPos = organizedPositions.find(pos => pos.id === spark.id);
        if (newPos) {
          return { ...spark, x: newPos.x, y: newPos.y };
        }
        return spark;
      });

      setSparks(updatedSparks);

      // Update positions in database
      for (const pos of organizedPositions) {
        const { error } = await supabase
          .from("sparks")
          .update({ x: pos.x, y: pos.y })
          .eq("id", pos.id);

        if (error) {
          console.error(`Failed to update spark ${pos.id}:`, error);
        }
      }

      // No need to scroll since we're organizing within the current viewport

      setOrganizeModalVisible(false);
      Alert.alert("Success", "Board organized successfully!");
    } catch (error: any) {
      console.error("Error organizing board:", error);
      Alert.alert("Error", error.message || "Failed to organize board.");
    } finally {
      setIsOrganizing(false);
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
            onPress={() => navigation.navigate('HomeMain')}
          >
            <Image source={require("../assets/selected home.png")} style={styles.backButtonIcon} />
          </TouchableOpacity>
        </View>
        
        {/* UNDO/REDO BUTTONS - moved to left side */}
        <View style={styles.undoRedoContainer}>
          <TouchableOpacity 
            style={[styles.undoRedoButton, historyIndex <= 0 && styles.undoRedoButtonDisabled]}
            onPress={handleUndo}
            disabled={historyIndex <= 0}
          >
          <Ionicons 
            name="arrow-undo" 
            size={16} 
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
            size={16} 
            color={historyIndex >= history.length - 1 ? theme.colors.textLight : theme.colors.textPrimary} 
          />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerTitleContainer}>
          <View style={styles.boardNameDropdownContainer}>
            <TouchableOpacity
              onPress={() => setBoardNameModalVisible(!boardNameModalVisible)}
              activeOpacity={0.7}
            >
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{boardName}</Text>
            </TouchableOpacity>
            {boardNameModalVisible && (
              <View style={styles.boardNameDropdown}>
                <Text style={styles.boardNameDropdownText}>{boardName}</Text>
              </View>
            )}
          </View>
          {uploading && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
          )}
        </View>

        {/* HELP BUTTON - centered between title and organize button */}
        <TouchableOpacity
          style={styles.helpButtonHeader}
          onPress={() => setHelpModalVisible(true)}
        >
          <Ionicons name="information-circle" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.rightButtonsContainer}>
          {/* ORGANIZE BUTTON */}
          <View style={styles.organizeContainer}>
            <TouchableOpacity
              style={styles.organizeButton}
              onPress={() => setOrganizeModalVisible(true)}
            >
              <Ionicons name="sparkles" size={20} color={theme.colors.textPrimary} />
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
        onScroll={(event) => {
          const { contentOffset } = event.nativeEvent;
          setScrollX(contentOffset.x);
          setScrollY(contentOffset.y);
        }}
        scrollEventThrottle={16}
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
        <Animated.View 
          style={[
            styles.canvasContent,
            {
              transform: [{ scale: zoomAnim }],
            },
          ]}
        >
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
              onResize={handleSparkResize}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTap={handleSparkTap}
              onLongPress={handleSparkLongPress}
              onDelete={handleDeleteSpark}
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
        </Animated.View>
      </ScrollView>


      {/* ZOOM CONTROLS */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={handleZoomOut}
          disabled={zoom <= 0.5}
        >
          <Ionicons name="remove" size={20} color={zoom <= 0.5 ? theme.colors.textLight : theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.zoomResetButton}
          onPress={handleResetZoom}
        >
          <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={handleZoomIn}
          disabled={zoom >= 3}
        >
          <Ionicons name="add" size={20} color={zoom >= 3 ? theme.colors.textLight : theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>


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
          <Image source={require("../assets/music.png")} style={styles.bottomBarIconImage} />
          <Text style={styles.bottomBarLabel}>Music</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon} onPress={handlePhotoButton}>
          <Image source={require("../assets/photo.png")} style={styles.bottomBarIconImage} />
          <Text style={styles.bottomBarLabel}>Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarIcon} onPress={() => setMoreMenuVisible(true)}>
          <View style={styles.bottomBarIconPlaceholder}>
            <Ionicons name="ellipsis-horizontal" size={28} color={theme.colors.textPrimary} />
          </View>
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

      <OrganizeModal
        visible={organizeModalVisible}
        onClose={() => setOrganizeModalVisible(false)}
        onSelectOption={handleOrganize}
        isOrganizing={isOrganizing}
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


      {/* HELP MODAL */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.helpModalOverlay}
          activeOpacity={1}
          onPress={() => setHelpModalVisible(false)}
        >
          <View style={styles.helpModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.helpModalHeader}>
              <Ionicons name="information-circle" size={32} color={theme.colors.primary} />
              <Text style={styles.helpModalTitle}>How to Use Your Board</Text>
            </View>
            
            <View style={styles.helpSection}>
              <View style={styles.helpItem}>
                <Ionicons name="finger-print" size={20} color={theme.colors.primary} />
                <Text style={styles.helpItemText}><Text style={styles.helpBold}>Tap</Text> a spark to select, resize, or delete</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="hand-left" size={20} color={theme.colors.primary} />
                <Text style={styles.helpItemText}><Text style={styles.helpBold}>Long press</Text> to view spark details</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="move" size={20} color={theme.colors.primary} />
                <Text style={styles.helpItemText}><Text style={styles.helpBold}>Drag</Text> to move sparks around</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="resize" size={20} color={theme.colors.primary} />
                <Text style={styles.helpItemText}><Text style={styles.helpBold}>Blue corners</Text> appear when selected to resize</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="arrow-undo" size={20} color={theme.colors.primary} />
                <Text style={styles.helpItemText}><Text style={styles.helpBold}>Undo/Redo</Text> buttons track all changes</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
                <Text style={styles.helpItemText}><Text style={styles.helpBold}>Organize</Text> auto-arranges your sparks neatly</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.helpModalButton}
              onPress={() => setHelpModalVisible(false)}
            >
              <Text style={styles.helpModalButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.light },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.white,
    zIndex: 10000,
    elevation: 12,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    justifyContent: "space-between",
  },
  leftHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  helpButtonHeader: {
    position: "absolute",
    right: 75,
    top: 50,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.md,
    zIndex: 1,
  },
  headerTitleContainer: {
    position: "absolute",
    left: 150,
    right: 150,
    top: 50,
    bottom: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.md,
  },
  backButtonIcon: {
    width: 36,
    height: 36,
    resizeMode: "contain",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    flexShrink: 1,
    maxWidth: 200,
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
  rightButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  undoRedoContainer: {
    position: "absolute",
    left: 75,
    top: 50,
    bottom: 12,
    flexDirection: "row",
    gap: 6,
    zIndex: 10001,
    alignItems: "center",
  },
  undoRedoButton: {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
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
    minWidth: 44,
    minHeight: 44,
    padding: 4,
  },
  bottomBarIconImage: { 
    width: 32, 
    height: 32,
    resizeMode: "contain",
    marginBottom: 6,
  },
  bottomBarIconPlaceholder: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
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
  zoomControls: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    padding: 4,
    gap: 4,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  zoomResetButton: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    minWidth: 60,
  },
  zoomText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  boardNameDropdownContainer: {
    position: "relative",
    zIndex: 1000,
  },
  boardNameDropdown: {
    position: "absolute",
    top: 30,
    left: "50%",
    marginLeft: -100,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 12,
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 1001,
    minWidth: 200,
    maxWidth: 300,
  },
  boardNameDropdownText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  helpModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  helpModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  helpModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  helpModalTitle: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  helpSection: {
    gap: 16,
    marginBottom: 24,
  },
  helpItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  helpItemText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  helpBold: {
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  helpModalButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.md,
  },
  helpModalButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default BoardScreen;
