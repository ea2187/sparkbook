import React, { FC, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import theme from "../styles/theme";

interface BoardOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  onBoardDeleted: () => void;
  onBoardRenamed: (newName: string) => void;
}

const BoardOptionsMenu: FC<BoardOptionsMenuProps> = ({
  visible,
  onClose,
  boardId,
  boardName,
  onBoardDeleted,
  onBoardRenamed,
}) => {
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [newName, setNewName] = useState(boardName);
  const [loading, setLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Check if board is shared when menu opens
  useEffect(() => {
    if (visible) {
      checkIfShared();
    }
  }, [visible, boardId]);

  async function handleRename() {
    if (!newName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("boards")
      .update({ name: newName })
      .eq("id", boardId);

    setLoading(false);

    if (error) {
      Alert.alert("Error", "Failed to rename Sparklette");
      return;
    }

    onBoardRenamed(newName);
    setShowRenameInput(false);
    onClose();
  }

  function handleDeletePress() {
    Alert.alert(
      "Delete Sparklette",
      `Are you sure you want to delete "${boardName}"? This action cannot be undone.`,
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
    setLoading(true);

    // Delete all sparks first
    await supabase.from("sparks").delete().eq("board_id", boardId);

    // Delete board
    const { error } = await supabase.from("boards").delete().eq("id", boardId);

    setLoading(false);

    if (error) {
      Alert.alert("Error", "Failed to delete board");
      return;
    }

    onBoardDeleted();
    onClose();
  }

  async function checkIfShared() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsShared(false);
        return;
      }

      // Get all sparks from this board
      const { data: sparks } = await supabase
        .from("sparks")
        .select("id")
        .eq("board_id", boardId);

      if (!sparks || sparks.length === 0) {
        setIsShared(false);
        return;
      }

      const sparkIds = sparks.map(s => s.id);

      // Find community posts of type sparklette by this user
      const { data: posts } = await supabase
        .from("community_posts")
        .select("id, attachments:community_attachments(spark_id)")
        .eq("user_id", userData.user.id)
        .eq("type", "sparklette");

      if (!posts) {
        setIsShared(false);
        return;
      }

      // Check if any post has attachments matching all this board's sparks
      for (const post of posts) {
        const attachments = post.attachments as any[];
        if (!attachments || attachments.length === 0) continue;

        const attachmentSparkIds = attachments
          .map(a => a.spark_id)
          .filter((id): id is string => id != null);

        // Check if all board sparks are in this post's attachments
        const allSparksMatch = sparkIds.every(id => attachmentSparkIds.includes(id));
        const sameCount = sparkIds.length === attachmentSparkIds.length;

        if (allSparksMatch && sameCount) {
          setIsShared(true);
          setSharedPostId(post.id);
          return;
        }
      }

      setIsShared(false);
      setSharedPostId(null);
    } catch (error) {
      console.error("Error checking if shared:", error);
      setIsShared(false);
    }
  }

  function handleSharePress() {
    // Close main menu and show caption modal
    onClose();
    setShowCaptionModal(true);
  }

  async function handleShare(captionText: string | null = null) {
    setLoading(true);
    
    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        Alert.alert("Error", "You must be logged in to share");
        setLoading(false);
        return;
      }

      // Fetch all sparks from the board with all necessary fields
      const { data: sparks, error: sparksError } = await supabase
        .from("sparks")
        .select("id, content_url, type, title, text_content")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true });

      if (sparksError) {
        console.error("Error fetching sparks:", sparksError);
        Alert.alert("Error", "Failed to fetch sparks");
        setLoading(false);
        return;
      }

      if (!sparks || sparks.length === 0) {
        Alert.alert("Error", "This Sparklette has no sparks to share");
        setLoading(false);
        return;
      }

      // Create community post
      const { data: post, error: postError } = await supabase
        .from("community_posts")
        .insert({
          user_id: userData.user.id,
          type: "sparklette",
          caption: captionText || null,
        })
        .select()
        .single();

      if (postError || !post) {
        console.error("Error creating community post:", postError);
        Alert.alert("Error", "Failed to share Sparklette");
        setLoading(false);
        return;
      }

      // Create attachments for each spark
      const attachments = sparks.map((spark) => {
        // Determine media type based on spark type
        // Music sparks are type "audio" but have albumImage, so we'll mark them as "music"
        // Regular audio sparks are type "audio" without albumImage, we'll mark them as "spark"
        let mediaType: "image" | "music" | "spark" | "note" = "spark";
        if (spark.type === "image") {
          mediaType = "image";
        } else if (spark.type === "note") {
          mediaType = "note";
        } else if (spark.type === "audio" || spark.type === "music") {
          // Check if it's music (has albumImage) or just audio
          let metadata = null;
          if (spark.text_content) {
            try {
              metadata = JSON.parse(spark.text_content);
            } catch (e) {
              // text_content might not be JSON
            }
          }
          const hasAlbumImage = metadata?.albumImage || metadata?.album_image;
          mediaType = hasAlbumImage ? "music" : "spark";
        }
        
        // Get title from spark data (subtitle might be in text_content)
        const sparkTitle = spark.title || boardName;
        let sparkSubtitle: string | null = null;
        
        // Try to get subtitle from text_content
        if (spark.text_content) {
          try {
            const metadata = JSON.parse(spark.text_content);
            sparkSubtitle = metadata?.subtitle || metadata?.artist || metadata?.artists || null;
          } catch (e) {
            // text_content might not be JSON
          }
        }
        
        // For image sparks, use content_url as image_url
        // For music sparks (type "audio" with albumImage in metadata), get album image
        let imageUrl: string | null = null;
        if (spark.type === "image") {
          imageUrl = spark.content_url;
        } else if (spark.type === "audio" || spark.type === "music") {
          // Try to extract album image from text_content
          let metadata = null;
          if (spark.text_content) {
            try {
              metadata = JSON.parse(spark.text_content);
            } catch (e) {
              // text_content might not be JSON
            }
          }
          imageUrl = metadata?.albumImage || metadata?.album_image || null;
        }
        
        // For music, get spotify_url from text_content metadata
        let spotifyUrl: string | null = null;
        if (spark.type === "audio" || spark.type === "music") {
          let metadata = null;
          if (spark.text_content) {
            try {
              metadata = JSON.parse(spark.text_content);
            } catch (e) {
              // text_content might not be JSON
            }
          }
          spotifyUrl = metadata?.spotifyUrl || metadata?.spotify_url || spark.content_url || null;
        }
        
        return {
          post_id: post.id,
          spark_id: spark.id,
          title: sparkTitle,
          subtitle: sparkSubtitle,
          image_url: imageUrl,
          spotify_url: spotifyUrl,
          media_type: mediaType,
        };
      });

      const { error: attachmentsError } = await supabase
        .from("community_attachments")
        .insert(attachments);

      if (attachmentsError) {
        console.error("Error creating attachments:", attachmentsError);
        // Try to delete the post if attachments failed
        await supabase.from("community_posts").delete().eq("id", post.id);
        Alert.alert("Error", "Failed to share Sparklette");
        setLoading(false);
        return;
      }

      setIsShared(true);
      setSharedPostId(post.id);
      setShowCaptionModal(false);
      setCaption("");
      setSuccessMessage("Shared to community!");
      setShowSuccessModal(true);
      onClose();
      
      // Auto-hide success modal after 2 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
    } catch (error) {
      console.error("Error sharing:", error);
      Alert.alert("Error", "Failed to share Sparklette");
      setShowCaptionModal(false);
      setCaption("");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnshare() {
    if (!sharedPostId) return;

    Alert.alert(
      "Unshare Sparklette",
      `Are you sure you want to unshare "${boardName}" from the community?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unshare",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // Delete attachments first
              await supabase
                .from("community_attachments")
                .delete()
                .eq("post_id", sharedPostId);

              // Delete the post
              const { error } = await supabase
                .from("community_posts")
                .delete()
                .eq("id", sharedPostId);

              if (error) {
                console.error("Error unsharing:", error);
                Alert.alert("Error", "Failed to unshare Sparklette");
              } else {
                setIsShared(false);
                setSharedPostId(null);
                setSuccessMessage("Unshared from community!");
                setShowSuccessModal(true);
                onClose();
                
                // Auto-hide success modal after 2 seconds
                setTimeout(() => {
                  setShowSuccessModal(false);
                }, 2000);
              }
            } catch (error) {
              console.error("Error unsharing:", error);
              Alert.alert("Error", "Failed to unshare Sparklette");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <>
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <View style={styles.menuContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Sparklette Options</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {showRenameInput ? (
              <View style={styles.renameContainer}>
                <TextInput
                  style={styles.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Enter sparklette name"
                  autoFocus
                  editable={!loading}
                />
                <View style={styles.renameButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => {
                      setShowRenameInput(false);
                      setNewName(boardName);
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={handleRename}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.menuItems}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setShowRenameInput(true)}
                  disabled={loading}
                >
                  <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
                  <Text style={styles.menuItemText}>Rename Sparklette</Text>
                </TouchableOpacity>

                {isShared ? (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleUnshare}
                    disabled={loading}
                  >
                    <Ionicons name="share-social" size={24} color={theme.colors.primary} />
                    <Text style={styles.menuItemText}>Unshare Sparklette</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleSharePress}
                    disabled={loading}
                  >
                    <Ionicons name="share-social-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.menuItemText}>Share Sparklette</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDeletePress}
                  disabled={loading}
                >
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                  <Text style={[styles.menuItemText, { color: "#EF4444" }]}>
                    Delete Sparklette
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>

    {/* Caption Modal */}
    <Modal
      visible={showCaptionModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowCaptionModal(false);
        setCaption("");
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowCaptionModal(false);
          setCaption("");
        }}>
          <View style={styles.captionModalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.captionModalContent}>
                <Text style={styles.captionModalTitle}>Add a Caption</Text>
                <Text style={styles.captionModalSubtitle}>Optional</Text>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Enter description"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={500}
                  autoFocus
                />
                <View style={styles.captionModalButtons}>
                  <TouchableOpacity
                    style={[styles.captionButton, styles.captionButtonCancel]}
                    onPress={() => {
                      setShowCaptionModal(false);
                      setCaption("");
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.captionButtonText, { color: theme.colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.captionButton, styles.captionButtonShare]}
                    onPress={() => handleShare(caption.trim() || null)}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    ) : (
                      <Text style={[styles.captionButtonText, { color: theme.colors.white }]}>
                        Share
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>

    {/* Success Modal */}
    <Modal
      visible={showSuccessModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowSuccessModal(false)}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <Ionicons name="checkmark-circle" size={48} color={theme.colors.primary} />
            <Text style={styles.successModalText}>{successMessage}</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    position: "absolute",
    right: 20,
    top: 16,
    padding: 4,
  },
  menuItems: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  renameContainer: {
    padding: 20,
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
    marginBottom: 16,
  },
  renameButtons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: theme.colors.light,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  captionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  captionModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: "85%",
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  captionModalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  captionModalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  captionInput: {
    backgroundColor: theme.colors.light,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: theme.spacing.lg,
  },
  captionModalButtons: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  captionButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  captionButtonCancel: {
    backgroundColor: theme.colors.light,
  },
  captionButtonShare: {
    backgroundColor: theme.colors.primary,
  },
  captionButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  successModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    ...theme.shadows.lg,
  },
  successModalText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginTop: theme.spacing.md,
  },
});

export default BoardOptionsMenu;
