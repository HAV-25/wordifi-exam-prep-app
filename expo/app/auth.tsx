import { router, useLocalSearchParams } from 'expo-router';
import { CheckSquare, Eye, EyeOff, Lock, Mail, Square, X } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
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
import { colors, fontFamily } from '@/theme';
import { WordifiLogo } from '@/components/WordifiLogo';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail, updateTcAccepted } from '@/lib/authHelpers';
import { tagPendingOnboardingForUser } from '@/lib/profileHelpers';
import { onboardingSessionNonce } from '@/app/onboarding_launch/_store';
import { track } from '@/lib/track';
import { useAppConfig } from '@/providers/AppConfigProvider';
import { supabase } from '@/lib/supabaseClient';

function getFriendlySignInError(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Could not connect. Please try again.';
  }
  return 'Something went wrong. Please check your connection.';
}

export default function AuthScreen() {
  const config = useAppConfig();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<'signIn' | 'signUp'>(
    modeParam === 'signUp' ? 'signUp' : 'signIn'
  );
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [tcAccepted, setTcAccepted] = useState<boolean>(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tcError, setTcError] = useState<boolean>(false);

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
    if (!touched.password || mode === 'signIn') {
      return '';
    }
    return password.length >= 8 ? '' : 'Password must be at least 8 characters';
  }, [password, touched.password, mode]);

  const canSubmit = email.length > 0 && password.length > 0 && /\S+@\S+\.\S+/.test(email) && (mode === 'signIn' || (password.length >= 8 && tcAccepted));

  const handleEmailAuth = async () => {
    setTouched({ email: true, password: true });
    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signIn') {
        const data = await signInWithEmail(email.trim(), password.trim());
        if (data?.user) {
          await updateTcAccepted(data.user.id, config.tc_version).catch(() => {});
        }
        track('user_signed_in', { method: 'email' });
        // Pending onboarding reconciliation handled by AuthProvider after session established
        router.replace('/');
      } else {
        const result = await signUpWithEmail(email.trim(), password);
        if (result.status === 'confirmation_pending') {
          // Onboarding data already persisted to AsyncStorage in paywall.tsx.
          // Tag it with the new userId so reconciliation is scoped to this user only.
          await tagPendingOnboardingForUser(result.userId, onboardingSessionNonce);
          track('user_signed_up', { signup_method: 'email' });
          // tc_accepted is handled by AuthProvider after session is established
          router.push({ pathname: '/check-email', params: { email: result.email } });
          return;
        }
        // Immediately signed in (email confirmation disabled)
        // Tag pending data and let AuthProvider handle reconciliation
        if (result.data?.user?.id) {
          await tagPendingOnboardingForUser(result.data.user.id, onboardingSessionNonce);
          await updateTcAccepted(result.data.user.id, config.tc_version).catch(() => {});
        }
        track('user_signed_up', { signup_method: 'email' });
        router.replace('/');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (mode === 'signUp') {
        Alert.alert('Wordifi', message);
      } else {
        Alert.alert('Wordifi', getFriendlySignInError(message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (mode === 'signUp' && !tcAccepted) {
      setTcError(true);
      return;
    }
    setIsLoading(true);
    try {
      await signInWithGoogle();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Detect new vs existing by account age — reliable regardless of which tab was selected
        const isNewUser = Date.now() - new Date(user.created_at).getTime() < 60_000;
        if (isNewUser) {
          await tagPendingOnboardingForUser(user.id, onboardingSessionNonce);
          track('user_signed_up', { signup_method: 'google' });
        } else {
          track('user_signed_in', { method: 'google' });
        }
        await updateTcAccepted(user.id, config.tc_version).catch(() => {});
      }
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Wordifi', getFriendlySignInError(message));
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
    <View style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <WordifiLogo variant="blue" height={44} />
            <Text style={styles.tagline}>Ace your German exam</Text>
          </View>

          <View style={styles.card}>
            <Pressable
              accessibilityLabel="Continue with Google"
              disabled={isLoading || (mode === 'signUp' && !tcAccepted)}
              onPress={handleGoogleAuth}
              style={[styles.googleButton, ((mode === 'signUp' && !tcAccepted) || isLoading) ? styles.buttonDisabled : null]}
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
              <View style={styles.tcWrap}>
                <View style={[styles.tcRow, tcError && styles.tcRowError]}>
                  <Pressable
                    onPress={() => { setTcAccepted((prev) => !prev); setTcError(false); }}
                    style={styles.tcCheckbox}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Agree to terms and conditions"
                    testID="tc-checkbox"
                  >
                    {tcAccepted
                      ? <CheckSquare size={20} color={Colors.primary} />
                      : <Square size={20} color={tcError ? '#EF4444' : Colors.textMuted} />
                    }
                  </Pressable>
                  <Text style={styles.tcText}>
                    {'I agree to the '}
                    <Text
                      style={styles.tcLink}
                      onPress={() => Linking.openURL(config.terms_url)}
                    >
                      Terms & Conditions
                    </Text>
                    {' and '}
                    <Text
                      style={styles.tcLink}
                      onPress={() => Linking.openURL(config.privacy_url)}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
                {tcError ? (
                  <Text style={styles.tcErrorText}>
                    Please accept the Terms & Conditions to continue
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={mode === 'signIn' ? 'Sign in with email' : 'Create account'}
              disabled={!canSubmit || isLoading}
              onPress={handleEmailAuth}
              style={[styles.primaryButton, (!canSubmit || isLoading) ? styles.buttonDisabled : null]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F8FAFF' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 24,
  },
  hero: { gap: 6, alignItems: 'center' as const, marginBottom: 8 },
  brand: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 36,
    color: '#0A0E1A',
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    color: '#94A3B8',
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 20,
    gap: 16,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  tcWrap: {
    gap: 6,
  },
  tcRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 6,
  },
  tcRowError: {
    // visual container highlight handled by icon + text colour change
  },
  tcCheckbox: {
    paddingTop: 1,
  },
  tcErrorText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 12,
    color: '#EF4444',
    marginHorizontal: 6,
  },
  tcText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: Colors.textBody,
    flex: 1,
    lineHeight: 20,
  },
  tcLink: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  googleButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
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
  googleButtonText: { fontFamily: 'NunitoSans_600SemiBold', color: '#374151', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontFamily: 'NunitoSans_400Regular', color: '#94A3B8', fontSize: 13 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
  },
  segmentButton: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontFamily: 'NunitoSans_600SemiBold', color: '#94A3B8', fontSize: 14 },
  segmentTextActive: { color: '#2B70EF' },
  inputWrap: { gap: 6 },
  inputShell: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, fontFamily: 'NunitoSans_400Regular', fontSize: 15, color: '#374151' },
  errorText: { fontFamily: 'NunitoSans_600SemiBold', color: '#EF4444', fontSize: 13 },
  forgotLink: { alignSelf: 'flex-end' as const, paddingVertical: 2 },
  forgotLinkText: { fontFamily: 'NunitoSans_600SemiBold', color: '#2B70EF', fontSize: 13 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#2B70EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', fontSize: 17 },

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
