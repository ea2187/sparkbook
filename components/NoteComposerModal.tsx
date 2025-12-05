import React, { FC, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import theme from '../styles/theme';

interface NoteComposerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, text: string) => void;
}

const NoteComposerModal: FC<NoteComposerModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  function handleSave() {
    if (!title.trim() && !text.trim()) {
      return;
    }
    onSubmit(title.trim(), text.trim());
    setTitle('');
    setText('');
  }

  function handleClose() {
    setTitle('');
    setText('');
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <Text style={styles.header}>New Note</Text>

              <TextInput
                style={styles.titleInput}
                placeholder="Enter title"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={styles.bodyInput}
                placeholder="Enter note"
                value={text}
                onChangeText={setText}
                multiline
              />

              <View style={styles.buttonsRow}>
                <TouchableOpacity onPress={handleClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={styles.primaryButton}>
                  <Text style={styles.primaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
  },
  container: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.modal,
    borderTopRightRadius: theme.borderRadius.modal,
    borderBottomLeftRadius: theme.borderRadius.modal,
    borderBottomRightRadius: theme.borderRadius.modal,
    padding: theme.spacing.lg,
    marginBottom: 80,
  },
  header: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    marginBottom: 12,
  },
  titleInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  bodyInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryText: {
    color: theme.colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.medium,
  },
});

export default NoteComposerModal;
