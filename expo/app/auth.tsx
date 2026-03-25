import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, Eye, EyeOff, Lock, Mail, Sparkles, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/authHelpers';

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
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotSent, setForgotSent] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string>('');
  const forgotModalFade = useRef(new Animated.Value(0)).current;

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

  const openForgotModal = () => {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotError('');
    setShowForgotModal(true);
    Animated.timing(forgotModalFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const closeForgotModal = () => {
    Animated.timing(forgotModalFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowForgotModal(false);
    });
  };

  const handleForgotPassword = async () => {
    const trimmed = forgotEmail.trim();
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setForgotError('Please enter a valid email address');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      await resetPassword(trimmed);
      setForgotSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.navy, colors.navy, '#16325D']} style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Sparkles color={Colors.accent} size={26} />
            </View>
            <Text style={styles.brand}>wordifi</Text>
            <Text style={styles.tagline}>Ace your German exam</Text>
          </View>

          <View style={styles.card}>
            <Pressable
              accessibilityLabel="Continue with Google"
              disabled={isLoading}
              onPress={handleGoogleAuth}
              style={styles.googleButton}
              testID="google-auth-button"
            >
              <View style={styles.googleIconWrap}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with email</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.segment}>
              <Pressable
                accessibilityLabel="Switch to sign in"
                onPress={() => setMode('signIn')}
                style={[styles.segmentButton, mode === 'signIn' ? styles.segmentButtonActive : null]}
                testID="sign-in-tab"
              >
                <Text style={[styles.segmentText, mode === 'signIn' ? styles.segmentTextActive : null]}>Sign In</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Switch to create account"
                onPress={() => setMode('signUp')}
                style={[styles.segmentButton, mode === 'signUp' ? styles.segmentButtonActive : null]}
                testID="sign-up-tab"
              >
                <Text style={[styles.segmentText, mode === 'signUp' ? styles.segmentTextActive : null]}>Create Account</Text>
              </Pressable>
            </View>

            <View style={styles.inputWrap}>
              <View style={styles.inputShell}>
                <Mail color={Colors.textMuted} size={18} />
                <TextInput
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onBlur={() => setTouched((value) => ({ ...value, email: true }))}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  testID="email-input"
                  textContentType="emailAddress"
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
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  onBlur={() => setTouched((value) => ({ ...value, password: true }))}
                  onChangeText={setPassword}
                  placeholder="Password (8+ characters)"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  testID="password-input"
                  textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setShowPassword((v) => !v)}
                  testID="password-toggle"
                >
                  {showPassword ? (
                    <EyeOff color={Colors.textMuted} size={20} />
                  ) : (
                    <Eye color={Colors.textMuted} size={20} />
                  )}
                </Pressable>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              {mode === 'signIn' ? (
                <Pressable
                  accessibilityLabel="Forgot password"
                  onPress={openForgotModal}
                  style={styles.forgotLink}
                  testID="forgot-password-link"
                >
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </Pressable>
              ) : null}
            </View>

            {mode === 'signUp' ? (
              <Pressable
                accessibilityLabel="Agree to terms"
                onPress={() => setAcceptedTerms((value) => !value)}
                style={styles.termsRow}
                testID="terms-checkbox"
              >
                <View style={[styles.checkbox, acceptedTerms ? styles.checkboxSelected : null]}>
                  {acceptedTerms ? <Check color={Colors.surface} size={14} /> : null}
                </View>
                <Text style={styles.termsText}>I agree to Terms</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityLabel={mode === 'signIn' ? 'Sign in with email' : 'Create account'}
              disabled={!canSubmit || isLoading}
              onPress={handleEmailAuth}
              style={[styles.primaryButton, !canSubmit || isLoading ? styles.buttonDisabled : null]}
              testID="email-auth-button"
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'signIn' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showForgotModal} transparent animationType="none" onRequestClose={closeForgotModal}>
        <Animated.View style={[styles.modalOverlay, { opacity: forgotModalFade }]}>
          <Pressable style={styles.modalBackdrop} onPress={closeForgotModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>Reset Password</Text>
              <Pressable onPress={closeForgotModal} hitSlop={8} testID="close-forgot-modal">
                <X color={Colors.textMuted} size={22} />
              </Pressable>
            </View>

            {forgotSent ? (
              <View style={styles.modalSentWrap}>
                <View style={styles.modalSentIcon}>
                  <Mail color={Colors.accent} size={28} />
                </View>
                <Text style={styles.modalSentTitle}>Check your inbox</Text>
                <Text style={styles.modalSentBody}>
                  We sent a password reset link to{'\n'}
                  <Text style={styles.modalSentEmail}>{forgotEmail.trim()}</Text>
                </Text>
                <Pressable style={styles.modalDoneButton} onPress={closeForgotModal} testID="forgot-done">
                  <Text style={styles.modalDoneButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.modalSubheading}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>
                <View style={styles.modalInputShell}>
                  <Mail color={Colors.textMuted} size={18} />
                  <TextInput
                    accessibilityLabel="Reset email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }}
                    placeholder="Email"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.modalInput}
                    testID="forgot-email-input"
                    textContentType="emailAddress"
                    value={forgotEmail}
                  />
                </View>
                {forgotError ? <Text style={styles.modalError}>{forgotError}</Text> : null}
                <Pressable
                  disabled={forgotLoading}
                  onPress={handleForgotPassword}
                  style={[styles.modalSendButton, forgotLoading ? styles.buttonDisabled : null]}
                  testID="forgot-send-button"
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={Colors.surface} />
                  ) : (
                    <Text style={styles.modalSendButtonText}>Send Reset Link</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </Modal>
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
  brand: { fontSize: 34, fontWeight: '800' as const, color: colors.white },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.78)' },
  card: {
    borderRadius: 28,
    backgroundColor: Colors.surface,
    padding: 18,
    gap: 16,
  },
  googleButton: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  googleButtonText: { color: Colors.primary, fontWeight: '800' as const, fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontWeight: '600' as const, fontSize: 13 },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 18,
    padding: 4,
  },
  segmentButton: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: Colors.surface },
  segmentText: { color: Colors.textMuted, fontWeight: '700' as const, fontSize: 14 },
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
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: '600' as const },
  forgotLink: { alignSelf: 'flex-end' as const, paddingVertical: 2 },
  forgotLinkText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' as const },
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
  termsText: { color: Colors.text, fontWeight: '600' as const },
  primaryButton: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: Colors.surface, fontWeight: '800' as const, fontSize: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,23,40,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 14,
    zIndex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeading: { fontSize: 20, fontWeight: '800' as const, color: Colors.primary },
  modalSubheading: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  modalInputShell: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalInput: { flex: 1, fontSize: 15, color: Colors.text },
  modalError: { color: Colors.danger, fontSize: 13, fontWeight: '600' as const },
  modalSendButton: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalSendButtonText: { color: Colors.surface, fontWeight: '800' as const, fontSize: 16 },
  modalSentWrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  modalSentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSentTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.primary },
  modalSentBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' as const, lineHeight: 20 },
  modalSentEmail: { fontWeight: '700' as const, color: Colors.primary },
  modalDoneButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  modalDoneButtonText: { color: '#fff', fontWeight: '800' as const, fontSize: 16 },
});
