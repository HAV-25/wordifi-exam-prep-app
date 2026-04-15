import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

export type WordifiLogoVariant = 'blue' | 'muted' | 'light' | 'dark';

type Props = {
  /**
   * Logo color variant.
   * - `blue` (default): primary wordmark for light/white backgrounds.
   * - `dark`: dark navy wordmark for very light backgrounds where blue is too saturated.
   * - `muted`: low-emphasis gray wordmark.
   * - `light`: near-white wordmark for dark backgrounds.
   */
  variant?: WordifiLogoVariant;
  /** Rendered height in px. Width scales proportionally. */
  height: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
};

// Native aspect ratio of the exported PNGs (width / height).
const LOGO_ASPECT = 3.2;

const SOURCES = {
  blue:  require('@/assets/images/wordifi-wordmark-blue.png'),
  muted: require('@/assets/images/wordifi-wordmark-muted.png'),
  light: require('@/assets/images/wordifi-wordmark-light.png'),
  dark:  require('@/assets/images/wordifi-wordmark-dark.png'),
};

export function WordifiLogo({ variant = 'blue', height, style, testID }: Props) {
  return (
    <Image
      accessibilityLabel="Wordifi"
      source={SOURCES[variant]}
      resizeMode="contain"
      style={[{ height, width: height * LOGO_ASPECT }, style]}
      testID={testID}
    />
  );
}
