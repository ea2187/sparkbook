import React, { FC, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp, NavigationProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { uploadImageAsync } from "../lib/uploadImage";
import { createSpark } from "../lib/createSpark";
import theme from "../styles/theme";
import type { HomeStackParamList } from "../types";

type AddPhotoDetailsRouteProp = RouteProp<HomeStackParamList, "AddPhotoDetails">;
type AddPhotoDetailsNavigationProp = NavigationProp<HomeStackParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const AddPhotoDetailsScreen: FC = () => {
  const route = useRoute<AddPhotoDetailsRouteProp>();
  const navigation = useNavigation<AddPhotoDetailsNavigationProp>();
  const { imageUri } = route.params;

  const [photoName, setPhotoName] = useState("");
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(true);

  useEffect(() => {
    fetchBoards();
  }, []);

  async function fetchBoards() {
    setLoadingBoards(true);
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBoards(data);
      if (data.length > 0) {
        setSelectedBoardId(data[0].id);
      }
    } else {
      Alert.alert("Error", "Failed to load boards");
    }
    setLoadingBoards(false);
  }

  function handleContinue() {
    if (!photoName.trim()) {
      Alert.alert("Missing Name", "Please enter a name for your photo");
      return;
    }

    if (!selectedBoardId) {
      Alert.alert("No Board Selected", "Please select a board");
      return;
    }

    // Navigate immediately to board
    navigation.navigate("Board", { boardId: selectedBoardId });

    // Upload in background
    uploadInBackground();
  }

  async function uploadInBackground() {
    try {
      // Set global flag for upload in progress
      (global as any).__uploadingPhoto = true;
      
      // Upload image to Supabase Storage
      const uploadedUrl = await uploadImageAsync(imageUri, selectedBoardId);
      
      if (!uploadedUrl) {
        console.error("Upload failed");
        (global as any).__uploadingPhoto = false;
        return;
      }

      // Calculate spawn position near center of board canvas
      const spawnX = SCREEN_WIDTH * 2.5 + (Math.random() * 200 - 100);
      const spawnY = SCREEN_HEIGHT * 2.5 + (Math.random() * 200 - 100);

      // Create spark in database
      await createSpark(selectedBoardId, uploadedUrl, spawnX, spawnY);
      
      console.log("✅ Photo uploaded successfully");
      (global as any).__uploadingPhoto = false;
    } catch (error) {
      console.error("Error uploading photo:", error);
      (global as any).__uploadingPhoto = false;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Photo</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Preview */}
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Photo Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photo Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter a name for this photo"
              placeholderTextColor={theme.colors.textLight}
              value={photoName}
              onChangeText={setPhotoName}
              editable={!loading}
            />
          </View>

          {/* Board Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Board</Text>
            {loadingBoards ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading boards...</Text>
              </View>
            ) : boards.length === 0 ? (
              <Text style={styles.emptyText}>No boards available</Text>
            ) : (
              <View style={styles.boardList}>
                {boards.map((board) => (
                  <TouchableOpacity
                    key={board.id}
                    style={[
                      styles.boardOption,
                      selectedBoardId === board.id && styles.boardOptionSelected,
                    ]}
                    onPress={() => setSelectedBoardId(board.id)}
                    disabled={loading}
                  >
                    <View style={styles.boardOptionContent}>
                      <Ionicons
                        name={
                          selectedBoardId === board.id
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={24}
                        color={
                          selectedBoardId === board.id
                            ? theme.colors.primary
                            : theme.colors.textLight
                        }
                      />
                      <Text
                        style={[
                          styles.boardName,
                          selectedBoardId === board.id && styles.boardNameSelected,
                        ]}
                      >
                        {board.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          disabled={loadingBoards || boards.length === 0}
        >
          <Text style={styles.continueButtonText}>Add to Board</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.light,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  previewContainer: {
    padding: 20,
  },
  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  formCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 20,
    ...theme.shadows.md,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textLight,
    padding: 16,
    textAlign: "center",
  },
  boardList: {
    gap: 8,
  },
  boardOption: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  boardOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#E8EFFF",
  },
  boardOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  boardName: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  boardNameSelected: {
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.md,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default AddPhotoDetailsScreen;
