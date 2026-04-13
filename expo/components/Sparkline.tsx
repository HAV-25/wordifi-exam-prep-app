import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  /** Array of 7 values (0–max), one per day */
  data: number[];
  /** Bar color for the peak bar */
  color: string;
  /** Height of the container (default 24) */
  height?: number;
};

export function Sparkline({ data, color, height = 24 }: Props) {
  const max = Math.max(...data, 1);

  return (
    <View style={[styles.container, { height }]}>
      {data.map((value, i) => {
        const barHeight = Math.max((value / max) * height, 2);
        const intensity = 0.3 + (value / max) * 0.7;
        const isLast = i === data.length - 1;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: barHeight,
                backgroundColor: isLast ? color : color,
                opacity: isLast ? 1 : intensity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bar: {
    flex: 1,
    borderRadius: 999,
    minWidth: 2,
  },
});
