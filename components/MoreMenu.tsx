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

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
  onImportFile: () => void;
  onToggleGrid: () => void;
  onExportAsImage: () => void;
  onRenameBoard: () => void;
  onShareToCommunity: () => void;
  gridVisible: boolean;
}

const MoreMenu: FC<MoreMenuProps> = ({
  visible,
  onClose,
  onImportFile,
  onToggleGrid,
  onExportAsImage,
  onRenameBoard,
  onShareToCommunity,
  gridVisible,
}) => {
  const handleAction = (action: () => void) => {
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
                <Text style={styles.headerTitle}>More</Text>
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

                {/* Rename Board */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onRenameBoard)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#FFE8F0" },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={28}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Rename Sparklette</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Toggle Grid */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onToggleGrid)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#E8EFFF" },
                    ]}
                  >
                    <Ionicons
                      name={gridVisible ? "grid" : "grid-outline"}
                      size={28}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.menuItemText}>
                    {gridVisible ? "Hide Grid" : "Show Grid"}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Share to Community */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onShareToCommunity)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#E8F0FF" },
                    ]}
                  >
                    <Ionicons
                      name="share-social"
                      size={28}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Share to Community</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Export as Image */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onExportAsImage)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: "#FFF4E0" },
                    ]}
                  >
                    <Ionicons
                      name="download-outline"
                      size={28}
                      color={theme.colors.secondary}
                    />
                  </View>
                  <Text style={styles.menuItemText}>Export Board as Image</Text>
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  menuItems: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 44,
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
    resizeMode: "contain",
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
});

export default MoreMenu;

