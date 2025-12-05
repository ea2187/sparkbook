import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../styles/theme';
import { supabase } from '../lib/supabase';
import { createNoteSpark } from '../lib/createNoteSpark';
import type { HomeStackParamList } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Board {
  id: string;
  name: string;
  created_at: string;
}

const AddNoteScreen: FC = () => {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
  
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, []);

  async function fetchBoards() {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        Alert.alert('Error', 'Failed to load boards');
        return;
      }

      setBoards(data || []);
      
      // Auto-select first board if available
      if (data && data.length > 0) {
        setSelectedBoardId(data[0].id);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoadingBoards(false);
    }
  }

  async function handleAddToBoard() {
    // Validate
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter some text for your note');
      return;
    }

    if (!selectedBoardId) {
      Alert.alert('Error', 'Please select a board');
      return;
    }

    setIsSaving(true);

    try {
      // Calculate spawn position near center
      const spawnX = (SCREEN_WIDTH * 5) / 2 - 80 + (Math.random() * 120 - 60);
      const spawnY = (SCREEN_HEIGHT * 5) / 2 - 80 + (Math.random() * 120 - 60);

      const spark = await createNoteSpark(
        selectedBoardId,
        title.trim() || 'Untitled Note',
        text.trim(),
        spawnX,
        spawnY
      );

      if (!spark) {
        Alert.alert('Error', 'Failed to create note');
        setIsSaving(false);
        return;
      }

      // Navigate to board
      navigation.navigate('Board', { boardId: selectedBoardId });
    } catch (err) {
      console.error('Error creating note:', err);
      Alert.alert('Error', 'Failed to create note');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Note</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Note Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Title (optional)</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter note title"
            placeholderTextColor={theme.colors.textLight}
            value={title}
            onChangeText={setTitle}
            editable={!isSaving}
          />
        </View>

        {/* Note Body */}
        <View style={styles.section}>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={styles.bodyInput}
            placeholder="Enter note"
            placeholderTextColor={theme.colors.textLight}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            editable={!isSaving}
          />
        </View>

        {/* Board Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Choose Board</Text>
          
          {loadingBoards ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : boards.length === 0 ? (
            <Text style={styles.noBoardsText}>No boards available. Create a board first.</Text>
          ) : (
            <View style={styles.boardList}>
              {boards.map((board) => (
                <TouchableOpacity
                  key={board.id}
                  style={[
                    styles.boardItem,
                    selectedBoardId === board.id && styles.boardItemSelected,
                  ]}
                  onPress={() => setSelectedBoardId(board.id)}
                  disabled={isSaving}
                >
                  <View style={styles.boardItemContent}>
                    <View
                      style={[
                        styles.radioOuter,
                        selectedBoardId === board.id && styles.radioOuterSelected,
                      ]}
                    >
                      {selectedBoardId === board.id && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.boardItemText,
                        selectedBoardId === board.id && styles.boardItemTextSelected,
                      ]}
                    >
                      {board.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.addButton,
            (!selectedBoardId || !text.trim() || isSaving) && styles.addButtonDisabled,
          ]}
          onPress={handleAddToBoard}
          disabled={!selectedBoardId || !text.trim() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.addButtonText}>Add to Board</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bodyInput: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 160,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noBoardsText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  boardList: {
    gap: 8,
  },
  boardItem: {
    backgroundColor: theme.colors.light,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  boardItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E8EFFF',
  },
  boardItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  boardItemText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  boardItemTextSelected: {
    color: theme.colors.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
});

export default AddNoteScreen;
