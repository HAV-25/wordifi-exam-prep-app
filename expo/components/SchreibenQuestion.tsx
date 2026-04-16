import { Mail, MessageSquare, PenLine } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CTAButton } from '@/components/CTAButton';
import { countWords } from '@/lib/schreibenHelpers';
import { colors, fontSize, radius, shadows, spacing } from '@/theme';
import type { AppQuestion } from '@/types/database';
import type { AssessmentResult, FormFillOption } from '@/types/schreiben';

type SchreibenQuestionProps = {
  question: AppQuestion;
  task_type: string;
  onSubmit: (userText: string, wordCount: number) => void;
  isSubmitted: boolean;
  isLoading: boolean;
  assessment: AssessmentResult | null;
};

const WORD_LIMITS: Record<string, { min: number; max: number; warnBelow: number }> = {
  sms: { min: 30, max: 80, warnBelow: 20 },
  formal_email: { min: 60, max: 120, warnBelow: 40 },
  informal_letter: { min: 80, max: 150, warnBelow: 50 },
  opinion: { min: 60, max: 120, warnBelow: 50 },
};

const NUMBERED_BULLETS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

export function SchreibenQuestion({
  question,
  task_type,
  onSubmit,
  isSubmitted,
  isLoading,
}: SchreibenQuestionProps) {
  switch (task_type) {
    case 'form_fill':
      return <FormFillVariant question={question} onSubmit={onSubmit} isSubmitted={isSubmitted} isLoading={isLoading} />;
    case 'sms':
      return <SMSVariant question={question} onSubmit={onSubmit} isSubmitted={isSubmitted} isLoading={isLoading} />;
    case 'formal_email':
      return <FormalEmailVariant question={question} onSubmit={onSubmit} isSubmitted={isSubmitted} isLoading={isLoading} />;
    case 'informal_letter':
      return <InformalLetterVariant question={question} onSubmit={onSubmit} isSubmitted={isSubmitted} isLoading={isLoading} />;
    case 'opinion':
      return <OpinionVariant question={question} onSubmit={onSubmit} isSubmitted={isSubmitted} isLoading={isLoading} />;
    default:
      return (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Unknown task type: {task_type}</Text>
        </View>
      );
  }
}

type VariantProps = {
  question: AppQuestion;
  onSubmit: (userText: string, wordCount: number) => void;
  isSubmitted: boolean;
  isLoading: boolean;
};

function FormFillVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const fields = useMemo<FormFillOption[]>(() => {
    try {
      return question.options as unknown as FormFillOption[];
    } catch {
      return [];
    }
  }, [question.options]);

  const [values, setValues] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    fields.forEach((f, i) => {
      if (f.value_prefilled) init[i] = f.value_prefilled;
    });
    return init;
  });

  const allFilled = useMemo(() => {
    return fields.every((f, i) => {
      if (f.value_prefilled) return true;
      return (values[i] ?? '').trim().length > 0;
    });
  }, [fields, values]);

  const handleSubmit = useCallback(() => {
    const ordered = fields.map((f, i) => values[i] ?? f.value_prefilled ?? '');
    const userText = JSON.stringify(ordered);
    onSubmit(userText, 0);
  }, [fields, values, onSubmit]);

  return (
    <View style={styles.variantWrap}>
      {question.stimulus_text ? (
        <View style={[styles.card, shadows.card]}>
          <ScrollView style={styles.stimulusScroll} nestedScrollEnabled>
            <Text style={styles.stimulusText}>{question.stimulus_text}</Text>
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>FORMULAR</Text>

      <View style={[styles.card, shadows.card]}>
        {fields.map((field, idx) => {
          const isPrefilled = Boolean(field.value_prefilled);
          return (
            <View key={idx}>
              {idx > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.formRow}>
                <Text style={styles.formLabel}>{field.label}</Text>
                {isPrefilled ? (
                  <Text style={styles.formPrefilled}>{field.value_prefilled}</Text>
                ) : (
                  <TextInput
                    style={styles.formInput}
                    value={values[idx] ?? ''}
                    onChangeText={(text) => setValues((prev) => ({ ...prev, [idx]: text }))}
                    placeholder="..."
                    placeholderTextColor={colors.muted}
                    editable={!isSubmitted}
                    testID={`form-field-${idx}`}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {!isSubmitted ? (
        isLoading ? (
          <LoadingIndicator />
        ) : (
          <CTAButton
            label="Abschicken"
            onPress={handleSubmit}
            disabled={!allFilled}
            style={styles.submitBtn}
            testID="schreiben-submit"
          />
        )
      ) : null}
    </View>
  );
}

function SMSVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [text, setText] = useState<string>('');
  const wc = useMemo(() => countWords(text), [text]);
  const limits = WORD_LIMITS.sms;
  const [showWarning, setShowWarning] = useState<boolean>(false);

  const bulletPoints = useMemo(() => {
    return (question.options as Array<{ key?: string; text?: string }>).map((o) => o.text ?? '');
  }, [question.options]);

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) {
      setShowWarning(true);
    }
    onSubmit(text, wc);
  }, [text, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={styles.variantWrap}>
      <View style={styles.scenarioCard}>
        <MessageSquare color={colors.white} size={18} style={styles.scenarioIcon} />
        <Text style={styles.scenarioText}>{question.question_text}</Text>
      </View>

      <RequiredPointsList points={bulletPoints} />

      <View style={[styles.smsContainer, shadows.card]}>
        <View style={styles.composerHeader}>
          <Text style={styles.composerLabel}>SMS</Text>
          <Text style={styles.wordCount}>{wc} / {limits.max} Wörter</Text>
        </View>
        <TextInput
          style={styles.smsInput}
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Schreiben Sie hier Ihre SMS..."
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="sms-input"
        />
      </View>

      {showWarning && wc < limits.warnBelow ? (
        <Text style={styles.warningText}>Hinweis: Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? (
        isLoading ? (
          <LoadingIndicator />
        ) : (
          <CTAButton
            label="Abschicken"
            onPress={handleSubmit}
            disabled={text.trim().length === 0}
            style={styles.submitBtn}
            testID="schreiben-submit"
          />
        )
      ) : null}
    </View>
  );
}

function FormalEmailVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [name, setName] = useState<string>('');
  const limits = WORD_LIMITS.formal_email;

  const fullText = useMemo(() => {
    return subject + '\n\nSehr geehrte Damen und Herren,\n\n' + body + '\n\nMit freundlichen Grüßen,\n' + name;
  }, [subject, body, name]);

  const wc = useMemo(() => countWords(body), [body]);
  const [showWarning, setShowWarning] = useState<boolean>(false);

  const bulletPoints = useMemo(() => {
    return (question.options as Array<{ key?: string; text?: string }>).map((o) => o.text ?? '');
  }, [question.options]);

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(fullText, wc);
  }, [fullText, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={styles.variantWrap}>
      <View style={styles.scenarioCard}>
        <Mail color={colors.white} size={18} style={styles.scenarioIcon} />
        <Text style={styles.scenarioText}>{question.question_text}</Text>
      </View>

      <RequiredPointsList points={bulletPoints} />

      <View style={[styles.emailContainer, shadows.card]}>
        <View style={styles.composerHeader}>
          <View style={styles.composerHeaderLeft}>
            <Mail color={colors.navy} size={16} />
            <Text style={styles.composerLabelDark}>E-Mail</Text>
          </View>
          <Text style={styles.wordCount}>{wc} / {limits.max} Wörter</Text>
        </View>

        <TextInput
          style={styles.subjectInput}
          value={subject}
          onChangeText={setSubject}
          placeholder="Betreff:"
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="email-subject"
        />

        <View style={styles.divider} />

        <Text style={styles.prefilledText}>Sehr geehrte Damen und Herren,</Text>

        <TextInput
          style={styles.emailBody}
          multiline
          value={body}
          onChangeText={setBody}
          placeholder="Schreiben Sie hier Ihre E-Mail..."
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="email-body"
        />

        <Text style={styles.prefilledText}>Mit freundlichen Grüßen,</Text>

        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Ihr Name"
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="email-name"
        />
      </View>

      {showWarning && wc < limits.warnBelow ? (
        <Text style={styles.warningText}>Hinweis: Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? (
        isLoading ? (
          <LoadingIndicator />
        ) : (
          <CTAButton
            label="Abschicken"
            onPress={handleSubmit}
            disabled={body.trim().length === 0}
            style={styles.submitBtn}
            testID="schreiben-submit"
          />
        )
      ) : null}
    </View>
  );
}

function InformalLetterVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [salutation, setSalutation] = useState<string>('Liebe/r ');
  const [body, setBody] = useState<string>('');
  const [name, setName] = useState<string>('');
  const limits = WORD_LIMITS.informal_letter;

  const fullText = useMemo(() => {
    return salutation + ',\n\n' + body + '\n\nViele Grüße,\n' + name;
  }, [salutation, body, name]);

  const wc = useMemo(() => countWords(body), [body]);
  const [showWarning, setShowWarning] = useState<boolean>(false);

  const bulletPoints = useMemo(() => {
    return (question.options as Array<{ key?: string; text?: string }>).map((o) => o.text ?? '');
  }, [question.options]);

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(fullText, wc);
  }, [fullText, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={styles.variantWrap}>
      <View style={styles.scenarioCard}>
        <PenLine color={colors.white} size={18} style={styles.scenarioIcon} />
        <Text style={styles.scenarioText}>{question.question_text}</Text>
      </View>

      <RequiredPointsList points={bulletPoints} />

      <View style={[styles.emailContainer, shadows.card]}>
        <View style={styles.composerHeader}>
          <View style={styles.composerHeaderLeft}>
            <PenLine color={colors.navy} size={16} />
            <Text style={styles.composerLabelDark}>Brief</Text>
          </View>
          <Text style={styles.wordCount}>{wc} / {limits.max} Wörter</Text>
        </View>

        <TextInput
          style={styles.salutationInput}
          value={salutation}
          onChangeText={setSalutation}
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="letter-salutation"
        />

        <View style={styles.divider} />

        <TextInput
          style={styles.emailBody}
          multiline
          value={body}
          onChangeText={setBody}
          placeholder="Schreiben Sie hier Ihren Brief..."
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="letter-body"
        />

        <Text style={styles.prefilledText}>Viele Grüße,</Text>

        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Ihr Name"
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="letter-name"
        />
      </View>

      {showWarning && wc < limits.warnBelow ? (
        <Text style={styles.warningText}>Hinweis: Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? (
        isLoading ? (
          <LoadingIndicator />
        ) : (
          <CTAButton
            label="Abschicken"
            onPress={handleSubmit}
            disabled={body.trim().length === 0}
            style={styles.submitBtn}
            testID="schreiben-submit"
          />
        )
      ) : null}
    </View>
  );
}

function OpinionVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [text, setText] = useState<string>('');
  const limits = WORD_LIMITS.opinion;
  const wc = useMemo(() => countWords(text), [text]);
  const [showWarning, setShowWarning] = useState<boolean>(false);

  const bulletPoints = useMemo(() => {
    return (question.options as Array<{ key?: string; text?: string }>).map((o) => o.text ?? '');
  }, [question.options]);

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(text, wc);
  }, [text, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={styles.variantWrap}>
      <View style={styles.quoteCard}>
        <Text style={styles.quoteMarks}>"</Text>
        <Text style={styles.quoteText}>{question.question_text}</Text>
        <Text style={styles.quoteMarksEnd}>"</Text>
      </View>

      <RequiredPointsList points={bulletPoints} />

      <Text style={styles.tipText}>Tipp: Schreiben Sie {limits.min}–{limits.max} Wörter.</Text>

      <View style={[styles.opinionContainer, shadows.card]}>
        <View style={styles.composerHeader}>
          <Text style={styles.composerLabelDark}>Ihr Text</Text>
          <Text style={styles.wordCount}>{wc} / {limits.max} Wörter</Text>
        </View>
        <TextInput
          style={styles.opinionInput}
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Schreiben Sie hier Ihre Meinung..."
          placeholderTextColor={colors.muted}
          editable={!isSubmitted}
          testID="opinion-input"
        />
      </View>

      {showWarning && wc < limits.warnBelow ? (
        <Text style={styles.warningText}>Hinweis: Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? (
        isLoading ? (
          <LoadingIndicator />
        ) : (
          <CTAButton
            label="Abschicken"
            onPress={handleSubmit}
            disabled={text.trim().length === 0}
            style={styles.submitBtn}
            testID="schreiben-submit"
          />
        )
      ) : null}
    </View>
  );
}

function RequiredPointsList({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <View style={[styles.card, shadows.card]}>
      <Text style={styles.pointsHeader}>Ihre Nachricht muss enthalten:</Text>
      {points.map((pt, idx) => (
        <View key={idx} style={styles.pointRow}>
          <Text style={styles.pointBullet}>{NUMBERED_BULLETS[idx] ?? `${idx + 1}.`}</Text>
          <Text style={styles.pointText}>{pt}</Text>
        </View>
      ))}
    </View>
  );
}

const ASSESSMENT_STAGES: Array<{ de: string; en: string }> = [
  { de: 'Wir bewerten deine Antwort…', en: 'We are evaluating your response…' },
  { de: 'Grammatik wird überprüft…', en: 'Checking grammar…' },
  { de: 'Feedback wird vorbereitet…', en: 'Preparing feedback…' },
  { de: 'Fast fertig…', en: 'Almost done…' },
];

function LoadingIndicator() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const [stageIndex, setStageIndex] = useState(0);
  const [showReassurance, setShowReassurance] = useState(false);

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Pulsing dots animation
  useEffect(() => {
    const createDotLoop = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const l1 = createDotLoop(dot1, 0);
    const l2 = createDotLoop(dot2, 150);
    const l3 = createDotLoop(dot3, 300);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [dot1, dot2, dot3]);

  // Stage rotation every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, ASSESSMENT_STAGES.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Show reassurance after 3 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowReassurance(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const stage = ASSESSMENT_STAGES[stageIndex] ?? ASSESSMENT_STAGES[0];

  return (
    <Animated.View style={[styles.loadingWrap, { opacity: fadeAnim }]}>
      {/* Pulsing dots */}
      <View style={styles.loadingDotsRow}>
        <Animated.View style={[styles.loadingDot, { opacity: dot1 }]} />
        <Animated.View style={[styles.loadingDot, { opacity: dot2 }]} />
        <Animated.View style={[styles.loadingDot, { opacity: dot3 }]} />
      </View>

      {/* Stage message — German (primary) */}
      <Text style={styles.loadingTitle}>{stage.de}</Text>
      {/* English translation */}
      <Text style={styles.loadingTitleEn}>{stage.en}</Text>

      {/* Reassurance — appears after 3s */}
      {showReassurance ? (
        <View style={styles.loadingReassurance}>
          <Text style={styles.loadingReassuranceDe}>Das kann ein paar Sekunden dauern</Text>
          <Text style={styles.loadingReassuranceEn}>This may take a few seconds</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  variantWrap: {
    gap: spacing.lg,
  },
  errorWrap: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: fontSize.bodyMd,
    color: colors.red,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  stimulusScroll: {
    maxHeight: 200,
  },
  stimulusText: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    lineHeight: fontSize.bodyMd * 1.6,
  },
  sectionLabel: {
    fontSize: fontSize.label,
    color: colors.muted,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingLeft: spacing.xs,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  formLabel: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    flex: 1,
  },
  formPrefilled: {
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    flex: 1,
    textAlign: 'right',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  formInput: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  scenarioCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  scenarioIcon: {
    marginBottom: spacing.sm,
  },
  scenarioText: {
    fontSize: fontSize.bodyLg,
    color: colors.white,
    lineHeight: fontSize.bodyLg * 1.5,
  },
  pointsHeader: {
    fontSize: fontSize.label,
    color: colors.muted,
    fontWeight: '600' as const,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pointRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pointBullet: {
    fontSize: fontSize.bodyMd,
    color: colors.blue,
    width: 24,
  },
  pointText: {
    fontSize: fontSize.bodyMd,
    color: colors.text,
    flex: 1,
    lineHeight: fontSize.bodyMd * 1.5,
  },
  smsContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  composerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  composerLabel: {
    fontSize: fontSize.label,
    color: colors.muted,
    fontWeight: '600' as const,
  },
  composerLabelDark: {
    fontSize: fontSize.label,
    color: colors.navy,
    fontWeight: '700' as const,
  },
  wordCount: {
    fontSize: fontSize.label,
    color: colors.muted,
    fontWeight: '500' as const,
  },
  smsInput: {
    minHeight: 120,
    padding: spacing.md,
    fontSize: fontSize.bodyLg,
    color: colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  emailContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  subjectInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyMd,
    color: colors.text,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  prefilledText: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.bodyMd,
    color: colors.muted,
    fontStyle: 'italic',
  },
  emailBody: {
    minHeight: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.bodyLg,
    color: colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  nameInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyMd,
    color: colors.text,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  salutationInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyMd,
    color: colors.text,
  },
  quoteCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  quoteMarks: {
    fontSize: 48,
    color: 'rgba(255,255,255,0.2)',
    lineHeight: 48,
    fontWeight: '800' as const,
  },
  quoteText: {
    fontSize: fontSize.displaySm,
    color: colors.white,
    lineHeight: fontSize.displaySm * 1.5,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  quoteMarksEnd: {
    fontSize: 48,
    color: 'rgba(255,255,255,0.2)',
    lineHeight: 48,
    fontWeight: '800' as const,
    alignSelf: 'flex-end',
  },
  tipText: {
    fontSize: fontSize.bodySm,
    color: colors.muted,
    paddingLeft: spacing.xs,
  },
  opinionContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  opinionInput: {
    minHeight: 200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyLg,
    color: colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  warningText: {
    fontSize: fontSize.bodySm,
    color: colors.amber,
    fontWeight: '600' as const,
    paddingLeft: spacing.xs,
  },
  submitBtn: {
    marginHorizontal: 0,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: spacing.md,
  },
  loadingDotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2B70EF',
  },
  loadingTitle: {
    fontSize: 17,
    color: '#0F1F3D',
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  loadingTitleEn: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400' as const,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginTop: -4,
  },
  loadingReassurance: {
    marginTop: 12,
    alignItems: 'center',
    gap: 2,
  },
  loadingReassuranceDe: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  loadingReassuranceEn: {
    fontSize: 12,
    color: '#B8C4D4',
    fontWeight: '400' as const,
    textAlign: 'center' as const,
  },
});
