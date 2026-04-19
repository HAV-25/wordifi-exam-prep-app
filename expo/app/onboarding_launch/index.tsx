/**
 * Onboarding Launch — Screen 00: Brand Video Splash
 * Plays wordifi.mp4 full-screen, then auto-navigates to app-intro.
 */
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';

export default function VideoSplashScreen() {
  const hasNavigated = useRef(false);

  function handlePlaybackUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    if (status.didJustFinish && !hasNavigated.current) {
      hasNavigated.current = true;
      router.replace('/onboarding_launch/app-intro');
    }
  }

  return (
    <View style={styles.root}>
      <Video
        source={require('../../assets/wordifi.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
});
