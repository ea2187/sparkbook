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
import theme from "../styles/theme";
import { uploadFileAsync } from "../lib/uploadFile";
import { createFileSpark } from "../lib/createFileSpark";
import type { HomeStackParamList } from "../types";

type ImportFileScreenRouteProp = RouteProp<HomeStackParamList, "ImportFile">;

const ImportFileScreen: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ImportFileScreenRouteProp>();
  const { boardId } = route.params;
  const [uploading, setUploading] = useState(false);

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

      setUploading(true);

      // Upload file
      const url = await uploadFileAsync(
        file.uri,
        boardId,
        file.name,
        file.mimeType || 'application/octet-stream'
      );

      if (!url) {
        Alert.alert("Error", "Failed to upload file");
        setUploading(false);
        return;
      }

      // Create spark
      const spark = await createFileSpark(
        boardId,
        url,
        file.name,
        file.mimeType || 'application/octet-stream'
      );

      setUploading(false);

      if (!spark) {
        Alert.alert("Error", "Failed to create file spark");
        return;
      }

      Alert.alert("Success", "File imported successfully!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error("Error picking document:", error);
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
        <View style={styles.uploadSection}>
          <Ionicons name="cloud-upload-outline" size={80} color={theme.colors.primary} />
          <Text style={styles.titleText}>Import a File</Text>
          <Text style={styles.subtitleText}>
            Select a document, PDF, or any file to add to your board
          </Text>

          <TouchableOpacity
            style={[styles.importButton, uploading && styles.importButtonDisabled]}
            onPress={handlePickDocument}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={24} color={theme.colors.white} />
                <Text style={styles.importButtonText}>Choose File</Text>
              </>
            )}
          </TouchableOpacity>

          {uploading && (
            <Text style={styles.uploadingText}>Uploading file...</Text>
          )}
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
