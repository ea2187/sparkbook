import React, { FC, useState } from "react";
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
      Alert.alert("Error", "Failed to rename board");
      return;
    }

    onBoardRenamed(newName);
    setShowRenameInput(false);
    onClose();
  }

  function handleDeletePress() {
    Alert.alert(
      "Delete Board",
      `Are you sure you want to delete "${boardName}"? This will also delete all sparks on this board.`,
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

  return (
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
              <Text style={styles.headerTitle}>Board Options</Text>
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
                  placeholder="Board name"
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
                  <Text style={styles.menuItemText}>Rename Board</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDeletePress}
                  disabled={loading}
                >
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                  <Text style={[styles.menuItemText, { color: "#EF4444" }]}>
                    Delete Board
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
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
});

export default BoardOptionsMenu;
