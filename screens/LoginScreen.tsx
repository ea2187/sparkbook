import React, { FC, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import theme from '../styles/theme';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('dev@sparkbook.test');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
      } else if (data.user) {
        onLoginSuccess();
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const username = email.split('@')[0];
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: username,
          }
        }
      });

      if (error) {
        console.error('Sign up error details:', JSON.stringify(error, null, 2));
        Alert.alert('Sign Up Failed', error.message + '\n\nCheck console for details');
      } else if (data.user) {
        // Try to create profile entry (in case trigger doesn't exist)
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              full_name: username,
            }, {
              onConflict: 'id'
            });

          if (profileError) {
            console.error('Profile creation error details:', JSON.stringify(profileError, null, 2));
            Alert.alert('Profile Error', 'User created but profile failed: ' + profileError.message);
          } else {
            Alert.alert(
              'Success',
              'Account created successfully! You can now sign in.',
              [{ text: 'OK', onPress: () => setIsSignUp(false) }]
            );
          }
        } catch (profileErr) {
          console.error('Profile creation exception:', profileErr);
          Alert.alert('Profile Error', 'User created but profile failed. Check console.');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Sign up error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../assets/SparkBookLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email"
              placeholderTextColor={theme.colors.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={theme.colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
              <Text style={styles.toggleButton}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  logo: {
    width: "80%",
  },
  title: {
    fontSize: 32,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    ...theme.components.input,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.base,
    paddingVertical: 16,
  },
  button: {
    ...theme.components.button.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.white,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  toggleText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  toggleButton: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;


