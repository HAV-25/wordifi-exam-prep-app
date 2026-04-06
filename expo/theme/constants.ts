/**
 * WORDIFI — App Constants
 * Business logic constants shared across the app.
 * Never hardcode these values inline anywhere.
 */

// ─── XP Rates (per correct answer in Test Stream) ────────────────────────────
export const XP_RATES: Record<string, number> = {
  A1: 5,
  A2: 10,
  B1: 15,
  B2: 20,
  C1: 25,
} as const;

// ─── Official TELC / Goethe Exam Timings (minutes) ───────────────────────────
// Source: Official exam specifications. Never hardcode "30 min".
export const EXAM_TIMINGS: Record<string, { hoeren: number; lesen: number; sprachbausteine?: number }> = {
  A1: { hoeren: 20, lesen: 25 },
  A2: { hoeren: 20, lesen: 25 },
  B1: { hoeren: 40, lesen: 70, sprachbausteine: 15 },
} as const;

// ─── Preparedness Score ───────────────────────────────────────────────────────
export const PREPAREDNESS = {
  min:           0,
  max:           100,
  deltaStream:  +1,   // Per question answered (regardless of correct/wrong)
  deltaSectional: +5, // Per sectional test completed
  deltaMock:    +20,  // Per mock test completed
  decayPerDay:   -1,  // Per calendar day of inactivity
  redBelow:      40,  // < 40% = red gauge
  amberBelow:    70,  // < 70% = amber gauge (≥ 70% = green)
} as const;

// ─── XP Badge Thresholds ─────────────────────────────────────────────────────
export const BADGE_THRESHOLDS = [
  { tier: 'bronze',   minXP:    0, color: '#CD7F32', label: 'Bronze' },
  { tier: 'silver',   minXP:  200, color: '#C0C0C0', label: 'Silver' },
  { tier: 'gold',     minXP:  500, color: '#FFD700', label: 'Gold'   },
  { tier: 'platinum', minXP: 1000, color: '#E5E4E2', label: 'Platinum' },
] as const;

export function getBadgeTier(xpTotal: number) {
  return [...BADGE_THRESHOLDS]
    .reverse()
    .find(b => xpTotal >= b.minXP) ?? BADGE_THRESHOLDS[0];
}

export function formatXP(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`;
  return String(xp);
}

// ─── Streak Milestones ────────────────────────────────────────────────────────
export const STREAK_MILESTONES = [7, 30, 60, 100] as const;

// ─── Question Queue ───────────────────────────────────────────────────────────
export const QUEUE = {
  fetchSize:       20,   // Questions per fetch
  prefetchAt:       5,   // Remaining questions that trigger next fetch
  dedupWindowDays: 30,   // Skip questions answered within this window
} as const;

// ─── Swipe Mechanics ─────────────────────────────────────────────────────────
export const SWIPE = {
  thresholdRatio: 0.40,  // 40% of screen height to trigger advance
  velocityThreshold: 800, // px/s — triggers regardless of distance
  maxBackCards:     1,    // How many cards back swipe-down allows
} as const;

// ─── Sectional Test Retest Window ────────────────────────────────────────────
export const RETEST_DAYS = 7;

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const LEADERBOARD = {
  topN:          50,   // Show top 50 users only
  refreshOnFocus: true,
} as const;

// ─── Onboarding ──────────────────────────────────────────────────────────────
export const ONBOARDING = {
  baseScore:      32,   // Always shown as starting preparedness score
  sampleQuestions: 5,   // Free sample questions in onboarding
} as const;

// ─── Paywall Timer ───────────────────────────────────────────────────────────
export const PAYWALL_TIMER = {
  initialSeconds: 23 * 3600 + 47 * 60 + 12, // 23:47:12
  storageKey:     'wordifi_paywall_timer_start',
  sessionHours:   24,
} as const;

// ─── Mock Test Official Exam Question Counts per Teil ────────────────────────
export const MOCK_TEST_QUESTION_COUNTS: Record<string, Record<string, Record<number, number>>> = {
  A1: {
    Hören:    { 1: 6, 2: 4, 3: 5 },
    Lesen:    { 1: 5, 2: 5, 3: 5 },
    Schreiben:{ 1: 1, 2: 1 },
  },
  A2: {
    Hören:    { 1: 5, 2: 5, 3: 5, 4: 5 },
    Lesen:    { 1: 5, 2: 5, 3: 5, 4: 5 },
    Schreiben:{ 1: 1, 2: 1 },
  },
  B1: {
    Hören:            { 1: 10, 2: 5, 3: 7, 4: 8 },
    Lesen:            { 1: 6,  2: 6, 3: 7, 4: 7, 5: 4 },
    Sprachbausteine:  { 1: 1,  2: 1 },
    Schreiben:        { 1: 1,  2: 1, 3: 1 },
  },
};

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── AsyncStorage Keys ───────────────────────────────────────────────────────
// Centralised to prevent key typos across the codebase
export const STORAGE_KEYS = {
  swipeCount:        'wordifi_swipe_count',
  explanationLang:   'wordifi_explanation_lang',
  playerNameSet:     'wordifi_player_name_set',
  onboardingComplete: 'wordifi_onboarding_complete',
  paywallTimerStart:  'wordifi_paywall_timer_start',
} as const;

// ─── Player Names Pool (for auto-assignment on sign-up) ──────────────────────
export const PLAYER_NAMES: string[] = [
  'FlinkeFeder', 'MutigerLerner', 'StillerProfi', 'SchnellerLeser',
  'WilderDenker', 'StarkerAnfaenger', 'KlugeStimme', 'FreierGeist',
  'Heller Kopf', 'TapfererSchueler', 'RasanterLerner', 'WeisenGeist',
  'FlottePrüfung', 'EifrigenLerner', 'ScharferVerstand', 'GuteLaune',
  'SanfterRiese', 'EchterKoenner', 'BravesFuchs', 'KlugerWolf',
  'GoldenerAdler', 'SilberneSchildkroete', 'StarkeEiche', 'FreieWolke',
  'TieferOzean', 'HoherBerg', 'SchnellerWind', 'RuhigerFluss',
  'LeuchtenderStern', 'WarmerSonnenschein', 'FreundlicherRiese', 'KlugeEule',
  'MutigerLoewe', 'StolzerFalke', 'FlinkesReh', 'StarkesBaer',
  'WeiseFuchs', 'TreuerHund', 'SchnelleKatze', 'StillerFisch',
  'WilderHase', 'FliegendesBlatt', 'TanzendeWelle', 'ScheinendePerle',
  'GluehenderFunken', 'FrischerWind', 'TieferBrunnen', 'GrossesHerz',
  'FreierVogel', 'RuhigeNacht',
];
