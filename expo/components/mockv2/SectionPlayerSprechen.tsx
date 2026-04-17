/**
 * SectionPlayerSprechen — Mock V2 oral section.
 *
 * V1 approach: for each teil, navigate OUT to /sprechen-realtime with a mock
 * context flag, collect the scored result on return via onComplete.
 *
 * For the compressed V1 build, we show a simplified one-screen-per-teil flow
 * that guides the user to start the conversation via the existing realtime flow.
 *
 * NOTE: Full inline realtime integration is a polish item. For V1 scope,
 * this wrapper shows a "Start Sprechen Teil X" card per teil and launches
 * the existing realtime flow. Results are simulated/captured via AsyncStorage
 * bridge since full inline is a 2-day job.
 *
 * Simple V1: show each teil as a "Ready to speak?" card → user taps Start →
 * conversation runs in the existing sprechen-realtime screen → on return,
 * we consume the score and advance to next teil.
 */
import { Mic, Play } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { B } from '@/theme/banani';

export type SprechenSectionResult = {
  teilScores: Array<{ teil: number; overall: number; fluency: number; grammar: number; vocabulary: number }>;
  overallScorePct: number;
  timeTakenSeconds: number;
};

type Props = {
  level: string;
  teils: number[];
  onComplete: (result: SprechenSectionResult) => void;
  sectionIndex: number;
  totalSections: number;
};

/**
 * Placeholder V1: collects per-teil scores but the actual speaking happens
 * via the existing /sprechen-realtime route. For the compressed implementation,
 * we offer "Skip with demo score" so the mock flow end-to-end can be tested.
 * The proper integration (launch realtime → return with score) is a
 * follow-up when we wire up deep-linking between mock orchestrator and realtime.
 */
export function SectionPlayerSprechen({ level, teils, onComplete, sectionIndex, totalSections }: Props) {
  const [currentTeilIndex, setCurrentTeilIndex] = useState(0);
  const [teilScores, setTeilScores] = useState<SprechenSectionResult['teilScores']>([]);
  const sessionStart = useRef(Date.now());

  const currentTeil = teils[currentTeilIndex]!;
  const isLastTeil = currentTeilIndex === teils.length - 1;

  const handleTeilDone = useCallback((score: { overall: number; fluency: number; grammar: number; vocabulary: number }) => {
    const next = [...teilScores, { teil: currentTeil, ...score }];
    setTeilScores(next);
    if (isLastTeil) {
      const avg = next.reduce((a, s) => a + s.overall, 0) / next.length;
      onComplete({
        teilScores: next,
        overallScorePct: Math.round(avg),
        timeTakenSeconds: Math.round((Date.now() - sessionStart.current) / 1000),
      });
    } else {
      setCurrentTeilIndex((i) => i + 1);
    }
  }, [teilScores, currentTeil, isLastTeil, onComplete]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.teilCount}>Teil {currentTeilIndex + 1} of {teils.length}</Text>
          <View style={styles.sectionPill}>
            <Mic color="#F97316" size={14} />
            <Text style={styles.sectionPillText}>Sprechen</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.teilCard}>
          <View style={styles.teilIconWrap}>
            <Mic color="#F97316" size={36} />
          </View>
          <Text style={styles.teilTitle}>Sprechen Teil {currentTeil}</Text>
          <Text style={styles.teilHint}>
            You'll have a short conversation with the AI partner. Speak naturally in German.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.instruction}>
            For the compressed V1 build, Sprechen uses a demo score. Full inline integration
            with the realtime flow comes in the next iteration.
          </Text>

          <Pressable
            style={styles.startBtn}
            onPress={() => handleTeilDone({ overall: 72, fluency: 70, grammar: 75, vocabulary: 70 })}
            testID={`mockv2-sprechen-teil-${currentTeil}`}
          >
            <Play color="#fff" size={18} />
            <Text style={styles.startBtnText}>
              {isLastTeil ? 'Finish Sprechen (demo)' : 'Complete Teil (demo)'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: B.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: B.card, borderBottomWidth: 1, borderBottomColor: B.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  teilCount: { fontSize: 13, fontWeight: '800' as const, color: B.primary },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.12)' },
  sectionPillText: { fontSize: 11, fontWeight: '700' as const, color: '#F97316' },
  levelText: { fontSize: 11, fontWeight: '600' as const, color: B.muted, flex: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 24 },

  teilCard: {
    backgroundColor: B.card, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: B.border,
  },
  teilIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  teilTitle: { fontSize: 22, fontWeight: '800' as const, color: B.questionColor, textAlign: 'center' },
  teilHint: { fontSize: 14, fontWeight: '500' as const, color: B.muted, textAlign: 'center', lineHeight: 20 },
  divider: { width: '60%', height: 1, backgroundColor: B.border, marginVertical: 12 },
  instruction: { fontSize: 13, color: B.muted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: B.primary, borderRadius: 999,
    paddingVertical: 16, paddingHorizontal: 28,
    marginTop: 12, minWidth: 220,
    shadowColor: B.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
  },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' as const },
});
