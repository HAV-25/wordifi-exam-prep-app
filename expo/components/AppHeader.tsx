import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AvatarImage } from './AvatarImage';
import { WordifiLogo } from './WordifiLogo';
import { useAuth } from '@/providers/AuthProvider';

interface AppHeaderProps {
  /** Element rendered in the right slot — must fit within 44×44. */
  rightElement?: React.ReactNode;
  /** Override background color. Defaults to '#F8FAFF'. */
  bgColor?: string;
}

export function AppHeader({ rightElement, bgColor }: AppHeaderProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const initial = profile?.player_name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <View style={[styles.row, bgColor != null ? { backgroundColor: bgColor } : null]}>
      <Pressable
        style={styles.avatarBtn}
        onPress={() => router.push('/(tabs)/profile' as never)}
        hitSlop={8}
        accessibilityLabel="Profile"
        testID="app-header-avatar"
      >
        <AvatarImage
          uri={profile?.avatar_url}
          initial={initial}
          size={44}
          bgColor="rgba(43,112,239,0.12)"
          textColor="#2B70EF"
          fontSize={16}
        />
      </Pressable>

      <View style={styles.logoWrap}>
        <WordifiLogo variant="blue" height={28} />
      </View>

      <View style={styles.rightSlot}>
        {rightElement ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 14,
    backgroundColor: '#F8FAFF',
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#0F1F3D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  logoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
