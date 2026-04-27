import type {
  DailyRollupRow,
  ReadinessRow,
  StreakRow,
  TierConfigRow,
} from '@/types/gamification';

export type GamificationScenario = 'free7' | 'trial14' | 'paid30';

// ─── Readiness stubs ──────────────────────────────────────────────────────────
// TODO: Replace with RPC call in next sprint

export function getReadinessStub(scenario: GamificationScenario): ReadinessRow {
  switch (scenario) {
    case 'free7':
      return {
        user_id:             'stub-free7',
        cefr_level:          'A1',
        raw_score_current:   0.8,
        raw_score_preceding: 0,
        ema_score:           0.6,
        normalized_score:    1.0,
        ramp_factor:         0.07,
        ramp_complete:       false,
      };
    case 'trial14':
      return {
        user_id:             'stub-trial14',
        cefr_level:          'A1',
        raw_score_current:   3.2,
        raw_score_preceding: 2.0,
        ema_score:           2.8,
        normalized_score:    2.5,
        ramp_factor:         0.12,
        ramp_complete:       false,
      };
    case 'paid30':
    default:
      return {
        user_id:             'stub-paid30',
        cefr_level:          'A1',
        raw_score_current:   58.0,
        raw_score_preceding: 44.0,
        ema_score:           52.0,
        normalized_score:    45.0,
        ramp_factor:         0.55,
        ramp_complete:       false,
      };
  }
}

// ─── Streak stubs ─────────────────────────────────────────────────────────────
// TODO: Replace with RPC call in next sprint

export function getStreakStub(scenario: GamificationScenario): StreakRow {
  switch (scenario) {
    case 'free7':
      return {
        current_streak_days:            0,
        longest_streak_days:            2,
        last_qualifying_day:            null,
        streak_started_at:              null,
        last_shield_used_at:            null,
        timezone:                       'Europe/Berlin',
        tier_adjusted_lifetime:         false,
        daily_requirement_tier_adjustment: 0,
      };
    case 'trial14':
      return {
        current_streak_days:            5,
        longest_streak_days:            5,
        last_qualifying_day:            '2026-04-24',
        streak_started_at:              '2026-04-20',
        last_shield_used_at:            null,
        timezone:                       'Europe/Berlin',
        tier_adjusted_lifetime:         true,
        daily_requirement_tier_adjustment: 2,
      };
    case 'paid30':
    default:
      return {
        current_streak_days:            18,
        longest_streak_days:            21,
        last_qualifying_day:            '2026-04-24',
        streak_started_at:              '2026-04-07',
        last_shield_used_at:            '2026-04-18',
        timezone:                       'Europe/Berlin',
        tier_adjusted_lifetime:         true,
        daily_requirement_tier_adjustment: 2,
      };
  }
}

// ─── Daily rollup stubs ───────────────────────────────────────────────────────
// Returns 7 rows (one per day, single CEFR level for simplicity).
// TODO: Replace with RPC call in next sprint

function makeRollupRow(
  date: string,
  met: boolean,
  answered: number,
  correct: number,
): DailyRollupRow {
  return {
    activity_date:                    date,
    cefr_level:                       'A1',
    stream_questions_answered:        answered,
    stream_questions_correct:         correct,
    sectional_questions_attempted:    0,
    sectional_questions_correct:      0,
    mock_questions_attempted:         0,
    mock_questions_correct:           0,
    sprechen_readiness_contrib:       0,
    schreiben_readiness_contrib:      0,
    total_questions_counted_for_streak: answered,
    streak_requirement_met:           met,
  };
}

export function getDailyRollupStub(scenario: GamificationScenario): DailyRollupRow[] {
  switch (scenario) {
    case 'free7':
      return [
        makeRollupRow('2026-04-19', false, 0,  0),
        makeRollupRow('2026-04-20', false, 2,  1),
        makeRollupRow('2026-04-21', false, 0,  0),
        makeRollupRow('2026-04-22', false, 0,  0),
        makeRollupRow('2026-04-23', false, 3,  1),
        makeRollupRow('2026-04-24', false, 0,  0),
        makeRollupRow('2026-04-25', false, 1,  0),
      ];
    case 'trial14':
      return [
        makeRollupRow('2026-04-19', false, 3,  1),
        makeRollupRow('2026-04-20', true,  7,  4),
        makeRollupRow('2026-04-21', false, 2,  1),
        makeRollupRow('2026-04-22', true,  8,  5),
        makeRollupRow('2026-04-23', true,  9,  6),
        makeRollupRow('2026-04-24', true,  7,  4),
        makeRollupRow('2026-04-25', false, 1,  0),
      ];
    case 'paid30':
    default:
      return [
        makeRollupRow('2026-04-19', true,  10, 8),
        makeRollupRow('2026-04-20', true,  11, 9),
        makeRollupRow('2026-04-21', true,  9,  7),
        makeRollupRow('2026-04-22', false, 4,  2),
        makeRollupRow('2026-04-23', true,  10, 8),
        makeRollupRow('2026-04-24', true,  12, 10),
        makeRollupRow('2026-04-25', true,  10, 8),
      ];
  }
}

// ─── Tier config stubs ────────────────────────────────────────────────────────
// TODO: Replace with RPC call in next sprint

export function getTierConfigStub(scenario: GamificationScenario): TierConfigRow {
  switch (scenario) {
    case 'free7':
      return {
        tier_name:                 'free',
        display_name:              'Free',
        tier_description:          'Access daily stream questions and track your streak. Upgrade to unlock sectional tests, mock exams, Schreiben, and Sprechen.',
        stream_questions_per_day:  5,
        sectional_tests_enabled:   false,
        schreiben_enabled:         false,
        sprechen_enabled:          false,
        mock_tests_enabled:        false,
        trial_duration_hours:      null,
      };
    case 'trial14':
      return {
        tier_name:                 'free_trial',
        display_name:              'Free Trial',
        tier_description:          'Full access to all sections for the duration of your trial. Includes sectional tests, Schreiben, Sprechen, and mock exams.',
        stream_questions_per_day:  null,
        sectional_tests_enabled:   true,
        schreiben_enabled:         true,
        sprechen_enabled:          true,
        mock_tests_enabled:        true,
        trial_duration_hours:      72,
      };
    case 'paid30':
    default:
      return {
        tier_name:                 'monthly',
        display_name:              'Pro Monthly',
        tier_description:          'Unlimited daily practice, all four exam sections, full mock tests, and priority readiness tracking. Billed monthly.',
        stream_questions_per_day:  null,
        sectional_tests_enabled:   true,
        schreiben_enabled:         true,
        sprechen_enabled:          true,
        mock_tests_enabled:        true,
        trial_duration_hours:      null,
      };
  }
}
