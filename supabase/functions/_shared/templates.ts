export type TemplateContext = {
  first_name?: string;
  streak_days?: number;
  previous_streak_days?: number;
  questions_remaining?: number;
  badge_name?: string;
  badge_translation?: string;
  next_badge_name?: string;
  days_to_next_badge?: number;
  previous_badge_name?: string;
  dropped_to_badge_name?: string;
  rebuild_days_required?: number;
  current_badge_name?: string;
  current_streak_days?: number;
  next_shield_available_at?: string;
  new_badge_name?: string;
  new_badge_translation?: string;
  cefr_level?: string;
  trial_ends_at_formatted?: string;
  section?: string;
  level?: string;
  score_pct?: number;
  // Readiness / score variables
  score_previous?: number;
  score_current?: number;
  score_target?: number;
  points_to_target?: number;
  top_skill_de?: string;
  weak_skill_de?: string;
  weak_skill_slug?: string;
  weak_skill_score?: number;
  avg_skill_score?: number;
  projected_gain?: number;
  // Exam countdown variables
  days_to_exam?: number;
  exam_name?: string;
  [key: string]: unknown;
};

type PushTemplate = {
  headings: { en: string };
  contents: { en: string };
  deep_link: string;
};

type EmailTemplate = {
  subject: string;
  html: string;
};

type InAppTemplate = {
  body: string;
  deep_link?: string;
};

type Template = {
  push?: PushTemplate;
  email?: EmailTemplate;
  in_app?: InAppTemplate;
};

export const TEMPLATES: Record<string, Template> = {
  'notif.streak_at_risk': {
    push: {
      headings: { en: '{streak_days} days. 90 minutes.' },
      contents: { en: '{questions_remaining} questions keep the streak. Less time than a coffee run.' },
      deep_link: '/stream?source=push_streak',
    },
  },

  'notif.score_moved': {
    push: {
      headings: { en: 'Readiness {score_previous} → {score_current}' },
      contents: { en: '{top_skill_de} carried you. {weak_skill_de} is still {weak_skill_score}. That\'s where the next {points_to_target} points live.' },
      deep_link: '/home?source=push_score&focus={weak_skill_slug}',
    },
  },

  'notif.exam_countdown': {
    push: {
      headings: { en: '{days_to_exam} days to {exam_name}' },
      contents: { en: 'Current Readiness {score_current}. Target {score_target}. That\'s one mock exam away.' },
      deep_link: '/home?source=push_countdown',
    },
  },

  'notif.mock_ready': {
    push: {
      headings: { en: 'Ready for a full mock.' },
      contents: { en: '150 minutes. Sits like the real thing. Best time for it: this morning.' },
      deep_link: '/mock?source=push_mock',
    },
  },

  'notif.weak_skill': {
    push: {
      headings: { en: '{weak_skill_de} is the ceiling.' },
      contents: { en: '{weak_skill_score} vs an {avg_skill_score} average. Twelve minutes of {weak_skill_de} tonight lifts overall Readiness by an estimated {projected_gain} points.' },
      deep_link: '/tests?skill={weak_skill_slug}&source=push_weak',
    },
  },
  'notif.streak_broken': {
    push: {
      headings: { en: 'Streak broken' },
      contents: { en: 'You dropped to {dropped_to_badge_name}. Rebuild in {rebuild_days_required} days to restore {previous_badge_name}.' },
      deep_link: '/home',
    },
    email: {
      subject: "Your streak is gone — let's rebuild.",
      html: `<p>Hi {first_name},</p>
             <p>Your {previous_streak_days}-day streak broke. You dropped from <strong>{previous_badge_name}</strong> to <strong>{dropped_to_badge_name}</strong>.</p>
             <p>Good news: rebuild in {rebuild_days_required} days and you're back where you were. Open the app and get started.</p>
             <p><a href="wordifi://home">Open Wordifi</a></p>`,
    },
  },
  'notif.score_shield_used': {
    in_app: {
      body: 'Score Shield used — your streak continues at {current_streak_days} days. Next Shield available in 7 days.',
    },
  },
  'notif.no_activity_48h': {
    push: {
      headings: { en: 'We miss you' },
      contents: { en: '5 quick questions to get back on track — Der Einsteiger is waiting.' },
      deep_link: '/stream',
    },
  },
  'notif.badge_rank_up': {
    in_app: {
      body: '🏆 {new_badge_name} unlocked — {new_badge_translation}. Next: {next_badge_name} in {days_to_next_badge} days.',
    },
    push: {
      headings: { en: 'Badge unlocked!' },
      contents: { en: 'You earned {new_badge_name}! Your new rank is live in Wordifi.' },
      deep_link: '/home',
    },
  },
  'notif.section_completed': {
    in_app: {
      body: '{section} {level} complete — {score_pct}%. Keep going!',
    },
  },
  'notif.trial_ending_t3': {
    push: {
      headings: { en: 'Your trial ends in 3 days' },
      contents: { en: 'Your {badge_name} and {streak_days}-day streak are at stake. Activate now.' },
      deep_link: '/paywall',
    },
    email: {
      subject: 'Your Wordifi trial ends in 3 days',
      html: `<p>Hi {first_name},</p>
             <p>Your trial ends on {trial_ends_at_formatted}.</p>
             <p>You've built a <strong>{streak_days}-day streak</strong> and reached <strong>{badge_name}</strong>. Activate your subscription to keep everything.</p>
             <p><a href="wordifi://paywall">Subscribe in the app</a></p>`,
    },
  },
  'notif.trial_ending_t1': {
    push: {
      headings: { en: 'Trial ends tomorrow' },
      contents: { en: 'Keep your {badge_name} — activate now.' },
      deep_link: '/paywall',
    },
    email: {
      subject: 'Last day of your Wordifi trial',
      html: `<p>Hi {first_name},</p>
             <p>Your trial ends tomorrow. Your {streak_days}-day streak and {badge_name} rank will be frozen if you don't activate.</p>
             <p><a href="wordifi://paywall">Subscribe now</a></p>`,
    },
  },
  'notif.trial_ending_t0': {
    push: {
      headings: { en: "Today's the day" },
      contents: { en: "Activate to keep everything you've built." },
      deep_link: '/paywall',
    },
    email: {
      subject: 'Your Wordifi trial ends today',
      html: `<p>Hi {first_name},</p>
             <p>Just a few hours left on your trial. Subscribe to keep your {streak_days}-day streak and {badge_name} rank.</p>
             <p><a href="wordifi://paywall">Subscribe now</a></p>`,
    },
  },
};

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function interpolate(template: string, ctx: TemplateContext, escapeHtml = false): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const val = ctx[key];
    if (val === undefined || val === null) {
      console.warn(`[templates] missing variable: ${key}`);
      return '';
    }
    const str = String(val);
    return escapeHtml ? htmlEscape(str) : str;
  });
}

export type RenderedPush = { headings: { en: string }; contents: { en: string }; deep_link: string };
export type RenderedEmail = { subject: string; html: string };
export type RenderedInApp = { body: string; deep_link?: string };

export function renderTemplate(
  eventKey: string,
  channel: 'push' | 'email' | 'in_app',
  ctx: TemplateContext,
): RenderedPush | RenderedEmail | RenderedInApp | null {
  const tmpl = TEMPLATES[eventKey];
  if (!tmpl) {
    console.warn(`[templates] no template for event: ${eventKey}`);
    return null;
  }

  if (channel === 'push' && tmpl.push) {
    return {
      headings: { en: interpolate(tmpl.push.headings.en, ctx) },
      contents: { en: interpolate(tmpl.push.contents.en, ctx) },
      deep_link: tmpl.push.deep_link,
    };
  }

  if (channel === 'email' && tmpl.email) {
    return {
      subject: interpolate(tmpl.email.subject, ctx),
      html: interpolate(tmpl.email.html, ctx, true),
    };
  }

  if (channel === 'in_app' && tmpl.in_app) {
    return {
      body: interpolate(tmpl.in_app.body, ctx),
      deep_link: tmpl.in_app.deep_link,
    };
  }

  console.warn(`[templates] no ${channel} template for event: ${eventKey}`);
  return null;
}
