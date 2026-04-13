import { Tabs } from 'expo-router';
import { FileText, Home, Layers, Zap } from 'lucide-react-native';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily } from '@/theme';

const B = {
  primary: '#2B70EF',
  primaryFg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  foreground: '#374151',
  muted: '#94A3B8',
} as const;

const TAB_CONFIG = [
  { name: 'index', label: 'Home', Icon: Home },
  { name: 'stream', label: 'Stream', Icon: Zap },
  { name: 'tests', label: 'Sectional', Icon: Layers },
  { name: 'mock', label: 'Complete Test', Icon: FileText },
] as const;

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TAB_CONFIG.map((tab, index) => {
        const focused = state.index === index;
        const { Icon, label } = tab;

        return (
          <Pressable
            key={tab.name}
            style={styles.tabItem}
            onPress={() => {
              const route = state.routes[index];
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <View style={[styles.tabInner, focused && styles.tabInnerActive]}>
              <Icon color={focused ? B.primaryFg : B.foreground} size={20} />
              <Text
                numberOfLines={1}
                style={[styles.tabLabel, { color: focused ? B.primaryFg : B.foreground }]}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stream" />
      <Tabs.Screen name="tests" />
      <Tabs.Screen name="mock" />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: B.card,
    borderTopWidth: 1,
    borderTopColor: B.border,
    paddingTop: 8,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.04, shadowRadius: 24 },
      android: { elevation: 8 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  tabInnerActive: {
    backgroundColor: B.primary,
    ...Platform.select({
      ios: { shadowColor: 'rgba(43,112,239,0.22)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
  },
  tabLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    textAlign: 'center',
  },
});
