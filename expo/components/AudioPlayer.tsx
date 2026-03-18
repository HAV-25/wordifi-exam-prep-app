import { Audio, type AVPlaybackStatus } from 'expo-av';
import { AlertCircle, Pause, Play, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/colors';

type AudioPlayerProps = {
  audioUrl: string;
  onFirstPlay?: () => void;
};

export function AudioPlayer({ audioUrl, onFirstPlay }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [positionMillis, setPositionMillis] = useState<number>(0);
  const [durationMillis, setDurationMillis] = useState<number>(1);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasPlayedRef = useRef<boolean>(false);
  const audioModeSetRef = useRef<boolean>(false);

  useEffect(() => {
    if (isPlaying) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying, pulseAnim]);

  useEffect(() => {
    let isMounted = true;

    async function prepareSound() {
      setIsBuffering(true);
      setError(null);
      setIsLoaded(false);
      setIsFinished(false);
      setPositionMillis(0);
      setDurationMillis(1);

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

  const handlePlayPause = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
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
  }, [isLoaded, isFinished, onFirstPlay]);

  const handleReplay = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      await soundRef.current.setPositionAsync(0);
      setIsFinished(false);
      await soundRef.current.playAsync();
      if (!hasPlayedRef.current && onFirstPlay) {
        hasPlayedRef.current = true;
        onFirstPlay();
      }
    } catch (e) {
      console.log('AudioPlayer replay error', e);
    }
  }, [isLoaded, onFirstPlay]);

  const handleRetry = useCallback(() => {
    console.log('AudioPlayer: retrying load');
    setReloadKey((v) => v + 1);
  }, []);

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
    if (isBuffering) return <ActivityIndicator color={Colors.surface} size="small" />;
    if (isFinished) return <RotateCcw color={Colors.surface} size={20} />;
    if (isPlaying) return <Pause color={Colors.surface} size={20} />;
    return <Play color={Colors.surface} size={20} />;
  };

  const getPlayLabel = () => {
    if (isBuffering) return 'Loading audio';
    if (isFinished) return 'Replay audio';
    if (isPlaying) return 'Pause audio';
    return 'Play audio';
  };

  return (
    <View style={styles.card} testID="audio-player">
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={getPlayLabel()}
          onPress={isFinished ? handleReplay : handlePlayPause}
          style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}
          testID="play-audio-button"
          disabled={isBuffering}
        >
          {getPlayIcon()}
        </Pressable>
        <View style={styles.infoColumn}>
          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                { width: `${progress * 100}%` },
                isPlaying && { opacity: pulseAnim },
              ]}
            />
          </View>
          <Text style={styles.timeText}>{formattedTime}</Text>
        </View>
        {isLoaded && (
          <Pressable
            accessibilityLabel="Replay audio"
            onPress={handleReplay}
            style={({ pressed }) => [styles.replayButton, pressed && styles.replayPressed]}
            testID="replay-audio-button"
          >
            <RotateCcw color={Colors.primary} size={16} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: Colors.primaryDeep,
    padding: 14,
    gap: 10,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  playPressed: {
    opacity: 0.8,
  },
  infoColumn: {
    flex: 1,
    gap: 4,
  },
  replayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayPressed: {
    opacity: 0.7,
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  timeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500' as const,
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
