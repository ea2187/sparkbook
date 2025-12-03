import React, { FC, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { HomeStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { supabase } from "../lib/supabase";
import theme from "../styles/theme";
import { useFocusEffect } from "@react-navigation/native";

type Props = StackScreenProps<HomeStackParamList, "SparkDetails">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SparkDetailsScreen: FC<Props> = ({ navigation, route }) => {
  const { sparkId, boardId } = route.params;
  const [spark, setSpark] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [tempSize, setTempSize] = useState({ width: 160, height: 160 });
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchSpark();
    }, [sparkId])
  );

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  async function fetchSpark() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sparks")
      .select("*")
      .eq("id", sparkId)
      .single();

    setLoading(false);

    if (error || !data) {
      Alert.alert("Error", "Failed to load spark");
      navigation.goBack();
      return;
    }

    setSpark(data);
    setEditedName(data.name || "");
    setTempSize({ width: data.width || 160, height: data.height || 160 });
  }

  async function handleSaveName() {
    if (!editedName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("sparks")
      .update({ name: editedName })
      .eq("id", sparkId);

    setSaving(false);

    if (error) {
      Alert.alert("Error", "Failed to rename spark");
      return;
    }

    setSpark({ ...spark, name: editedName });
    setIsEditing(false);
  }

  function handleDeletePress() {
    Alert.alert(
      "Delete Spark",
      "Are you sure you want to delete this spark?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDelete,
        },
      ]
    );
  }

  async function handleDelete() {
    setDeleting(true);

    const { error } = await supabase.from("sparks").delete().eq("id", sparkId);

    if (error) {
      setDeleting(false);
      Alert.alert("Error", "Failed to delete spark");
      return;
    }

    // Navigate back to board
    navigation.navigate("Board", { boardId });
  }

  async function handleSaveSize() {
    setResizing(true);
    const { error } = await supabase
      .from("sparks")
      .update({ width: tempSize.width, height: tempSize.height })
      .eq("id", sparkId);

    setResizing(false);

    if (error) {
      console.error("Resize error:", error);
      Alert.alert("Error", `Failed to resize spark: ${error.message}`);
      return;
    }

    setSpark({ ...spark, width: tempSize.width, height: tempSize.height });
    Alert.alert("Success", "Spark resized successfully");
  }

  function handleResetSize() {
    setTempSize({ width: 160, height: 160 });
  }

  async function toggleAudioPlayback() {
    if (!spark?.content_url) return;

    // Check if this is a music spark
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

    // Open music in Spotify
    if (isMusic) {
      try {
        if (spotifyUri) {
          const canOpen = await Linking.canOpenURL(spotifyUri);
          if (canOpen) {
            await Linking.openURL(spotifyUri);
            return;
          }
        }
        if (spotifyUrl) {
          await Linking.openURL(spotifyUrl);
        }
      } catch (error) {
        console.error('Error opening Spotify:', error);
        Alert.alert('Error', 'Could not open Spotify');
      }
      return;
    }

    // Play voice recording
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
      Alert.alert('Error', 'Could not play audio');
      setIsPlaying(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!spark) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spark Details</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeletePress}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Content Preview */}
        {spark.type === 'image' && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: spark.content_url }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        {spark.type === 'note' && (
          <View style={styles.noteContainer}>
            <View style={styles.noteCard}>
              {spark.title && (
                <Text style={styles.noteTitle}>{spark.title}</Text>
              )}
              {spark.text_content && (
                <Text style={styles.noteBody}>{spark.text_content}</Text>
              )}
            </View>
          </View>
        )}

        {spark.type === 'audio' && (() => {
          // Parse metadata if music
          let metadata = null;
          let isMusic = false;
          try {
            if (spark.text_content && spark.text_content.startsWith('{')) {
              metadata = JSON.parse(spark.text_content);
              isMusic = true;
            }
          } catch (e) {
            // Voice recording
          }

          if (isMusic) {
            const displayMode = metadata?.displayMode || 'album';
            return (
              <View style={styles.audioContainer}>
                <View style={styles.musicPreview}>
                  {displayMode === 'album' && metadata.albumImage ? (
                    <Image
                      source={{ uri: metadata.albumImage }}
                      style={styles.albumArt}
                    />
                  ) : (
                    <View style={styles.musicTextPreview}>
                      <Ionicons name="musical-notes" size={48} color="#8B5CF6" />
                      <Text style={styles.musicTitle}>{spark.title}</Text>
                      {metadata.artists && (
                        <Text style={styles.musicArtist}>{metadata.artists}</Text>
                      )}
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.spotifyButton}
                  onPress={toggleAudioPlayback}
                >
                  <Ionicons name="musical-notes" size={24} color="#FFF" />
                  <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
                </TouchableOpacity>
              </View>
            );
          } else {
            // Voice recording
            return (
              <View style={styles.audioContainer}>
                <View style={styles.voicePreview}>
                  <Ionicons
                    name={isPlaying ? "pause-circle" : "mic-circle"}
                    size={80}
                    color="#10B981"
                  />
                  <Text style={styles.voiceLabel}>{spark.title || 'Audio Recording'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={toggleAudioPlayback}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={24}
                    color="#FFF"
                  />
                  <Text style={styles.playButtonText}>
                    {isPlaying ? 'Pause' : 'Play'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
        })()}

        {spark.type === 'image' && spark.text_content && 
          !spark.text_content.startsWith('{') && 
          spark.text_content.includes('/') && 
          spark.title && (
          <View style={styles.fileContainer}>
            <View style={styles.filePreview}>
              <Image
                source={require("../assets/file.png")}
                style={styles.filePreviewIcon}
              />
              <Text style={styles.filePreviewName}>{spark.title}</Text>
              <Text style={styles.filePreviewType}>
                {spark.text_content?.split('/').pop()?.toUpperCase() || 'FILE'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => {
                if (spark.content_url) {
                  Linking.openURL(spark.content_url).catch(err => {
                    Alert.alert('Error', 'Could not open file');
                  });
                }
              }}
            >
              <Ionicons name="download-outline" size={24} color="#FFF" />
              <Text style={styles.downloadButtonText}>Open File</Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Name Section */}
      <View style={styles.nameSection}>
        <View style={styles.nameSectionHeader}>
          <Text style={styles.label}>Name</Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Spark name"
              autoFocus
              editable={!saving}
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => {
                  setIsEditing(false);
                  setEditedName(spark.name || "");
                }}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={handleSaveName}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.nameText}>{spark.name || "Untitled"}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Type</Text>
          <Text style={styles.infoValue}>{spark.type}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Position</Text>
          <Text style={styles.infoValue}>
            x: {Math.round(spark.x)}, y: {Math.round(spark.y)}
          </Text>
        </View>
      </View>

      {/* Resize Section */}
      <View style={styles.resizeSection}>
        <Text style={styles.sectionTitle}>Resize Spark</Text>
        
        <View style={styles.resizeControls}>
          <View style={styles.sizeControl}>
            <Text style={styles.sizeLabel}>Width</Text>
            <View style={styles.sizeButtons}>
              <TouchableOpacity
                style={styles.sizeButton}
                onPress={() => setTempSize({ ...tempSize, width: Math.max(80, tempSize.width - 20) })}
              >
                <Ionicons name="remove" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={styles.sizeValue}>{tempSize.width}</Text>
              <TouchableOpacity
                style={styles.sizeButton}
                onPress={() => setTempSize({ ...tempSize, width: Math.min(400, tempSize.width + 20) })}
              >
                <Ionicons name="add" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sizeControl}>
            <Text style={styles.sizeLabel}>Height</Text>
            <View style={styles.sizeButtons}>
              <TouchableOpacity
                style={styles.sizeButton}
                onPress={() => setTempSize({ ...tempSize, height: Math.max(80, tempSize.height - 20) })}
              >
                <Ionicons name="remove" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={styles.sizeValue}>{tempSize.height}</Text>
              <TouchableOpacity
                style={styles.sizeButton}
                onPress={() => setTempSize({ ...tempSize, height: Math.min(400, tempSize.height + 20) })}
              >
                <Ionicons name="add" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.resizeActionButtons}>
          <TouchableOpacity
            style={[styles.resizeActionButton, styles.resetButton]}
            onPress={handleResetSize}
            disabled={resizing}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resizeActionButton, styles.applyButton]}
            onPress={handleSaveSize}
            disabled={resizing}
          >
            {resizing ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={styles.applyButtonText}>Apply Size</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  deleteButton: {
    padding: 8,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  noteContainer: {
    padding: 20,
    backgroundColor: "#F5F5F5",
    minHeight: 200,
  },
  noteCard: {
    backgroundColor: "#FFFBEA",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FACC15",
    minHeight: 160,
  },
  noteTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  noteBody: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
  audioContainer: {
    padding: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    gap: 20,
  },
  voicePreview: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 40,
  },
  voiceLabel: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: "#10B981",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    ...theme.shadows.md,
  },
  playButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: "#FFF",
  },
  musicPreview: {
    width: 240,
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    ...theme.shadows.lg,
  },
  albumArt: {
    width: "100%",
    height: "100%",
  },
  musicTextPreview: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FAF5FF",
    borderWidth: 2,
    borderColor: "#8B5CF6",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  musicTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: "#8B5CF6",
    textAlign: "center",
  },
  musicArtist: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: "#A78BFA",
    textAlign: "center",
  },
  spotifyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1DB954",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    ...theme.shadows.md,
  },
  spotifyButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: "#FFF",
  },
  fileContainer: {
    padding: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    gap: 20,
  },
  filePreview: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 40,
    backgroundColor: "#F0F4FF",
    borderRadius: 16,
    width: "100%",
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  filePreviewIcon: {
    width: 80,
    height: 80,
    resizeMode: "contain",
  },
  filePreviewName: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  filePreviewType: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    ...theme.shadows.md,
  },
  downloadButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: "#FFF",
  },
  nameSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  nameSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  nameText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  editContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 12,
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: theme.colors.light,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  infoSection: {
    padding: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  resizeSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  resizeControls: {
    gap: 16,
  },
  sizeControl: {
    gap: 8,
  },
  sizeLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  sizeButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 12,
  },
  sizeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.sm,
  },
  sizeValue: {
    flex: 1,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  resizeActionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  resizeActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  resetButton: {
    backgroundColor: theme.colors.light,
  },
  resetButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
  },
  applyButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default SparkDetailsScreen;
