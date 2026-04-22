import { FileText, ListChecks, Mail, MessageSquare, PenLine } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { countWords } from '@/lib/schreibenHelpers';
import { B } from '@/theme/banani';
import { fontFamily } from '@/theme/typography';
import type { AppQuestion } from '@/types/database';
import type { AssessmentResult, FormFillOption } from '@/types/schreiben';

// ── Schreiben-specific accent tokens ─────────────────────────────────────
const PURPLE = '#8B5CF6';
const PURPLE_BG = '#F3E8FF';
const DISABLED_BG = '#F1F5F9';

// ── Types ─────────────────────────────────────────────────────────────────
type SchreibenQuestionProps = {
  question: AppQuestion;
  task_type: string;
  onSubmit: (userText: string, wordCount: number) => void;
  isSubmitted: boolean;
  isLoading: boolean;
  assessment: AssessmentResult | null;
};

type VariantProps = {
  question: AppQuestion;
  onSubmit: (userText: string, wordCount: number) => void;
  isSubmitted: boolean;
  isLoading: boolean;
};

const WORD_LIMITS: Record<string, { min: number; max: number; warnBelow: number }> = {
  sms:             { min: 30, max: 80,  warnBelow: 20 },
  formal_email:    { min: 60, max: 120, warnBelow: 40 },
  informal_letter: { min: 80, max: 150, warnBelow: 50 },
  opinion:         { min: 60, max: 120, warnBelow: 50 },
};

// ── Dispatcher ────────────────────────────────────────────────────────────
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
        <View style={s.errorWrap}>
          <Text style={s.errorText}>Unknown task type: {task_type}</Text>
        </View>
      );
  }
}

// ── Shared UI atoms ───────────────────────────────────────────────────────

function ScenarioCard({ text, icon }: { text: string; icon: React.ReactNode }) {
  return (
    <View style={s.scenarioCard}>
      <View style={s.iconSquare}>{icon}</View>
      <Text style={s.scenarioText}>{text}</Text>
    </View>
  );
}

function RequiredPointsList({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <View style={s.card}>
      <View style={s.reqHeader}>
        <ListChecks size={16} color={B.muted} />
        <Text style={s.reqHeaderText}>IHRE NACHRICHT MUSS ENTHALTEN:</Text>
      </View>
      {points.map((pt, idx) => (
        <View key={idx} style={[s.reqRow, idx === points.length - 1 && s.reqRowLast]}>
          <View style={s.reqNum}>
            <Text style={s.reqNumText}>{idx + 1}</Text>
          </View>
          <Text style={s.reqText}>{pt}</Text>
        </View>
      ))}
    </View>
  );
}

function WordCountBar({ wc, max }: { wc: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (wc / max) * 100 : 0);
  const isOver = wc > max;
  return (
    <View style={s.wcContainer}>
      <Text style={s.wcLabel}>{max} Wörter Limit</Text>
      <View style={s.wcTrack}>
        <View
          style={[
            s.wcFill,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { width: `${pct}%` as any, backgroundColor: isOver ? B.destructive : B.primary },
          ]}
        />
      </View>
    </View>
  );
}

function SubmitCTA({ canSubmit, onPress, isLoading }: { canSubmit: boolean; onPress: () => void; isLoading: boolean }) {
  if (isLoading) return <LoadingIndicator />;
  return (
    <Pressable
      style={[s.ctaButton, !canSubmit && s.ctaDisabled]}
      onPress={canSubmit ? onPress : undefined}
      testID="schreiben-submit"
    >
      <Text style={[s.ctaText, !canSubmit && s.ctaTextDisabled]}>
        Antwort einreichen
      </Text>
    </Pressable>
  );
}

// ── Pulsing cursor hint ───────────────────────────────────────────────────
function PulsingCursor() {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 530, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 530, useNativeDriver: true }),
      ]),
    ).start();
  }, [blink]);
  return <Animated.Text style={[s.pulsingCursor, { opacity: blink }]}>|</Animated.Text>;
}

// ── Form Fill Variant ─────────────────────────────────────────────────────
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
    fields.forEach((f, i) => { if (f.value_prefilled) init[i] = f.value_prefilled; });
    return init;
  });

  const allFilled = useMemo(() => {
    return fields.every((f, i) => f.value_prefilled || (values[i] ?? '').trim().length > 0);
  }, [fields, values]);

  const handleSubmit = useCallback(() => {
    const ordered = fields.map((f, i) => values[i] ?? f.value_prefilled ?? '');
    onSubmit(JSON.stringify(ordered), 0);
  }, [fields, values, onSubmit]);

  return (
    <View style={s.variantWrap}>
      {question.stimulus_text ? (
        <View style={s.card}>
          <Text style={s.stimulusText}>{question.stimulus_text}</Text>
        </View>
      ) : null}

      <Text style={s.sectionLabel}>FORMULAR</Text>

      <View style={s.card}>
        {fields.map((field, idx) => {
          const isPrefilled = Boolean(field.value_prefilled);
          return (
            <View key={idx}>
              {idx > 0 ? <View style={s.divider} /> : null}
              <View style={s.formRow}>
                <Text style={s.formLabel}>{field.label}</Text>
                {isPrefilled ? (
                  <Text style={s.formPrefilled}>{field.value_prefilled}</Text>
                ) : (
                  <TextInput
                    style={s.formInput}
                    value={values[idx] ?? ''}
                    onChangeText={(text) => setValues((prev) => ({ ...prev, [idx]: text }))}
                    placeholder="..."
                    placeholderTextColor={B.muted}
                    editable={!isSubmitted}
                    testID={`form-field-${idx}`}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {!isSubmitted ? <SubmitCTA canSubmit={allFilled} onPress={handleSubmit} isLoading={isLoading} /> : null}
    </View>
  );
}

// ── SMS Variant ───────────────────────────────────────────────────────────
function SMSVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [text, setText] = useState('');
  const wc = useMemo(() => countWords(text), [text]);
  const limits = WORD_LIMITS.sms!;
  const [showWarning, setShowWarning] = useState(false);
  const [focused, setFocused] = useState(false);

  const bulletPoints = useMemo(
    () => (question.options as Array<{ text?: string }>).map((o) => o.text ?? ''),
    [question.options],
  );

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(text, wc);
  }, [text, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={s.variantWrap}>
      <ScenarioCard text={question.question_text} icon={<MessageSquare size={20} color={PURPLE} />} />

      <RequiredPointsList points={bulletPoints} />

      <View style={s.writingCard}>
        <View style={s.writingHeader}>
          <View style={s.writingHeaderLeft}>
            <MessageSquare size={18} color={B.muted} />
            <Text style={s.writingHeaderLabel}>SMS</Text>
          </View>
          <Text style={s.writingHeaderRight}>{wc} / {limits.max} Wörter</Text>
        </View>
        <View style={s.textAreaZone}>
          <View style={s.cursorWrap}>
            {text === '' && !focused && !isSubmitted && <PulsingCursor />}
            <TextInput
              style={s.textArea}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Schreiben Sie hier Ihre SMS..."
              placeholderTextColor={B.muted}
              editable={!isSubmitted}
              testID="sms-input"
              textAlignVertical="top"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>
        </View>
      </View>

      <WordCountBar wc={wc} max={limits.max} />

      {showWarning && wc < limits.warnBelow ? (
        <Text style={s.warningText}>Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? <SubmitCTA canSubmit={text.trim().length > 0} onPress={handleSubmit} isLoading={isLoading} /> : null}
    </View>
  );
}

// ── Formal Email Variant ──────────────────────────────────────────────────
function FormalEmailVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const limits = WORD_LIMITS.formal_email!;
  const wc = useMemo(() => countWords(body), [body]);
  const [showWarning, setShowWarning] = useState(false);
  const [subjectFocused, setSubjectFocused] = useState(false);
  const [bodyFocused, setBodyFocused] = useState(false);

  const fullText = useMemo(
    () => `${subject}\n\nSehr geehrte Damen und Herren,\n\n${body}\n\nMit freundlichen Grüßen,\n${name}`,
    [subject, body, name],
  );

  const bulletPoints = useMemo(
    () => (question.options as Array<{ text?: string }>).map((o) => o.text ?? ''),
    [question.options],
  );

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(fullText, wc);
  }, [fullText, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={s.variantWrap}>
      <ScenarioCard text={question.question_text} icon={<Mail size={20} color={PURPLE} />} />

      <RequiredPointsList points={bulletPoints} />

      <View style={s.writingCard}>
        <View style={s.writingHeader}>
          <View style={s.writingHeaderLeft}>
            <Mail size={18} color={B.muted} />
            <Text style={s.writingHeaderLabel}>E-Mail</Text>
          </View>
          <Text style={s.writingHeaderRight}>{wc} / {limits.max} Wörter</Text>
        </View>

        <View style={s.betreffArea}>
          <Text style={s.betreffLabel}>Betreff:</Text>
          <View style={s.betreffInputContainer}>
            <View style={s.cursorWrap}>
              {subject === '' && !subjectFocused && !isSubmitted && <PulsingCursor />}
              <TextInput
                style={s.betreffInput}
                value={subject}
                onChangeText={setSubject}
                placeholder="Schreiben Sie hier den Betreff..."
                placeholderTextColor={B.muted}
                editable={!isSubmitted}
                testID="email-subject"
                onFocus={() => setSubjectFocused(true)}
                onBlur={() => setSubjectFocused(false)}
              />
            </View>
          </View>
        </View>

        <View style={s.bodyArea}>
          <Text style={s.scaffold}>Sehr geehrte Damen und Herren,</Text>
          <View style={s.cursorWrap}>
            {body === '' && !bodyFocused && !isSubmitted && <PulsingCursor />}
            <TextInput
              style={s.bodyTextArea}
              multiline
              value={body}
              onChangeText={setBody}
              placeholder="Schreiben Sie hier Ihre E-Mail..."
              placeholderTextColor={B.muted}
              editable={!isSubmitted}
              testID="email-body"
              textAlignVertical="top"
              onFocus={() => setBodyFocused(true)}
              onBlur={() => setBodyFocused(false)}
            />
          </View>
          <Text style={s.scaffold}>Mit freundlichen Grüßen,</Text>
          <TextInput
            style={s.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Ihr Name"
            placeholderTextColor={B.muted}
            editable={!isSubmitted}
            testID="email-name"
          />
        </View>
      </View>

      <WordCountBar wc={wc} max={limits.max} />

      {showWarning && wc < limits.warnBelow ? (
        <Text style={s.warningText}>Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? <SubmitCTA canSubmit={body.trim().length > 0} onPress={handleSubmit} isLoading={isLoading} /> : null}
    </View>
  );
}

// ── Informal Letter Variant ───────────────────────────────────────────────
function InformalLetterVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [salutation, setSalutation] = useState('Liebe/r ');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const limits = WORD_LIMITS.informal_letter!;
  const wc = useMemo(() => countWords(body), [body]);
  const [showWarning, setShowWarning] = useState(false);
  const [bodyFocused, setBodyFocused] = useState(false);

  const fullText = useMemo(
    () => `${salutation},\n\n${body}\n\nViele Grüße,\n${name}`,
    [salutation, body, name],
  );

  const bulletPoints = useMemo(
    () => (question.options as Array<{ text?: string }>).map((o) => o.text ?? ''),
    [question.options],
  );

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(fullText, wc);
  }, [fullText, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={s.variantWrap}>
      <ScenarioCard text={question.question_text} icon={<PenLine size={20} color={PURPLE} />} />

      <RequiredPointsList points={bulletPoints} />

      <View style={s.writingCard}>
        <View style={s.writingHeader}>
          <View style={s.writingHeaderLeft}>
            <PenLine size={18} color={B.muted} />
            <Text style={s.writingHeaderLabel}>Brief</Text>
          </View>
          <Text style={s.writingHeaderRight}>{wc} / {limits.max} Wörter</Text>
        </View>

        <View style={s.bodyArea}>
          <TextInput
            style={s.salutationInput}
            value={salutation}
            onChangeText={setSalutation}
            placeholderTextColor={B.muted}
            editable={!isSubmitted}
            testID="letter-salutation"
          />
          <View style={s.salutationDivider} />
          <View style={s.cursorWrap}>
            {body === '' && !bodyFocused && !isSubmitted && <PulsingCursor />}
            <TextInput
              style={s.bodyTextArea}
              multiline
              value={body}
              onChangeText={setBody}
              placeholder="Schreiben Sie hier Ihren Brief..."
              placeholderTextColor={B.muted}
              editable={!isSubmitted}
              testID="letter-body"
              textAlignVertical="top"
              onFocus={() => setBodyFocused(true)}
              onBlur={() => setBodyFocused(false)}
            />
          </View>
          <Text style={s.scaffold}>Viele Grüße,</Text>
          <TextInput
            style={s.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Ihr Name"
            placeholderTextColor={B.muted}
            editable={!isSubmitted}
            testID="letter-name"
          />
        </View>
      </View>

      <WordCountBar wc={wc} max={limits.max} />

      {showWarning && wc < limits.warnBelow ? (
        <Text style={s.warningText}>Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? <SubmitCTA canSubmit={body.trim().length > 0} onPress={handleSubmit} isLoading={isLoading} /> : null}
    </View>
  );
}

// ── Opinion Variant ───────────────────────────────────────────────────────
function OpinionVariant({ question, onSubmit, isSubmitted, isLoading }: VariantProps) {
  const [text, setText] = useState('');
  const limits = WORD_LIMITS.opinion!;
  const wc = useMemo(() => countWords(text), [text]);
  const [showWarning, setShowWarning] = useState(false);
  const [focused, setFocused] = useState(false);

  const bulletPoints = useMemo(
    () => (question.options as Array<{ text?: string }>).map((o) => o.text ?? ''),
    [question.options],
  );

  const handleSubmit = useCallback(() => {
    if (wc < limits.warnBelow) setShowWarning(true);
    onSubmit(text, wc);
  }, [text, wc, limits.warnBelow, onSubmit]);

  return (
    <View style={s.variantWrap}>
      <ScenarioCard text={question.question_text} icon={<FileText size={20} color={PURPLE} />} />

      <RequiredPointsList points={bulletPoints} />

      <Text style={s.tipText}>Tipp: Schreiben Sie {limits.min}–{limits.max} Wörter.</Text>

      <View style={s.writingCard}>
        <View style={s.writingHeader}>
          <View style={s.writingHeaderLeft}>
            <FileText size={18} color={B.muted} />
            <Text style={s.writingHeaderLabel}>Ihr Text</Text>
          </View>
          <Text style={s.writingHeaderRight}>{wc} / {limits.max} Wörter</Text>
        </View>
        <View style={s.textAreaZone}>
          <View style={s.cursorWrap}>
            {text === '' && !focused && !isSubmitted && <PulsingCursor />}
            <TextInput
              style={[s.textArea, { minHeight: 200 }]}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Schreiben Sie hier Ihre Meinung..."
              placeholderTextColor={B.muted}
              editable={!isSubmitted}
              testID="opinion-input"
              textAlignVertical="top"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>
        </View>
      </View>

      <WordCountBar wc={wc} max={limits.max} />

      {showWarning && wc < limits.warnBelow ? (
        <Text style={s.warningText}>Mindestens {limits.warnBelow} Wörter empfohlen.</Text>
      ) : null}

      {!isSubmitted ? <SubmitCTA canSubmit={text.trim().length > 0} onPress={handleSubmit} isLoading={isLoading} /> : null}
    </View>
  );
}

// ── Loading indicator ─────────────────────────────────────────────────────
const ASSESSMENT_STAGES: Array<{ de: string; en: string }> = [
  { de: 'Wir bewerten deine Antwort…',  en: 'We are evaluating your response…' },
  { de: 'Grammatik wird überprüft…',     en: 'Checking grammar…' },
  { de: 'Feedback wird vorbereitet…',    en: 'Preparing feedback…' },
  { de: 'Fast fertig…',                  en: 'Almost done…' },
];

function LoadingIndicator() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const [stageIndex, setStageIndex] = useState(0);
  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, ASSESSMENT_STAGES.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowReassurance(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const stage = ASSESSMENT_STAGES[stageIndex] ?? ASSESSMENT_STAGES[0]!;

  return (
    <Animated.View style={[s.loadingWrap, { opacity: fadeAnim }]}>
      <View style={s.loadingDotsRow}>
        <Animated.View style={[s.loadingDot, { opacity: dot1 }]} />
        <Animated.View style={[s.loadingDot, { opacity: dot2 }]} />
        <Animated.View style={[s.loadingDot, { opacity: dot3 }]} />
      </View>
      <Text style={s.loadingTitle}>{stage.de}</Text>
      <Text style={s.loadingSubtitle}>{stage.en}</Text>
      {showReassurance ? (
        <View style={s.loadingReassurance}>
          <Text style={s.loadingReassuranceDe}>Das kann ein paar Sekunden dauern</Text>
          <Text style={s.loadingReassuranceEn}>This may take a few seconds</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  variantWrap: {
    gap: 16,
  },
  errorWrap: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: B.destructive,
    fontFamily: fontFamily.bodyRegular,
  },

  // ── Scenario card ──────────────────────────────────────────────────────
  scenarioCard: {
    backgroundColor: B.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: B.border,
    padding: 20,
    gap: 16,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: PURPLE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioText: {
    fontSize: 15,
    color: B.foreground,
    lineHeight: 24,
    fontFamily: fontFamily.bodyRegular,
  },

  // ── Requirements card ──────────────────────────────────────────────────
  card: {
    backgroundColor: B.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: B.border,
    padding: 20,
  },
  reqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reqHeaderText: {
    fontSize: 12,
    color: B.muted,
    fontFamily: fontFamily.bodyBold,
    letterSpacing: 0.5,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: B.border,
  },
  reqRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  reqNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PURPLE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  reqNumText: {
    fontSize: 13,
    color: PURPLE,
    fontFamily: fontFamily.bodyBold,
  },
  reqText: {
    fontSize: 13,
    lineHeight: 18,
    color: B.foreground,
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
  },

  // ── Writing card ───────────────────────────────────────────────────────
  writingCard: {
    backgroundColor: B.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: B.border,
    overflow: 'hidden',
  },
  writingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: B.border,
  },
  writingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  writingHeaderLabel: {
    fontSize: 15,
    color: B.foreground,
    fontFamily: fontFamily.bodySemiBold,
  },
  writingHeaderRight: {
    fontSize: 13,
    color: B.muted,
    fontFamily: fontFamily.bodyRegular,
  },

  // Betreff (email subject area)
  betreffArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  betreffLabel: {
    fontSize: 15,
    color: B.muted,
    fontFamily: fontFamily.bodySemiBold,
    marginBottom: 8,
  },
  betreffInputContainer: {
    borderBottomWidth: 1,
    borderBottomColor: B.border,
    paddingBottom: 12,
  },
  betreffInput: {
    fontSize: 15,
    color: B.foreground,
    fontFamily: fontFamily.bodyRegular,
    fontStyle: 'italic',
    minHeight: 36,
  },

  // Body area (email / letter)
  bodyArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  scaffold: {
    fontSize: 15,
    color: B.muted,
    fontFamily: fontFamily.bodyRegular,
    fontStyle: 'italic',
  },
  salutationInput: {
    fontSize: 15,
    color: B.foreground,
    fontFamily: fontFamily.bodyRegular,
    minHeight: 36,
  },
  salutationDivider: {
    height: 1,
    backgroundColor: B.border,
  },
  bodyTextArea: {
    minHeight: 180,
    fontSize: 15,
    color: B.foreground,
    lineHeight: 24,
    fontFamily: fontFamily.bodyRegular,
    textAlignVertical: 'top',
  },
  nameInput: {
    fontSize: 15,
    color: B.foreground,
    fontFamily: fontFamily.bodyRegular,
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: B.border,
    paddingTop: 12,
  },

  // Text area zone (SMS / Opinion)
  textAreaZone: {
    padding: 20,
    paddingTop: 16,
  },
  textArea: {
    minHeight: 160,
    fontSize: 15,
    color: B.foreground,
    lineHeight: 24,
    fontFamily: fontFamily.bodyRegular,
    textAlignVertical: 'top',
  },

  // Word count bar
  wcContainer: {
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  wcLabel: {
    fontSize: 12,
    color: B.muted,
    textAlign: 'right',
    fontFamily: fontFamily.bodyRegular,
  },
  wcTrack: {
    height: 4,
    backgroundColor: B.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  wcFill: {
    height: '100%',
    borderRadius: 999,
  },

  // Pulsing cursor
  cursorWrap: {
    position: 'relative',
  },
  pulsingCursor: {
    position: 'absolute',
    top: 2,
    left: 0,
    fontSize: 16,
    lineHeight: 24,
    color: '#2B70EF',
    fontFamily: fontFamily.bodyRegular,
    pointerEvents: 'none',
  },

  // Form fill
  sectionLabel: {
    fontSize: 12,
    color: B.muted,
    fontFamily: fontFamily.bodyBold,
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: B.border,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    color: B.muted,
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
  },
  formPrefilled: {
    fontSize: 14,
    color: B.muted,
    flex: 1,
    textAlign: 'right',
    fontStyle: 'italic',
    fontFamily: fontFamily.bodyRegular,
  },
  formInput: {
    fontSize: 14,
    color: B.foreground,
    flex: 1,
    textAlign: 'right',
    backgroundColor: B.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: B.border,
    fontFamily: fontFamily.bodyRegular,
  },
  stimulusText: {
    fontSize: 15,
    color: B.foreground,
    lineHeight: 24,
    fontFamily: fontFamily.bodyRegular,
  },

  // Submit CTA
  ctaButton: {
    backgroundColor: B.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: DISABLED_BG,
  },
  ctaText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: fontFamily.display,
  },
  ctaTextDisabled: {
    color: B.muted,
    fontFamily: fontFamily.bodySemiBold,
  },

  // Misc
  warningText: {
    fontSize: 13,
    color: '#F59E0B',
    fontFamily: fontFamily.bodySemiBold,
    paddingLeft: 4,
  },
  tipText: {
    fontSize: 13,
    color: B.muted,
    fontFamily: fontFamily.bodyRegular,
    paddingLeft: 4,
  },

  // Loading indicator
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
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
    backgroundColor: B.primary,
  },
  loadingTitle: {
    fontSize: 17,
    color: B.foreground,
    fontFamily: fontFamily.bodySemiBold,
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: B.muted,
    fontFamily: fontFamily.bodyRegular,
    textAlign: 'center',
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
    color: B.muted,
    fontFamily: fontFamily.bodyRegular,
    textAlign: 'center',
  },
  loadingReassuranceEn: {
    fontSize: 12,
    color: '#B8C4D4',
    fontFamily: fontFamily.bodyRegular,
    textAlign: 'center',
  },
});
