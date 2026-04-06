import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { colors } from '@/theme';
import Colors from '@/constants/colors';
import { upsertOnboardingProfile } from '@/lib/profileHelpers';
import { useAuth } from '@/providers/AuthProvider';
import type { ExamType, Level } from '@/types/database';

const LEVELS: { id: Level; label: string; subtitle: string }[] = [
  { id: 'A1', label: 'A1 · Beginner', subtitle: 'First step into German' },
  { id: 'A2', label: 'A2 · Elementary', subtitle: 'Everyday basics' },
  { id: 'B1', label: 'B1 · Intermediate', subtitle: 'Most important for visas & residency' },
];

const EXAM_TYPES: { id: ExamType; label: string }[] = [
  { id: 'GOETHE', label: 'Goethe-Institut' },
  { id: 'TELC', label: 'TELC' },
];

export default function ProfileSetupScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const [level, setLevel] = useState<Level | null>((profile?.target_level as Level) ?? null);
  const [examType, setExamType] = useState<ExamType | null>((profile?.exam_type as ExamType) ?? null);
  const [examDate, setExamDate] = useState<Date | null>(
    profile?.exam_date ? new Date(profile.exam_date) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = Boolean(level && examType);

  const handleSave = async () => {
    if (!user?.id || !level || !examType || saving) return;
    setSaving(true);
    try {
      await upsertOnboardingProfile(user.id, {
        targetLevel: level,
        examType,
        examDate: examDate ? examDate.toISOString().split('T')[0]! : null,
      });
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
      router.back();
    } catch (err) {
      console.log('ProfileSetupScreen save error', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Level section */}
        <Text style={styles.sectionLabel}>TARGET LEVEL</Text>
        <View style={styles.optionGroup}>
          {LEVELS.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => setLevel(l.id)}
              style={[styles.option, level === l.id && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ checked: level === l.id }}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, level === l.id && styles.optionLabelSelected]}>
                  {l.label}
                </Text>
                <Text style={styles.optionSub}>{l.subtitle}</Text>
              </View>
              {level === l.id && (
                <View style={styles.checkCircle}>
                  <Check size={14} color={Colors.white} />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Exam type section */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>EXAM TYPE</Text>
        <View style={styles.optionGroup}>
          {EXAM_TYPES.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => setExamType(e.id)}
              style={[styles.option, examType === e.id && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ checked: examType === e.id }}
            >
              <Text style={[styles.optionLabel, examType === e.id && styles.optionLabelSelected]}>
                {e.label}
              </Text>
              {examType === e.id && (
                <View style={styles.checkCircle}>
                  <Check size={14} color={Colors.white} />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Exam date section */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>EXAM DATE (OPTIONAL)</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={styles.dateRow}
          accessibilityRole="button"
          accessibilityLabel="Select exam date"
        >
          <Text style={examDate ? styles.dateValue : styles.datePlaceholder}>
            {examDate
              ? examDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Tap to set a date'}
          </Text>
          {examDate && (
            <Pressable
              onPress={() => setExamDate(null)}
              style={styles.clearDate}
              accessibilityLabel="Clear exam date"
            >
              <Text style={styles.clearDateText}>Clear</Text>
            </Pressable>
          )}
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={examDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setExamDate(date);
            }}
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 24,
  },
  sectionLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  optionGroup: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0A`,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: Colors.primaryDeep,
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionSub: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dateValue: {
    flex: 1,
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: Colors.primaryDeep,
  },
  datePlaceholder: {
    flex: 1,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.textMuted,
  },
  clearDate: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearDateText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: Colors.accent,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
