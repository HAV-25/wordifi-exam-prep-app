import type { BadgeType } from '@/lib/streamHelpers';

export type BadgeTier = {
  type: BadgeType;
  label: string;
  color: string;
  minXp: number;
};

const BADGE_TIERS: BadgeTier[] = [
  { type: 'platinum', label: 'Platinum', color: '#E5E4E2', minXp: 1000 },
  { type: 'gold', label: 'Gold', color: '#FFD700', minXp: 500 },
  { type: 'silver', label: 'Silver', color: '#C0C0C0', minXp: 200 },
  { type: 'bronze', label: 'Bronze', color: '#CD7F32', minXp: 0 },
];

export function getBadgeTier(xpTotal: number): BadgeTier {
  for (const tier of BADGE_TIERS) {
    if (xpTotal >= tier.minXp) {
      return tier;
    }
  }
  return BADGE_TIERS[BADGE_TIERS.length - 1]!;
}

export function formatXp(xp: number): string {
  if (xp >= 1000) {
    const k = (xp / 1000).toFixed(1);
    return k.endsWith('.0') ? `${Math.floor(xp / 1000)}k` : `${k}k`;
  }
  return String(xp);
}

export function getNextBadgeTier(xpTotal: number): BadgeTier | null {
  const sorted = [...BADGE_TIERS].sort((a, b) => a.minXp - b.minXp);
  for (const tier of sorted) {
    if (xpTotal < tier.minXp) {
      return tier;
    }
  }
  return null;
}

export function didCrossBadgeThreshold(oldXp: number, newXp: number): BadgeTier | null {
  const thresholds = [1000, 500, 200];
  for (const threshold of thresholds) {
    if (oldXp < threshold && newXp >= threshold) {
      return BADGE_TIERS.find((t) => t.minXp === threshold) ?? null;
    }
  }
  return null;
}
