import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dices, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/colors';
import { getRandomPlayerName } from '@/constants/playerNames';

const PLAYER_NAME_SET_KEY = 'wordifi_player_name_set';
const MAX_NAME_LENGTH = 20;
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]*$/;

type PlayerNameModalProps = {
  visible: boolean;
  onConfirm: (name: string) => void;
};

export function PlayerNameModal({ visible, onConfirm }: PlayerNameModalProps) {
  const [suggestedName, setSuggestedName] = useState<string>(() => getRandomPlayerName());
  const [customName, setCustomName] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const handleReroll = useCallback(() => {
    setSuggestedName(getRandomPlayerName());
    setIsCustom(false);
    setCustomName('');
    setError('');
  }, []);

  const handleCustomInput = useCallback((text: string) => {
    if (text.length > MAX_NAME_LENGTH) return;
    if (!ALPHANUMERIC_REGEX.test(text)) {
      setError('Letters and numbers only');
      return;
    }
    setError('');
    setCustomName(text);
    setIsCustom(text.length > 0);
  }, []);

  const handleConfirm = useCallback(async () => {
    const finalName = isCustom ? customName.trim() : suggestedName;
    if (finalName.length === 0) {
      setError('Name cannot be empty');
      return;
    }
    if (finalName.length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }
    await AsyncStorage.setItem(PLAYER_NAME_SET_KEY, 'true');
    onConfirm(finalName);
  }, [isCustom, customName, suggestedName, onConfirm]);

  if (!visible) return null;

  const displayName = isCustom ? customName : suggestedName;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconWrap}>
            <Sparkles color={Colors.accent} size={28} />
          </View>

          <Text style={styles.heading}>Choose your learner name</Text>
          <Text style={styles.subheading}>
            This is how you'll appear on the leaderboard
          </Text>

          <View style={styles.nameDisplayWrap}>
            <Text style={styles.nameDisplay}>{displayName || 'Type a name...'}</Text>
          </View>

          <Pressable
            style={styles.rerollButton}
            onPress={handleReroll}
            testID="reroll-name"
          >
            <Dices color={Colors.primary} size={16} />
            <Text style={styles.rerollText}>Suggest another name</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or type your own</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.inputShell}>
            <TextInput
              style={styles.input}
              placeholder="Your custom name"
              placeholderTextColor={Colors.textMuted}
              value={customName}
              onChangeText={handleCustomInput}
              maxLength={MAX_NAME_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
              testID="player-name-input"
            />
            <Text style={styles.charCount}>{customName.length}/{MAX_NAME_LENGTH}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={styles.confirmButton}
            onPress={handleConfirm}
            testID="confirm-player-name"
          >
            <Text style={styles.confirmText}>
              {isCustom ? 'Use this name' : `I'm ${suggestedName}`}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 23, 40, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 24,
  },
  keyboardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 28,
    gap: 16,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: -8,
  },
  nameDisplayWrap: {
    width: '100%',
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  nameDisplay: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  rerollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  rerollText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  inputShell: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    paddingVertical: 14,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '600' as const,
    marginTop: -8,
  },
  confirmButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
});
