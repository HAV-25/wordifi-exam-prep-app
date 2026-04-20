import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Flag, Headphones, Share as ShareIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CTA_BUTTON_HEIGHT = 56;    // primary CTA / footer height
const BOTTOM_CONTENT_BUFFER = 24; // breathing room below last content item
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ScoreRing } from '@/components/ScoreRing';
import { StimulusCard, shouldShowStimulus } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { submitQuestionReport } from '@/lib/mockHelpers';
import { updateReadinessScore } from '@/lib/streamHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion, StudyPlanItem } from '@/types/database';

type ExplanationLang = 'EN' | 'DE';

const REPORT_REASONS = [
  'Wrong answer key',
  'Bad audio quality',
  'Unclear question',
  'Translation error',
  'Other',
] as const;

function performanceLabel(score: number): string {
  if (score < 50) return 'Keep going — you\'ve got this 💪';
  if (score < 75) return 'Good effort! 👍';
  if (score < 90) return 'Well done! ⭐';
  return 'Excellent! 🏆';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function scoreColor(pct: number): string {
  if (pct < 60) return colors.red;
  if (pct < 75) return colors.amber;
  if (pct < 90) return colors.green;
  return '#FFD700';
}

function retestDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MockResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mockTestId?: string;
    horenCorrect?: string;
    horenTotal?: string;
    horenPct?: string;
    lesenCorrect?: string;
    lesenTotal?: string;
    lesenPct?: string;
    overallPct?: string;
    totalCorrect?: string;
    totalQuestions?: string;
    level?: string;
    isTimed?: string;
    timeTaken?: string;
    horenQuestions?: string;
    lesenQuestions?: string;
    answers?: string;
    studyPlan?: string;
    sprachbausteineCorrect?: string;
    sprachbausteineTotal?: string;
    sprachbausteinePct?: string;
  }>();

  const { user } = useAuth();
  const userId = user?.id ?? '';
  const hasUpdatedReadiness = useRef<boolean>(false);

  useEffect(() => {
    if (userId && !hasUpdatedReadiness.current) {
      hasUpdatedReadiness.current = true;
      updateReadinessScore(userId, 20).catch((err) =>
        console.log('MockResults updateReadiness error', err)
      );
    }
  }, [userId]);

  const horenCorrect = Number(params.horenCorrect ?? '0');
  const horenTotal = Number(params.horenTotal ?? '0');
  const horenPct = Number(params.horenPct ?? '0');
  const lesenCorrect = Number(params.lesenCorrect ?? '0');
  const lesenTotal = Number(params.lesenTotal ?? '0');
  const lesenPct = Number(params.lesenPct ?? '0');
  const sprachbausteineCorrect = Number(params.sprachbausteineCorrect ?? '0');
  const sprachbausteineTotal = Number(params.sprachbausteineTotal ?? '0');
  const sprachbausteinePct = Number(params.sprachbausteinePct ?? '0');
  const overallPct = Number(params.overallPct ?? '0');
  const totalCorrect = Number(params.totalCorrect ?? '0');
  const totalQuestions = Number(params.totalQuestions ?? '0');
  const level = params.level ?? 'A1';
  const isTimed = params.isTimed === '1';
  const timeTaken = Number(params.timeTaken ?? '0');

  const horenQuestions = useMemo<AppQuestion[]>(() => {
    try { return JSON.parse(params.horenQuestions ?? '[]') as AppQuestion[]; }
    catch { return []; }
  }, [params.horenQuestions]);

  const lesenQuestions = useMemo<AppQuestion[]>(() => {
    try { return JSON.parse(params.lesenQuestions ?? '[]') as AppQuestion[]; }
    catch { return []; }
  }, [params.lesenQuestions]);

  const answers = useMemo<Record<string, string>>(() => {
    try { return JSON.parse(params.answers ?? '{}') as Record<string, string>; }
    catch { return {}; }
  }, [params.answers]);

  const studyPlan = useMemo<StudyPlanItem[]>(() => {
    try { return JSON.parse(params.studyPlan ?? '[]') as StudyPlanItem[]; }
    catch { return []; }
  }, [params.studyPlan]);

  const _allQuestions = useMemo(() => [...horenQuestions, ...lesenQuestions], [horenQuestions, lesenQuestions]);

  const [lang, setLang] = useState<ExplanationLang>('EN');
  const [expandedStimulusIds, setExpandedStimulusIds] = useState<Set<string>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{ visible: boolean; questionId: string }>({
    visible: false,
    questionId: '',
  });
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDetail, setReportDetail] = useState<string>('');
  const [isReporting, setIsReporting] = useState<boolean>(false);

  const xpAnimValue = useRef(new Animated.Value(0)).current;
  const xpOpacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(xpAnimValue, { toValue: -40, duration: 1500, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(xpOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, [xpAnimValue, xpOpacity]);

  const passed = overallPct >= 60;
  const retestDate = useMemo(() => retestDateString(), []);

  const toggleStimulus = useCallback((id: string) => {
    setExpandedStimulusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openReport = useCallback((questionId: string) => {
    setReportReason('');
    setReportDetail('');
    setReportModal({ visible: true, questionId });
  }, []);

  const closeReport = useCallback(() => {
    setReportModal({ visible: false, questionId: '' });
  }, []);

  const handleSubmitReport = useCallback(async () => {
    if (!reportReason || isReporting) return;
    setIsReporting(true);
    try {
      await submitQuestionReport({
        questionId: reportModal.questionId,
        userId,
        reason: reportReason,
        detail: reportDetail,
      });
      setReportedIds((prev) => new Set(prev).add(reportModal.questionId));
      closeReport();
    } catch (err) {
      console.log('MockResults report error', err);
    } finally {
      setIsReporting(false);
    }
  }, [reportReason, reportDetail, reportModal.questionId, userId, isReporting, closeReport]);

  const handleShare = useCallback(async () => {
    const message = `Wordifi Mock Exam — ${level}\nScore: ${totalCorrect}/${totalQuestions} (${Math.round(overallPct)}%)\nHören: ${Math.round(horenPct)}% | Lesen: ${Math.round(lesenPct)}%\n${passed ? 'PASS ✓' : 'NOT YET ✗'}\n${performanceLabel(overallPct)}`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ text: message });
        }
      } else {
        await RNShare.share({ message });
      }
    } catch (err) {
      console.log('MockResults share error', err);
    }
  }, [level, totalCorrect, totalQuestions, overallPct, horenPct, lesenPct, passed]);

  const renderQuestionCard = useCallback(
    (question: AppQuestion, index: number) => {
      const selectedAnswer = (answers[question.id] ?? '').toLowerCase();
      const isCorrect = selectedAnswer === question.correct_answer.toLowerCase();
      const selectedOption = question.options.find((o) => o.key.toLowerCase() === selectedAnswer);
      const correctOption = question.options.find((o) => o.key.toLowerCase() === question.correct_answer.toLowerCase());
      const isHoren = question.section === 'Hören';
      const hasStimulus = !isHoren && Boolean(question.stimulus_text) && shouldShowStimulus(question.level, question.section, question.teil);
      const isExpanded = expandedStimulusIds.has(question.id);
      const isQuestionReported = reportedIds.has(question.id);

      const explanationText = lang === 'DE'
        ? (question as AppQuestion).explanation_de
        : (question as AppQuestion).explanation_en;
      const grammarText = lang === 'DE'
        ? (question as AppQuestion).grammar_rule_de
        : (question as AppQuestion).grammar_rule;

      return (
        <View key={question.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewNumberBadge}>
              <Text style={styles.reviewNumber}>{index + 1}</Text>
            </View>
            <View style={[styles.reviewSectionTag, isHoren ? styles.horenTag : styles.lesenTag]}>
              {isHoren ? <Headphones color="#fff" size={10} /> : <BookOpen color="#fff" size={10} />}
              <Text style={styles.reviewSectionText}>{question.section}</Text>
            </View>
            <Text style={styles.reviewTeilText}>Teil {question.teil}</Text>
            <View style={[styles.resultIcon, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
              <Text style={styles.resultIconText}>{isCorrect ? '✓' : '✗'}</Text>
            </View>
          </View>

          <Text style={styles.reviewQuestionText}>{question.question_text}</Text>

          <View style={styles.answerSection}>
            <View style={[styles.answerPill, isCorrect ? styles.answerPillCorrect : styles.answerPillWrong]}>
              <Text style={[styles.answerPillText, isCorrect ? styles.answerPillTextCorrect : styles.answerPillTextWrong]}>
                {isCorrect ? '✓' : '✗'} {(selectedOption?.text ?? selectedAnswer) || 'No answer'}
              </Text>
            </View>
            {!isCorrect ? (
              <View style={[styles.answerPill, styles.answerPillCorrectAlt]}>
                <Text style={styles.answerPillTextCorrectAlt}>
                  ✓ {correctOption?.text ?? question.correct_answer}
                </Text>
              </View>
            ) : null}
          </View>

          {isHoren && question.audio_url ? (
            <AudioPlayer audioUrl={question.audio_url} />
          ) : null}

          {hasStimulus ? (
            <Pressable
              accessibilityLabel="Toggle passage"
              onPress={() => toggleStimulus(question.id)}
              style={styles.showPassageBtn}
              testID={`show-passage-${question.id}`}
            >
              <Text style={styles.showPassageBtnText}>
                {isExpanded ? 'Hide passage' : 'Show passage'}
              </Text>
              {isExpanded ? <ChevronUp color={Colors.primary} size={16} /> : <ChevronDown color={Colors.primary} size={16} />}
            </Pressable>
          ) : null}
          {hasStimulus && isExpanded ? (
            <StimulusCard text={question.stimulus_text!} type={question.stimulus_type} collapsible={false} />
          ) : null}

          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>💡 Why is this the answer?</Text>
            <Text style={styles.explanationText}>
              {explanationText ?? 'Explanation coming soon.'}
            </Text>
            {grammarText ? (
              <>
                <Text style={styles.grammarTitle}>📖 Grammar rule:</Text>
                <Text style={styles.grammarText}>{grammarText}</Text>
              </>
            ) : null}
          </View>

          <Pressable
            accessibilityLabel="Report an issue"
            onPress={() => openReport(question.id)}
            style={styles.reportBtn}
            testID={`report-${question.id}`}
          >
            <Flag color={isQuestionReported ? Colors.warning : Colors.textMuted} size={14} />
            <Text style={[styles.reportBtnText, isQuestionReported ? styles.reportedText : null]}>
              {isQuestionReported ? 'Reported' : 'Report an issue'}
            </Text>
          </Pressable>
        </View>
      );
    },
    [answers, lang, expandedStimulusIds, reportedIds, toggleStimulus, openReport]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader rightElement={
        <Pressable
          accessibilityLabel="Share result"
          onPress={handleShare}
          style={styles.shareBtn}
          testID="share-mock-result"
        >
          <ShareIcon color={Colors.primary} size={22} />
        </Pressable>
      } />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + CTA_BUTTON_HEIGHT + BOTTOM_CONTENT_BUFFER }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroMeta}>Mock Exam · {level}</Text>
          <View style={styles.verdictRow}>
            <View style={[styles.verdictPill, passed ? styles.verdictPass : styles.verdictFail]}>
              <Text style={[styles.verdictText, passed ? styles.verdictPassText : styles.verdictFailText]}>
                {passed ? 'PASS ✓' : 'NOT YET ✗'}
              </Text>
            </View>
          </View>
          <View style={styles.heroRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.scoreLine}>{totalCorrect} / {totalQuestions}</Text>
              <Text style={styles.performance}>{performanceLabel(overallPct)}</Text>
              {isTimed && timeTaken > 0 ? (
                <Text style={styles.timeLine}>⏱ {formatDuration(timeTaken)}</Text>
              ) : null}
              <View style={styles.xpRow}>
                <Text style={styles.xpLine}>+{totalCorrect} XP</Text>
                <Animated.Text
                  style={[styles.xpFloat, { transform: [{ translateY: xpAnimValue }], opacity: xpOpacity }]}
                >
                  +{totalCorrect}
                </Animated.Text>
              </View>
            </View>
            <ScoreRing label="Overall" score={overallPct} size={96} />
          </View>
        </View>

        <View style={styles.sectionBarsCard}>
          <View style={styles.sectionBarRow}>
            <View style={styles.sectionBarLabel}>
              <View style={styles.sectionDotHoren} />
              <Text style={styles.sectionBarName}>Hören</Text>
            </View>
            <View style={styles.barTrackOuter}>
              <View style={[styles.barFillOuter, { width: `${Math.min(100, horenPct)}%`, backgroundColor: scoreColor(horenPct) }]} />
            </View>
            <Text style={[styles.sectionBarPct, { color: scoreColor(horenPct) }]}>
              {Math.round(horenPct)}%
            </Text>
          </View>
          <View style={styles.sectionBarRow}>
            <View style={styles.sectionBarLabel}>
              <View style={styles.sectionDotLesen} />
              <Text style={styles.sectionBarName}>Lesen</Text>
            </View>
            <View style={styles.barTrackOuter}>
              <View style={[styles.barFillOuter, { width: `${Math.min(100, lesenPct)}%`, backgroundColor: scoreColor(lesenPct) }]} />
            </View>
            <Text style={[styles.sectionBarPct, { color: scoreColor(lesenPct) }]}>
              {Math.round(lesenPct)}%
            </Text>
          </View>
          {sprachbausteineTotal > 0 ? (
            <View style={styles.sectionBarRow}>
              <View style={styles.sectionBarLabel}>
                <View style={styles.sectionDotSprachbausteine} />
                <Text style={styles.sectionBarName}>Sprachbausteine</Text>
              </View>
              <View style={styles.barTrackOuter}>
                <View style={[styles.barFillOuter, { width: `${Math.min(100, sprachbausteinePct)}%`, backgroundColor: scoreColor(sprachbausteinePct) }]} />
              </View>
              <Text style={[styles.sectionBarPct, { color: scoreColor(sprachbausteinePct) }]}>
                {Math.round(sprachbausteinePct)}%
              </Text>
            </View>
          ) : null}
          <View style={styles.sectionBarDetails}>
            <Text style={styles.sectionBarDetail}>Hören: {horenCorrect}/{horenTotal}</Text>
            <Text style={styles.sectionBarDetail}>Lesen: {lesenCorrect}/{lesenTotal}</Text>
            {sprachbausteineTotal > 0 ? (
              <Text style={styles.sectionBarDetail}>Sprachbausteine: {sprachbausteineCorrect}/{sprachbausteineTotal}</Text>
            ) : null}
          </View>
        </View>

        {studyPlan.length > 0 ? (
          <View style={styles.studyPlanSection}>
            <Text style={styles.studyPlanTitle}>Your Study Plan</Text>
            {studyPlan.map((item, idx) => (
              <View key={idx} style={styles.studyPlanCard}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>{item.priority}</Text>
                </View>
                <View style={styles.studyPlanContent}>
                  <Text style={styles.studyPlanSection2}>{item.section}</Text>
                  <Text style={styles.studyPlanAction}>{item.action}</Text>
                  <Text style={styles.studyPlanResource}>{item.resource}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.retestNotice}>
          <Text style={styles.retestText}>
            You can retest this mock exam in 7 days — {retestDate}
          </Text>
        </View>

        <View style={styles.langToggleRow}>
          <Text style={styles.langLabel}>Explanations:</Text>
          <View style={styles.langToggle}>
            <Pressable
              accessibilityLabel="English explanations"
              onPress={() => setLang('EN')}
              style={[styles.langBtn, lang === 'EN' ? styles.langBtnActive : null]}
              testID="lang-en"
            >
              <Text style={[styles.langBtnText, lang === 'EN' ? styles.langBtnTextActive : null]}>EN</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="German explanations"
              onPress={() => setLang('DE')}
              style={[styles.langBtn, lang === 'DE' ? styles.langBtnActive : null]}
              testID="lang-de"
            >
              <Text style={[styles.langBtnText, lang === 'DE' ? styles.langBtnTextActive : null]}>DE</Text>
            </Pressable>
          </View>
        </View>

        {horenQuestions.length > 0 ? (
          <View style={styles.sectionReviewGroup}>
            <View style={styles.sectionReviewHeader}>
              <View style={styles.sectionDotHoren} />
              <Text style={styles.sectionReviewTitle}>Hören</Text>
              <Text style={styles.sectionReviewCount}>{horenCorrect}/{horenTotal}</Text>
            </View>
            {horenQuestions.map((q, i) => renderQuestionCard(q, i))}
          </View>
        ) : null}

        {lesenQuestions.length > 0 ? (
          <View style={styles.sectionReviewGroup}>
            <View style={styles.sectionReviewHeader}>
              <View style={styles.sectionDotLesen} />
              <Text style={styles.sectionReviewTitle}>Lesen</Text>
              <Text style={styles.sectionReviewCount}>{lesenCorrect}/{lesenTotal}</Text>
            </View>
            {lesenQuestions.map((q, i) => renderQuestionCard(q, horenQuestions.length + i))}
          </View>
        ) : null}

        <View style={{ height: 180 }} />
      </ScrollView>

      <View style={[styles.footer, { bottom: insets.bottom }]}>
        <Pressable
          accessibilityLabel="Share result"
          onPress={handleShare}
          style={styles.primaryButton}
          testID="mock-share-button"
        >
          <Text style={styles.primaryButtonText}>Share Result</Text>
        </Pressable>
        <View style={styles.footerRow}>
          <Pressable
            accessibilityLabel="Back to mock tests"
            onPress={() => router.replace('/(tabs)/mock')}
            style={styles.secondaryButton}
            testID="back-to-mock-button"
          >
            <Text style={styles.secondaryButtonText}>Back to Mock</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Go home"
            onPress={() => router.replace('/')}
            style={styles.secondaryButton}
            testID="mock-home-button"
          >
            <Text style={styles.secondaryButtonText}>Home</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={reportModal.visible}
        onRequestClose={closeReport}
      >
        <Pressable style={styles.modalOverlay} onPress={closeReport}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.reportHeader}>
              <AlertTriangle color={Colors.warning} size={22} />
              <Text style={styles.reportTitle}>Report an issue</Text>
            </View>

            <View style={styles.reportReasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  accessibilityLabel={reason}
                  onPress={() => setReportReason(reason)}
                  style={[styles.reportReasonBtn, reportReason === reason ? styles.reportReasonBtnActive : null]}
                  testID={`report-reason-${reason}`}
                >
                  <Text style={[styles.reportReasonText, reportReason === reason ? styles.reportReasonTextActive : null]}>
                    {reason}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              accessibilityLabel="Report details"
              maxLength={200}
              multiline
              onChangeText={setReportDetail}
              placeholder="Additional details (optional)"
              placeholderTextColor={Colors.textMuted}
              style={styles.reportInput}
              value={reportDetail}
              testID="report-detail-input"
            />

            <Pressable
              accessibilityLabel="Submit report"
              disabled={!reportReason || isReporting}
              onPress={handleSubmitReport}
              style={[styles.reportSubmitBtn, (!reportReason || isReporting) ? styles.reportSubmitBtnDisabled : null]}
              testID="submit-report-button"
            >
              <Text style={styles.reportSubmitText}>
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  shareBtn: {
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: Colors.primary,
    padding: 20,
    gap: 12,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  verdictRow: {
    alignItems: 'flex-start',
  },
  verdictPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  verdictPass: {
    backgroundColor: '#E8F5E9',
  },
  verdictFail: {
    backgroundColor: '#FFEBEE',
  },
  verdictText: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  verdictPassText: {
    color: '#2E7D32',
  },
  verdictFailText: {
    color: '#C62828',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTextWrap: {
    flex: 1,
    gap: 6,
  },
  scoreLine: {
    color: Colors.surface,
    fontSize: 34,
    fontWeight: '800' as const,
  },
  performance: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  timeLine: {
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '700' as const,
    fontSize: 14,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  xpLine: {
    color: 'rgba(255,255,255,0.74)',
    fontWeight: '700' as const,
  },
  xpFloat: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  sectionBarsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  sectionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 65,
  },
  sectionDotHoren: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.blue,
  },
  sectionDotLesen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  sectionDotSprachbausteine: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7B1FA2',
  },
  sectionBarName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  barTrackOuter: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFillOuter: {
    height: '100%',
    borderRadius: 6,
  },
  sectionBarPct: {
    fontSize: 15,
    fontWeight: '800' as const,
    width: 45,
    textAlign: 'right' as const,
  },
  sectionBarDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionBarDetail: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  studyPlanSection: {
    gap: 10,
  },
  studyPlanTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  studyPlanCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  priorityBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  studyPlanContent: {
    flex: 1,
    gap: 4,
  },
  studyPlanSection2: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  studyPlanAction: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    lineHeight: 20,
  },
  studyPlanResource: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  retestNotice: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
  },
  retestText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  langToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  langBtnTextActive: {
    color: '#fff',
  },
  sectionReviewGroup: {
    gap: 10,
  },
  sectionReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  sectionReviewTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
    flex: 1,
  },
  sectionReviewCount: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewNumber: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  reviewSectionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  horenTag: {
    backgroundColor: colors.blue,
  },
  lesenTag: {
    backgroundColor: '#6A1B9A',
  },
  reviewSectionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  reviewTeilText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    flex: 1,
  },
  resultIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCorrect: {
    backgroundColor: '#E8F5E9',
  },
  resultWrong: {
    backgroundColor: '#FFEBEE',
  },
  resultIconText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  reviewQuestionText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  answerSection: {
    gap: 6,
  },
  answerPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  answerPillCorrect: {
    borderColor: '#43A047',
    backgroundColor: '#E8F5E9',
  },
  answerPillWrong: {
    borderColor: '#E53935',
    backgroundColor: '#FFEBEE',
  },
  answerPillCorrectAlt: {
    borderColor: '#43A047',
    backgroundColor: '#F1F8E9',
  },
  answerPillText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  answerPillTextCorrect: {
    color: '#2E7D32',
  },
  answerPillTextWrong: {
    color: '#C62828',
  },
  answerPillTextCorrectAlt: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  showPassageBtn: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  showPassageBtnText: {
    color: Colors.primary,
    fontWeight: '700' as const,
    fontSize: 13,
  },
  explanationCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  grammarTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginTop: 4,
  },
  grammarText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  reportBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  reportedText: {
    color: Colors.warning,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    gap: 10,
    backgroundColor: Colors.background,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: Colors.surface,
    fontWeight: '800' as const,
    fontSize: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  reportReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportReasonBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  reportReasonBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  reportReasonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  reportReasonTextActive: {
    color: Colors.primary,
  },
  reportInput: {
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  reportSubmitBtn: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSubmitBtnDisabled: {
    opacity: 0.4,
  },
  reportSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800' as const,
  },
});
