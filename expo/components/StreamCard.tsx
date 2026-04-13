import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Flag, BookOpenText, Play, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { AudioPlayer } from '@/components/AudioPlayer';
import { colors, fontFamily, fontSize, shadows } from '@/theme';
import type { AppQuestion } from '@/types/database';

// ─── Banani design tokens ────────────────────────────────────────────────────
const B = {
  background: '#F8FAFF',
  foreground: '#374151',
  border: '#E2E8F0',
  primary: '#2B70EF',
  primaryFg: '#FFFFFF',
  card: '#FFFFFF',
  muted: '#94A3B8',
  success: '#22C55E',
  destructive: '#EF4444',
  questionColor: '#0F1F3D',
} as const;

const SCREEN_HEIGHT = Dimensions.get('window').height;
const EXPLANATION_HEIGHT = SCREEN_HEIGHT * 0.42;
const LANG_PREF_KEY = 'wordifi_explanation_lang';

const CORRECT_AFFIRMATIONS = [
  'Sehr gut! ✦', 'Genau! ✦', 'Klasse! ✦', 'Perfekt! ✦',
  'Ausgezeichnet! ✦', 'Wunderbar! ✦', 'Bravo! ✦',
];
const PROGRESS_REINFORCEMENTS = [
  '+1 Schritt näher an dein Ziel', 'Du verbesserst dein Deutsch', 'Dein Fortschritt zählt',
];
const WRONG_HEADER = 'Fast! Hier ist die Antwort:';

type StreamCardProps = {
  question: AppQuestion;
  onAnswer: (questionId: string, selectedKey: string, isCorrect: boolean) => void;
  isAnswered: boolean;
  selectedAnswer: string | null;
  audioUnlocked: boolean;
  onAudioPlayed: () => void;
  onReportPress: (questionId: string) => void;
  reviewMode?: boolean;
};

export const StreamCard = React.memo(function StreamCard({
  question, onAnswer, isAnswered, selectedAnswer, audioUnlocked, onAudioPlayed, onReportPress, reviewMode = false,
}: StreamCardProps) {
  const isHoren = question.section === 'Hören';
  const needsAudioGate = isHoren && Boolean(question.audio_url) && !audioUnlocked && !reviewMode;
  const isReady = Boolean(question.question_text) && (!isHoren || Boolean(question.audio_url));

  const [explanationLang, setExplanationLang] = useState<'en' | 'de'>('en');
  const [showFeedback, setShowFeedback] = useState<boolean>(isAnswered);
  const explanationAnim = useRef(new Animated.Value(isAnswered ? 1 : 0)).current;
  const optionFlashAnim = useRef(new Animated.Value(1)).current;
  const correctScaleAnim = useRef(new Animated.Value(1)).current;
  const wrongShakeAnim = useRef(new Animated.Value(0)).current;
  const explanationSlideAnim = useRef(new Animated.Value(isAnswered ? 0 : 30)).current;

  const affirmation = useMemo(() => CORRECT_AFFIRMATIONS[Math.floor(Math.random() * CORRECT_AFFIRMATIONS.length)] ?? CORRECT_AFFIRMATIONS[0], []);
  const progressMsg = useMemo(() => PROGRESS_REINFORCEMENTS[Math.floor(Math.random() * PROGRESS_REINFORCEMENTS.length)] ?? PROGRESS_REINFORCEMENTS[0], []);

  useEffect(() => {
    AsyncStorage.getItem(LANG_PREF_KEY).then((val) => {
      if (val === 'de' || val === 'en') setExplanationLang(val);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAnswered) {
      setShowFeedback(true);
      Animated.spring(explanationAnim, { toValue: 1, friction: 10, tension: 50, useNativeDriver: false }).start();
      Animated.timing(explanationSlideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    } else {
      explanationAnim.setValue(0);
      explanationSlideAnim.setValue(30);
      setShowFeedback(false);
    }
  }, [isAnswered, explanationAnim, explanationSlideAnim]);

  const toggleLang = useCallback(() => {
    setExplanationLang((prev) => {
      const next = prev === 'en' ? 'de' : 'en';
      AsyncStorage.setItem(LANG_PREF_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const animateCorrect = useCallback(() => {
    Animated.sequence([
      Animated.timing(correctScaleAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
      Animated.spring(correctScaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [correctScaleAnim]);

  const animateWrong = useCallback(() => {
    Animated.sequence([
      Animated.timing(wrongShakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [wrongShakeAnim]);

  const optionPressAnims = useRef<Record<string, Animated.Value>>({}).current;
  const getOptionPressAnim = useCallback((key: string): Animated.Value => {
    if (!optionPressAnims[key]) optionPressAnims[key] = new Animated.Value(1);
    return optionPressAnims[key];
  }, [optionPressAnims]);

  const handleSelect = useCallback(
    (key: string) => {
      if (isAnswered || needsAudioGate || reviewMode) return;
      const normalizedKey = key.toLowerCase();
      const isCorrect = normalizedKey === question.correct_answer.toLowerCase();
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const pressAnim = getOptionPressAnim(key);
      Animated.sequence([
        Animated.timing(pressAnim, { toValue: 0.96, duration: 60, useNativeDriver: true }),
        Animated.spring(pressAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        onAnswer(question.id, normalizedKey, isCorrect);
        if (isCorrect) animateCorrect(); else animateWrong();
      }, 120);
    },
    [isAnswered, needsAudioGate, reviewMode, question.id, question.correct_answer, onAnswer, animateCorrect, animateWrong, getOptionPressAnim]
  );

  // ─── Answer state styling (card-based from Banani) ─────────────────────────
  const getCardBorderColor = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return B.border;
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if (isSelectedOpt && isCorrectOpt) return B.success;
    if (isSelectedOpt && !isCorrectOpt) return B.destructive;
    if (isCorrectOpt) return B.success;
    return B.border;
  }, [isAnswered, selectedAnswer, question.correct_answer]);

  const getCardBg = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return B.card;
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if (isSelectedOpt && isCorrectOpt) return 'rgba(34,197,94,0.06)';
    if (isSelectedOpt && !isCorrectOpt) return 'rgba(239,68,68,0.04)';
    if (isCorrectOpt) return 'rgba(34,197,94,0.04)';
    return B.card;
  }, [isAnswered, selectedAnswer, question.correct_answer]);

  const getLetterBg = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return 'rgba(43,112,239,0.08)';
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if ((isSelectedOpt && isCorrectOpt) || isCorrectOpt) return B.success;
    if (isSelectedOpt) return B.destructive;
    return 'rgba(43,112,239,0.08)';
  }, [isAnswered, selectedAnswer, question.correct_answer]);

  const getLetterColor = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return B.primary;
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if (isSelectedOpt || isCorrectOpt) return B.primaryFg;
    return B.primary;
  }, [isAnswered, selectedAnswer, question.correct_answer]);

  const getTextColor = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return B.questionColor;
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if (isSelectedOpt && isCorrectOpt) return B.success;
    if (isSelectedOpt) return B.muted;
    if (isCorrectOpt) return B.success;
    return B.muted;
  }, [isAnswered, selectedAnswer, question.correct_answer]);

  const getCardOpacity = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return 1;
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if (isSelectedOpt || isCorrectOpt) return 1;
    return 0.5;
  }, [isAnswered, selectedAnswer, question.correct_answer]);

  const renderLetterOrIcon = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return <Text style={[st.letterText, { color: getLetterColor(optionKey) }]}>{optionKey.toUpperCase()}</Text>;
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if ((isSelectedOpt && isCorrectOpt) || isCorrectOpt) return <Check color={B.primaryFg} size={16} />;
    if (isSelectedOpt) return <X color={B.primaryFg} size={16} />;
    return <Text style={[st.letterText, { color: getLetterColor(optionKey) }]}>{optionKey.toUpperCase()}</Text>;
  }, [isAnswered, selectedAnswer, question.correct_answer, getLetterColor]);

  const getOptionAnimatedStyle = useCallback((optionKey: string) => {
    if (!isAnswered || !selectedAnswer) return {};
    const nk = optionKey.toLowerCase();
    const isCorrectOpt = nk === question.correct_answer.toLowerCase();
    const isSelectedOpt = nk === selectedAnswer.toLowerCase();
    if (isSelectedOpt && isCorrectOpt) return { transform: [{ scale: correctScaleAnim }] };
    if (isSelectedOpt && !isCorrectOpt) return { transform: [{ translateX: wrongShakeAnim }] };
    return {};
  }, [isAnswered, selectedAnswer, question.correct_answer, correctScaleAnim, wrongShakeAnim]);

  const isCorrectAnswer = useMemo(() => {
    if (!selectedAnswer) return false;
    return selectedAnswer.toLowerCase() === question.correct_answer.toLowerCase();
  }, [selectedAnswer, question.correct_answer]);

  const explanationText = useMemo(() => {
    if (explanationLang === 'de' && question.explanation_de) return question.explanation_de;
    if (question.explanation_en) return question.explanation_en;
    return 'Explanation coming soon.';
  }, [explanationLang, question.explanation_en, question.explanation_de]);

  const panelHeight = explanationAnim.interpolate({ inputRange: [0, 1], outputRange: [0, EXPLANATION_HEIGHT] });
  const isBinaryType = question.question_type === 'true_false' || question.question_type === 'ja_nein';
  const hasStimulus = !isHoren && Boolean(question.stimulus_text);

  if (!isReady) {
    return <View style={[st.card, st.loadingCard]}><ActivityIndicator color={B.primary} size="small" /></View>;
  }

  return (
    <View style={st.card}>
      <ScrollView style={st.scrollArea} contentContainerStyle={st.scrollContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {/* Audio player (Hören) */}
        {isHoren && question.audio_url ? <AudioPlayer audioUrl={question.audio_url} onFirstPlay={onAudioPlayed} /> : null}

        {/* Audio gate */}
        {needsAudioGate ? (
          <View style={st.audioGate}>
            <View style={st.audioGateIcon}><Play color={B.primaryFg} size={12} /></View>
            <Text style={st.audioGateText}>Press play above to unlock answers</Text>
          </View>
        ) : null}

        {/* Stimulus (Lesen) */}
        {hasStimulus ? (
          <View style={st.stimulusWrap}>
            <View style={st.stimulusHeader}>
              <BookOpenText color={B.muted} size={14} />
              <Text style={st.stimulusLabel}>{question.stimulus_type === 'building_directory' ? 'Building directory' : 'Read the following:'}</Text>
            </View>
            <ScrollView style={st.stimulusScroll} nestedScrollEnabled showsVerticalScrollIndicator>
              <Text style={st.stimulusText}>{question.stimulus_text}</Text>
            </ScrollView>
            <View style={st.stimulusFade} pointerEvents="none" />
          </View>
        ) : null}

        {/* Question text */}
        <View style={st.questionWrap}>
          <Text style={st.questionText}>{question.question_text}</Text>
        </View>

        {/* Answer options */}
        <Animated.View style={[st.answersWrap, { opacity: optionFlashAnim }]}>
          {isBinaryType ? (
            <View style={st.binaryRow}>
              {question.options.map((option) => {
                const animStyle = getOptionAnimatedStyle(option.key);
                const pressAnim = getOptionPressAnim(option.key);
                return (
                  <Animated.View key={option.key} style={[{ flex: 1 }, animStyle, { transform: [...(animStyle.transform ?? []), { scale: pressAnim }] }]}>
                    <Pressable
                      style={[st.binaryCard, {
                        borderColor: getCardBorderColor(option.key),
                        backgroundColor: getCardBg(option.key),
                        opacity: getCardOpacity(option.key),
                      }]}
                      onPress={() => handleSelect(option.key)}
                      disabled={isAnswered || needsAudioGate}
                      testID={`stream-option-${option.key}`}
                    >
                      {(() => {
                        const isRichtig = option.key.toLowerCase() === 'richtig' || option.text.toLowerCase() === 'richtig' || option.text.toLowerCase() === 'ja';
                        if (!isAnswered) {
                          // Pre-answer: always show green check for Richtig, red X for Falsch
                          return (
                            <View style={[st.binaryIcon, { backgroundColor: isRichtig ? '#22C55E' : '#EF4444' }]}>
                              {isRichtig ? <Check color={B.primaryFg} size={16} /> : <X color={B.primaryFg} size={16} />}
                            </View>
                          );
                        }
                        // Post-answer: show with answer feedback colors
                        const nk = option.key.toLowerCase();
                        const isCorrectOpt = nk === question.correct_answer.toLowerCase();
                        const isSelectedOpt = nk === (selectedAnswer ?? '').toLowerCase();
                        const bg = (isSelectedOpt && isCorrectOpt) || isCorrectOpt ? '#22C55E' : isSelectedOpt ? '#EF4444' : B.muted;
                        return (
                          <View style={[st.binaryIcon, { backgroundColor: bg }]}>
                            {isRichtig ? <Check color={B.primaryFg} size={16} /> : <X color={B.primaryFg} size={16} />}
                          </View>
                        );
                      })()}
                      <Text style={[st.binaryText, { color: getTextColor(option.key) }]}>{option.text}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <View style={st.answersList}>
              {question.options.map((option) => {
                const animStyle = getOptionAnimatedStyle(option.key);
                const pressAnim = getOptionPressAnim(option.key);
                return (
                  <Animated.View key={option.key} style={[animStyle, { transform: [...(animStyle.transform ?? []), { scale: pressAnim }] }]}>
                    <Pressable
                      style={[st.answerCard, {
                        borderColor: getCardBorderColor(option.key),
                        backgroundColor: getCardBg(option.key),
                        opacity: getCardOpacity(option.key),
                      }, needsAudioGate && { opacity: 0.4 }]}
                      onPress={() => handleSelect(option.key)}
                      disabled={isAnswered || needsAudioGate}
                      testID={`stream-option-${option.key}`}
                    >
                      <View style={[st.answerLetter, { backgroundColor: getLetterBg(option.key) }]}>
                        {renderLetterOrIcon(option.key)}
                      </View>
                      <Text style={[st.answerText, { color: getTextColor(option.key) }]} numberOfLines={3}>{option.text}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Explanation panel */}
      <Animated.View style={[st.explanationPanel, { height: panelHeight }]}>
        {showFeedback ? (
          <Animated.View style={{ flex: 1, transform: [{ translateY: explanationSlideAnim }], opacity: explanationAnim }}>
            <ScrollView style={st.explanationScroll} contentContainerStyle={st.explanationContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={st.explanationHeader}>
                <View style={st.resultLabelWrap}>
                  <Text style={[st.resultLabel, isCorrectAnswer ? st.resultCorrect : st.resultWrong]}>
                    {isCorrectAnswer ? affirmation : WRONG_HEADER}
                  </Text>
                  {isCorrectAnswer ? <Text style={st.progressReinforcement}>{progressMsg}</Text> : null}
                </View>
                <Pressable style={st.langToggle} onPress={toggleLang} testID="lang-toggle">
                  <Text style={[st.langOption, explanationLang === 'en' && st.langActive]}>EN</Text>
                  <Text style={st.langSep}>|</Text>
                  <Text style={[st.langOption, explanationLang === 'de' && st.langActive]}>DE</Text>
                </Pressable>
              </View>
              <Text style={st.explanationText}>{explanationText}</Text>
              {question.grammar_rule ? (
                <View style={st.grammarCard}>
                  <Text style={st.grammarLabel}>Grammar rule</Text>
                  <Text style={st.grammarText}>{explanationLang === 'de' && question.grammar_rule_de ? question.grammar_rule_de : question.grammar_rule}</Text>
                </View>
              ) : null}
              <Pressable style={st.reportLink} onPress={() => onReportPress(question.id)} testID="report-issue-link">
                <Flag color={B.muted} size={13} />
                <Text style={st.reportText}>Report an issue</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
});

// ─── Styles (Banani faithful) ────────────────────────────────────────────────
const st = StyleSheet.create({
  card: { flex: 1 },
  loadingCard: { alignItems: 'center', justifyContent: 'center' },
  scrollArea: { flex: 1 },
  scrollContent: { paddingTop: 0, paddingBottom: 16, paddingHorizontal: 20, gap: 0 },

  // Audio gate
  audioGate: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, backgroundColor: 'rgba(15,31,61,0.04)', marginTop: 16 },
  audioGateIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: B.primary, alignItems: 'center', justifyContent: 'center' },
  audioGateText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.bodySm, color: B.muted },

  // Stimulus
  stimulusWrap: { maxHeight: SCREEN_HEIGHT * 0.38, borderRadius: 16, backgroundColor: B.card, borderWidth: 1, borderColor: B.border, overflow: 'hidden', marginTop: 16 },
  stimulusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  stimulusLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.label, color: B.muted, letterSpacing: 0.3 },
  stimulusScroll: { paddingHorizontal: 14, paddingBottom: 14 },
  stimulusText: { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.bodyMd, lineHeight: 22, color: B.foreground },
  stimulusFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, backgroundColor: 'rgba(255,255,255,0.8)' },

  // Question
  questionWrap: { paddingTop: 20, paddingBottom: 16 },
  questionText: { fontFamily: fontFamily.display, fontSize: 22, color: B.questionColor, lineHeight: 22 * 1.35, letterSpacing: -0.3 },

  // Answers
  answersWrap: { gap: 0 },
  answersList: { gap: 10 },
  binaryRow: { flexDirection: 'row', gap: 10 },
  binaryCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 18,
    borderWidth: 2, borderColor: B.border, backgroundColor: B.card,
  },
  binaryIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  binaryText: { fontFamily: fontFamily.display, fontSize: 18, color: B.questionColor },
  answerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: B.card,
    borderWidth: 2,
    borderColor: B.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 56,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 12 },
      android: { elevation: 1 },
    }),
  },
  answerLetter: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(43,112,239,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  letterText: { fontFamily: fontFamily.display, fontSize: 15, color: B.primary },
  answerText: { fontFamily: fontFamily.bodySemiBold, fontSize: 16, color: B.questionColor, lineHeight: 22, flex: 1 },

  // Explanation panel
  explanationPanel: { backgroundColor: B.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', ...shadows.panel },
  explanationScroll: { flex: 1 },
  explanationContent: { padding: 20, gap: 12 },
  explanationHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  resultLabelWrap: { flex: 1, gap: 2, marginRight: 12 },
  resultLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.bodyLg },
  resultCorrect: { color: B.success },
  resultWrong: { color: '#F59E0B' },
  progressReinforcement: { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.label, color: B.muted, marginTop: 2 },
  langToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,31,61,0.04)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  langOption: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.label, color: B.muted },
  langActive: { color: B.primary, fontFamily: fontFamily.display },
  langSep: { fontSize: fontSize.label, color: B.border },
  explanationText: { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.bodyMd, lineHeight: 22, color: B.foreground },
  grammarCard: { backgroundColor: 'rgba(15,31,61,0.04)', borderRadius: 12, padding: 14, gap: 4 },
  grammarLabel: { fontFamily: fontFamily.bodyBold, fontSize: 11, color: B.muted, letterSpacing: 0.3 },
  grammarText: { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.bodySm, lineHeight: 20, color: B.foreground },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingVertical: 4 },
  reportText: { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.label, color: B.muted },
});
