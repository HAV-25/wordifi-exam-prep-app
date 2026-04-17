import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export function GlowOrb({ size = 380, color = '#F0C808', top, right, bottom, left }: Props) {
  const r = size / 2;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top, right, bottom, left, width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={color} stopOpacity={0.38} />
            <Stop offset="40%"  stopColor={color} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={color} stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill="url(#glowGrad)" />
      </Svg>
    </View>
  );
}
