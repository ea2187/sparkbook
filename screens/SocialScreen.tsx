import React, { FC } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../styles/theme';

const SocialScreen: FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Social</Text>
      <Text style={styles.subtitle}>Connect with friends</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.fontSize.xxxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
});

export default SocialScreen;
