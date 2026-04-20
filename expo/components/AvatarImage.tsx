/**
 * AvatarImage
 *
 * Displays a circular avatar. Shows the user's photo when `uri` is provided;
 * falls back to an initials circle otherwise.
 *
 * Props:
 *   uri      — remote or local image URL (profile.avatar_url)
 *   initial  — single uppercase letter shown when no image
 *   size     — diameter in px (default 44)
 *   bgColor  — background color for initials circle
 *   textColor — color for initials text
 */
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  uri?: string | null;
  initial?: string;
  size?: number;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
};

export function AvatarImage({
  uri,
  initial = '?',
  size = 44,
  bgColor = 'rgba(43,112,239,0.12)',
  textColor = '#2B70EF',
  fontSize: fontSizeProp,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const radius = size / 2;
  const computedFontSize = fontSizeProp ?? Math.round(size * 0.36);

  const showImage = Boolean(uri) && !imgError;

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: radius, backgroundColor: bgColor },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={[styles.img, { width: size, height: size, borderRadius: radius }]}
          onError={() => setImgError(true)}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[styles.initial, { fontSize: computedFontSize, color: textColor }]}
          allowFontScaling={false}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  initial: {
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: undefined,
    includeFontPadding: false,
  },
});
