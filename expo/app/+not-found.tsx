import { Link, Stack } from 'expo-router';
import { Compass } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Compass color={Colors.primary} size={28} />
        </View>
        <Text style={styles.title}>That page isn&apos;t here.</Text>
        <Text style={styles.description}>Let&apos;s get you back to practice.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
    backgroundColor: Colors.background,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  description: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  link: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: Colors.primary,
  },
  linkText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '800',
  },
});
