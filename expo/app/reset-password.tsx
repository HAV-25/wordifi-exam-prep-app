import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyRound } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastVisible, setToastVisible] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const showToast = useCallback(() => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setToastVisible(false);
      router.replace('/(tabs)');
    });
  }, [toastOpacity]);

  const validate = useCallback((): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  }, [password, confirm]);

  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }
      showToast();
    } catch (err) {
      console.error('[ResetPassword] updateUser error', err);
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }, [password, validate, showToast]);

  const canSubmit = password.length >= 8 && confirm.length >= 1 && !isLoading;

  return (
    <SafeAreaView style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={s.iconWrap}>
            <KeyRound size={32} color="#2B70EF" />
          </View>

          {/* Heading */}
          <Text style={s.title}>Set new password</Text>
          <Text style={s.subtitle}>
            Choose a new password for your Wordifi account.
          </Text>

          {/* Fields */}
          <View style={s.fieldsWrap}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>New password</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                placeholder="At least 8 characters"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!isLoading}
                testID="new-password-input"
              />
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Confirm password</Text>
              <TextInput
                ref={confirmRef}
                style={s.input}
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setError(null); }}
                placeholder="Repeat your new password"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isLoading}
                testID="confirm-password-input"
              />
            </View>

            {error ? (
              <Text style={s.errorText} testID="reset-password-error">{error}</Text>
            ) : null}
          </View>

          {/* CTA */}
          <Pressable
            style={[s.cta, !canSubmit && s.ctaDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            testID="reset-password-submit"
          >
            <Text style={[s.ctaText, !canSubmit && s.ctaTextDisabled]}>
              {isLoading ? 'Updating…' : 'Update password'}
            </Text>
          </Pressable>

          {/* Sign in link */}
          <Pressable onPress={() => router.replace('/auth')} style={s.backWrap}>
            <Text style={s.backText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {toastVisible ? (
        <Animated.View style={[s.toast, { opacity: toastOpacity }]}>
          <Text style={s.toastText}>Password updated!</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#EBF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  fieldsWrap: {
    width: '100%',
    gap: 16,
    marginBottom: 28,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: '#374151',
    paddingLeft: 2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: '#374151',
  },
  errorText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 4,
  },
  cta: {
    width: '100%',
    backgroundColor: '#2B70EF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaDisabled: {
    backgroundColor: '#F1F5F9',
  },
  ctaText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  ctaTextDisabled: {
    fontFamily: 'NunitoSans_600SemiBold',
    color: '#94A3B8',
  },
  backWrap: {
    paddingVertical: 8,
  },
  backText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: '#94A3B8',
  },
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
