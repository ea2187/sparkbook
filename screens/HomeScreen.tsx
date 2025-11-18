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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import theme from '../styles/theme';
import { supabase } from '../lib/supabase';
import { Board, RootTabParamList } from '../types';
import BoardPreviewCard from '../components/BoardPreviewCard';

type HomeScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

const HomeScreen: FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBoards();
  }, []);

  async function fetchBoards() {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        Alert.alert('Error', 'Failed to load boards');
      } else {
        setBoards(data || []);
      }
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
        console.error('Error creating board:', error);
        Alert.alert('Error', 'Failed to create board');
      } else {
        setBoards([data, ...boards]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  function handleAddSparklette() {
    Alert.prompt(
      'New Board',
      'Enter board name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (name) => {
            if (name && name.trim()) {
              createBoard(name.trim());
            }
          },
        },
      ],
      'plain-text'
    );
  }

  function handleBoardPress(board: Board) {
    // Navigate to board screen when implemented
    console.log('Board pressed:', board.name);
    // navigation.navigate('Board', { boardId: board.id });
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search boards..."
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
          <Text style={styles.addButtonText}>Add sparklette</Text>
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
            />
          ))
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable style={styles.floatingButton} onPress={handleAddSparklette}>
        <Ionicons name="add" size={32} color={theme.colors.white} />
      </Pressable>
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
    backgroundColor: theme.colors.white,
    gap: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.md,
    height: 44,
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
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    maxHeight: 80,
    backgroundColor: theme.colors.white,
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
  floatingButton: {
    position: 'absolute',
    bottom: 80, // Above the tab bar
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
    elevation: 8,
  },
});

export default HomeScreen;
