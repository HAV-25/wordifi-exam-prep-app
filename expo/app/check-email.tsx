import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabaseClient';

const RESEND_COOLDOWN = 30;

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [cooldown, setCooldown] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback(() => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  }, [toastOpacity]);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0) return;
    await supabase.auth.resend({ type: 'signup', email });
    showToast();
    setCooldown(RESEND_COOLDOWN);
  }, [email, cooldown, showToast]);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Mail size={48} color="#2B70EF" />
        </View>

        <Text style={styles.title}>Check your inbox</Text>

        <View style={styles.bodyWrap}>
          <Text style={styles.body}>We sent a confirmation link to</Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.subtext}>
            Tap the link in the email to activate your account and start practising.
          </Text>
        </View>

        <Pressable
          onPress={handleResend}
          disabled={cooldown > 0}
          style={[styles.resendBtn, cooldown > 0 && styles.resendBtnDisabled]}
        >
          <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it? Resend email"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/auth')}>
          <Text style={styles.backText}>Back to sign in</Text>
        </Pressable>
      </View>

      {toastVisible ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>Email resent!</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
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
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  bodyWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 40,
  },
  body: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emailText: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 16,
    color: '#2B70EF',
    textAlign: 'center',
    marginVertical: 8,
  },
  subtext: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  resendBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#EBF1FF',
    marginBottom: 16,
  },
  resendBtnDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: '#2B70EF',
  },
  resendTextDisabled: {
    color: '#94A3B8',
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
    backgroundColor: '#2B70EF',
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
