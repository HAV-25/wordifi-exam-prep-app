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
import { colors, fontFamily } from '@/theme';

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
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Mail size={56} color={colors.accentTeal} />
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
          style={{ opacity: cooldown > 0 ? 0.5 : 1, marginBottom: 16 }}
        >
          <Text style={styles.resendText}>
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
    backgroundColor: colors.darkNavy,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 24,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  bodyWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 48,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  emailText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    color: colors.accentTeal,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 19,
  },
  resendText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.accentTeal,
  },
  backText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: colors.accentTeal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.darkNavy,
  },
});
