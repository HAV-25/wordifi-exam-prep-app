import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, Mail, Lock, Sparkles } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/colors';
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/authHelpers';

function getFriendlyError(errorMessage: string, isSignUp: boolean): string {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect';
  }
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'An account with this email already exists';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Could not connect. Please try again.';
  }
  return isSignUp ? 'Could not create your account. Please try again.' : 'Something went wrong. Please check your connection.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const emailError = useMemo<string>(() => {
    if (!touched.email) {
      return '';
    }
    return /\S+@\S+\.\S+/.test(email) ? '' : 'Please enter a valid email address';
  }, [email, touched.email]);

  const passwordError = useMemo<string>(() => {
    if (!touched.password) {
      return '';
    }
    return password.length >= 8 ? '' : 'Password must be at least 8 characters';
  }, [password, touched.password]);

  const canSubmit = email.length > 0 && password.length >= 8 && /\S+@\S+\.\S+/.test(email) && (mode === 'signIn' || acceptedTerms);

  const handleEmailAuth = async () => {
    setTouched({ email: true, password: true });
    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signIn') {
        await signInWithEmail(email.trim(), password);
        router.replace('/');
      } else {
        await signUpWithEmail(email.trim(), password);
        router.replace('/onboarding');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Wordifi', getFriendlyError(message, mode === 'signUp'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Wordifi', getFriendlyError(message, false));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.primaryDeep, Colors.primary, '#16325D']} style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Sparkles color={Colors.accent} size={26} />
            </View>
            <Text style={styles.brand}>Wordifi</Text>
            <Text style={styles.tagline}>Ace your German exam</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.segment}>
              <Pressable accessibilityLabel="Switch to sign in" onPress={() => setMode('signIn')} style={[styles.segmentButton, mode === 'signIn' ? styles.segmentButtonActive : null]} testID="sign-in-tab">
                <Text style={[styles.segmentText, mode === 'signIn' ? styles.segmentTextActive : null]}>Sign In</Text>
              </Pressable>
              <Pressable accessibilityLabel="Switch to sign up" onPress={() => setMode('signUp')} style={[styles.segmentButton, mode === 'signUp' ? styles.segmentButtonActive : null]} testID="sign-up-tab">
                <Text style={[styles.segmentText, mode === 'signUp' ? styles.segmentTextActive : null]}>Sign Up</Text>
              </Pressable>
            </View>

            <View style={styles.inputWrap}>
              <View style={styles.inputShell}>
                <Mail color={Colors.textMuted} size={18} />
                <TextInput
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onBlur={() => setTouched((value) => ({ ...value, email: true }))}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  testID="email-input"
                  value={email}
                />
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            <View style={styles.inputWrap}>
              <View style={styles.inputShell}>
                <Lock color={Colors.textMuted} size={18} />
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  onBlur={() => setTouched((value) => ({ ...value, password: true }))}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                  testID="password-input"
                  value={password}
                />
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            {mode === 'signUp' ? (
              <Pressable accessibilityLabel="Agree to terms" onPress={() => setAcceptedTerms((value) => !value)} style={styles.termsRow} testID="terms-checkbox">
                <View style={[styles.checkbox, acceptedTerms ? styles.checkboxSelected : null]}>{acceptedTerms ? <Check color={Colors.surface} size={14} /> : null}</View>
                <Text style={styles.termsText}>I agree to Terms</Text>
              </Pressable>
            ) : null}

            <Pressable accessibilityLabel={mode === 'signIn' ? 'Sign in with email' : 'Create account'} disabled={!canSubmit || isLoading} onPress={handleEmailAuth} style={[styles.primaryButton, !canSubmit || isLoading ? styles.buttonDisabled : null]} testID="email-auth-button">
              {isLoading ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.primaryButtonText}>{mode === 'signIn' ? 'Sign In with Email' : 'Create Account'}</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <Pressable accessibilityLabel="Continue with Google" disabled={isLoading} onPress={handleGoogleAuth} style={styles.secondaryButton} testID="google-auth-button">
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 24,
  },
  hero: { gap: 8 },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 34, fontWeight: '800', color: Colors.surface },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.78)' },
  card: {
    borderRadius: 28,
    backgroundColor: Colors.surface,
    padding: 18,
    gap: 16,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 18,
    padding: 4,
  },
  segmentButton: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: Colors.surface },
  segmentText: { color: Colors.textMuted, fontWeight: '700' },
  segmentTextActive: { color: Colors.primary },
  inputWrap: { gap: 6 },
  inputShell: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { color: Colors.text, fontWeight: '600' },
  primaryButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: Colors.surface, fontWeight: '800', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontWeight: '700' },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: '800', fontSize: 16 },
});
