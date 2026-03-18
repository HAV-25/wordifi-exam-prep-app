import { Flag, Send, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/colors';
import { submitQuestionReport } from '@/lib/streamHelpers';

type ReportModalProps = {
  visible: boolean;
  questionId: string;
  userId: string;
  onClose: () => void;
};

const REASONS = [
  { key: 'wrong_answer', label: 'Wrong answer marked as correct' },
  { key: 'bad_audio', label: 'Audio issue or missing' },
  { key: 'unclear_question', label: 'Question text is unclear' },
  { key: 'other', label: 'Other' },
];

export const ReportModal = React.memo(function ReportModal({
  visible,
  questionId,
  userId,
  onClose,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [detail, setDetail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    console.log('ReportModal: submitting report', { questionId, reason: selectedReason });
    const success = await submitQuestionReport({
      questionId,
      userId,
      reason: selectedReason,
      detail: detail.trim() || null,
    });
    setIsSubmitting(false);
    if (success) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedReason(null);
        setDetail('');
        onClose();
      }, 1500);
    }
  }, [selectedReason, detail, questionId, userId, onClose]);

  const handleClose = useCallback(() => {
    setSelectedReason(null);
    setDetail('');
    setSubmitted(false);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}
      >
        <Animated.View style={styles.sheet}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Flag color={Colors.danger} size={18} />
              <Text style={styles.title}>Report an issue</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} testID="report-close">
              <X color={Colors.textMuted} size={22} />
            </Pressable>
          </View>

          {submitted ? (
            <View style={styles.successWrap}>
              <Text style={styles.successEmoji}>✅</Text>
              <Text style={styles.successText}>Report submitted. Thank you!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>What's wrong with this question?</Text>
              <View style={styles.reasonList}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.key}
                    style={[
                      styles.reasonPill,
                      selectedReason === r.key && styles.reasonPillActive,
                    ]}
                    onPress={() => setSelectedReason(r.key)}
                    testID={`report-reason-${r.key}`}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        selectedReason === r.key && styles.reasonTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.detailInput}
                placeholder="Add details (optional)"
                placeholderTextColor={Colors.textMuted}
                value={detail}
                onChangeText={setDetail}
                multiline
                maxLength={500}
                testID="report-detail-input"
              />

              <Pressable
                style={[
                  styles.submitButton,
                  !selectedReason && styles.submitDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                testID="report-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Send color="#fff" size={16} />
                    <Text style={styles.submitText}>Submit Report</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  reasonList: {
    gap: 8,
  },
  reasonPill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonPillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  reasonTextActive: {
    color: Colors.primary,
  },
  detailInput: {
    minHeight: 72,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  successEmoji: {
    fontSize: 40,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
});
