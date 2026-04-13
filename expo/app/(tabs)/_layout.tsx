import { Tabs } from 'expo-router';
import { FileText, Home, Layers, Zap } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily } from '@/theme';

const BANANI = {
  primary: '#2B70EF',
  primaryFg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  foreground: '#374151',
} as const;

function TabIcon({
  icon: Icon,
  label,
  focused,
}: {
  icon: typeof Home;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.navInner, focused && styles.navInnerActive]}>
      <Icon
        color={focused ? BANANI.primaryFg : BANANI.foreground}
        size={20}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.navLabel,
          { color: focused ? BANANI.primaryFg : BANANI.foreground },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          paddingHorizontal: 8,
          backgroundColor: BANANI.card,
          borderTopWidth: 1,
          borderTopColor: BANANI.border,
          ...Platform.select({
            ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.04, shadowRadius: 24 },
            android: { elevation: 8 },
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Home} label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stream"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Zap} label="Stream" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tests"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Layers} label="Sectional" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mock"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={FileText} label="Complete Test" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  navInner: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navInnerActive: {
    backgroundColor: BANANI.primary,
    ...Platform.select({
      ios: { shadowColor: 'rgba(43,112,239,0.22)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
  },
  navLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    textAlign: 'center',
  },
});
