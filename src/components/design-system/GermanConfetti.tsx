/**
 * WORDIFI — GermanConfetti
 * Source of truth: Design Language v1.0 · Section 4.2
 *
 * Abstract geometric shapes scattered in the blue header zone.
 * Communicates "German exam app" without being literal.
 *
 * RULES:
 * - Used on Splash header + Question screen headers (02–06) ONLY
 * - Never centred — right side of header only
 * - Shapes: circles (4–6px), squares (4–5px), diamonds (5–7px)
 * - Max 3 shapes visible per screen
 * - Semi-transparent only — never solid
 * - Positions are seeded (same layout every render)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

// Seeded positions — always the same, never random at runtime
const CONFETTI_SHAPES = [
  { type: 'circle',  size: 5,  top: '15%', right: '12%', color: colors.flagRed  },
  { type: 'square',  size: 4,  top: '35%', right: '22%', color: colors.flagGold },
  { type: 'diamond', size: 6,  top: '55%', right: '8%',  color: colors.flagRed  },
  { type: 'circle',  size: 4,  top: '25%', right: '35%', color: colors.flagGold },
  { type: 'square',  size: 5,  top: '70%', right: '18%', color: colors.flagBlack},
  { type: 'circle',  size: 6,  top: '45%', right: '42%', color: colors.flagRed  },
  { type: 'diamond', size: 5,  top: '10%', right: '28%', color: colors.flagGold },
  { type: 'square',  size: 4,  top: '80%', right: '30%', color: colors.flagRed  },
] as const;

// Show max 3 per screen — using first 3 most visible positions
const VISIBLE_COUNT = 3;

export function GermanConfetti() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {CONFETTI_SHAPES.slice(0, VISIBLE_COUNT).map((shape, i) => (
        <View
          key={i}
          style={[
            styles.shape,
            {
              top:   shape.top,
              right: shape.right,
              width:  shape.size,
              height: shape.size,
              backgroundColor: shape.color,
              borderRadius: shape.type === 'circle'  ? shape.size / 2 :
                            shape.type === 'diamond' ? 1 : 0,
              transform: shape.type === 'diamond' ? [{ rotate: '45deg' }] : [],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shape: {
    position: 'absolute',
  },
});
