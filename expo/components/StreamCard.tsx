import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Flag, BookOpenText, Play, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import Colors from '@/constants/colors';
import type { AppQuestion } from '@/types/database';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const EXPLANATION_HEIGHT = SCREEN_HEIGHT * 0.42;
const LANG_PREF_KEY = 'wordifi_explanation_lang';

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
  question,
  onAnswer,
  isAnswered,
  selectedAnswer,
  audioUnlocked,
  onAudioPlayed,
  onReportPress,
  reviewMode = false,
}: StreamCardProps) {
  const isHoren = question.section === 'Hören';
  const needsAudioGate = isHoren && Boolean(question.audio_url) && !audioUnlocked && !reviewMode;

  const [explanationLang, setExplanationLang] = useState<'en' | 'de'>('en');
  const explanationAnim = useRef(new Animated.Value(isAnswered ? 1 : 0)).current;
  const optionFlashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(LANG_PREF_KEY).then((val) => {
      if (val === 'de' || val === 'en') {
        setExplanationLang(val);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAnswered) {
      Animated.spring(explanationAnim, {
        toValue: 1,
        friction: 10,
        tension: 50,
        useNativeDriver: false,
      }).start();
    } else {
      explanationAnim.setValue(0);
    }
  }, [isAnswered, explanationAnim]);

  const toggleLang = useCallback(() => {
    setExplanationLang((prev) => {
      const next = prev === 'en' ? 'de' : 'en';
      AsyncStorage.setItem(LANG_PREF_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (key: string) => {
      if (isAnswered || needsAudioGate || reviewMode) return;
      const normalizedKey = key.toLowerCase();
      const isCorrect = normalizedKey === question.correct_answer.toLowerCase();
      onAnswer(question.id, normalizedKey, isCorrect);
    },
    [isAnswered, needsAudioGate, reviewMode, question.id, question.correct_answer, onAnswer]
  );

  const _flashOptions = useCallback(() => {
    Animated.sequence([
      Animated.timing(optionFlashAnim, { toValue: 0.4, duration: 120, useNativeDriver: true }),
      Animated.timing(optionFlashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [optionFlashAnim]);

  const getOptionStyle = useCallback(
    (optionKey: string) => {
      if (!isAnswered || !selectedAnswer) return styles.optionDefault;
      const normalizedOption = optionKey.toLowerCase();
      const isCorrectOption = normalizedOption === question.correct_answer.toLowerCase();
      const isSelectedOption = normalizedOption === selectedAnswer.toLowerCase();

      if (isSelectedOption && isCorrectOption) return styles.optionCorrect;
      if (isSelectedOption && !isCorrectOption) return styles.optionWrong;
      if (isCorrectOption) return styles.optionCorrectHighlight;
      return styles.optionFaded;
    },
    [isAnswered, selectedAnswer, question.correct_answer]
  );

  const getOptionTextStyle = useCallback(
    (optionKey: string) => {
      if (!isAnswered || !selectedAnswer) return styles.optionTextDefault;
      const normalizedOption = optionKey.toLowerCase();
      const isCorrectOption = normalizedOption === question.correct_answer.toLowerCase();
      const isSelectedOption = normalizedOption === selectedAnswer.toLowerCase();

      if (isSelectedOption && isCorrectOption) return styles.optionTextCorrect;
      if (isSelectedOption && !isCorrectOption) return styles.optionTextWrong;
      if (isCorrectOption) return styles.optionTextCorrect;
      return styles.optionTextFaded;
    },
    [isAnswered, selectedAnswer, question.correct_answer]
  );

  const renderIcon = useCallback(
    (optionKey: string) => {
      if (!isAnswered || !selectedAnswer) return null;
      const normalizedOption = optionKey.toLowerCase();
      const isCorrectOption = normalizedOption === question.correct_answer.toLowerCase();
      const isSelectedOption = normalizedOption === selectedAnswer.toLowerCase();

      if (isSelectedOption && isCorrectOption) return <Check color="#fff" size={14} />;
      if (isSelectedOption && !isCorrectOption) return <X color="#fff" size={14} />;
      if (isCorrectOption) return <Check color="#fff" size={14} />;
      return null;
    },
    [isAnswered, selectedAnswer, question.correct_answer]
  );

  const isCorrectAnswer = useMemo(() => {
    if (!selectedAnswer) return false;
    return selectedAnswer.toLowerCase() === question.correct_answer.toLowerCase();
  }, [selectedAnswer, question.correct_answer]);

  const explanationText = useMemo(() => {
    if (explanationLang === 'de' && question.explanation_de) return question.explanation_de;
    if (question.explanation_en) return question.explanation_en;
    return 'Explanation coming soon.';
  }, [explanationLang, question.explanation_en, question.explanation_de]);

  const panelHeight = explanationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, EXPLANATION_HEIGHT],
  });

  const isBinaryType = question.question_type === 'true_false' || question.question_type === 'ja_nein';
  const hasStimulus = !isHoren && Boolean(question.stimulus_text);

  return (
    <View style={styles.card}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {isHoren && question.audio_url ? (
          <AudioPlayer audioUrl={question.audio_url} onFirstPlay={onAudioPlayed} />
        ) : null}

        {needsAudioGate ? (
          <View style={styles.audioGate}>
            <View style={styles.audioGateIcon}>
              <Play color="#fff" size={12} />
            </View>
            <Text style={styles.audioGateText}>Press Play above to unlock answers</Text>
          </View>
        ) : null}

        {hasStimulus ? (
          <View style={styles.stimulusWrap}>
            <View style={styles.stimulusHeader}>
              <BookOpenText color={Colors.textMuted} size={14} />
              <Text style={styles.stimulusLabel}>
                {question.stimulus_type === 'building_directory'
                  ? 'Building Directory'
                  : 'Read the following:'}
              </Text>
            </View>
            <ScrollView
              style={styles.stimulusScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.stimulusText}>{question.stimulus_text}</Text>
            </ScrollView>
            <View style={styles.stimulusFade} pointerEvents="none" />
          </View>
        ) : null}

        <Text style={styles.questionText}>{question.question_text}</Text>

        <Animated.View style={[styles.optionsWrap, { opacity: optionFlashAnim }]}>
          {isBinaryType ? (
            <View style={styles.binaryRow}>
              {question.options.map((option) => {
                const optStyle = getOptionStyle(option.key);
                const textStyle = getOptionTextStyle(option.key);
                const icon = renderIcon(option.key);
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.binaryOption, optStyle]}
                    onPress={() => handleSelect(option.key)}
                    disabled={isAnswered || needsAudioGate}
                    testID={`stream-option-${option.key}`}
                  >
                    <View style={[styles.optionLeading, isAnswered ? optStyle : null]}>
                      {icon ?? (
                        <Text style={[styles.optionKey, isAnswered ? textStyle : null]}>
                          {option.key.toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.binaryText, textStyle]}>{option.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            question.options.map((option, idx) => {
              const optStyle = getOptionStyle(option.key);
              const textStyle = getOptionTextStyle(option.key);
              const icon = renderIcon(option.key);
              const isLast = idx === question.options.length - 1;

              return (
                <React.Fragment key={option.key}>
                  <Pressable
                    style={[styles.option, optStyle, needsAudioGate && styles.optionLocked]}
                    onPress={() => handleSelect(option.key)}
                    disabled={isAnswered || needsAudioGate}
                    testID={`stream-option-${option.key}`}
                  >
                    <View style={[styles.optionLeading, isAnswered ? optStyle : null]}>
                      {icon ?? (
                        <Text style={[styles.optionKey, isAnswered ? textStyle : null]}>
                          {option.key.toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.optionLabel, textStyle]} numberOfLines={3}>
                      {option.text}
                    </Text>
                  </Pressable>
                  {!isLast ? <View style={styles.optionDivider} /> : null}
                </React.Fragment>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      <Animated.View style={[styles.explanationPanel, { height: panelHeight }]}>
        {isAnswered ? (
          <ScrollView
            style={styles.explanationScroll}
            contentContainerStyle={styles.explanationContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.explanationHeader}>
              <Text
                style={[
                  styles.resultLabel,
                  isCorrectAnswer ? styles.resultCorrect : styles.resultWrong,
                ]}
              >
                {isCorrectAnswer ? '✓ Richtig' : '✗ Falsch'}
              </Text>
              <Pressable style={styles.langToggle} onPress={toggleLang} testID="lang-toggle">
                <Text style={[styles.langOption, explanationLang === 'en' && styles.langActive]}>
                  EN
                </Text>
                <Text style={styles.langSep}>|</Text>
                <Text style={[styles.langOption, explanationLang === 'de' && styles.langActive]}>
                  DE
                </Text>
              </Pressable>
            </View>

            <Text style={styles.explanationText}>{explanationText}</Text>

            {question.grammar_rule ? (
              <View style={styles.grammarCard}>
                <Text style={styles.grammarLabel}>Grammar rule</Text>
                <Text style={styles.grammarText}>
                  {explanationLang === 'de' && question.grammar_rule_de
                    ? question.grammar_rule_de
                    : question.grammar_rule}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={styles.reportLink}
              onPress={() => onReportPress(question.id)}
              testID="report-issue-link"
            >
              <Flag color={Colors.textMuted} size={13} />
              <Text style={styles.reportText}>Report an issue</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
  },
  audioGate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
  },
  audioGateText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  stimulusWrap: {
    maxHeight: SCREEN_HEIGHT * 0.38,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  stimulusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  stimulusLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  stimulusScroll: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  stimulusText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text,
  },
  stimulusFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  questionText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  optionsWrap: {
    gap: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 14,
  },
  optionDefault: {
    backgroundColor: 'transparent',
  },
  optionCorrect: {
    backgroundColor: '#E8F5E9',
  },
  optionWrong: {
    backgroundColor: '#FFEBEE',
  },
  optionCorrectHighlight: {
    backgroundColor: '#E8F5E9',
  },
  optionFaded: {
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  optionLocked: {
    opacity: 0.4,
  },
  optionDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginLeft: 58,
  },
  optionLeading: {
    width: 32,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  optionKey: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  optionTextDefault: {
    color: Colors.text,
  },
  optionTextCorrect: {
    color: '#2E7D32',
    fontWeight: '600' as const,
  },
  optionTextWrong: {
    color: '#C62828',
    fontWeight: '600' as const,
  },
  optionTextFaded: {
    color: Colors.textMuted,
  },
  binaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  binaryOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  binaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  explanationPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  explanationScroll: {
    flex: 1,
  },
  explanationContent: {
    padding: 20,
    gap: 12,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  resultCorrect: {
    color: '#2E7D32',
  },
  resultWrong: {
    color: '#C62828',
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langOption: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  langActive: {
    color: Colors.primary,
    fontWeight: '800' as const,
  },
  langSep: {
    fontSize: 12,
    color: Colors.border,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text,
  },
  grammarCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  grammarLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  grammarText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  reportText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  audioGateIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
