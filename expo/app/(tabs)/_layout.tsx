import { Tabs } from 'expo-router';
import { Home, Puzzle, Trophy, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

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
  { name: 'index',  label: 'Home',          Icon: Home },
  { name: 'stream', label: 'Stream',        Icon: Zap },
  { name: 'tests',  label: 'Sectional',     Icon: Puzzle },
  { name: 'mock',   label: 'Complete Test',  Icon: Trophy },
] as const;

const TAB_COUNT = TAB_CONFIG.length;
const ANIM_DURATION = 300;

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const activeIndex = state.index;

  // ── Sliding indicator ──────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const tabWidthRef = useRef(0);
  const tabBarWidthRef = useRef(0);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeIndex,
      duration: ANIM_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slideAnim]);

  const handleTabBarLayout = useCallback((e: LayoutChangeEvent) => {
    const barWidth = e.nativeEvent.layout.width;
    tabBarWidthRef.current = barWidth;
    tabWidthRef.current = (barWidth - 16) / TAB_COUNT; // 8px padding each side
  }, []);

  // Indicator translateX derived from animated index
  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: TAB_CONFIG.map((_, i) => i),
    outputRange: TAB_CONFIG.map((_, i) => i * (tabWidthRef.current || 90)),
  });

  // ── Per-tab animations ─────────────────────────────────────────────────────
  const pressAnims = useRef(TAB_CONFIG.map(() => new Animated.Value(1))).current;
  const iconScaleAnims = useRef(TAB_CONFIG.map((_, i) => new Animated.Value(i === activeIndex ? 1.08 : 1))).current;
  const colorAnims = useRef(TAB_CONFIG.map((_, i) => new Animated.Value(i === activeIndex ? 1 : 0))).current;

  useEffect(() => {
    TAB_CONFIG.forEach((_, i) => {
      Animated.parallel([
        Animated.timing(iconScaleAnims[i], {
          toValue: i === activeIndex ? 1.08 : 1,
          duration: ANIM_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(colorAnims[i], {
          toValue: i === activeIndex ? 1 : 0,
          duration: ANIM_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false, // color interpolation needs JS driver
        }),
      ]).start();
    });
  }, [activeIndex, iconScaleAnims, colorAnims]);

  const handlePressIn = useCallback((index: number) => {
    Animated.timing(pressAnims[index], {
      toValue: 0.92,
      duration: 80,
      useNativeDriver: true,
    }).start();
  }, [pressAnims]);

  const handlePressOut = useCallback((index: number) => {
    Animated.spring(pressAnims[index], {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [pressAnims]);

  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={handleTabBarLayout}
    >
      {/* Sliding active indicator */}
      <Animated.View
        style={[
          styles.activeIndicator,
          {
            width: `${100 / TAB_COUNT}%`,
            transform: [{ translateX: indicatorTranslateX }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.activeIndicatorPill} />
      </Animated.View>

      {/* Tab items */}
      {TAB_CONFIG.map((tab, index) => {
        const focused = activeIndex === index;
        const { Icon, label } = tab;

        const iconColor = colorAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [B.foreground, B.primaryFg],
        });

        const labelColor = colorAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [B.foreground, B.primaryFg],
        });

        return (
          <Pressable
            key={tab.name}
            style={styles.tabItem}
            onPressIn={() => handlePressIn(index)}
            onPressOut={() => handlePressOut(index)}
            onPress={() => {
              const route = state.routes[index];
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            android_ripple={{ color: 'rgba(43,112,239,0.08)', borderless: true }}
          >
            <Animated.View
              style={[
                styles.tabInner,
                {
                  transform: [
                    { scale: Animated.multiply(pressAnims[index], iconScaleAnims[index]) },
                  ],
                },
              ]}
            >
              <Animated.View>
                <Icon color={focused ? B.primaryFg : B.foreground} size={20} />
              </Animated.View>
              <Animated.Text
                numberOfLines={1}
                style={[styles.tabLabel, { color: labelColor }]}
              >
                {label}
              </Animated.Text>
            </Animated.View>
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
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0F1F3D',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.04,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    height: '100%',
    zIndex: 0,
  },
  activeIndicatorPill: {
    flex: 1,
    marginBottom: 8, // Don't fill into safe-area padding
    backgroundColor: B.primary,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(43,112,239,0.22)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
  tabInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 20,
  },
  tabLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    textAlign: 'center',
  },
});
