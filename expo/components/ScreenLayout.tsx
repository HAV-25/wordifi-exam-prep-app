/**
 * ScreenLayout — Reusable layout that guarantees primary action
 * buttons stay visible above the fold (above the native tab bar /
 * home indicator).
 *
 * Two zones:
 *   1. Scrollable content area (children)
 *   2. Fixed footer pinned above the fold (footer prop)
 *
 * Usage:
 *   <ScreenLayout footer={<CTAButton />}>
 *     {scrollableContent}
 *   </ScreenLayout>
 */
import React from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ScreenLayoutProps {
  children: React.ReactNode;
  /** Buttons / actions pinned above the fold */
  footer?: React.ReactNode;
  /** Whether the content area scrolls (default true) */
  scrollable?: boolean;
  /** Root background colour (default '#F8FAFF') */
  backgroundColor?: string;
  /** Extra style applied to the ScrollView contentContainer */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra style applied to the root View */
  style?: StyleProp<ViewStyle>;
}

export function ScreenLayout({
  children,
  footer,
  scrollable = true,
  backgroundColor = '#F8FAFF',
  contentContainerStyle,
  style,
}: ScreenLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[{ flex: 1, backgroundColor }, style]}>
      {/* ── Scrollable content zone ─────────────────────────────────── */}
      {scrollable ? (
        <ScrollView
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingBottom: footer ? 0 : insets.bottom + 16,
            },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
      )}

      {/* ── Fixed footer — always above fold ────────────────────────── */}
      {footer ? (
        <View
          style={{
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            backgroundColor,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
