import { Bell, CheckCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import { colors, fontFamily, fontSize, radius, shadows, spacing } from '@/theme';
import type { UserNotification } from '@/types/database';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    void loadNotifications();
  }, [user?.id]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const { data } = await (supabase.from('user_notifications' as never) as any)
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifications((data ?? []) as UserNotification[]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (!user?.id) return;
    await (supabase.from('user_notifications' as never) as any)
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: true,
          headerRight: unreadCount > 0
            ? () => (
                <Pressable onPress={markAllRead} style={styles.markAllBtn} hitSlop={8}>
                  <CheckCheck color={colors.blue} size={18} />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Bell color={colors.muted} size={40} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => (
            <View style={[styles.row, !item.read_at && styles.rowUnread]}>
              {!item.read_at && <View style={styles.unreadDot} />}
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowBody2}>{item.body}</Text>
                <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  markAllText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: colors.blue,
  },
  list: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: 'rgba(43,112,239,0.04)',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  unreadDot: {
    marginTop: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2B70EF',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.md,
    color: '#0F1F3D',
  },
  rowBody2: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.sm,
    color: '#374151',
    lineHeight: 20,
  },
  rowTime: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
});
