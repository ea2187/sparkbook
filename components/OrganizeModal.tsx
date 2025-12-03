import React, { FC } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import theme from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface OrganizeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (method: 'grid' | 'spacing' | 'byType') => Promise<void>;
  isOrganizing: boolean;
}

const OrganizeModal: FC<OrganizeModalProps> = ({
  visible,
  onClose,
  onSelectOption,
  isOrganizing,
}) => {
  function handleClose() {
    if (isOrganizing) return; // Prevent closing while organizing
    onClose();
  }

  async function handleOptionSelect(method: 'grid' | 'spacing' | 'byType') {
    if (isOrganizing) return;
    await onSelectOption(method);
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.header}>
                <Text style={styles.headerText}>Organize Board</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isOrganizing}
                  style={styles.closeButton}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isOrganizing ? theme.colors.textSecondary : theme.colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.description}>
                Choose how you'd like to organize your board:
              </Text>

              {isOrganizing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Organizing...</Text>
                </View>
              ) : (
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => handleOptionSelect('grid')}
                    disabled={isOrganizing}
                  >
                    <Ionicons name="grid" size={28} color={theme.colors.primary} />
                    <Text style={styles.optionTitle}>Grid Layout</Text>
                    <Text style={styles.optionDescription}>Arrange all sparks in a neat grid</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => handleOptionSelect('byType')}
                    disabled={isOrganizing}
                  >
                    <Ionicons name="layers" size={28} color={theme.colors.primary} />
                    <Text style={styles.optionTitle}>Group by Type</Text>
                    <Text style={styles.optionDescription}>Group images, notes, audio, and files together</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => handleOptionSelect('spacing')}
                    disabled={isOrganizing}
                  >
                    <Ionicons name="resize" size={28} color={theme.colors.primary} />
                    <Text style={styles.optionTitle}>Smart Spacing</Text>
                    <Text style={styles.optionDescription}>Remove overlaps and add consistent spacing</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : theme.spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerText: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  description: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  optionsContainer: {
    gap: theme.spacing.md,
  },
  optionButton: {
    backgroundColor: theme.colors.light,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  optionDescription: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
});

export default OrganizeModal;

