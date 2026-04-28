export const TIER_COLORS: Record<string, string> = {
  'Der Einsteiger': '#93C5FD',
  'Der Stürmer':    '#60A5FA',
  'Der Jäger':      '#3B82F6',
  'Der Kämpfer':    '#2563EB',
  'Der Bezwinger':  '#1D4ED8',
  'Der Meister':    '#1E40AF',
  'Der Legendär':   '#1E3A8A',
  'Bronze':         '#CD7F32',
  'Silber':         '#C0C0C0',
  'Gold':           '#FFD700',
  'Diamant':        '#B9F2FF',
  'Platin':         '#E5E4E2',
};

export function getTierColor(tierName: string): string {
  return TIER_COLORS[tierName] ?? '#94A3B8';
}

export function getTierEmoji(tierName: string): string {
  if (tierName === 'Bronze') return '🥉';
  if (tierName === 'Silber') return '🥈';
  if (tierName === 'Gold') return '🥇';
  if (tierName === 'Diamant' || tierName === 'Platin') return '💎';
  return '🏆';
}

export function formatXp(xp: number): string {
  if (xp >= 1000) {
    const k = (xp / 1000).toFixed(1);
    return k.endsWith('.0') ? `${Math.floor(xp / 1000)}k` : `${k}k`;
  }
  return String(xp);
}
