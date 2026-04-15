import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { WordifiLogo } from '@/components/WordifiLogo';

// Static confetti shapes in the header zone — positional constants
const HEADER_CONFETTI = [
  { left: 12,  top: 14, w: 8,  h: 8,  r: 4,   color: colors.flagGold,  rotate: '0deg'  },
  { left: 38,  top: 52, w: 5,  h: 12, r: 2,   color: colors.flagRed,   rotate: '30deg' },
  { left: 78,  top: 10, w: 7,  h: 7,  r: 3.5, color: colors.accentTeal,rotate: '0deg'  },
  { left: 130, top: 26, w: 5,  h: 11, r: 1.5, color: colors.flagGold,  rotate: '45deg' },
  { left: 195, top: 12, w: 6,  h: 14, r: 2,   color: colors.flagGold,  rotate: '-20deg'},
  { left: 238, top: 48, w: 8,  h: 8,  r: 4,   color: colors.primaryBlue,rotate: '0deg' },
  { left: 268, top: 22, w: 5,  h: 10, r: 1,   color: colors.flagRed,   rotate: '18deg' },
  { left: 298, top: 54, w: 7,  h: 7,  r: 3.5, color: colors.accentTeal,rotate: '0deg'  },
] as const;

export type ShareCardProps = {
  section: string;
  level: string;
  teilNameEn: string;
  teilNameDe: string;
  score: number;
  total: number;
  incorrect: number;
  examType: string;
  captureRef?: React.RefObject<View>;
};

export default function ShareCard({
  section,
  level,
  teilNameEn,
  teilNameDe,
  score,
  total,
  incorrect,
  examType,
  captureRef,
}: ShareCardProps) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const accuracy = `${pct}%`;
  const examLabel = examType
    ? examType.toUpperCase()
    : 'German language';

  return (
    <View ref={captureRef} style={styles.card}>
      {/* ── Zone 1: Header ────────────────────────────────────── */}
      <View style={styles.zone1}>
        {/* Decorative confetti shapes */}
        {HEADER_CONFETTI.map((s, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: s.w,
              height: s.h,
              borderRadius: s.r,
              backgroundColor: s.color,
              transform: [{ rotate: s.rotate }],
              opacity: 0.7,
            }}
          />
        ))}
        {/* Wordmark + level pill */}
        <View style={styles.z1TopRow}>
          <WordifiLogo variant="light" height={26} />
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>{level}</Text>
          </View>
        </View>
        {/* Section name */}
        <Text style={styles.sectionName}>{section}</Text>
        {/* Exam type */}
        <Text style={styles.examSubtitle}>{examLabel}</Text>
      </View>

      {/* ── Zone 2: Score ─────────────────────────────────────── */}
      <View style={styles.zone2}>
        <Text style={styles.scoreFraction}>
          {score}/{total}
        </Text>
        <Text style={styles.scorePct}>{accuracy}</Text>
        <Text style={styles.teilBilingual}>
          {teilNameEn}{teilNameDe ? ` / ${teilNameDe}` : ''}
        </Text>
      </View>

      {/* ── Zone 3: Stats row ─────────────────────────────────── */}
      <View style={styles.zone3}>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{score}</Text>
          <Text style={styles.statLabel}>Correct</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{incorrect}</Text>
          <Text style={styles.statLabel}>Incorrect</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{accuracy}</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      {/* ── Zone 4: Footer ────────────────────────────────────── */}
      <View style={styles.zone4}>
        <Text style={styles.footerLeft}>Preparing for {examLabel}</Text>
        <Text style={styles.footerRight}>wordifi.app</Text>
      </View>
    </View>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 480,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: Colors.primaryDeep,
  },

  // ── Zone 1: Header (~144px / 30%) ──────────────────────────
  zone1: {
    height: 144,
    backgroundColor: Colors.primaryDeep,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  z1TopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  levelPill: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  sectionName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  examSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
    marginTop: 4,
  },

  // ── Zone 2: Score (~168px / 35%) ───────────────────────────
  zone2: {
    height: 168,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  scoreFraction: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.primaryDeep,
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 72,
    letterSpacing: -1,
  },
  scorePct: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.accent,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  teilBilingual: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textBody,
    fontFamily: 'NunitoSans_400Regular',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // ── Zone 3: Stats (~96px / 20%) ────────────────────────────
  zone3: {
    height: 96,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryDeep,
    fontFamily: 'Outfit_800ExtraBold',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },

  // ── Zone 4: Footer (~72px / 15%) ───────────────────────────
  zone4: {
    height: 72,
    backgroundColor: Colors.primaryDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  footerLeft: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    fontFamily: 'NunitoSans_400Regular',
  },
  footerRight: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
    fontFamily: 'NunitoSans_600SemiBold',
  },
});
