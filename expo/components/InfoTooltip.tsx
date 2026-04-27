import React, { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onDismiss: () => void;
  text: string;
  /** Auto-dismiss delay in ms. Default 3000. */
  autoDismissMs?: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Reusable fade-in tooltip modal.
 * Matches the modal+backdrop pattern used in StreakStatusIcon and profile.tsx.
 *
 * - Fades in on mount, auto-dismisses after `autoDismissMs` (default 3 s)
 * - Tap outside the card calls onDismiss immediately
 * - Returns null when not visible (no tree overhead)
 */
export function InfoTooltip({ visible, onDismiss, text, autoDismissMs = 3000 }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onDismiss, autoDismissMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={s.backdrop} onPress={onDismiss}>
        <View style={s.card}>
          <Text style={s.body}>{text}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 320,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#0F1F3D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  body: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
});
