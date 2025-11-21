import React, { FC, useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [showBoardOptions, setShowBoardOptions] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);

  useEffect(() => {
    fetchBoards();
  }, []);

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
        return;
      }

      // Fetch preview images for each board (first 4 sparks)
      const boardsWithPreviews = await Promise.all(
        (boardsData || []).map(async (board) => {
          const { data: sparks } = await supabase
            .from('sparks')
            .select('content_url')
            .eq('board_id', board.id)
            .limit(4);

          return {
            ...board,
            thumbnail_urls: sparks?.map(s => s.content_url) || [],
          };
        })
      );

      setBoards(boardsWithPreviews);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
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

  return (
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
        <Pressable style={styles.avatarButton}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={theme.colors.white} />
          </View>
        </Pressable>
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
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : boards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>No boards yet</Text>
            <Text style={styles.emptySubtitle}>Tap "Add sparklette" to create your first board</Text>
          </View>
        ) : (
          boards.map((board) => (
            <BoardPreviewCard
              key={board.id}
              title={board.name}
              previewImages={board.thumbnail_urls}
              onPress={() => handleBoardPress(board)}
              onLongPress={() => handleBoardLongPress(board)}
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
              placeholder="Name"
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
