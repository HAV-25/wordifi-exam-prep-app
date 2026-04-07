import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Copy, Image as ImageIcon, Share2 } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { captureRef } from 'react-native-view-shot';

import Colors from '@/constants/colors';
import { colors } from '@/theme';
import ShareCard from './ShareCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function motivationalLine(pct: number): string {
  if (pct >= 90) return 'Almost perfect! Exam ready. 💪';
  if (pct >= 70) return 'Strong result — keeping the momentum going!';
  if (pct >= 50) return 'Solid progress. Every test counts.';
  return 'Learning from every question. Getting there!';
}

export type ShareResultSheetProps = {
  visible: boolean;
  onClose: () => void;
  section: string;
  level: string;
  teilNameEn: string;
  teilNameDe: string;
  score: number;
  total: number;
  scorePct: number;
  examType: string;
};

export default function ShareResultSheet({
  visible,
  onClose,
  section,
  level,
  teilNameEn,
  teilNameDe,
  score,
  total,
  scorePct,
  examType,
}: ShareResultSheetProps) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastVisible, setToastVisible] = useState(false);

  const incorrect = total - score;
  const examLabel = examType ? examType.toUpperCase() : 'German language';

  const shareText =
    `🎯 ${score}/${total} on ${section} ${level} — ${teilNameEn}\n` +
    `${motivationalLine(scorePct)}\n\n` +
    `Preparing for my ${examLabel} exam with Wordifi 🇩🇪\n` +
    `Download: wordifi.app`;

  const showCopiedToast = useCallback(() => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 1140, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  }, [toastOpacity]);

  const handleCopyText = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(shareText);
      showCopiedToast();
    } catch (e) {
      console.log('ShareResultSheet copyText error', e);
    }
  }, [shareText, showCopiedToast]);

  const handleCopyImage = useCallback(async () => {
    try {
      const base64 = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'base64',
      });
      await Clipboard.setImageAsync(base64);
      showCopiedToast();
    } catch (e) {
      console.log('ShareResultSheet copyImage error', e);
    }
  }, [showCopiedToast]);

  const handleShare = useCallback(async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (Platform.OS === 'ios') {
        await Share.share({ message: shareText, url: uri });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: shareText,
        });
      }
      onClose();
    } catch (e) {
      console.log('ShareResultSheet share error', e);
    }
  }, [shareText, onClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Scrim — tap to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Sheet */}
        <View style={[styles.sheet, { maxHeight: SCREEN_HEIGHT - insets.top - 8 }]}>
          {/* Handle bar */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          >
            {/* ── Card preview ─────────────────────────────── */}
            <View style={styles.cardWrap}>
              <View ref={cardRef} style={styles.cardInner}>
                <ShareCard
                  section={section}
                  level={level}
                  teilNameEn={teilNameEn}
                  teilNameDe={teilNameDe}
                  score={score}
                  total={total}
                  incorrect={incorrect}
                  examType={examLabel}
                />
              </View>
            </View>

            {/* ── Copy text section ─────────────────────────── */}
            <View style={styles.textSection}>
              <View style={styles.textLabelRow}>
                <Text style={styles.textLabel}>Copy text</Text>
                <Pressable onPress={handleCopyText} style={styles.copyIconBtn} accessibilityLabel="Copy share text">
                  <Copy size={16} color={Colors.primary} />
                </Pressable>
              </View>
              <View style={styles.textBox}>
                <Text style={styles.textBoxContent} selectable>{shareText}</Text>
              </View>
            </View>

            {/* ── Action buttons ────────────────────────────── */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleCopyImage}
                style={styles.actionBtnOutline}
                accessibilityLabel="Copy card as image"
              >
                <ImageIcon size={18} color={Colors.primary} />
                <Text style={styles.actionBtnOutlineText}>Copy image</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={styles.actionBtnPrimary}
                accessibilityLabel="Share result"
              >
                <Share2 size={18} color={Colors.white} />
                <Text style={styles.actionBtnPrimaryText}>Share</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>

        {/* ── Copied! toast ────────────────────────────────── */}
        {toastVisible && (
          <Animated.View
            style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 100 }]}
            pointerEvents="none"
          >
            <Text style={styles.toastText}>Copied!</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  scrollContent: {
    paddingTop: 8,
    gap: 20,
  },

  // ── Card preview ───────────────────────────────────────────
  cardWrap: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  cardInner: {
    borderRadius: 16,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Copy text section ──────────────────────────────────────
  textSection: {
    paddingHorizontal: 24,
    gap: 8,
  },
  textLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textBody,
    fontFamily: 'NunitoSans_600SemiBold',
  },
  copyIconBtn: {
    padding: 4,
  },
  textBox: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  textBoxContent: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_400Regular',
    lineHeight: 20,
  },

  // ── Action buttons ─────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
  },
  actionBtnOutline: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
  },
  actionBtnOutlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_600SemiBold',
  },
  actionBtnPrimary: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  actionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    fontFamily: 'NunitoSans_600SemiBold',
  },

  // ── Copied toast ───────────────────────────────────────────
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDeep,
    fontFamily: 'NunitoSans_600SemiBold',
  },
});
