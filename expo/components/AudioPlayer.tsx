import { Audio, type AVPlaybackStatus } from 'expo-av';
import { AlertCircle, Gauge, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { fontFamily } from '@/theme';

// ─── Banani design tokens ────────────────────────────────────────────────────
const B = {
  primary: '#2B70EF',
  primaryFg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  foreground: '#374151',
  muted: '#94A3B8',
} as const;

const WAVEFORM_BAR_COUNT = 25;
const MAX_REPLAYS = 3;

const WAVEFORM_SEED = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => {
  const x = i / WAVEFORM_BAR_COUNT;
  const base = 0.25 + 0.55 * Math.sin(x * Math.PI);
  const noise = 0.15 * Math.sin(x * 17.3 + 2.7) + 0.1 * Math.cos(x * 31.1 + 1.2);
  return Math.max(0.15, Math.min(1, base + noise));
});

type AudioPlayerProps = {
  audioUrl: string;
  onFirstPlay?: () => void;
  onPlaybackComplete?: () => void;
};

export function AudioPlayer({ audioUrl, onFirstPlay, onPlaybackComplete }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [positionMillis, setPositionMillis] = useState<number>(0);
  const [durationMillis, setDurationMillis] = useState<number>(1);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [replayCount, setReplayCount] = useState<number>(0);
  const [waveformWidth, setWaveformWidth] = useState<number>(0);
  const hasPlayedRef = useRef<boolean>(false);
  const audioModeSetRef = useRef<boolean>(false);

  const barAnims = useRef<Animated.Value[]>(
    WAVEFORM_SEED.map(() => new Animated.Value(0.4))
  ).current;

  const playButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying) {
      const animations = barAnims.map((anim, i) => {
        const baseHeight = WAVEFORM_SEED[i] ?? 0.5;
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: baseHeight, duration: 300 + (i % 5) * 80, useNativeDriver: true }),
            Animated.timing(anim, { toValue: baseHeight * 0.35, duration: 250 + (i % 7) * 60, useNativeDriver: true }),
          ])
        );
      });
      animations.forEach((a) => a.start());
      return () => animations.forEach((a) => a.stop());
    } else {
      barAnims.forEach((anim, i) => {
        Animated.timing(anim, { toValue: (WAVEFORM_SEED[i] ?? 0.5) * 0.4, duration: 300, useNativeDriver: true }).start();
      });
    }
  }, [isPlaying, barAnims]);

  useEffect(() => {
    let isMounted = true;

    async function prepareSound() {
      setIsBuffering(true);
      setError(null);
      setIsLoaded(false);
      setIsFinished(false);
      setPositionMillis(0);
      setDurationMillis(1);
      setReplayCount(0);
      setPlaybackSpeed(1);
      hasPlayedRef.current = false;

      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }

      try {
        if (!audioModeSetRef.current) {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
          audioModeSetRef.current = true;
        }

        const encodedUrl = encodeURI(audioUrl);
        const nextSound = new Audio.Sound();
        nextSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!isMounted) return;
          if (!status.isLoaded) {
            if (status.error) setError('Audio nicht verfügbar');
            return;
          }
          setPositionMillis(status.positionMillis ?? 0);
          setDurationMillis(status.durationMillis ?? 1);
          setIsPlaying(status.isPlaying);
          setIsBuffering(status.isBuffering ?? false);
          if (status.didJustFinish) {
            setIsFinished(true);
            setIsPlaying(false);
            onPlaybackComplete?.();
          }
        });

        await nextSound.loadAsync({ uri: encodedUrl }, { shouldPlay: false });
        if (!isMounted) { await nextSound.unloadAsync(); return; }
        soundRef.current = nextSound;
        setIsLoaded(true);
        setIsBuffering(false);
      } catch {
        if (isMounted) { setError('Audio nicht verfügbar'); setIsBuffering(false); }
      }
    }

    void prepareSound();
    return () => {
      isMounted = false;
      const activeSound = soundRef.current;
      soundRef.current = null;
      if (activeSound) void activeSound.unloadAsync().catch(() => {});
    };
  }, [audioUrl, reloadKey]);

  const progress = useMemo<number>(() => {
    if (!durationMillis) return 0;
    return Math.min(positionMillis / durationMillis, 1);
  }, [durationMillis, positionMillis]);

  const formattedTime = useMemo(() => {
    const fmt = (s: number) => {
      if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    const pos = Math.floor(positionMillis / 1000);
    const dur = durationMillis > 1 ? Math.floor(durationMillis / 1000) : 0;
    return `${fmt(pos)} / ${fmt(dur)}`;
  }, [positionMillis, durationMillis]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const animatePlayButton = useCallback(() => {
    Animated.sequence([
      Animated.timing(playButtonScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(playButtonScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [playButtonScale]);

  const handlePlayPause = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    triggerHaptic();
    animatePlayButton();
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        if (isFinished) { await soundRef.current.setPositionAsync(0); setIsFinished(false); }
        await soundRef.current.playAsync();
        if (!hasPlayedRef.current && onFirstPlay) { hasPlayedRef.current = true; onFirstPlay(); }
      }
    } catch { setError('Audio nicht verfügbar'); }
  }, [isLoaded, isFinished, onFirstPlay, triggerHaptic, animatePlayButton]);

  const handleReplay = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    triggerHaptic();
    animatePlayButton();
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      await soundRef.current.setPositionAsync(0);
      setIsFinished(false);
      setReplayCount((prev) => prev + 1);
      await soundRef.current.playAsync();
      if (!hasPlayedRef.current && onFirstPlay) { hasPlayedRef.current = true; onFirstPlay(); }
    } catch {}
  }, [isLoaded, onFirstPlay, triggerHaptic, animatePlayButton]);

  const handleRetry = useCallback(() => { setReloadKey((v) => v + 1); }, []);

  const handleSpeedToggle = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    triggerHaptic();
    const newSpeed = playbackSpeed === 1 ? 0.75 : 1;
    setPlaybackSpeed(newSpeed);
    try { await soundRef.current.setRateAsync(newSpeed, true); } catch {}
  }, [isLoaded, playbackSpeed, triggerHaptic]);

  const handleWaveformPress = useCallback(
    async (locationX: number) => {
      if (!soundRef.current || !isLoaded || !waveformWidth || waveformWidth <= 0) return;
      triggerHaptic();
      const ratio = Math.max(0, Math.min(1, locationX / waveformWidth));
      const seekTo = Math.floor(ratio * durationMillis);
      try {
        await soundRef.current.setPositionAsync(seekTo);
        if (isFinished) { setIsFinished(false); await soundRef.current.playAsync(); }
      } catch {}
    },
    [isLoaded, waveformWidth, durationMillis, isFinished, triggerHaptic]
  );

  const onWaveformLayout = useCallback((e: LayoutChangeEvent) => {
    setWaveformWidth(e.nativeEvent.layout.width);
  }, []);

  const replayLabel = useMemo(() => `${Math.min(replayCount, MAX_REPLAYS)}/${MAX_REPLAYS}`, [replayCount]);
  const replayLimitReached = replayCount >= MAX_REPLAYS;
  const activeBarIndex = Math.floor(progress * WAVEFORM_BAR_COUNT);

  if (error) {
    return (
      <View style={s.card} testID="audio-player-error">
        <View style={s.errorRow}>
          <AlertCircle color="#EF4444" size={20} />
          <Text style={s.errorText}>Audio nicht verfügbar</Text>
        </View>
        <Pressable onPress={handleRetry} style={s.retryBtn} testID="retry-audio-button">
          <RotateCcw color={B.primary} size={16} />
          <Text style={s.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const getPlayIcon = () => {
    if (isBuffering) return <ActivityIndicator color={B.primaryFg} size="small" />;
    if (isFinished) return <RotateCcw color={B.primaryFg} size={24} />;
    if (isPlaying) return <Pause color={B.primaryFg} size={24} />;
    return <Play color={B.primaryFg} size={24} style={{ marginLeft: 2 }} />;
  };

  return (
    <View style={s.card} testID="audio-player">
      {/* Player main: play button + waveform */}
      <View style={s.playerMain}>
        <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
          <Pressable
            accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
            onPress={isFinished ? handleReplay : handlePlayPause}
            style={s.playBtn}
            testID="play-audio-button"
            disabled={isBuffering}
          >
            {getPlayIcon()}
          </Pressable>
        </Animated.View>

        <View style={s.waveformWrap}>
          <Pressable
            style={s.waveformTouchArea}
            onPress={(e) => void handleWaveformPress(e.nativeEvent.locationX)}
            onLayout={onWaveformLayout}
            testID="waveform-scrub"
          >
            <View style={s.waveform}>
              {WAVEFORM_SEED.map((height, i) => {
                const isPast = i < activeBarIndex;
                const isCurrent = i === activeBarIndex;
                const barColor = isPast || isCurrent ? B.primary : B.border;
                return (
                  <Animated.View
                    key={i}
                    style={[
                      s.waveBar,
                      {
                        backgroundColor: barColor,
                        height: `${height * 100}%`,
                        transform: [{ scaleY: barAnims[i] ?? new Animated.Value(0.4) }],
                      },
                    ]}
                  />
                );
              })}
            </View>
          </Pressable>
          <Text style={s.timestamp}>{formattedTime}</Text>
        </View>
      </View>

      {/* Controls row */}
      <View style={s.playerControls}>
        <Pressable onPress={handleSpeedToggle} style={s.controlPill} disabled={!isLoaded} testID="speed-toggle-button">
          <Gauge color={B.foreground} size={16} />
          <Text style={s.controlPillText}>{playbackSpeed === 1 ? '1x' : '0.75x'}</Text>
        </Pressable>

        <View style={s.controlPill}>
          <RotateCcw color={B.foreground} size={16} />
          <Text style={s.controlPillText}>Replay: {replayLabel}</Text>
        </View>

        {isLoaded ? (
          <Pressable onPress={handleReplay} style={s.controlPillIcon} testID="replay-audio-button">
            <RefreshCw color={B.foreground} size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: B.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: B.border,
    ...Platform.select({
      ios: { shadowColor: '#0F1F3D', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.04, shadowRadius: 32 },
      android: { elevation: 3 },
    }),
  },
  playerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: B.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(43,112,239,0.25)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
  },
  waveformWrap: {
    flex: 1,
    gap: 8,
  },
  waveformTouchArea: {
    height: 32,
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
    minWidth: 2,
  },
  timestamp: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: B.muted,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,31,61,0.04)',
    borderRadius: 999,
  },
  controlPillText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: B.foreground,
  },
  controlPillIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,31,61,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#EF4444',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(43,112,239,0.08)',
    marginTop: 12,
  },
  retryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: B.primary,
  },
});
