import React, { FC, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import theme from '../styles/theme';
import { supabase } from '../lib/supabase';
import { Board, HomeStackParamList } from '../types';
import BoardPreviewCard from '../components/BoardPreviewCard';
import BoardOptionsMenu from '../components/BoardOptionsMenu';

type HomeScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'HomeMain'>;

const HomeScreen: FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [showBoardOptions, setShowBoardOptions] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    fetchBoards();
    loadUserProfile();
  }, []);

  // Refetch boards when screen comes into focus (e.g., after deleting images)
  useFocusEffect(
    useCallback(() => {
      fetchBoards();
      loadUserProfile();
    }, [])
  );

  async function loadUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadata = user.user_metadata || {};
        const picture = metadata.profile_picture || metadata.profilePicture || null;
        setProfilePicture(picture);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error', 'Failed to log out');
      } else {
        setShowProfileDropdown(false);
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'An unexpected error occurred while logging out');
    }
  }

  function handleProfilePress() {
    setShowProfileDropdown(!showProfileDropdown);
  }

  function handleGoToProfile() {
    setShowProfileDropdown(false);
    navigation.navigate('Profile');
  }

  async function fetchBoards() {
    try {
      const { data: boardsData, error } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        Alert.alert('Error', 'Failed to load boards');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch all sparks for each board preview
      const boardsWithPreviews = await Promise.all(
        (boardsData || []).map(async (board) => {
          try {
            // Fetch all sparks with their type and content
            const { data: sparks, error: sparksError } = await supabase
              .from('sparks')
              .select('id, type, content_url, title, text_content')
              .eq('board_id', board.id)
              .order('created_at', { ascending: false });

            if (sparksError) {
              console.error('Error fetching sparks for board:', board.id, sparksError);
              // Fallback to empty preview
              return {
                ...board,
                previewItems: [],
                thumbnail_urls: [],
              };
            }

            // Process sparks to get preview data
            const previewItems = (sparks || []).map((spark) => {
              let imageUrl: string | null = null;
              let iconType: 'image' | 'note' | 'music' | 'audio' = 'audio';
              let textContent: string | null = null;
              
              if (spark.type === 'image' && spark.content_url) {
                imageUrl = spark.content_url;
                iconType = 'image';
              } else if (spark.type === 'note') {
                iconType = 'note';
                textContent = spark.text_content || null;
              } else if (spark.type === 'audio') {
                // Check if it's music (has albumImage) or audio
                let metadata = null;
                if (spark.text_content) {
                  try {
                    metadata = JSON.parse(spark.text_content);
                  } catch (e) {
                    // text_content might not be JSON
                  }
                }
                if (metadata?.albumImage || metadata?.album_image) {
                  imageUrl = metadata.albumImage || metadata.album_image;
                  iconType = 'music';
                } else {
                  iconType = 'audio';
                }
              }
              
              return {
                id: spark.id,
                type: iconType,
                imageUrl,
                textContent,
              };
            });

            return {
              ...board,
              previewItems: previewItems.slice(0, 8), // Show up to 8 items
            };
          } catch (error) {
            console.error('Error processing board preview:', board.id, error);
            // Fallback to empty preview
            return {
              ...board,
              previewItems: [],
              thumbnail_urls: [],
            };
          }
        })
      );

      setBoards(boardsWithPreviews);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchBoards();
  }

  async function createBoard(name: string) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        Alert.alert('Error', 'You must be logged in to create a board');
        return;
      }

      const { data, error } = await supabase
        .from('boards')
        .insert([
          {
            name,
            user_id: userData.user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating caboard:', error);
        Alert.alert('Error', 'Failed to create board');
      } else {
        setBoards([data, ...boards]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  function handleAddSparklette() {
    setNewBoardName('');
    setShowCreateModal(true);
  }

  function handleCreateBoard() {
    if (newBoardName && newBoardName.trim()) {
      createBoard(newBoardName.trim());
      setShowCreateModal(false);
      setNewBoardName('');
    }
  }

  function handleCancelCreate() {
    setShowCreateModal(false);
    setNewBoardName('');
  }

  function handleBoardPress(board: Board) {
    navigation.navigate('Board', { boardId: board.id });
  }

  function handleBoardLongPress(board: Board) {
    setSelectedBoard(board);
    setShowBoardOptions(true);
  }

  function handleBoardDeleted() {
    if (selectedBoard) {
      setBoards(boards.filter(b => b.id !== selectedBoard.id));
      setSelectedBoard(null);
    }
  }

  function handleBoardRenamed(newName: string) {
    if (selectedBoard) {
      setBoards(boards.map(b => 
        b.id === selectedBoard.id ? { ...b, name: newName } : b
      ));
      setSelectedBoard({ ...selectedBoard, name: newName });
    }
  }

  // Filter boards based on search query
  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {showProfileDropdown && (
        <TouchableWithoutFeedback onPress={() => setShowProfileDropdown(false)}>
          <View style={styles.fullScreenOverlay} />
        </TouchableWithoutFeedback>
      )}
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
        <View style={styles.profileContainer}>
          <Pressable 
            style={styles.avatarButton}
            onPress={handleProfilePress}
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={theme.colors.white} />
              </View>
            )}
          </Pressable>
          
          {showProfileDropdown && (
            <View style={styles.profileDropdown}>
                <Pressable 
                  style={styles.dropdownItem}
                  onPress={handleGoToProfile}
                >
                  <Ionicons name="person-outline" size={20} color={theme.colors.textPrimary} />
                  <Text style={styles.dropdownItemText}>Profile</Text>
                </Pressable>
                <View style={styles.dropdownDivider} />
                <Pressable 
                  style={styles.dropdownItem}
                  onPress={handleLogout}
                >
                  <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                  <Text style={[styles.dropdownItemText, { color: theme.colors.error }]}>Log out</Text>
                </Pressable>
              </View>
          )}
        </View>
      </View>

      {/* Action Buttons Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionRow}
        contentContainerStyle={styles.actionRowContent}
      >
        <Pressable style={styles.addButton} onPress={handleAddSparklette}>
          <Ionicons name="add" size={20} color={theme.colors.white} />
          <Text style={styles.addButtonText}>Add Sparklette</Text>
        </Pressable>

        <Pressable style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Filter by</Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
        </Pressable>

        <Pressable style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Sort by</Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      </ScrollView>

      {/* Board List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : filteredBoards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No boards found' : 'No boards yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? `No boards match "${searchQuery}"`
                : 'Tap "Add sparklette" to create your first board'}
            </Text>
          </View>
        ) : (
          filteredBoards.map((board) => (
            <BoardPreviewCard
              key={board.id}
              title={board.name}
              previewItems={(board as any).previewItems}
              previewImages={(board as any).thumbnail_urls}
              onPress={() => handleBoardPress(board)}
              onLongPress={() => handleBoardLongPress(board)}
              onMenuPress={() => handleBoardLongPress(board)}
            />
          ))
        )}
      </ScrollView>

      {/* Create Board Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelCreate}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Sparklette</Text>
            <Text style={styles.modalSubtitle}>Enter Sparklette Name:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter sparklette name"
              placeholderTextColor={theme.colors.textLight}
              value={newBoardName}
              onChangeText={setNewBoardName}
              autoFocus={true}
              onSubmitEditing={handleCreateBoard}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCancelCreate}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCreate]}
                onPress={handleCreateBoard}
              >
                <Text style={styles.modalButtonCreateText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Board Options Menu */}
      {selectedBoard && (
        <BoardOptionsMenu
          visible={showBoardOptions}
          onClose={() => setShowBoardOptions(false)}
          boardId={selectedBoard.id}
          boardName={selectedBoard.name}
          onBoardDeleted={handleBoardDeleted}
          onBoardRenamed={handleBoardRenamed}
        />
      )}
    </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    
    gap: theme.spacing.sm,
  marginTop: '15%'
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  profileContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  avatarButton: {
    width: 44,
    height: 44,
    overflow: 'visible',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.secondary,
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  profileDropdown: {
    position: 'absolute',
    top: 50,
    right: 0,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    minWidth: 140,
    paddingVertical: 4,
    zIndex: 1001,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  dropdownItemText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  actionRow: {
    maxHeight: 80,
    
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  borderWidth: 1,
  borderColor: theme.colors.border,
  },
  filterButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100, // Extra padding for floating button
    alignItems: 'flex-start',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '80%',
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  modalInput: {
    ...theme.components.input,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  modalButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
  },
  modalButtonCancelText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  modalButtonCreate: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonCreateText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default HomeScreen;
