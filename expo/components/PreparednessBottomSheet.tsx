import { Calendar, Flame, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { colors } from '@/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.52;

type PreparednessBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  level: string;
  overallScore: number;
  horenPct: number;
  lesenPct: number;
  schreibenPct?: number;
  streak: number;
  lastActiveDate: string | null;
};

function getBarColor(score: number): string {
  if (score < 40) return colors.red;
  if (score < 70) return colors.amber;
  return colors.green;
}

function BarRow({ label, pct, icon }: { label: string; pct: number; icon: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const color = getBarColor(pct);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(pct, 100),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  const widthInterp = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelWrap}>
        <Text style={barStyles.icon}>{icon}</Text>
        <Text style={barStyles.label}>{label}</Text>
      </View>
      <View style={barStyles.trackWrap}>
        <View style={barStyles.track}>
          <Animated.View style={[barStyles.fill, { width: widthInterp, backgroundColor: color }]} />
        </View>
        <Text style={[barStyles.pct, { color }]}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: {
    gap: 6,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  trackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  pct: {
    fontSize: 14,
    fontWeight: '800' as const,
    minWidth: 40,
    textAlign: 'right' as const,
  },
});

function getReadinessColor(pct: number): string {
  if (pct >= 70) return colors.green;
  if (pct >= 40) return colors.amber;
  return colors.red;
}

const BOTTOM_CONTENT_BUFFER = 24;

export const PreparednessBottomSheet = React.memo(function PreparednessBottomSheet({
  visible,
  onClose,
  level,
  overallScore,
  horenPct,
  lesenPct,
  schreibenPct = 0,
  streak,
  lastActiveDate,
}: PreparednessBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetHeight = SHEET_HEIGHT + insets.bottom;
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: sheetHeight, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: sheetHeight, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [translateY, backdropOpacity, onClose, sheetHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          void dismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const lastPracticeLabel = lastActiveDate
    ? lastActiveDate === new Date().toISOString().split('T')[0]
      ? 'Today'
      : lastActiveDate
    : 'Never';

  if (!visible) return null;

  return (
    <View style={styles.overlay} testID="preparedness-bottom-sheet">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            paddingBottom: insets.bottom + BOTTOM_CONTENT_BUFFER,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <Text style={styles.title}>{level} Readiness Overview</Text>
          <Pressable onPress={dismiss} hitSlop={12}>
            <X color={Colors.textMuted} size={22} />
          </Pressable>
        </View>

        <View style={styles.barsWrap}>
          <BarRow label="Hören" pct={horenPct} icon="🎧" />
          <BarRow label="Lesen" pct={lesenPct} icon="📖" />
          <BarRow label="Schreiben" pct={schreibenPct} icon="✍️" />
          <View style={styles.divider} />
          <BarRow label="Overall" pct={overallScore} icon="📊" />
        </View>

        <View style={styles.readinessRow}>
          <Text style={[styles.readinessText, { color: getReadinessColor(Math.round((horenPct * 0.35) + (lesenPct * 0.35) + (schreibenPct * 0.30))) }]}>
            Estimated exam readiness: {Math.round((horenPct * 0.35) + (lesenPct * 0.35) + (schreibenPct * 0.30))}%
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Flame color={colors.amber} size={20} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <Calendar color={Colors.textMuted} size={20} />
            <Text style={styles.statValue}>{lastPracticeLabel}</Text>
            <Text style={styles.statLabel}>Last practice</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 150,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  barsWrap: {
    gap: 14,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  readinessRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  readinessText: {
    fontSize: 15,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
});
