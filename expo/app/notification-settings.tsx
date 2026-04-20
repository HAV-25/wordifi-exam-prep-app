/**
 * Notification Preferences screen
 *
 * Three sections: Channels · Categories · Delivery preferences.
 * Every control writes immediately to `notification_preferences` via
 * optimistic update + rollback on error. Matches Profile screen visual style.
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Bell, ChevronLeft, Minus, Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import {
  dateToTimeStr,
  fmtTime,
  timeStrToDate,
  useNotificationPreferences,
  type NotifPrefs,
} from '@/lib/notificationPreferences';

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.sectionCard}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PrefRow({
  label,
  subtitle,
  right,
  showDivider = true,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  subtitle?: string;
  right: React.ReactNode;
  showDivider?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const inner = (
    <View style={s.prefRow} accessibilityLabel={accessibilityLabel}>
      <View style={s.prefLeft}>
        <Text style={s.prefLabel}>{label}</Text>
        {subtitle ? <Text style={s.prefSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={s.prefRight}>{right}</View>
    </View>
  );
  return (
    <>
      {onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner}
      {showDivider && <View style={s.rowDivider} />}
    </>
  );
}

function Stepper({
  value,
  min,
  max,
  onDecrement,
  onIncrement,
}: {
  value: number;
  min: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={onDecrement}
        disabled={value <= min}
        style={[s.stepBtn, value <= min && s.stepBtnDisabled]}
        accessibilityLabel="Decrease"
        hitSlop={8}
      >
        <Minus size={16} color={value <= min ? Colors.textMuted : Colors.primary} />
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable
        onPress={onIncrement}
        disabled={value >= max}
        style={[s.stepBtn, value >= max && s.stepBtnDisabled]}
        accessibilityLabel="Increase"
        hitSlop={8}
      >
        <Plus size={16} color={value >= max ? Colors.textMuted : Colors.primary} />
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type TimeField = 'quiet_hours_start' | 'quiet_hours_end' | 'daily_reminder_time';

type PickerState = {
  visible: boolean;
  field: TimeField | null;
  date: Date;
};

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { prefs, loading, loadError, saveError, setSaveError, updateField } =
    useNotificationPreferences(user?.id);

  // Auto-dismiss save error banner after 4 s
  useEffect(() => {
    if (!saveError) return;
    const t = setTimeout(() => setSaveError(null), 4000);
    return () => clearTimeout(t);
  }, [saveError, setSaveError]);

  const [picker, setPicker] = useState<PickerState>({
    visible: false,
    field: null,
    date: new Date(),
  });

  function openPicker(field: TimeField) {
    if (!prefs) return;
    const raw =
      field === 'daily_reminder_time'
        ? (prefs.daily_reminder_time ?? '19:00:00')
        : prefs[field];
    setPicker({ visible: true, field, date: timeStrToDate(raw) });
  }

  function handlePickerChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      // Android: native dialog closes itself; commit immediately on 'set'
      if (_event.type === 'set' && date && picker.field) {
        void updateField(picker.field, dateToTimeStr(date));
      }
      setPicker((p) => ({ ...p, visible: false }));
    } else {
      // iOS spinner: live update local date but don't write until "Done"
      if (date) setPicker((p) => ({ ...p, date }));
    }
  }

  function confirmPicker() {
    if (picker.field) {
      void updateField(picker.field, dateToTimeStr(picker.date));
    }
    setPicker((p) => ({ ...p, visible: false }));
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (loadError || !prefs) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <Bell size={32} color={Colors.textMuted} style={{ marginBottom: 12 } as object} />
        <Text style={s.errorText}>{loadError ?? 'Could not load preferences.'}</Text>
        <Pressable style={s.retryBtn} onPress={() => router.back()}>
          <Text style={s.retryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const p = prefs;
  const allCategoriesOff =
    !p.category_practice && !p.category_progress && !p.category_monetisation;

  // Shorthand helpers
  const toggle = (field: keyof NotifPrefs) =>
    void updateField(field, !(p[field] as boolean));

  function makeSwitch(
    field: keyof NotifPrefs,
    label: string,
    disabled = false
  ) {
    return (
      <Switch
        value={Boolean(p[field])}
        onValueChange={disabled ? undefined : () => toggle(field)}
        disabled={disabled}
        trackColor={{ true: Colors.primary, false: Colors.border }}
        thumbColor={Colors.white}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: Boolean(p[field]), disabled }}
      />
    );
  }

  function timePill(field: TimeField, label: string) {
    const raw =
      field === 'daily_reminder_time' ? p.daily_reminder_time : p[field];
    return (
      <Pressable
        onPress={() => openPicker(field)}
        style={s.timePill}
        accessibilityLabel={`${label}, currently ${fmtTime(raw)}`}
        accessibilityRole="button"
      >
        <Text style={s.timePillText}>{fmtTime(raw)}</Text>
      </Pressable>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Brand header */}
      <AppHeader />

      {/* Save error banner */}
      {saveError ? (
        <View style={s.errorBanner}>
          <Text style={s.errorBannerText}>{saveError}</Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* ── Section 1: Channels ────────────────────────────────────────── */}
        <Section label="Channels">
          <PrefRow
            label="Push notifications"
            right={makeSwitch('push_enabled', 'Push notifications')}
            accessibilityLabel="Push notifications toggle"
          />
          <PrefRow
            label="Email"
            right={makeSwitch('email_enabled', 'Email notifications')}
            accessibilityLabel="Email notifications toggle"
          />
          <PrefRow
            label="In-app banners"
            right={makeSwitch('in_app_enabled', 'In-app banners')}
            showDivider={false}
            accessibilityLabel="In-app banners toggle"
          />
        </Section>

        {/* ── Section 2: Categories ──────────────────────────────────────── */}
        <Section label="Categories">
          <PrefRow
            label="Practice reminders"
            subtitle="Daily nudges and streak alerts"
            right={makeSwitch('category_practice', 'Practice reminders')}
            accessibilityLabel="Practice reminders toggle"
          />
          <PrefRow
            label="Progress updates"
            subtitle="Milestones and section completions"
            right={makeSwitch('category_progress', 'Progress updates')}
            accessibilityLabel="Progress updates toggle"
          />
          <PrefRow
            label="Offers & plans"
            subtitle="Trial reminders and special offers"
            right={makeSwitch('category_monetisation', 'Offers and plans')}
            accessibilityLabel="Offers and plans toggle"
          />
          <PrefRow
            label="Account & billing"
            subtitle="Required — trial, payment, and security messages"
            right={makeSwitch('category_transactional', 'Account and billing', true)}
            showDivider={false}
            accessibilityLabel="Account and billing — required, cannot be disabled"
          />
        </Section>

        {allCategoriesOff ? (
          <View style={s.inlineNotice}>
            <Text style={s.inlineNoticeText}>
              You'll only receive required account and billing messages.
            </Text>
          </View>
        ) : null}

        {/* ── Section 3: Delivery preferences ───────────────────────────── */}
        <Section label="Delivery">
          {p.category_practice ? (
            <PrefRow
              label="Daily reminder"
              right={timePill('daily_reminder_time', 'Daily reminder')}
              onPress={() => openPicker('daily_reminder_time')}
              accessibilityLabel={`Daily reminder time, ${fmtTime(p.daily_reminder_time)}`}
            />
          ) : null}

          <PrefRow
            label="Quiet hours"
            right={makeSwitch('quiet_hours_enabled', 'Quiet hours')}
            accessibilityLabel="Quiet hours toggle"
            showDivider={p.quiet_hours_enabled}
          />

          {p.quiet_hours_enabled ? (
            <>
              <PrefRow
                label="Start"
                right={timePill('quiet_hours_start', 'Quiet hours start')}
                onPress={() => openPicker('quiet_hours_start')}
                accessibilityLabel={`Quiet hours start, ${fmtTime(p.quiet_hours_start)}`}
              />
              <PrefRow
                label="End"
                right={timePill('quiet_hours_end', 'Quiet hours end')}
                onPress={() => openPicker('quiet_hours_end')}
                accessibilityLabel={`Quiet hours end, ${fmtTime(p.quiet_hours_end)}`}
              />
            </>
          ) : null}

          <PrefRow
            label="Max push per day"
            right={
              <Stepper
                value={p.max_push_per_day}
                min={1}
                max={10}
                onDecrement={() => void updateField('max_push_per_day', p.max_push_per_day - 1)}
                onIncrement={() => void updateField('max_push_per_day', p.max_push_per_day + 1)}
              />
            }
          />
          <PrefRow
            label="Timezone"
            right={<Text style={s.tzText}>{p.timezone}</Text>}
            subtitle="Detected automatically"
            showDivider={false}
            accessibilityLabel={`Timezone: ${p.timezone}, detected automatically`}
          />
        </Section>
      </ScrollView>

      {/* ── iOS time picker modal ─────────────────────────────────────────── */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={picker.visible}
          transparent
          animationType="slide"
          onRequestClose={() => setPicker((p) => ({ ...p, visible: false }))}
        >
          <Pressable
            style={s.pickerBackdrop}
            onPress={() => setPicker((p) => ({ ...p, visible: false }))}
          />
          <View style={[s.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.pickerHeader}>
              <Pressable
                onPress={() => setPicker((p) => ({ ...p, visible: false }))}
                hitSlop={8}
              >
                <Text style={s.pickerCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmPicker} hitSlop={8}>
                <Text style={s.pickerDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={picker.date}
              mode="time"
              display="spinner"
              onChange={handlePickerChange}
              textColor={Colors.textBody}
            />
          </View>
        </Modal>
      )}

      {/* Android: inline DateTimePicker (shows native dialog) */}
      {Platform.OS === 'android' && picker.visible && (
        <DateTimePicker
          value={picker.date}
          mode="time"
          display="default"
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_R = 20;
const CARD_MH = 24;
const CARD_MB = 24;
const CARD_PH = 20;
const CARD_PV = 24;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 8 },

  // Error states
  errorBanner: {
    backgroundColor: Colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  errorBannerText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: Colors.white,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  retryBtnText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: Colors.white,
  },

  // Section card (matches Profile screen)
  sectionCard: {
    marginHorizontal: CARD_MH,
    marginBottom: CARD_MB,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: CARD_R,
    paddingHorizontal: CARD_PH,
    paddingVertical: CARD_PV,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 1,
  },
  sectionLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 24,
  },

  // Pref rows
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  prefLeft: { flex: 1, gap: 3 },
  prefLabel: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 15,
    color: Colors.textBody,
  },
  prefSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  prefRight: { flexShrink: 0 },
  rowDivider: { height: 1, backgroundColor: Colors.border },

  // Time pill button
  timePill: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timePillText: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepValue: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: Colors.primary,
    minWidth: 24,
    textAlign: 'center',
  },

  // All-categories-off notice
  inlineNotice: {
    marginHorizontal: CARD_MH,
    marginTop: -16,
    marginBottom: CARD_MB,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  inlineNoticeText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },

  // Timezone read-only
  tzText: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
  },

  // iOS time picker sheet
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,31,61,0.4)',
  },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: '#374151',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  pickerCancel: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 16,
    color: Colors.textMuted,
    paddingVertical: 8,
  },
  pickerDone: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 16,
    color: Colors.primary,
    paddingVertical: 8,
  },
});
