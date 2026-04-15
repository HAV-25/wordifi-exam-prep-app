import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, ChevronLeft, CircleCheck, Eye, EyeOff, Headphones, BookOpenText, Lock, Mail, Sparkles, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AudioPlayer } from '@/components/AudioPlayer';
import { PlayerNameModal } from '@/components/PlayerNameModal';
import { ScoreRing } from '@/components/ScoreRing';
import { StimulusCard } from '@/components/StimulusCard';
import Colors from '@/constants/colors';
import { colors } from '@/theme';
import { CTAButton } from '@/components/CTAButton';
import { GermanConfetti } from '@/components/GermanConfetti';
import { GermanFlagBadge } from '@/components/GermanFlagBadge';
import { WordifiLogo } from '@/components/WordifiLogo';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/authHelpers';
import { upsertOnboardingProfile, updatePlayerName } from '@/lib/profileHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import type { AppQuestion, ExamType, Level } from '@/types/database';

type OnboardingState = {
  selectedLanguage: 'de';
  selectedLevel: Level | null;
  selectedExamType: ExamType | null;
  sampleQuestions: AppQuestion[];
  sampleAnswers: Record<string, string>;
  sampleScore: number;
};

const LEVEL_CARDS: { level: Level; description: string; available: boolean }[] = [
  { level: 'A1', description: 'Complete beginner — first words and phrases', available: true },
  { level: 'A2', description: 'Elementary — everyday conversations', available: true },
  { level: 'B1', description: 'Intermediate — work and travel situations', available: true },
];

const COMING_SOON_LEVELS = [
  { level: 'B2', description: 'Upper intermediate — complex topics' },
  { level: 'C1', description: 'Advanced — professional fluency' },
  { level: 'C2', description: 'Mastery — near-native level' },
];

const COMING_SOON_LANGUAGES = ['French 🇫🇷', 'Spanish 🇪🇸', 'Italian 🇮🇹', 'Dutch 🇳🇱'];

export default function OnboardingScreen() {
  const { user: _user, refreshProfile } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<OnboardingState>({
    selectedLanguage: 'de',
    selectedLevel: null,
    selectedExamType: null,
    sampleQuestions: [],
    sampleAnswers: {},
    sampleScore: 0,
  });

  const [sampleIndex, setSampleIndex] = useState<number>(0);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signUp' | 'signIn'>('signUp');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [_isSaving, setIsSaving] = useState<boolean>(false);
  const [showPlayerNameModal, setShowPlayerNameModal] = useState<boolean>(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotSent, setForgotSent] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string>('');

  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.8)).current;
  const _scoreAnim = useRef(new Animated.Value(0)).current;
  const forgotModalFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 1) {
      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(splashScale, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        setStep(2);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step, splashOpacity, splashScale]);

  const fetchSampleQuestions = useCallback(async () => {
    if (!state.selectedLevel) return;
    setIsLoadingSample(true);
    console.log('Onboarding fetching sample questions for', state.selectedLevel);

    try {
      const { data, error } = await supabase
        .from('app_questions')
        .select('*')
        .eq('level', state.selectedLevel)
        .eq('is_active', true)
        .limit(5);

      if (error) {
        console.log('Onboarding sample fetch error', error);
        setIsLoadingSample(false);
        return;
      }

      let questions = (data ?? []) as AppQuestion[];

      if (questions.length < 5) {
        console.log('Onboarding not enough questions for level, fetching any');
        const { data: fallback } = await supabase
          .from('app_questions')
          .select('*')
          .eq('is_active', true)
          .limit(5);
        questions = (fallback ?? []) as AppQuestion[];
      }

      setState((prev) => ({ ...prev, sampleQuestions: questions }));
      setSampleIndex(0);
    } catch (err) {
      console.log('Onboarding sample fetch unexpected error', err);
    } finally {
      setIsLoadingSample(false);
    }
  }, [state.selectedLevel]);

  const handleSampleAnswer = useCallback(
    (questionId: string, answerKey: string) => {
      setState((prev) => ({
        ...prev,
        sampleAnswers: { ...prev.sampleAnswers, [questionId]: answerKey },
      }));
    },
    []
  );

  const advanceSample = useCallback(() => {
    if (sampleIndex < state.sampleQuestions.length - 1) {
      setSampleIndex((prev) => prev + 1);
    } else {
      const correct = state.sampleQuestions.reduce((count, q) => {
        const sel = (state.sampleAnswers[q.id] ?? '').toLowerCase();
        return sel === q.correct_answer.toLowerCase() ? count + 1 : count;
      }, 0);
      setState((prev) => ({ ...prev, sampleScore: correct }));
      setStep(7);
    }
  }, [sampleIndex, state.sampleQuestions, state.sampleAnswers]);

  const handleAuth = useCallback(async (mode: 'email' | 'google') => {
    setIsAuthLoading(true);
    try {
      if (mode === 'google') {
        await signInWithGoogle();
      } else if (authMode === 'signUp') {
        await signUpWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }

      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) {
        throw new Error('Auth succeeded but no user found');
      }

      if (state.selectedLevel) {
        setIsSaving(true);
        await upsertOnboardingProfile(currentUser.id, {
          targetLevel: state.selectedLevel,
          examType: state.selectedExamType ?? 'TELC',
          examDate: null,
        });
        await refreshProfile();
        setIsSaving(false);
      }

      if (authMode === 'signIn') {
        router.replace('/');
      } else {
        const existingProfile = await supabase
          .from('user_profiles')
          .select('player_name')
          .eq('id', currentUser.id)
          .maybeSingle();

        const alreadySet = await AsyncStorage.getItem('wordifi_player_name_set');
        if (existingProfile.data?.player_name || alreadySet === 'true') {
          setStep(9);
        } else {
          setPendingUserId(currentUser.id);
          setShowPlayerNameModal(true);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const normalized = message.toLowerCase();
      let friendly = 'Something went wrong. Please try again.';
      if (normalized.includes('invalid login')) {
        friendly = 'Email or password is incorrect';
      } else if (normalized.includes('already registered') || normalized.includes('already exists')) {
        friendly = 'An account with this email already exists. Try signing in.';
      }
      Alert.alert('Wordifi', friendly);
    } finally {
      setIsAuthLoading(false);
      setIsSaving(false);
    }
  }, [authMode, email, password, state.selectedLevel, state.selectedExamType, refreshProfile]);

  const canEmailAuth = email.length > 0 && password.length >= 8 && /\S+@\S+\.\S+/.test(email);

  const sampleQuestion = state.sampleQuestions[sampleIndex] ?? null;
  const sampleSelectedAnswer = sampleQuestion ? (state.sampleAnswers[sampleQuestion.id] ?? '') : '';
  const sampleTotalQuestions = state.sampleQuestions.length;
  const _sampleScorePct = sampleTotalQuestions > 0 ? (state.sampleScore / sampleTotalQuestions) * 100 : 0;

  const renderStep1 = () => (
    <View style={styles.splashContainer}>
      <LinearGradient colors={[colors.navy, '#10233F', '#0D1F38']} style={StyleSheet.absoluteFillObject} />
      <GermanConfetti />
      <Animated.View style={[styles.splashContent, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
        <View style={styles.splashLogoWrap}>
          <Sparkles color={colors.green} size={36} />
        </View>
        <View style={styles.splashBrandRow}>
          <WordifiLogo variant="light" height={52} />
          <GermanFlagBadge width={22} height={14} />
        </View>
        <Text style={styles.splashTagline}>Your exam, conquered.</Text>
      </Animated.View>
    </View>
  );

  const renderBackButton = (onPress: () => void) => (
    <Pressable
      accessibilityLabel="Go back"
      onPress={onPress}
      style={styles.backButton}
      testID="onboarding-back"
    >
      <ChevronLeft color={Colors.primary} size={24} />
    </Pressable>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <SafeAreaView style={styles.safeInner}>
        {renderBackButton(() => setStep(1))}
        <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepHeading}>What language are you learning?</Text>

          <Pressable style={[styles.languageCard, styles.languageCardSelected]} testID="language-german">
            <Text style={styles.languageFlag}>🇩🇪</Text>
            <View style={styles.languageCardTextWrap}>
              <Text style={styles.languageCardTitle}>German</Text>
              <Text style={styles.languageCardSub}>Deutsch</Text>
            </View>
            <View style={styles.checkCircle}>
              <Check color="#fff" size={16} />
            </View>
          </Pressable>

          <Text style={styles.comingSoonLabel}>More languages on the way</Text>
          <View style={styles.comingSoonRow}>
            {COMING_SOON_LANGUAGES.map((lang) => (
              <View key={lang} style={styles.comingSoonPill}>
                <Text style={styles.comingSoonPillText}>{lang}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <CTAButton
            label="Continue"
            onPress={() => setStep(3)}
            testID="onboarding-step2-continue"
          />
          <Pressable onPress={() => router.push('/auth')} style={styles.signInLink} testID="onboarding-signin-link">
            <Text style={styles.signInLinkText}>Already a user? <Text style={styles.signInLinkBold}>Sign in</Text></Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <SafeAreaView style={styles.safeInner}>
        {renderBackButton(() => setStep(2))}
        <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepHeading}>What's your target level?</Text>
          <Text style={styles.stepSubheading}>Don't worry — you can change this later</Text>

          {LEVEL_CARDS.map((item) => {
            const selected = state.selectedLevel === item.level;
            return (
              <Pressable
                key={item.level}
                accessibilityLabel={`Choose ${item.level}`}
                onPress={() => setState((prev) => ({ ...prev, selectedLevel: item.level }))}
                style={[styles.levelCard, selected ? styles.levelCardSelected : null]}
                testID={`level-${item.level}`}
              >
                <View style={[styles.levelBadge, selected ? styles.levelBadgeSelected : null]}>
                  <Text style={[styles.levelBadgeText, selected ? styles.levelBadgeTextSelected : null]}>
                    {item.level}
                  </Text>
                </View>
                <View style={styles.levelCardTextWrap}>
                  <Text style={[styles.levelCardTitle, selected ? styles.levelCardTitleSelected : null]}>
                    {item.level}
                  </Text>
                  <Text style={styles.levelCardDesc}>{item.description}</Text>
                </View>
                {selected ? (
                  <View style={styles.checkCircle}>
                    <Check color="#fff" size={14} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {COMING_SOON_LEVELS.map((item) => (
            <View key={item.level} style={[styles.levelCard, styles.levelCardDisabled]}>
              <View style={styles.levelBadgeDisabled}>
                <Text style={styles.levelBadgeTextDisabled}>{item.level}</Text>
              </View>
              <View style={styles.levelCardTextWrap}>
                <Text style={styles.levelCardTitleDisabled}>{item.level}</Text>
                <Text style={styles.levelCardDescDisabled}>{item.description}</Text>
              </View>
              <View style={styles.lockPill}>
                <Lock color={Colors.textMuted} size={12} />
                <Text style={styles.lockPillText}>Coming soon</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <CTAButton
            label="Continue"
            onPress={() => setStep(4)}
            disabled={!state.selectedLevel}
            testID="onboarding-step3-continue"
          />
        </View>
      </SafeAreaView>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <SafeAreaView style={styles.safeInner}>
        {renderBackButton(() => setStep(3))}
        <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepHeading}>Which exam are you preparing for?</Text>
          <Text style={styles.stepSubheading}>
            Our content prepares you for both — this helps us personalise your experience
          </Text>

          <View style={styles.examRow}>
            <Pressable
              accessibilityLabel="Choose Goethe-Institut"
              onPress={() => setState((prev) => ({ ...prev, selectedExamType: 'GOETHE' }))}
              style={[
                styles.examCard,
                state.selectedExamType === 'GOETHE' ? styles.examCardSelected : null,
              ]}
              testID="exam-goethe"
            >
              <View style={styles.examIconWrap}>
                <Text style={styles.examIcon}>🏛</Text>
              </View>
              <Text style={[styles.examCardTitle, state.selectedExamType === 'GOETHE' ? styles.examCardTitleSelected : null]}>
                Goethe-Institut
              </Text>
              {state.selectedExamType === 'GOETHE' ? (
                <View style={styles.checkCircleSmall}>
                  <Check color="#fff" size={12} />
                </View>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityLabel="Choose TELC"
              onPress={() => setState((prev) => ({ ...prev, selectedExamType: 'TELC' }))}
              style={[
                styles.examCard,
                state.selectedExamType === 'TELC' ? styles.examCardSelected : null,
              ]}
              testID="exam-telc"
            >
              <View style={styles.examIconWrap}>
                <Text style={styles.examIcon}>📝</Text>
              </View>
              <Text style={[styles.examCardTitle, state.selectedExamType === 'TELC' ? styles.examCardTitleSelected : null]}>
                TELC
              </Text>
              {state.selectedExamType === 'TELC' ? (
                <View style={styles.checkCircleSmall}>
                  <Check color="#fff" size={12} />
                </View>
              ) : null}
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Not sure yet"
            onPress={() => setState((prev) => ({ ...prev, selectedExamType: null }))}
            style={styles.notSureLink}
            testID="exam-not-sure"
          >
            <Text style={[styles.notSureText, state.selectedExamType === null ? styles.notSureTextActive : null]}>
              Not sure yet
            </Text>
          </Pressable>
        </ScrollView>
        <View style={styles.footer}>
          <CTAButton
            label="Continue"
            onPress={() => setStep(5)}
            testID="onboarding-step4-continue"
          />
        </View>
      </SafeAreaView>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <LinearGradient colors={[colors.navy, '#10233F']} style={StyleSheet.absoluteFillObject} />
      <GermanConfetti />
      <SafeAreaView style={styles.safeInner}>
        <View style={styles.step5Content}>
          <View style={styles.step5Hero}>
            <Text style={styles.step5Heading}>Ready to try a free mini-test?</Text>
            <Text style={styles.step5Subheading}>5 questions · No account needed · Takes 2 minutes</Text>
          </View>

          <View style={styles.step5Bullets}>
            <View style={styles.bulletRow}>
              <CircleCheck color={Colors.accent} size={20} />
              <Text style={styles.bulletText}>Real exam-style questions</Text>
            </View>
            <View style={styles.bulletRow}>
              <CircleCheck color={Colors.accent} size={20} />
              <Text style={styles.bulletText}>Instant results and explanations</Text>
            </View>
            <View style={styles.bulletRow}>
              <CircleCheck color={Colors.accent} size={20} />
              <Text style={styles.bulletText}>See your readiness score</Text>
            </View>
          </View>

          <View style={styles.step5Footer}>
            <Pressable
              accessibilityLabel="Start my free test"
              onPress={() => {
                void fetchSampleQuestions();
                setStep(6);
              }}
              style={styles.accentButton}
              testID="start-free-test"
            >
              <Sparkles color="#fff" size={18} />
              <Text style={styles.accentButtonText}>Start My Free Test</Text>
            </Pressable>
            <Text style={styles.step5Note}>No sign-up required</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );

  const renderStep6 = () => {
    if (isLoadingSample || state.sampleQuestions.length === 0) {
      return (
        <View style={styles.stepContainer}>
          <SafeAreaView style={styles.safeInner}>
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading questions...</Text>
            </View>
          </SafeAreaView>
        </View>
      );
    }

    if (!sampleQuestion) return null;

    const isHoren = sampleQuestion.section === 'Hören';
    const hasAnswer = Boolean(sampleSelectedAnswer);

    return (
      <View style={styles.stepContainer}>
        <SafeAreaView style={styles.safeInner}>
          <View style={styles.sampleHeader}>
            <View style={styles.sampleProgressTrack}>
              <View
                style={[
                  styles.sampleProgressFill,
                  { width: `${((sampleIndex + 1) / sampleTotalQuestions) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.sampleCounter}>
              Question {sampleIndex + 1} of {sampleTotalQuestions}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.sampleContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sampleTagRow}>
              <View style={[styles.sampleSectionTag, isHoren ? styles.horenTag : styles.lesenTag]}>
                {isHoren ? <Headphones color="#fff" size={12} /> : <BookOpenText color="#fff" size={12} />}
                <Text style={styles.sampleSectionTagText}>{sampleQuestion.section}</Text>
              </View>
              <View style={styles.sampleTeilTag}>
                <Text style={styles.sampleTeilTagText}>Teil {sampleQuestion.teil}</Text>
              </View>
            </View>

            {isHoren && sampleQuestion.audio_url ? (
              <AudioPlayer audioUrl={sampleQuestion.audio_url} />
            ) : null}

            {!isHoren && sampleQuestion.stimulus_text ? (
              <StimulusCard text={sampleQuestion.stimulus_text} type={sampleQuestion.stimulus_type} collapsible />
            ) : null}

            <Text style={styles.sampleQuestionText}>{sampleQuestion.question_text}</Text>

            <View style={styles.sampleOptionsWrap}>
              {sampleQuestion.options.map((option) => {
                const normalizedKey = option.key.toLowerCase();
                const isSelected = sampleSelectedAnswer === normalizedKey;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityLabel={option.text}
                    onPress={() => handleSampleAnswer(sampleQuestion.id, normalizedKey)}
                    style={[styles.sampleOption, isSelected ? styles.sampleOptionSelected : null]}
                    testID={`sample-option-${option.key}`}
                    disabled={hasAnswer}
                  >
                    <View style={[styles.sampleOptionLeading, isSelected ? styles.sampleOptionLeadingSelected : null]}>
                      <Text style={[styles.sampleOptionKey, isSelected ? styles.sampleOptionKeySelected : null]}>
                        {option.key.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.sampleOptionLabel, isSelected ? styles.sampleOptionLabelSelected : null]} numberOfLines={3}>
                      {option.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {hasAnswer ? (
            <View style={styles.footer}>
              <CTAButton
                label={sampleIndex === sampleTotalQuestions - 1 ? 'See results' : 'Next question'}
                onPress={advanceSample}
                testID="sample-next"
              />
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    );
  };

  const renderStep7 = () => {
    const questions = state.sampleQuestions;
    const answers = state.sampleAnswers;
    const score = state.sampleScore;
    const total = questions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;

    return (
      <View style={styles.stepContainer}>
        <SafeAreaView style={styles.safeInner}>
          {renderBackButton(() => {
            setSampleIndex(state.sampleQuestions.length - 1);
            setStep(6);
          })}
          <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.step7Heading}>Here's how you did!</Text>

            <View style={styles.step7ScoreCard}>
              <ScoreRing label="Score" score={pct} size={100} />
              <Text style={styles.step7ScoreLine}>{score} / {total} correct</Text>
              <Text style={styles.step7ReadinessLine}>
                Your {state.selectedLevel ?? 'B1'} readiness: {pct}%
              </Text>
            </View>

            {questions.map((question, index) => {
              const selectedAnswer = (answers[question.id] ?? '').toLowerCase();
              const isCorrect = selectedAnswer === question.correct_answer.toLowerCase();
              const selectedOption = question.options.find((o) => o.key.toLowerCase() === selectedAnswer);
              const correctOption = question.options.find((o) => o.key.toLowerCase() === question.correct_answer.toLowerCase());
              const isHoren = question.section === 'Hören';

              return (
                <View key={question.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewNumberBadge}>
                      <Text style={styles.reviewNumber}>{index + 1}</Text>
                    </View>
                    <View style={[styles.resultIcon, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
                      <Text style={styles.resultIconText}>{isCorrect ? '✓' : '✗'}</Text>
                    </View>
                  </View>

                  <Text style={styles.reviewQuestionText} numberOfLines={3}>{question.question_text}</Text>

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

                  <View style={styles.explanationCard}>
                    <Text style={styles.explanationTitle}>💡 Why is this the answer?</Text>
                    <Text style={styles.explanationText}>
                      {question.explanation_en ?? 'Explanation coming soon.'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <CTAButton
              label="Save your results and keep going"
              onPress={() => setStep(8)}
              testID="save-results-continue"
            />
            <Text style={styles.footerNote}>Your score will be lost if you don't save</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  };

  const openForgotModal = () => {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotError('');
    setShowForgotModal(true);
    Animated.timing(forgotModalFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const closeForgotModal = () => {
    Animated.timing(forgotModalFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowForgotModal(false);
    });
  };

  const handleForgotPassword = async () => {
    const trimmed = forgotEmail.trim();
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setForgotError('Please enter a valid email address');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      await resetPassword(trimmed);
      setForgotSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const renderStep8 = () => (
    <View style={styles.stepContainer}>
      <SafeAreaView style={styles.safeInner}>
        {renderBackButton(() => setStep(7))}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.stepHeading}>Save your progress</Text>
            <Text style={styles.stepSubheading}>Create a free account to track your score and streak</Text>

            <View style={styles.authCard}>
              <Pressable
                accessibilityLabel="Continue with Google"
                disabled={isAuthLoading}
                onPress={() => handleAuth('google')}
                style={styles.googleButton}
                testID="onboarding-google-auth"
              >
                <View style={styles.googleIconWrap}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or continue with email</Text>
                <View style={styles.divider} />
              </View>

              <View style={styles.authSegment}>
                <Pressable
                  onPress={() => setAuthMode('signUp')}
                  style={[styles.authSegmentBtn, authMode === 'signUp' ? styles.authSegmentBtnActive : null]}
                  testID="auth-signup-tab"
                >
                  <Text style={[styles.authSegmentText, authMode === 'signUp' ? styles.authSegmentTextActive : null]}>
                    Create Account
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAuthMode('signIn')}
                  style={[styles.authSegmentBtn, authMode === 'signIn' ? styles.authSegmentBtnActive : null]}
                  testID="auth-signin-tab"
                >
                  <Text style={[styles.authSegmentText, authMode === 'signIn' ? styles.authSegmentTextActive : null]}>
                    Sign In
                  </Text>
                </Pressable>
              </View>

              <View style={styles.inputShellRow}>
                <Mail color={Colors.textMuted} size={18} />
                <TextInput
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.inputFlex}
                  testID="onboarding-email-input"
                  textContentType="emailAddress"
                  value={email}
                />
              </View>

              <View style={styles.passwordFieldWrap}>
                <View style={styles.inputShellRow}>
                  <Lock color={Colors.textMuted} size={18} />
                  <TextInput
                    accessibilityLabel="Password"
                    autoCapitalize="none"
                    autoComplete={authMode === 'signUp' ? 'new-password' : 'current-password'}
                    onChangeText={setPassword}
                    placeholder="Password (8+ characters)"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    style={styles.inputFlex}
                    testID="onboarding-password-input"
                    textContentType={authMode === 'signUp' ? 'newPassword' : 'password'}
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={8}
                    onPress={() => setShowPassword((v) => !v)}
                    testID="onboarding-password-toggle"
                  >
                    {showPassword ? (
                      <EyeOff color={Colors.textMuted} size={20} />
                    ) : (
                      <Eye color={Colors.textMuted} size={20} />
                    )}
                  </Pressable>
                </View>
                {authMode === 'signIn' ? (
                  <Pressable
                    accessibilityLabel="Forgot password"
                    onPress={openForgotModal}
                    style={styles.forgotLink}
                    testID="onboarding-forgot-password"
                  >
                    <Text style={styles.forgotLinkText}>Forgot password?</Text>
                  </Pressable>
                ) : null}
              </View>

              <CTAButton
                label={authMode === 'signIn' ? 'Sign In' : 'Create Account'}
                onPress={() => handleAuth('email')}
                disabled={!canEmailAuth || isAuthLoading}
                testID="onboarding-email-auth"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );

  const renderStep9 = () => (
    <View style={styles.stepContainer}>
      <SafeAreaView style={styles.safeInner}>
        <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.step9Heading}>You're in! 🎉</Text>
          <Text style={styles.step9Subheading}>Start free, upgrade when you're ready</Text>

          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeader}>
              <View style={styles.comparisonCol}>
                <Text style={styles.comparisonColTitle}>Free</Text>
              </View>
              <View style={[styles.comparisonCol, styles.comparisonColPremium]}>
                <Text style={styles.comparisonColTitlePremium}>Premium</Text>
              </View>
            </View>

            {[
              { free: '10 questions/day', premium: 'Unlimited questions' },
              { free: 'A1, A2, B1 content', premium: 'All levels' },
              { free: 'Basic results', premium: 'Full explanations' },
              { free: '—', premium: 'Mock exams' },
              { free: '—', premium: 'Offline mode' },
              { free: '—', premium: 'Progress analytics' },
            ].map((row, idx) => (
              <View key={idx} style={styles.comparisonRow}>
                <View style={styles.comparisonCell}>
                  <Text style={styles.comparisonFreeText}>{row.free}</Text>
                </View>
                <View style={[styles.comparisonCell, styles.comparisonCellPremium]}>
                  <Text style={styles.comparisonPremiumText}>{row.premium}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <CTAButton
            label="Start free"
            onPress={() => router.replace('/')}
            testID="start-free-button"
          />
          <Pressable
            accessibilityLabel="Go premium"
            onPress={() => {
              Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!');
            }}
            style={styles.secondaryButton}
            testID="go-premium-button"
          >
            <Text style={styles.secondaryButtonText}>Go Premium</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );

  const handlePlayerNameConfirm = async (name: string) => {
    setShowPlayerNameModal(false);
    if (pendingUserId) {
      try {
        await updatePlayerName(pendingUserId, name);
        await refreshProfile();
      } catch (err) {
        console.log('Failed to save player name', err);
      }
    }
    setStep(9);
  };

  let content: React.ReactNode = null;
  switch (step) {
    case 1: content = renderStep1(); break;
    case 2: content = renderStep2(); break;
    case 3: content = renderStep3(); break;
    case 4: content = renderStep4(); break;
    case 5: content = renderStep5(); break;
    case 6: content = renderStep6(); break;
    case 7: content = renderStep7(); break;
    case 8: content = renderStep8(); break;
    case 9: content = renderStep9(); break;
    default: content = renderStep2(); break;
  }

  return (
    <>
      {content}
      <PlayerNameModal
        visible={showPlayerNameModal}
        onConfirm={handlePlayerNameConfirm}
      />
      <Modal visible={showForgotModal} transparent animationType="none" onRequestClose={closeForgotModal}>
        <Animated.View style={[styles.forgotModalOverlay, { opacity: forgotModalFade }]}>
          <Pressable style={styles.forgotModalBackdrop} onPress={closeForgotModal} />
          <View style={styles.forgotModalCard}>
            <View style={styles.forgotModalHeader}>
              <Text style={styles.forgotModalHeading}>Reset Password</Text>
              <Pressable onPress={closeForgotModal} hitSlop={8} testID="close-onboarding-forgot-modal">
                <X color={Colors.textMuted} size={22} />
              </Pressable>
            </View>

            {forgotSent ? (
              <View style={styles.forgotSentWrap}>
                <View style={styles.forgotSentIcon}>
                  <Mail color={Colors.accent} size={28} />
                </View>
                <Text style={styles.forgotSentTitle}>Check your inbox</Text>
                <Text style={styles.forgotSentBody}>
                  We sent a password reset link to{'\n'}
                  <Text style={styles.forgotSentEmail}>{forgotEmail.trim()}</Text>
                </Text>
                <Pressable style={styles.forgotDoneButton} onPress={closeForgotModal} testID="onboarding-forgot-done">
                  <Text style={styles.forgotDoneButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.forgotSubheading}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>
                <View style={styles.forgotInputShell}>
                  <Mail color={Colors.textMuted} size={18} />
                  <TextInput
                    accessibilityLabel="Reset email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }}
                    placeholder="Email"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.forgotInput}
                    testID="onboarding-forgot-email-input"
                    textContentType="emailAddress"
                    value={forgotEmail}
                  />
                </View>
                {forgotError ? <Text style={styles.forgotErrorText}>{forgotError}</Text> : null}
                <Pressable
                  disabled={forgotLoading}
                  onPress={handleForgotPassword}
                  style={[styles.forgotSendButton, forgotLoading ? styles.forgotButtonDisabled : null]}
                  testID="onboarding-forgot-send-button"
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={Colors.surface} />
                  ) : (
                    <Text style={styles.forgotSendButtonText}>Send Reset Link</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContent: {
    alignItems: 'center',
    gap: 12,
  },
  splashLogoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  splashBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splashBrand: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: colors.white,
    letterSpacing: -0.5,
  },
  splashTagline: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.65)',
  },
  stepContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeInner: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 120,
  },
  stepHeading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    color: Colors.primary,
    paddingTop: 8,
  },
  stepSubheading: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginTop: -8,
  },
  footer: {
    padding: 20,
    gap: 10,
    paddingBottom: 24,
  },
  footerNote: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
  accentButton: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accentButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800' as const,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  languageCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  languageFlag: {
    fontSize: 36,
  },
  languageCardTextWrap: {
    flex: 1,
    gap: 2,
  },
  languageCardTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  languageCardSub: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 10,
    right: 10,
  },
  comingSoonLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginTop: 8,
  },
  comingSoonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  comingSoonPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
  },
  comingSoonPillText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  levelCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  levelCardDisabled: {
    opacity: 0.55,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  levelBadgeText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  levelBadgeTextSelected: {
    color: '#fff',
  },
  levelBadgeDisabled: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeTextDisabled: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  levelCardTextWrap: {
    flex: 1,
    gap: 2,
  },
  levelCardTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  levelCardTitleSelected: {
    color: Colors.primary,
  },
  levelCardDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  levelCardTitleDisabled: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  levelCardDescDisabled: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceMuted,
  },
  lockPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  examRow: {
    flexDirection: 'row',
    gap: 12,
  },
  examCard: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  examCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  examIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examIcon: {
    fontSize: 24,
  },
  examCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  examCardTitleSelected: {
    color: Colors.primary,
  },
  notSureLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notSureText: {
    color: Colors.textMuted,
    fontWeight: '600' as const,
    fontSize: 15,
  },
  notSureTextActive: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  step5Content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 32,
  },
  step5Hero: {
    gap: 10,
  },
  step5Heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800' as const,
    color: '#fff',
  },
  step5Subheading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  step5Bullets: {
    gap: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulletText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  step5Footer: {
    gap: 12,
    alignItems: 'center',
  },
  step5Note: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  sampleHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  sampleProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ringTrack,
    overflow: 'hidden',
  },
  sampleProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  sampleCounter: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  sampleContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 120,
  },
  sampleTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sampleSectionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  horenTag: {
    backgroundColor: '#1565C0',
  },
  lesenTag: {
    backgroundColor: '#6A1B9A',
  },
  sampleSectionTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  sampleTeilTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: Colors.surfaceMuted,
  },
  sampleTeilTagText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  sampleQuestionText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  sampleOptionsWrap: {
    gap: 10,
  },
  sampleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sampleOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  sampleOptionLeading: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  sampleOptionLeadingSelected: {
    backgroundColor: Colors.primary,
  },
  sampleOptionKey: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.textMuted,
  },
  sampleOptionKeySelected: {
    color: '#fff',
  },
  sampleOptionLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  sampleOptionLabelSelected: {
    color: Colors.primary,
  },
  step7Heading: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
    paddingTop: 8,
  },
  step7ScoreCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  step7ScoreLine: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  step7ReadinessLine: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  explanationCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  authCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  authSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    padding: 4,
  },
  authSegmentBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authSegmentBtnActive: {
    backgroundColor: Colors.surface,
  },
  authSegmentText: {
    color: Colors.textMuted,
    fontWeight: '700' as const,
    fontSize: 15,
  },
  authSegmentTextActive: {
    color: Colors.primary,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontWeight: '700' as const,
  },
  googleButton: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  googleButtonText: {
    color: Colors.primary,
    fontWeight: '800' as const,
    fontSize: 16,
  },
  inputShellRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  passwordFieldWrap: {
    gap: 6,
  },
  forgotLink: {
    alignSelf: 'flex-end' as const,
    paddingVertical: 2,
  },
  forgotLinkText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  forgotModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,23,40,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  forgotModalBackdrop: { ...StyleSheet.absoluteFillObject },
  forgotModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 14,
    zIndex: 1,
  },
  forgotModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotModalHeading: { fontSize: 20, fontWeight: '800' as const, color: Colors.primary },
  forgotSubheading: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  forgotInputShell: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forgotInput: { flex: 1, fontSize: 15, color: Colors.text },
  forgotErrorText: { color: Colors.danger, fontSize: 13, fontWeight: '600' as const },
  forgotSendButton: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  forgotButtonDisabled: { opacity: 0.5 },
  forgotSendButtonText: { color: Colors.surface, fontWeight: '800' as const, fontSize: 16 },
  forgotSentWrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  forgotSentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotSentTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.primary },
  forgotSentBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' as const, lineHeight: 20 },
  forgotSentEmail: { fontWeight: '700' as const, color: Colors.primary },
  forgotDoneButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  forgotDoneButtonText: { color: '#fff', fontWeight: '800' as const, fontSize: 16 },
  step9Heading: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
    paddingTop: 16,
  },
  step9Subheading: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: -8,
  },
  comparisonCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
  },
  comparisonCol: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  comparisonColPremium: {
    backgroundColor: Colors.primary,
  },
  comparisonColTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  comparisonColTitlePremium: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
  },
  comparisonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  comparisonCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  comparisonCellPremium: {
    backgroundColor: 'rgba(16, 35, 63, 0.03)',
  },
  comparisonFreeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  comparisonPremiumText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  signInLink: {
    marginTop: 16,
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  signInLinkText: {
    fontSize: 14,
    color: colors.muted,
  },
  signInLinkBold: {
    fontWeight: '600' as const,
    color: colors.blue,
  },
});
