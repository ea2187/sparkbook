import React, { FC, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import theme from "../styles/theme";
import type { HomeStackParamList } from "../types";

const PhotoPickerScreen: FC = () => {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();

  useEffect(() => {
    handlePhotoButton();
  }, []);

  async function requestPermissions() {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (camera.status !== "granted" || media.status !== "granted") {
      Alert.alert(
        "Permissions Needed",
        "Camera + photo library permissions required."
      );
      return false;
    }
    return true;
  }

  async function handlePhotoButton() {
    const ok = await requestPermissions();
    if (!ok) {
      navigation.goBack();
      return;
    }

    Alert.alert("Add Photo", "Choose an option", [
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImageFromLibrary },
      { text: "Cancel", style: "cancel", onPress: () => navigation.goBack() },
    ]);
  }

  async function takePhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });

      if (!result.canceled) {
        navigation.navigate("AddPhotoDetails", {
          imageUri: result.assets[0].uri,
        });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert("Error", "Failed to open camera.");
      navigation.goBack();
    }
  }

  async function pickImageFromLibrary() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        selectionLimit: 1,
      });

      if (!result.canceled) {
        navigation.navigate("AddPhotoDetails", {
          imageUri: result.assets[0].uri,
        });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert("Error", "Failed to pick image.");
      navigation.goBack();
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>Opening photo library...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.light,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  text: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
});

export default PhotoPickerScreen;
