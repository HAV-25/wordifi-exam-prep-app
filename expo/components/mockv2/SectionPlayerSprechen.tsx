/**
 * SectionPlayerSprechen — Mock V2 oral section.
 *
 * Iterates Sprechen teils sequentially. For each teil:
 *   1. Fetches one Sprechen question for that teil
 *   2. Mounts <MockSprechenTeil /> which runs the real OpenAI Realtime
 *      conversation (A2: Ready card → conversation → score)
 *   3. On completion, stashes the score silently and shows a "Saved"
 *      transition card before advancing to the next teil
 *   4. After last teil, calls onComplete with aggregate
 *
 * If user denies mic permission (B2), that teil records 0% and the
 * section continues to the next teil — user can retry mic later.
 *
 * Silent UX: NO per-teil score is shown to the user during the mock.
 * All scoring revealed only at the final results screen.
 */
import { Check, Mic } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchSprechenQuestions } from '@/lib/sprechenHelpers';
import { B } from '@/theme/banani';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion } from '@/types/database';
import { MockSprechenTeil, type MockSprechenTeilResult } from './MockSprechenTeil';

export type SprechenTeilScore = {
  teil: number;
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  /** Final transcript for review at the end of the mock. */
  transcript?: string;
  /** True if user skipped (mic denied or chose to skip). */
  skipped?: boolean;
};

export type SprechenSectionResult = {
  teilScores: SprechenTeilScore[];
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

type Phase =
  | 'loading'   // fetching question for current teil
  | 'teil'      // <MockSprechenTeil> active
  | 'saved'     // brief "Teil saved" confirmation between teils
  | 'finalizing'; // computing aggregate, calling onComplete

export function SectionPlayerSprechen({
  level,
  teils,
  onComplete,
  sectionIndex,
  totalSections,
}: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? '';

  const [currentTeilIndex, setCurrentTeilIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<AppQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [teilScores, setTeilScores] = useState<SprechenTeilScore[]>([]);
  const sessionStart = useRef(Date.now());
  const isMountedRef = useRef(true);

  const currentTeil = teils[currentTeilIndex]!;
  const isLastTeil = currentTeilIndex === teils.length - 1;
  const teilLabel = `Sprechen Teil ${currentTeil}`;
  const teilCount = `Teil ${currentTeilIndex + 1} of ${teils.length}`;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Fetch question for current teil ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setCurrentQuestion(null);
    (async () => {
      try {
        const fetched = await fetchSprechenQuestions(level, currentTeil, 1);
        if (cancelled) return;
        if (fetched.length === 0) {
          // No question in DB for this teil — skip with 0%
          finalizeTeil({ teil: currentTeil, overall: 0, fluency: 0, grammar: 0, vocabulary: 0, skipped: true });
          return;
        }
        setCurrentQuestion(fetched[0]!);
        setPhase('teil');
      } catch (err) {
        console.log('[MockV2 Sprechen] fetch error', err);
        finalizeTeil({ teil: currentTeil, overall: 0, fluency: 0, grammar: 0, vocabulary: 0, skipped: true });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeilIndex, level]);

  // ── Finalize current teil (advance to next or finish section) ──────────
  const finalizeTeil = useCallback((score: SprechenTeilScore) => {
    setTeilScores((prev) => {
      const next = [...prev, score];
      // If last teil, finalize section
      if (isLastTeil) {
        const total = next.length;
        const avg = total > 0 ? next.reduce((s, t) => s + t.overall, 0) / total : 0;
        const timeTakenSeconds = Math.round((Date.now() - sessionStart.current) / 1000);
        // Use a microtask so state updates settle first
        setTimeout(() => {
          onComplete({
            teilScores: next,
            overallScorePct: Math.round(avg),
            timeTakenSeconds,
          });
        }, 0);
        setPhase('finalizing');
      } else {
        setPhase('saved');
      }
      return next;
    });
  }, [isLastTeil, onComplete]);

  // ── Handlers passed to MockSprechenTeil ─────────────────────────────────
  const handleTeilCompleted = useCallback((result: MockSprechenTeilResult) => {
    finalizeTeil({
      teil: currentTeil,
      overall: result.scores.overall_score,
      fluency: result.scores.fluency_score,
      grammar: result.scores.grammar_score,
      vocabulary: result.scores.vocabulary_score,
      transcript: result.transcript,
    });
  }, [currentTeil, finalizeTeil]);

  const handleTeilSkipped = useCallback((_reason: 'mic_denied' | 'user_skip') => {
    finalizeTeil({
      teil: currentTeil,
      overall: 0,
      fluency: 0,
      grammar: 0,
      vocabulary: 0,
      skipped: true,
    });
  }, [currentTeil, finalizeTeil]);

  const handleContinueToNext = useCallback(() => {
    setCurrentTeilIndex((i) => i + 1);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  // PHASE: loading (fetching the next teil's question)
  if (phase === 'loading') {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.teilCount}>{teilCount}</Text>
          <View style={styles.sectionPill}>
            <Mic color="#F97316" size={14} />
            <Text style={styles.sectionPillText}>Sprechen</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={B.primary} size="large" />
          <Text style={styles.loadingText}>Loading {teilLabel}…</Text>
        </View>
      </View>
    );
  }

  // PHASE: teil — render the real conversation
  if (phase === 'teil' && currentQuestion) {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.teilCount}>{teilCount}</Text>
          <View style={styles.sectionPill}>
            <Mic color="#F97316" size={14} />
            <Text style={styles.sectionPillText}>Sprechen</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
        </View>
        <MockSprechenTeil
          question={currentQuestion}
          accessToken={accessToken}
          teilIndexLabel={teilLabel}
          onComplete={handleTeilCompleted}
          onSkipped={handleTeilSkipped}
        />
      </View>
    );
  }

  // PHASE: saved — neutral confirmation between teils
  if (phase === 'saved') {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.teilCount}>{teilCount}</Text>
          <View style={styles.sectionPill}>
            <Mic color="#F97316" size={14} />
            <Text style={styles.sectionPillText}>Sprechen</Text>
          </View>
          <Text style={styles.levelText}>{level} · Section {sectionIndex + 1}/{totalSections}</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.savedCard}>
            <View style={styles.savedIconWrap}>
              <Check color="#22C55E" size={36} strokeWidth={3} />
            </View>
            <Text style={styles.savedTitle}>{teilLabel} saved</Text>
            <Text style={styles.savedSub}>
              Your response has been recorded. Full feedback shown at the end of the mock.
            </Text>
            <Pressable style={styles.continueBtn} onPress={handleContinueToNext} testID="mock-sprechen-continue-next">
              <Text style={styles.continueBtnText}>Continue to Teil {currentTeil + 1} →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // PHASE: finalizing — brief loading while we hand off to orchestrator
  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <ActivityIndicator color={B.primary} size="large" />
        <Text style={styles.loadingText}>Wrapping up Sprechen…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: B.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },
  loadingText: { fontSize: 14, color: B.muted, fontWeight: '600' as const },

  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    backgroundColor: B.card, borderBottomWidth: 1, borderBottomColor: B.border,
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  teilCount: { fontSize: 13, fontWeight: '800' as const, color: B.primary },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.12)' },
  sectionPillText: { fontSize: 11, fontWeight: '700' as const, color: '#F97316' },
  levelText: { fontSize: 11, fontWeight: '600' as const, color: B.muted, flex: 1 },

  // Saved confirmation card
  savedCard: {
    backgroundColor: B.card, borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 12, width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: B.border,
  },
  savedIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  savedTitle: { fontSize: 20, fontWeight: '800' as const, color: B.questionColor, marginTop: 4 },
  savedSub: { fontSize: 14, fontWeight: '500' as const, color: B.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  continueBtn: {
    marginTop: 12,
    backgroundColor: B.primary, borderRadius: 999,
    paddingVertical: 14, paddingHorizontal: 24, minWidth: 220,
    alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' as const },
});
