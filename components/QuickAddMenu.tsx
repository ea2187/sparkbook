import React, { FC } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import theme from "../styles/theme";

interface QuickAddMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddPhoto: () => void | Promise<void>;
  onAddNote: () => void;
  onAddAudio: () => void;
  onImportFile: () => void;
  onAddMusic: () => void;
}

const QuickAddMenu: FC<QuickAddMenuProps> = ({
  visible,
  onClose,
  onAddPhoto,
  onAddNote,
  onAddAudio,
  onImportFile,
  onAddMusic,
}) => {
  const handleAction = (action: () => void | Promise<void>) => {
    onClose();
    setTimeout(action, 100);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      {/* Outer overlay: tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          
          {/* Inner sheet */}
          <View style={styles.menuContainer}>
              
              {/* HEADER */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Quick Add</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons
                    name="close"
                    size={28}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* MENU ITEMS */}
              <View style={styles.menuItems}>

                {/* Add Photo */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onAddPhoto)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#E8EFFF" },
                    ]}
                  >
                    <Image
                      source={require("../assets/photo.png")}
                      style={styles.menuIcon}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Add Photo</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Add Note */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onAddNote)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#FFF4E0" },
                    ]}
                  >
                    <Image
                      source={require("../assets/note.png")}
                      style={styles.menuIcon}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Add Note</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Add Audio */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onAddAudio)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#FFE8F0" },
                    ]}
                  >
                    <Image
                      source={require("../assets/voice.png")}
                      style={styles.menuIcon}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Add Audio</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Import File */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onImportFile)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#E0F7E9" },
                    ]}
                  >
                    <Image
                      source={require("../assets/file.png")}
                      style={styles.menuIcon}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Import File</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Music / Sound */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onAddMusic)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#F3E8FF" },
                    ]}
                  >
                    <Image
                      source={require("../assets/music.png")}
                      style={styles.menuIcon}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Music / Sound</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

              </View>
            </View>

        </View>
      </TouchableWithoutFeedback>
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    width: 28,
    height: 28,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
});

export default QuickAddMenu;
