import { Audio, type AVPlaybackStatus } from 'expo-av';
import { AlertCircle, Pause, Play, RotateCcw, Gauge } from 'lucide-react-native';
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

import Colors from '@/constants/colors';
import { colors } from '@/theme';

const WAVEFORM_BAR_COUNT = 32;
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
            Animated.timing(anim, {
              toValue: baseHeight,
              duration: 300 + (i % 5) * 80,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: baseHeight * 0.35,
              duration: 250 + (i % 7) * 60,
              useNativeDriver: true,
            }),
          ])
        );
      });
      animations.forEach((a) => a.start());
      return () => animations.forEach((a) => a.stop());
    } else {
      barAnims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: (WAVEFORM_SEED[i] ?? 0.5) * 0.4,
          duration: 300,
          useNativeDriver: true,
        }).start();
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

      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log('AudioPlayer unload previous error', e);
        }
        soundRef.current = null;
      }

      try {
        if (!audioModeSetRef.current) {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
          audioModeSetRef.current = true;
          console.log('AudioPlayer: audio mode set successfully');
        }

        const encodedUrl = encodeURI(audioUrl);
        console.log('AudioPlayer: loading audio from', encodedUrl);

        const nextSound = new Audio.Sound();
        nextSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!isMounted) return;
          if (!status.isLoaded) {
            if (status.error) {
              console.log('AudioPlayer playback error', status.error);
              setError('Audio nicht verfügbar');
            }
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

        await nextSound.loadAsync(
          { uri: encodedUrl },
          { shouldPlay: false }
        );

        if (!isMounted) {
          await nextSound.unloadAsync();
          return;
        }
        soundRef.current = nextSound;
        setIsLoaded(true);
        setIsBuffering(false);
        console.log('AudioPlayer: audio loaded successfully');
      } catch (loadError) {
        console.log('AudioPlayer load error', loadError);
        if (isMounted) {
          setError('Audio nicht verfügbar');
          setIsBuffering(false);
        }
      }
    }

    void prepareSound();

    return () => {
      isMounted = false;
      const activeSound = soundRef.current;
      soundRef.current = null;
      if (activeSound) {
        void activeSound.unloadAsync().catch((e) =>
          console.log('AudioPlayer cleanup unload error', e)
        );
      }
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
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
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
      if (!status.isLoaded) {
        console.log('AudioPlayer: sound not loaded when trying to play/pause');
        return;
      }
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        if (isFinished) {
          await soundRef.current.setPositionAsync(0);
          setIsFinished(false);
        }
        await soundRef.current.playAsync();
        if (!hasPlayedRef.current && onFirstPlay) {
          hasPlayedRef.current = true;
          onFirstPlay();
        }
      }
    } catch (e) {
      console.log('AudioPlayer playPause error', e);
      setError('Audio nicht verfügbar');
    }
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
      if (!hasPlayedRef.current && onFirstPlay) {
        hasPlayedRef.current = true;
        onFirstPlay();
      }
    } catch (e) {
      console.log('AudioPlayer replay error', e);
    }
  }, [isLoaded, onFirstPlay, triggerHaptic, animatePlayButton]);

  const handleRetry = useCallback(() => {
    console.log('AudioPlayer: retrying load');
    setReloadKey((v) => v + 1);
  }, []);

  const handleSpeedToggle = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    triggerHaptic();
    const newSpeed = playbackSpeed === 1 ? 0.75 : 1;
    setPlaybackSpeed(newSpeed);
    try {
      await soundRef.current.setRateAsync(newSpeed, true);
      console.log('AudioPlayer: speed set to', newSpeed);
    } catch (e) {
      console.log('AudioPlayer setRate error', e);
    }
  }, [isLoaded, playbackSpeed, triggerHaptic]);

  const handleWaveformPress = useCallback(
    async (locationX: number) => {
      if (!soundRef.current || !isLoaded || !waveformWidth || waveformWidth <= 0) return;
      triggerHaptic();
      const ratio = Math.max(0, Math.min(1, locationX / waveformWidth));
      const seekTo = Math.floor(ratio * durationMillis);
      console.log('AudioPlayer: scrub to', seekTo, 'ms (', Math.round(ratio * 100), '%)');
      try {
        await soundRef.current.setPositionAsync(seekTo);
        if (isFinished) {
          setIsFinished(false);
          await soundRef.current.playAsync();
        }
      } catch (e) {
        console.log('AudioPlayer scrub error', e);
      }
    },
    [isLoaded, waveformWidth, durationMillis, isFinished, triggerHaptic]
  );

  const onWaveformLayout = useCallback((e: LayoutChangeEvent) => {
    setWaveformWidth(e.nativeEvent.layout.width);
  }, []);

  const replayLabel = useMemo(() => {
    const used = Math.min(replayCount, MAX_REPLAYS);
    return `${used}/${MAX_REPLAYS}`;
  }, [replayCount]);

  const replayLimitReached = replayCount >= MAX_REPLAYS;

  if (error) {
    return (
      <View style={styles.card} testID="audio-player-error">
        <View style={styles.errorRow}>
          <AlertCircle color="#FF6B6B" size={20} />
          <Text style={styles.error}>Audio nicht verfügbar</Text>
        </View>
        <Pressable
          accessibilityLabel="Retry audio"
          onPress={handleRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
          testID="retry-audio-button"
        >
          <RotateCcw color={Colors.primary} size={16} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const getPlayIcon = () => {
    if (isBuffering) return <ActivityIndicator color={colors.white} size="small" />;
    if (isFinished) return <RotateCcw color={colors.white} size={20} />;
    if (isPlaying) return <Pause color={colors.white} size={20} />;
    return <Play color={colors.white} size={20} />;
  };

  const getPlayLabel = () => {
    if (isBuffering) return 'Loading audio';
    if (isFinished) return 'Replay audio';
    if (isPlaying) return 'Pause audio';
    return 'Play audio';
  };

  const activeBarIndex = Math.floor(progress * WAVEFORM_BAR_COUNT);

  return (
    <View style={styles.card} testID="audio-player">
      <View style={styles.topRow}>
        <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
          <Pressable
            accessibilityLabel={getPlayLabel()}
            onPress={isFinished ? handleReplay : handlePlayPause}
            style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}
            testID="play-audio-button"
            disabled={isBuffering}
          >
            {getPlayIcon()}
          </Pressable>
        </Animated.View>

        <View style={styles.centerColumn}>
          <Pressable
            style={styles.waveformTouchArea}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              void handleWaveformPress(x);
            }}
            onLayout={onWaveformLayout}
            testID="waveform-scrub"
            accessibilityLabel="Scrub audio position"
          >
            <View style={styles.waveformContainer}>
              {WAVEFORM_SEED.map((height, i) => {
                const isPast = i < activeBarIndex;
                const isCurrent = i === activeBarIndex;
                const barColor = isPast || isCurrent
                  ? colors.teal
                  : 'rgba(255,255,255,0.22)';

                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        backgroundColor: barColor,
                        height: `${height * 100}%`,
                        transform: [{ scaleY: barAnims[i] ?? new Animated.Value(0.4) }],
                      },
                      isCurrent && isPlaying && styles.waveformBarActive,
                    ]}
                  />
                );
              })}
            </View>
          </Pressable>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formattedTime}</Text>
            {playbackSpeed !== 1 ? (
              <Text style={styles.speedIndicator}>{playbackSpeed}x</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Pressable
          onPress={handleSpeedToggle}
          style={({ pressed }) => [styles.speedButton, pressed && styles.speedPressed]}
          testID="speed-toggle-button"
          accessibilityLabel={`Playback speed ${playbackSpeed}x`}
          disabled={!isLoaded}
        >
          <Gauge color={playbackSpeed === 0.75 ? colors.teal : 'rgba(255,255,255,0.5)'} size={14} />
          <Text
            style={[
              styles.speedText,
              playbackSpeed === 0.75 && styles.speedTextActive,
            ]}
          >
            {playbackSpeed === 1 ? '1x' : '0.75x'}
          </Text>
        </Pressable>

        <View style={styles.replayBadge}>
          <RotateCcw
            color={replayLimitReached ? colors.amber : 'rgba(255,255,255,0.5)'}
            size={12}
          />
          <Text
            style={[
              styles.replayText,
              replayLimitReached && styles.replayTextLimit,
            ]}
          >
            Replay: {replayLabel}
          </Text>
        </View>

        {isLoaded && (
          <Pressable
            accessibilityLabel="Replay audio"
            onPress={handleReplay}
            style={({ pressed }) => [styles.replayButton, pressed && styles.replayPressed]}
            testID="replay-audio-button"
          >
            <RotateCcw color={colors.teal} size={14} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: colors.navy,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  playPressed: {
    opacity: 0.85,
  },
  centerColumn: {
    flex: 1,
    gap: 6,
  },
  waveformTouchArea: {
    height: 44,
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    gap: 2,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  waveformBarActive: {
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500' as const,
  },
  speedIndicator: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '700' as const,
    backgroundColor: 'rgba(0,229,182,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  speedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  speedPressed: {
    opacity: 0.7,
  },
  speedText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  speedTextActive: {
    color: colors.teal,
  },
  replayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  replayText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  replayTextLimit: {
    color: colors.amber,
  },
  replayButton: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,229,182,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayPressed: {
    opacity: 0.7,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryPressed: {
    opacity: 0.7,
  },
  retryText: {
    color: Colors.surface,
    fontWeight: '600' as const,
    fontSize: 13,
  },
});
