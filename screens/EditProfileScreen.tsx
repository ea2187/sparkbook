import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as base64 from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import theme from '../styles/theme';

const EditProfileScreen: FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not found');
        navigation.goBack();
        return;
      }

      // Try to get from profiles table first, fallback to auth metadata
      let profileData = null;
      try {
        // First try: schema with full_name + username
        let { data, error } = await supabase
          .from('profiles')
          .select('username, full_name, profile_picture')
          .eq('id', user.id)
          .single();
        
        // If column doesn't exist, try first_name/last_name schema
        if (error && error.code === '42703') {
          const { data: fallbackData } = await supabase
            .from('profiles')
            .select('username, first_name, last_name, profile_picture')
            .eq('id', user.id)
            .single();
          profileData = fallbackData;
        } else {
          profileData = data;
        }
      } catch (profileError) {
        // Profiles table might not exist, use auth metadata
        console.log('Using auth metadata for profile');
      }

      // Get profile data from profiles table or user metadata
      const metadata = user.user_metadata || {};
      
      // Handle both schema variations
      let firstName = '';
      let lastName = '';
      if (profileData) {
        if ((profileData as any).first_name) {
          // first_name/last_name schema
          firstName = (profileData as any).first_name || '';
          lastName = (profileData as any).last_name || '';
        } else if ((profileData as any).full_name) {
          // full_name schema - split it
          const fullName = (profileData as any).full_name || '';
          const parts = fullName.trim().split(' ');
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }
      }
      
      setFirstName(firstName || metadata.first_name || metadata.firstName || '');
      setLastName(lastName || metadata.last_name || metadata.lastName || '');
      const emailUsername = user.email?.split('@')[0] || '';
      setUsername((profileData as any)?.username || metadata.username || emailUsername);
      setOriginalUsername((profileData as any)?.username || metadata.username || emailUsername);
      setProfilePictureUri((profileData as any)?.profile_picture || metadata.profile_picture || metadata.profilePicture || null);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function checkUsernameAvailability(newUsername: string) {
    if (!newUsername || newUsername === originalUsername) {
      setUsernameError('');
      return true;
    }

    if (newUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }

    setCheckingUsername(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check if username exists in profiles table (if it exists)
      // If profiles table doesn't exist, we'll skip the check
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', newUsername)
          .neq('id', user.id) // Exclude current user
          .single();

        if (error && error.code === 'PGRST116') {
          // Username is available (not found)
          setUsernameError('');
          return true;
        }

        if (data) {
          setUsernameError('Username already exists');
          return false;
        }
      } catch (tableError: any) {
        // If profiles table doesn't exist, skip username check
        if (tableError.code === 'PGRST204' || tableError.code === '42P01') {
          // Table doesn't exist, allow the username
          setUsernameError('');
          return true;
        }
        throw tableError;
      }

      setUsernameError('');
      return true;
    } catch (error) {
      console.error('Error checking username:', error);
      // If we can't check, allow it (graceful degradation)
      setUsernameError('');
      return true;
    } finally {
      setCheckingUsername(false);
    }
  }

  async function uploadProfilePicture(uri: string): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Read file as base64
      const base64String = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const fileExt = uri.split('.').pop() ?? 'jpg';
      const fileName = `profile-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      // Convert base64 → ArrayBuffer
      const arrayBuffer = base64.decode(base64String);

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('spark-images')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true, // Allow overwriting existing profile pictures
        });

      if (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data: publicURL } = supabase.storage
        .from('spark-images')
        .getPublicUrl(filePath);

      return publicURL.publicUrl;
    } catch (err) {
      console.error('Upload profile picture failed:', err);
      return null;
    }
  }

  async function handlePickImage() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photo library to set a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPicture(true);
        const uploadedUrl = await uploadProfilePicture(result.assets[0].uri);
        setUploadingPicture(false);

        if (uploadedUrl) {
          setProfilePictureUri(uploadedUrl);
        } else {
          Alert.alert('Error', 'Failed to upload profile picture');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      setUploadingPicture(false);
    }
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    // Check username availability if it changed
    if (username !== originalUsername) {
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Update user metadata in authentication
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          firstName: firstName.trim(), // Support both naming conventions
          lastName: lastName.trim(),
          username: username.trim(),
          profile_picture: profilePictureUri,
          profilePicture: profilePictureUri, // Support both naming conventions
        }
      });

      if (authError) {
        console.error('Error saving profile:', authError);
        Alert.alert('Error', 'Failed to save profile');
        return;
      }

      // Update profiles table (if it exists)
      // Try both schema variations to handle different table structures
      try {
        // First try: schema with full_name + username
        let { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            username: username.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            profile_picture: profilePictureUri,
          }, {
            onConflict: 'id'
          });

        // If that fails with column error, try first_name/last_name schema
        if (profileError && profileError.code === '42703') {
          console.log('Trying first_name/last_name schema');
          const { error: fallbackError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              username: username.trim(),
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              profile_picture: profilePictureUri,
            }, {
              onConflict: 'id'
            });
          
          if (fallbackError) {
            console.log('Profiles table update failed:', fallbackError.message);
          } else {
            console.log('Profile picture saved to profiles table (first_name/last_name schema)');
          }
        } else if (profileError) {
          console.log('Profiles table update skipped:', profileError.message);
        } else {
          console.log('Profile picture saved to profiles table (full_name schema)');
        }
      } catch (profileTableError) {
        // Profiles table might not exist yet, that's okay
        console.log('Profiles table not available, using auth metadata only');
      }

      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <View style={styles.profilePictureSection}>
          <TouchableOpacity
            style={styles.profilePictureContainer}
            onPress={handlePickImage}
            disabled={uploadingPicture}
          >
            {profilePictureUri ? (
              <Image source={{ uri: profilePictureUri }} style={styles.profilePicture} />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Ionicons name="person" size={60} color={theme.colors.white} />
              </View>
            )}
            {uploadingPicture && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={theme.colors.white} />
              </View>
            )}
            <View style={styles.editPictureButton}>
              <Ionicons name="camera" size={20} color={theme.colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.profilePictureLabel}>Tap to change profile picture</Text>
        </View>

        {/* First Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor={theme.colors.textLight}
            autoCapitalize="words"
          />
        </View>

        {/* Last Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor={theme.colors.textLight}
            autoCapitalize="words"
          />
        </View>

        {/* Username */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameContainer}>
            <TextInput
              style={[styles.input, usernameError && styles.inputError]}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (text !== originalUsername) {
                  // Debounce username check
                  setTimeout(() => checkUsernameAvailability(text), 500);
                } else {
                  setUsernameError('');
                }
              }}
              placeholder="Enter username"
              placeholderTextColor={theme.colors.textLight}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {checkingUsername && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={styles.checkingIndicator}
              />
            )}
          </View>
          {usernameError ? (
            <Text style={styles.errorText}>{usernameError}</Text>
          ) : (
            <Text style={styles.helpText}>
              Username can contain letters, numbers, and underscores
            </Text>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xxl,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  profilePictureLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  usernameContainer: {
    position: 'relative',
  },
  checkingIndicator: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#EF4444',
    marginTop: theme.spacing.xs,
  },
  helpText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default EditProfileScreen;

