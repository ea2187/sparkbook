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
  Modal,
  TouchableWithoutFeedback,
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
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedBoardNames, setAddedBoardNames] = useState<string[]>([]);

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
    } else {
      Alert.alert("Error", "Failed to load boards");
    }
    setLoadingBoards(false);
  }

  function toggleBoardSelection(boardId: string) {
    setSelectedBoardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(boardId)) {
        newSet.delete(boardId);
      } else {
        newSet.add(boardId);
      }
      return newSet;
    });
  }

  async function handleContinue() {
    if (!photoName.trim()) {
      Alert.alert("Error", "Please enter a name for your photo");
      return;
    }

    if (selectedBoardIds.size === 0) {
      Alert.alert("No Board Selected", "Please select at least one board");
      return;
    }

    setLoading(true);
    
    try {
      // Upload image to Supabase Storage (use first selected board for storage path)
      const firstBoardId = Array.from(selectedBoardIds)[0];
      const uploadedUrl = await uploadImageAsync(imageUri, firstBoardId);
      
      if (!uploadedUrl) {
        Alert.alert("Error", "Failed to upload photo");
        setLoading(false);
        return;
      }

      // Calculate spawn position near center of board canvas
      const spawnX = SCREEN_WIDTH * 2.5 + (Math.random() * 200 - 100);
      const spawnY = SCREEN_HEIGHT * 2.5 + (Math.random() * 200 - 100);

      // Create spark in all selected boards
      await Promise.all(
        Array.from(selectedBoardIds).map(boardId =>
          createSpark(boardId, uploadedUrl, spawnX, spawnY)
        )
      );
      
      // Get board names for success message
      const addedBoards = boards.filter(board => selectedBoardIds.has(board.id));
      const boardNames = addedBoards.map(board => board.name);
      
      // Navigate based on selection count
      if (selectedBoardIds.size === 1) {
        // Single board: navigate to that board
        navigation.navigate("Board", { boardId: firstBoardId });
      } else {
        // Multiple boards: show success message then go home
        setAddedBoardNames(boardNames);
        setShowSuccessModal(true);
        // Auto-dismiss after 2 seconds and navigate home
        setTimeout(() => {
          setShowSuccessModal(false);
          navigation.navigate("HomeMain");
        }, 2000);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      Alert.alert("Error", "Failed to add photo to boards");
    } finally {
      setLoading(false);
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
              placeholder="Enter photo name"
              placeholderTextColor={theme.colors.textLight}
              value={photoName}
              onChangeText={setPhotoName}
              editable={!loading}
            />
          </View>

          {/* Board Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Boards</Text>
            <Text style={styles.subLabel}>
              {selectedBoardIds.size === 0 
                ? "Select at least one board" 
                : `${selectedBoardIds.size} board${selectedBoardIds.size > 1 ? 's' : ''} selected`}
            </Text>
            {loadingBoards ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading boards...</Text>
              </View>
            ) : boards.length === 0 ? (
              <Text style={styles.emptyText}>No boards available</Text>
            ) : (
              <View style={styles.boardList}>
                {boards.map((board) => {
                  const isSelected = selectedBoardIds.has(board.id);
                  return (
                    <TouchableOpacity
                      key={board.id}
                      style={[
                        styles.boardOption,
                        isSelected && styles.boardOptionSelected,
                      ]}
                      onPress={() => toggleBoardSelection(board.id)}
                      disabled={loading}
                    >
                      <View style={styles.boardOptionContent}>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={24}
                          color={
                            isSelected
                              ? theme.colors.primary
                              : theme.colors.textLight
                          }
                        />
                        <Text
                          style={[
                            styles.boardName,
                            isSelected && styles.boardNameSelected,
                          ]}
                        >
                          {board.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (loadingBoards || boards.length === 0 || selectedBoardIds.size === 0) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={loadingBoards || boards.length === 0 || selectedBoardIds.size === 0 || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>
              Add to {selectedBoardIds.size > 0 ? `${selectedBoardIds.size} board${selectedBoardIds.size > 1 ? 's' : ''}` : 'board'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal for Multiple Boards */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          navigation.navigate("HomeMain");
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowSuccessModal(false);
          navigation.navigate("HomeMain");
        }}>
          <View style={styles.successModalOverlay}>
            <View style={styles.successModalContent}>
              <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              <Text style={styles.successModalTitle}>Photo Added!</Text>
              <Text style={styles.successModalSubtitle}>
                Added to {addedBoardNames.length} board{addedBoardNames.length > 1 ? 's' : ''}:
              </Text>
              <View style={styles.successBoardList}>
                {addedBoardNames.map((name, index) => (
                  <Text key={index} style={styles.successBoardName}>
                    • {name}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    paddingTop: 70,
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
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: 12,
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
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  successModalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  successModalSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successBoardList: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  successBoardName: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
});

export default AddPhotoDetailsScreen;
