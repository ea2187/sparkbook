import React, { FC, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";
import theme from "../styles/theme";
import { uploadFileAsync } from "../lib/uploadFile";
import { createFileSpark } from "../lib/createFileSpark";
import type { HomeStackParamList } from "../types";

type ImportFileScreenRouteProp = RouteProp<HomeStackParamList, "ImportFile">;

const ImportFileScreen: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ImportFileScreenRouteProp>();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  React.useEffect(() => {
    fetchBoards();
  }, []);

  async function fetchBoards() {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        Alert.alert('Error', 'Failed to load boards');
        return;
      }

      setBoards(data || []);
      if (data && data.length > 0) {
        setSelectedBoardId(data[0].id);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoadingBoards(false);
    }
  }

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!file) return;

      setSelectedFile(file);
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to pick file");
    }
  }

  async function handleAddToBoard() {
    if (!selectedFile || !selectedBoardId) {
      Alert.alert("Error", "Please select a file and board");
      return;
    }

    setUploading(true);

    try {
      // Upload file
      const url = await uploadFileAsync(
        selectedFile.uri,
        selectedBoardId,
        selectedFile.name,
        selectedFile.mimeType || 'application/octet-stream'
      );

      if (!url) {
        Alert.alert("Error", "Failed to upload file");
        setUploading(false);
        return;
      }

      // Create spark
      const spark = await createFileSpark(
        selectedBoardId,
        url,
        selectedFile.name,
        selectedFile.mimeType || 'application/octet-stream'
      );

      setUploading(false);

      if (!spark) {
        Alert.alert("Error", "Failed to create file spark");
        return;
      }

      navigation.navigate('Board', { boardId: selectedBoardId });
    } catch (error) {
      console.error("Error uploading file:", error);
      Alert.alert("Error", "Failed to import file");
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import File</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!selectedFile ? (
          <>
            <View style={styles.uploadSection}>
              <Ionicons name="cloud-upload-outline" size={80} color={theme.colors.primary} />
              <Text style={styles.titleText}>Import a File</Text>
              <Text style={styles.subtitleText}>
                Select a document, PDF, or any file to add to your board
              </Text>

              <TouchableOpacity
                style={styles.importButton}
                onPress={handlePickDocument}
              >
                <Ionicons name="document-text-outline" size={24} color={theme.colors.white} />
                <Text style={styles.importButtonText}>Choose File</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Supported File Types</Text>
              <View style={styles.fileTypesList}>
                <View style={styles.fileTypeItem}>
                  <Ionicons name="document-text" size={20} color={theme.colors.primary} />
                  <Text style={styles.fileTypeText}>Documents (PDF, DOC, DOCX, TXT)</Text>
                </View>
                <View style={styles.fileTypeItem}>
                  <Ionicons name="images" size={20} color={theme.colors.primary} />
                  <Text style={styles.fileTypeText}>Images (JPG, PNG, GIF)</Text>
                </View>
                <View style={styles.fileTypeItem}>
                  <Ionicons name="musical-notes" size={20} color={theme.colors.primary} />
                  <Text style={styles.fileTypeText}>Audio Files (MP3, M4A, WAV)</Text>
                </View>
                <View style={styles.fileTypeItem}>
                  <Ionicons name="videocam" size={20} color={theme.colors.primary} />
                  <Text style={styles.fileTypeText}>Video Files (MP4, MOV)</Text>
                </View>
                <View style={styles.fileTypeItem}>
                  <Ionicons name="folder" size={20} color={theme.colors.primary} />
                  <Text style={styles.fileTypeText}>Other Files</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.uploadSection}>
            {/* File Info */}
            <View style={styles.fileInfo}>
              <Ionicons name="document" size={60} color={theme.colors.primary} />
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <Text style={styles.fileSize}>
                {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(2)} KB` : 'Unknown size'}
              </Text>
              <TouchableOpacity
                style={styles.changeFileButton}
                onPress={handlePickDocument}
              >
                <Text style={styles.changeFileText}>Change File</Text>
              </TouchableOpacity>
            </View>

            {/* Board Selector */}
            <View style={styles.boardSection}>
              <Text style={styles.sectionLabel}>Select Board</Text>
              {loadingBoards ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : boards.length === 0 ? (
                <Text style={styles.noBoardsText}>No boards available</Text>
              ) : (
                <View style={styles.boardsList}>
                  {boards.map((board) => (
                    <TouchableOpacity
                      key={board.id}
                      style={[
                        styles.boardItem,
                        selectedBoardId === board.id && styles.boardItemSelected,
                      ]}
                      onPress={() => setSelectedBoardId(board.id)}
                    >
                      <View style={styles.boardItemContent}>
                        <View
                          style={[
                            styles.radioOuter,
                            selectedBoardId === board.id && styles.radioOuterSelected,
                          ]}
                        >
                          {selectedBoardId === board.id && <View style={styles.radioInner} />}
                        </View>
                        <Text
                          style={[
                            styles.boardItemText,
                            selectedBoardId === board.id && styles.boardItemTextSelected,
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

            {/* Add Button */}
            <TouchableOpacity
              style={[
                styles.addButton,
                (!selectedBoardId || uploading) && styles.addButtonDisabled,
              ]}
              onPress={handleAddToBoard}
              disabled={!selectedBoardId || uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.addButtonText}>Add to Board</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  uploadSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  titleText: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    ...theme.shadows.md,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  uploadingText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  fileInfo: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    marginBottom: 24,
  },
  fileName: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  fileSize: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  changeFileButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeFileText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary,
  },
  boardSection: {
    width: '100%',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  boardsList: {
    maxHeight: 200,
  },
  boardItem: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  boardItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E8EFFF',
  },
  boardItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.textLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  boardItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  boardItemTextSelected: {
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary,
  },
  noBoardsText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  infoSection: {
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  fileTypesList: {
    gap: 12,
  },
  fileTypeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.light,
    borderRadius: 12,
  },
  fileTypeText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
});

export default ImportFileScreen;
