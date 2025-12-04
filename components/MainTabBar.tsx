import React, { FC, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Text, Alert } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute, CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import theme from "../styles/theme";
import QuickAddMenu from "./QuickAddMenu";

const MainTabBar: FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const focusedRoute = state.routes[state.index];
  const focusedRouteName = getFocusedRouteNameFromRoute(focusedRoute) ?? focusedRoute.name;
  const [menuVisible, setMenuVisible] = useState(false);

  const handlePress = (routeName: string) => {
    const event = navigation.emit({
      type: "tabPress",
      target: routeName,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(routeName as never);
    }
  };

  const handleAddPhoto = () => {
    (navigation as any).navigate("Home", { screen: "PhotoPicker" });
  };

  const handleAddNote = () => {
    (navigation as any).navigate("Home", { screen: "AddNote" });
  };

  const handleAddAudio = () => {
    (navigation as any).navigate("Home", { screen: "AddAudio" });
  };

  const handleImportFile = () => {
    (navigation as any).navigate("Home", { screen: "ImportFile" });
  };

  const handleAddMusic = () => {
    (navigation as any).navigate("Home", { screen: "AddMusic" });
  };

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        {/* Home Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handlePress("Home")}
        >
          <Image
            source={
              focusedRouteName === "HomeMain" || focusedRouteName === "Home"
                ? require("../assets/selected home.png")
                : require("../assets/home.png")
            }
            style={styles.icon}
            resizeMode="contain"
          />
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              (focusedRouteName === "HomeMain" || focusedRouteName === "Home") && styles.labelActive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        {/* Community Tab (Social) */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handlePress("Social")}
        >
          <Image
            source={
              focusedRouteName === "Social"
                ? require("../assets/selected community.png")
                : require("../assets/community.png")
            }
            style={styles.icon}
            resizeMode="contain"
          />
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              focusedRouteName === "Social" && styles.labelActive,
            ]}
          >
            Community
          </Text>
        </TouchableOpacity>
      </View>

      {/* Center Add Button */}
      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.centerButtonText}>+</Text>
      </TouchableOpacity>

      {/* Quick Add Menu */}
      <QuickAddMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onAddPhoto={handleAddPhoto}
        onAddNote={handleAddNote}
        onAddAudio={handleAddAudio}
        onImportFile={handleImportFile}
        onAddMusic={handleAddMusic}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
    overflow: "visible",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.white,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    width: "90%",
    maxWidth: 320,
    marginBottom: 16,
    overflow: "visible",
    ...theme.shadows.md,
  },
  tabButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minWidth: 90,
    minHeight: 44,
    paddingVertical: 4,
    overflow: "visible",
  },
  spacer: {
    width: 72,
  },
  icon: {
    width: 30,
    height: 30,
    marginBottom: 4,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: "center",
    width: "120%",
  },
  labelActive: {
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary,
  },
  centerButton: {
    position: "absolute",
    bottom: 55,
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...theme.shadows.lg,
  },
  centerButtonText: {
    fontSize: 36,
    color: theme.colors.white,
    lineHeight: 36,
    fontWeight: "300",
  },
});

export default MainTabBar;
