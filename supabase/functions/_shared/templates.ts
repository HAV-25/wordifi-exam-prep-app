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
  // Weekly digest variables
  week_of?: string;
  score_delta?: string;
  projected_score?: number;
  projected_score_if_action?: number;
  minutes_practiced?: number;
  sessions_count?: number;
  questions_answered?: number;
  accuracy_pct?: number;
  mocks_count?: number;
  weak_skill_gap?: number;
  // Per-skill scores and label colours (worker sets weak skill to #EF4444, others to #374151)
  score_lesen?: number;
  score_hoeren?: number;
  score_schreiben?: number;
  score_sprechen?: number;
  color_lesen?: string;
  color_hoeren?: string;
  color_schreiben?: string;
  color_sprechen?: string;
  // Section completed
  teil?: string;
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
  headings: { en: string };
  contents: { en: string };
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
    email: {
      subject: '{days_to_exam} days to {exam_name} — Readiness {score_current}',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>{days_to_exam} days to {exam_name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img   { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
  a     { color:#2B70EF; }
  .cta:hover { filter:brightness(1.04); }
  @media only screen and (max-width: 520px) {
    .shell     { width:100% !important; }
    .pad       { padding-left:24px !important; padding-right:24px !important; }
    .h1        { font-size:28px !important; line-height:1.15 !important; }
    .cta       { font-size:16px !important; padding:16px 24px !important; }
    .logo      { height:26px !important; }
    .daycount  { font-size:72px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFF; font-family:'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#374151;">

<div style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
  {days_to_exam} days to {exam_name}. Your Readiness Score is {score_current}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFF;">
  <tr><td align="center" style="padding:40px 16px;">

    <table role="presentation" class="shell" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

      <!-- Dark hero: day counter -->
      <tr>
        <td style="background-color:#0A0E1A; border-radius:24px 24px 0 0; padding:36px 40px 28px; text-align:left;">
          <img src="https://wwfiauhsbssjowaxmqyn.supabase.co/storage/v1/object/sign/Wordifi%20Brand/email/assets/logo-light.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hZGExZDI2Zi1lMzg3LTQzMWMtYjkxNi0wMjY4NjM3Y2YwNzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJXb3JkaWZpIEJyYW5kL2VtYWlsL2Fzc2V0cy9sb2dvLWxpZ2h0LnBuZyIsImlhdCI6MTc3NjkzNzAxOCwiZXhwIjoxOTM0NjE3MDE4fQ.-d64zsBC0ExEBBYb9u3VQ1vEiTaiTIMao9qrXIcjVwA"
               width="128" height="40"
               alt="wordifi"
               class="logo"
               style="height:28px; width:auto; display:block; margin:0 0 24px; color:#FFFFFF; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; letter-spacing:-0.03em;">
          <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            Countdown &middot; {exam_name}
          </p>
          <p class="daycount" style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:88px; line-height:1; letter-spacing:-0.04em; color:#FFFFFF;">
            {days_to_exam}
          </p>
          <p style="margin:6px 0 0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:18px; line-height:1; color:#00E5B6;">
            days to go
          </p>
        </td>
      </tr>

      <!-- Card -->
      <tr>
        <td class="pad" style="background-color:#FFFFFF; border-radius:0 0 24px 24px; padding:36px 40px 40px;">

          <h1 class="h1" style="margin:0 0 14px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:30px; line-height:1.1; letter-spacing:-0.03em; color:#0A0E1A;">
            Readiness {score_current}.<br>
            <span style="font-style:italic; color:#00E5B6;">You need 70 to pass.</span>
          </h1>

          <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            Your score is up <strong style="color:#0A0E1A; font-weight:700;">{score_delta}</strong> since last week. At your current pace you land on <strong style="color:#0A0E1A; font-weight:700;">{projected_score}</strong> on exam day. Close the gap today.
          </p>

          <!-- Skills table -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
            <tr>
              <td colspan="2" style="background-color:#F2F4FF; border-radius:16px 16px 0 0; padding:16px 20px 10px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">Skills breakdown</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#F2F4FF; padding:8px 20px; width:50%;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-weight:700; font-size:14px; color:{color_lesen};">Lesen</p>
              </td>
              <td align="right" style="background-color:#F2F4FF; padding:8px 20px;">
                <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; color:{color_lesen};">{score_lesen}</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#F2F4FF; padding:8px 20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-weight:700; font-size:14px; color:{color_hoeren};">H&ouml;ren</p>
              </td>
              <td align="right" style="background-color:#F2F4FF; padding:8px 20px;">
                <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; color:{color_hoeren};">{score_hoeren}</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#F2F4FF; padding:8px 20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-weight:700; font-size:14px; color:{color_schreiben};">Schreiben</p>
              </td>
              <td align="right" style="background-color:#F2F4FF; padding:8px 20px;">
                <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; color:{color_schreiben};">{score_schreiben}</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#F2F4FF; border-radius:0 0 0 16px; padding:8px 20px 16px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-weight:700; font-size:14px; color:{color_sprechen};">Sprechen</p>
              </td>
              <td align="right" style="background-color:#F2F4FF; border-radius:0 0 16px 0; padding:8px 20px 16px;">
                <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; color:{color_sprechen};">{score_sprechen}</p>
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:14px; line-height:1.55; color:#374151;">
            <strong style="color:#0A0E1A; font-weight:700;">{weak_skill_de} is dragging the average.</strong> Twenty minutes on {weak_skill_de} tasks today moves your projected score by roughly <strong style="color:#00E5B6; font-weight:700;">+{projected_gain}</strong>.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td align="center" style="border-radius:16px; background-color:#2B70EF; box-shadow:0 6px 16px rgba(43,112,239,0.30);">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wordifi.com/tests?skill={weak_skill_slug}" style="height:56px;v-text-anchor:middle;width:240px;" arcsize="29%" stroke="f" fillcolor="#2B70EF">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:16px;font-weight:bold;">Practice {weak_skill_de}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="https://wordifi.com/tests?skill={weak_skill_slug}" class="cta" style="display:inline-block; padding:18px 36px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:16px; color:#FFFFFF; text-decoration:none; border-radius:16px; letter-spacing:0.01em;">
                  Practice {weak_skill_de}
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <tr>
        <td class="pad" style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid rgba(229,231,235,0.7); padding-top:20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  You receive a countdown every Sunday until your exam. <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Change frequency</a> &middot; <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Unsubscribe</a>
                </p>
                <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  <a href="https://wordifi.com" style="color:#9CA3AF; text-decoration:underline;">wordifi</a> &middot; The smart path to certified.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>

  </td></tr>
</table>

</body>
</html>`,
    },
  },

  'notif.weekly_digest': {
    email: {
      subject: 'Readiness {score_current} — up {score_delta} this week',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Your week on wordifi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img   { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
  a     { color:#2B70EF; }
  .cta:hover { filter:brightness(1.04); }
  @media only screen and (max-width: 520px) {
    .shell { width:100% !important; }
    .pad   { padding-left:24px !important; padding-right:24px !important; }
    .h1    { font-size:28px !important; line-height:1.15 !important; }
    .cta   { font-size:16px !important; padding:16px 24px !important; }
    .logo  { height:26px !important; }
    .score { font-size:72px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFF; font-family:'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#374151;">

<div style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
  Readiness {score_current}. Up {score_delta} this week. {days_to_exam} days to {exam_name}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFF;">
  <tr><td align="center" style="padding:40px 16px;">

    <table role="presentation" class="shell" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

      <!-- Header -->
      <tr>
        <td style="background-color:#0A0E1A; border-radius:24px 24px 0 0; padding:28px 40px; text-align:left;">
          <img src="https://wwfiauhsbssjowaxmqyn.supabase.co/storage/v1/object/sign/Wordifi%20Brand/email/assets/logo-light.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hZGExZDI2Zi1lMzg3LTQzMWMtYjkxNi0wMjY4NjM3Y2YwNzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJXb3JkaWZpIEJyYW5kL2VtYWlsL2Fzc2V0cy9sb2dvLWxpZ2h0LnBuZyIsImlhdCI6MTc3NjkzNzAxOCwiZXhwIjoxOTM0NjE3MDE4fQ.-d64zsBC0ExEBBYb9u3VQ1vEiTaiTIMao9qrXIcjVwA"
               width="128" height="40"
               alt="wordifi"
               class="logo"
               style="height:32px; width:auto; display:block; color:#FFFFFF; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:22px; letter-spacing:-0.03em;">
        </td>
      </tr>

      <!-- Score hero -->
      <tr>
        <td class="pad" align="center" style="background-color:#FFFFFF; padding:36px 40px 16px; text-align:center;">
          <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            Readiness Score &middot; week of {week_of}
          </p>
          <p class="score" style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:88px; line-height:1; letter-spacing:-0.04em; color:#0A0E1A;">
            {score_current}
          </p>
          <p style="margin:8px 0 0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:18px; color:#00E5B6;">
            &uarr; {score_delta} this week
          </p>
        </td>
      </tr>

      <!-- Headline + body -->
      <tr>
        <td class="pad" style="background-color:#FFFFFF; padding:24px 40px 8px;">
          <h1 class="h1" style="margin:0 0 12px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:28px; line-height:1.1; letter-spacing:-0.03em; color:#0A0E1A;">
            Not hoping.<br>
            <span style="font-style:italic; color:#00E5B6;">Knowing.</span>
          </h1>
          <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            {days_to_exam} days to {exam_name}. You logged <strong style="color:#0A0E1A; font-weight:700;">{minutes_practiced} minutes</strong> across <strong style="color:#0A0E1A; font-weight:700;">{sessions_count} sessions</strong> and closed <strong style="color:#0A0E1A; font-weight:700;">{questions_answered} questions</strong>.
          </p>
        </td>
      </tr>

      <!-- Stats grid -->
      <tr>
        <td class="pad" style="background-color:#FFFFFF; padding:24px 40px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:33%; padding:0 6px 0 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color:#F2F4FF; border-radius:16px; padding:16px 14px;">
                    <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">Streak</p>
                    <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:26px; color:#0A0E1A;">&#x1F525; {streak_days}</p>
                  </td></tr>
                </table>
              </td>
              <td style="width:33%; padding:0 6px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color:#F2F4FF; border-radius:16px; padding:16px 14px;">
                    <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">Accuracy</p>
                    <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:26px; color:#0A0E1A;">{accuracy_pct}%</p>
                  </td></tr>
                </table>
              </td>
              <td style="width:33%; padding:0 0 0 6px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color:#F2F4FF; border-radius:16px; padding:16px 14px;">
                    <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">Mocks</p>
                    <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:26px; color:#0A0E1A;">{mocks_count}</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Focus row -->
      <tr>
        <td class="pad" style="background-color:#FFFFFF; padding:24px 40px 4px;">
          <p style="margin:0 0 8px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            This week's focus
          </p>
          <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:700; font-size:20px; line-height:1.25; color:#0A0E1A;">
            {weak_skill_de}. Your weakest skill by <span style="color:#EF4444;">{weak_skill_gap} points</span>.
          </p>
          <p style="margin:8px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:15px; line-height:1.55; color:#374151;">
            Three {weak_skill_de} drills this week moves your projected exam-day score from {projected_score} to {projected_score_if_action}.
          </p>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td class="pad" style="background-color:#FFFFFF; border-radius:0 0 24px 24px; padding:24px 40px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="border-radius:16px; background-color:#2B70EF; box-shadow:0 6px 16px rgba(43,112,239,0.30);">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wordifi.com/today" style="height:56px;v-text-anchor:middle;width:220px;" arcsize="29%" stroke="f" fillcolor="#2B70EF">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:16px;font-weight:bold;">Open this week's plan</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href="https://wordifi.com/today" class="cta" style="display:inline-block; padding:18px 36px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:16px; color:#FFFFFF; text-decoration:none; border-radius:16px; letter-spacing:0.01em;">
                  Open this week's plan
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td class="pad" style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid rgba(229,231,235,0.7); padding-top:20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  You receive this digest every Sunday. <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Change frequency</a> &middot; <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Unsubscribe</a>
                </p>
                <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  <a href="https://wordifi.com" style="color:#9CA3AF; text-decoration:underline;">wordifi</a> &middot; The smart path to certified.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>

  </td></tr>
</table>

</body>
</html>`,
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

  'notif.no_activity_48h': {
    push: {
      headings: { en: 'Two days quiet.' },
      contents: { en: 'One question tonight keeps your Readiness Score honest. That\'s all.' },
      deep_link: '/stream?source=push_reengage',
    },
  },

  'notif.streak_broken': {
    push: {
      headings: { en: 'Streak reset · {previous_streak_days} days.' },
      contents: { en: '{previous_badge_name} → {dropped_to_badge_name}. {rebuild_days_required} days of practice restores the rank. The Readiness Score didn\'t move.' },
      deep_link: '/stream?source=push_streak_broken',
    },
    email: {
      subject: 'Streak reset, {first_name}. The work isn\'t.',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Your streak reset. Rebuild starts today.</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img   { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
  a     { color:#2B70EF; }
  .cta:hover { filter:brightness(1.04); }
  @media only screen and (max-width: 520px) {
    .shell  { width:100% !important; }
    .pad    { padding-left:24px !important; padding-right:24px !important; }
    .h1     { font-size:28px !important; line-height:1.15 !important; }
    .cta    { font-size:16px !important; padding:16px 24px !important; }
    .logo   { height:26px !important; }
    .bignum { font-size:56px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFF; font-family:'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#374151;">

<div style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
  Streak reset. One day back on the board rebuilds it.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFF;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="shell" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

      <tr>
        <td style="background-color:#0A0E1A; border-radius:24px 24px 0 0; padding:28px 40px; text-align:left;">
          <img src="https://wwfiauhsbssjowaxmqyn.supabase.co/storage/v1/object/sign/Wordifi%20Brand/email/assets/logo-light.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hZGExZDI2Zi1lMzg3LTQzMWMtYjkxNi0wMjY4NjM3Y2YwNzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJXb3JkaWZpIEJyYW5kL2VtYWlsL2Fzc2V0cy9sb2dvLWxpZ2h0LnBuZyIsImlhdCI6MTc3NjkzNzAxOCwiZXhwIjoxOTM0NjE3MDE4fQ.-d64zsBC0ExEBBYb9u3VQ1vEiTaiTIMao9qrXIcjVwA" width="128" height="40" alt="wordifi" class="logo"
               style="height:32px; width:auto; display:block; color:#FFFFFF; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:22px; letter-spacing:-0.03em;">
        </td>
      </tr>

      <tr>
        <td class="pad" style="background-color:#FFFFFF; border-radius:0 0 24px 24px; padding:40px 40px 40px;">

          <div style="font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            Streak reset
          </div>

          <h1 class="h1" style="margin:10px 0 14px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:34px; line-height:1.1; letter-spacing:-0.03em; color:#0A0E1A;">
            Streak broken, {first_name}.<br>
            <span style="font-style:italic; color:#00E5B6;">The work isn't.</span>
          </h1>

          <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            You missed yesterday. Your <strong style="color:#0A0E1A; font-weight:700;">{previous_streak_days}-day streak</strong> reset to zero. Your Readiness Score did not &mdash; every question you answered still counts.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
            <tr>
              <td style="background-color:#F2F4FF; border-radius:16px; padding:20px 24px;">
                <p style="margin:0 0 12px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">Badge</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:45%;">
                      <p style="margin:0 0 2px; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; color:#9CA3AF;">From</p>
                      <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:700; font-size:17px; color:#374151;">{previous_badge_name}</p>
                    </td>
                    <td style="width:10%; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; color:#9CA3AF;" align="center">&rarr;</td>
                    <td style="width:45%;" align="right">
                      <p style="margin:0 0 2px; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; color:#9CA3AF;">Now</p>
                      <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:17px; color:#0A0E1A;">{dropped_to_badge_name}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 6px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            To reclaim {previous_badge_name}
          </p>
          <p class="bignum" style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:64px; line-height:1; letter-spacing:-0.04em; color:#0A0E1A;">
            {rebuild_days_required}<span style="font-size:20px; font-weight:700; color:#00E5B6; letter-spacing:0;">&nbsp;days</span>
          </p>
          <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:15px; line-height:1.55; color:#374151;">
            That starts with one session today. Twenty minutes. Then tomorrow.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td align="center" style="border-radius:16px; background-color:#2B70EF; box-shadow:0 6px 16px rgba(43,112,239,0.30);">
                <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wordifi.com/today" style="height:56px;v-text-anchor:middle;width:220px;" arcsize="29%" stroke="f" fillcolor="#2B70EF"><w:anchorlock/><center style="color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:16px;font-weight:bold;">Start day one</center></v:roundrect><![endif]-->
                <!--[if !mso]><!-- -->
                <a href="https://wordifi.com/today" class="cta" style="display:inline-block; padding:18px 36px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:16px; color:#FFFFFF; text-decoration:none; border-radius:16px; letter-spacing:0.01em;">
                  Start day one
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <tr>
        <td class="pad" style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid rgba(229,231,235,0.7); padding-top:20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  Streak notifications help you rebuild routine. <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Change frequency</a> &middot; <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Unsubscribe</a>
                </p>
                <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  <a href="https://wordifi.com" style="color:#9CA3AF; text-decoration:underline;">wordifi</a> &middot; The smart path to certified.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    },
  },

  'notif.trial_ending_t3': {
    push: {
      headings: { en: '{first_name}, {streak_days} days of work.' },
      contents: { en: '{badge_name}. A {streak_days}-day streak. Trial ends {trial_ends_at_formatted} — keep building on the same account.' },
      deep_link: '/paywall?source=push_trial_t3',
    },
    email: {
      subject: 'Look what you\'ve built, {first_name}. Three days to keep it.',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Three days of trial left</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img   { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
  a     { color:#2B70EF; }
  .cta:hover { filter:brightness(1.04); }
  @media only screen and (max-width: 520px) {
    .shell { width:100% !important; }
    .pad   { padding-left:24px !important; padding-right:24px !important; }
    .h1    { font-size:28px !important; line-height:1.15 !important; }
    .cta   { font-size:16px !important; padding:16px 24px !important; }
    .logo  { height:26px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFF; font-family:'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#374151;">

<div style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
  Three days of trial remaining. Keep the streak, keep the score.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFF;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="shell" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

      <tr>
        <td style="background-color:#0A0E1A; border-radius:24px 24px 0 0; padding:28px 40px; text-align:left;">
          <img src="https://wwfiauhsbssjowaxmqyn.supabase.co/storage/v1/object/sign/Wordifi%20Brand/email/assets/logo-light.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hZGExZDI2Zi1lMzg3LTQzMWMtYjkxNi0wMjY4NjM3Y2YwNzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJXb3JkaWZpIEJyYW5kL2VtYWlsL2Fzc2V0cy9sb2dvLWxpZ2h0LnBuZyIsImlhdCI6MTc3NjkzNzAxOCwiZXhwIjoxOTM0NjE3MDE4fQ.-d64zsBC0ExEBBYb9u3VQ1vEiTaiTIMao9qrXIcjVwA" width="128" height="40" alt="wordifi" class="logo"
               style="height:32px; width:auto; display:block; color:#FFFFFF; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:22px; letter-spacing:-0.03em;">
        </td>
      </tr>

      <tr>
        <td class="pad" style="background-color:#FFFFFF; border-radius:0 0 24px 24px; padding:40px 40px 40px;">

          <div style="font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            Trial ends {trial_ends_at_formatted}
          </div>

          <h1 class="h1" style="margin:10px 0 14px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:34px; line-height:1.1; letter-spacing:-0.03em; color:#0A0E1A;">
            Look what you've built, {first_name}.<br>
            <span style="font-style:italic; color:#00E5B6;">Three days to keep it.</span>
          </h1>

          <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            Most people stop studying after a week. You didn't. Here's what your trial looks like on paper.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
            <tr>
              <td style="background-color:#F2F4FF; border-radius:16px; padding:20px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:50%; padding:0 10px 0 0;">
                      <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">Streak</p>
                      <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:28px; line-height:1; letter-spacing:-0.02em; color:#0A0E1A;">&#x1F525; {streak_days}</p>
                      <p style="margin:2px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; color:#9CA3AF;">days running</p>
                    </td>
                    <td style="width:50%; padding:0 0 0 10px; border-left:1px solid rgba(229,231,235,0.7);">
                      <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF; padding-left:14px;">Badge</p>
                      <p style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; line-height:1.15; letter-spacing:-0.02em; color:#0A0E1A; padding-left:14px;">{badge_name}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            On <strong style="color:#0A0E1A; font-weight:700;">{trial_ends_at_formatted}</strong> your trial ends. Subscribe now and the streak, the badge, and your Readiness Score roll straight into your full account.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td align="center" style="border-radius:16px; background-color:#2B70EF; box-shadow:0 6px 16px rgba(43,112,239,0.30);">
                <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wordifi.com/subscribe" style="height:56px;v-text-anchor:middle;width:240px;" arcsize="29%" stroke="f" fillcolor="#2B70EF"><w:anchorlock/><center style="color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:16px;font-weight:bold;">Keep my progress</center></v:roundrect><![endif]-->
                <!--[if !mso]><!-- -->
                <a href="https://wordifi.com/subscribe" class="cta" style="display:inline-block; padding:18px 36px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:16px; color:#FFFFFF; text-decoration:none; border-radius:16px; letter-spacing:0.01em;">
                  Keep my progress
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:13px; line-height:1.5; color:#9CA3AF;">
            Cancel anytime. No surprise charges &mdash; we'll remind you before every renewal.
          </p>

        </td>
      </tr>

      <tr>
        <td class="pad" style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid rgba(229,231,235,0.7); padding-top:20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  This is a trial reminder. <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Manage emails</a> &middot; <a href="https://wordifi.com/settings/subscription" style="color:#9CA3AF; text-decoration:underline;">Manage subscription</a>
                </p>
                <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  <a href="https://wordifi.com" style="color:#9CA3AF; text-decoration:underline;">wordifi</a> &middot; The smart path to certified.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    },
  },

  'notif.trial_ending_t1': {
    push: {
      headings: { en: 'Tomorrow: pause.' },
      contents: { en: '{first_name}, your streak keeps counting or it doesn\'t. {badge_name} rank, {streak_days} days, one tap away.' },
      deep_link: '/paywall?source=push_trial_t1',
    },
    email: {
      subject: 'Tomorrow, {first_name}. Everything pauses.',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>One day left</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img   { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
  a     { color:#2B70EF; }
  .cta:hover { filter:brightness(1.04); }
  @media only screen and (max-width: 520px) {
    .shell  { width:100% !important; }
    .pad    { padding-left:24px !important; padding-right:24px !important; }
    .h1     { font-size:30px !important; line-height:1.1 !important; }
    .cta    { font-size:16px !important; padding:16px 24px !important; }
    .logo   { height:26px !important; }
    .bignum { font-size:88px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFF; font-family:'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#374151;">

<div style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
  One day left on your trial. Tomorrow, practice pauses.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFF;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="shell" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

      <tr>
        <td style="background-color:#0A0E1A; border-radius:24px 24px 0 0; padding:32px 40px 36px; text-align:left;">
          <img src="https://wwfiauhsbssjowaxmqyn.supabase.co/storage/v1/object/sign/Wordifi%20Brand/email/assets/logo-light.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hZGExZDI2Zi1lMzg3LTQzMWMtYjkxNi0wMjY4NjM3Y2YwNzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJXb3JkaWZpIEJyYW5kL2VtYWlsL2Fzc2V0cy9sb2dvLWxpZ2h0LnBuZyIsImlhdCI6MTc3NjkzNzAxOCwiZXhwIjoxOTM0NjE3MDE4fQ.-d64zsBC0ExEBBYb9u3VQ1vEiTaiTIMao9qrXIcjVwA" width="128" height="40" alt="wordifi" class="logo"
               style="height:28px; width:auto; display:block; margin:0 0 28px; color:#FFFFFF; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; letter-spacing:-0.03em;">
          <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9CA3AF;">
            Trial ending
          </p>
          <p class="bignum" style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:110px; line-height:1; letter-spacing:-0.05em; color:#FFFFFF;">
            1
          </p>
          <p style="margin:4px 0 0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; line-height:1; color:#00E5B6;">
            day left
          </p>
        </td>
      </tr>

      <tr>
        <td class="pad" style="background-color:#FFFFFF; border-radius:0 0 24px 24px; padding:36px 40px 40px;">

          <h1 class="h1" style="margin:0 0 14px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:34px; line-height:1.1; letter-spacing:-0.03em; color:#0A0E1A;">
            Tomorrow, {first_name}.<br>
            <span style="font-style:italic; color:#00E5B6;">Everything pauses.</span>
          </h1>

          <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            Your <strong style="color:#0A0E1A; font-weight:700;">{streak_days}-day streak</strong> and your <strong style="color:#0A0E1A; font-weight:700;">{badge_name}</strong> badge are ready to carry forward. Without a subscription they freeze tomorrow &mdash; sessions locked, score paused, streak at risk.
          </p>

          <p style="margin:16px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:16px; line-height:1.55; color:#374151;">
            Most people prepare for German. Smart people prepare for the certificate. You're already on the smart path. Don't stop the day before the finish.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td align="center" style="border-radius:16px; background-color:#2B70EF; box-shadow:0 6px 16px rgba(43,112,239,0.30);">
                <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wordifi.com/subscribe" style="height:56px;v-text-anchor:middle;width:220px;" arcsize="29%" stroke="f" fillcolor="#2B70EF"><w:anchorlock/><center style="color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:16px;font-weight:bold;">Subscribe now</center></v:roundrect><![endif]-->
                <!--[if !mso]><!-- -->
                <a href="https://wordifi.com/subscribe" class="cta" style="display:inline-block; padding:18px 36px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:16px; color:#FFFFFF; text-decoration:none; border-radius:16px; letter-spacing:0.01em;">
                  Subscribe now
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:13px; line-height:1.5; color:#9CA3AF;">
            Cancel anytime. No hidden charges.
          </p>

        </td>
      </tr>

      <tr>
        <td class="pad" style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid rgba(229,231,235,0.7); padding-top:20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  Final trial reminder. <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Manage emails</a> &middot; <a href="https://wordifi.com/settings/subscription" style="color:#9CA3AF; text-decoration:underline;">Manage subscription</a>
                </p>
                <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  <a href="https://wordifi.com" style="color:#9CA3AF; text-decoration:underline;">wordifi</a> &middot; The smart path to certified.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    },
  },

  'notif.trial_ending_t0': {
    push: {
      headings: { en: '4 hours.' },
      contents: { en: '{streak_days}-day streak. {badge_name}. Keep it.' },
      deep_link: '/paywall?source=push_trial_t0',
    },
    email: {
      subject: 'Four hours, {first_name}. Then it\'s over.',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Four hours left</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img   { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
  a     { color:#2B70EF; }
  .cta:hover { filter:brightness(1.04); }
  @media only screen and (max-width: 520px) {
    .shell  { width:100% !important; }
    .pad    { padding-left:24px !important; padding-right:24px !important; }
    .h1     { font-size:32px !important; line-height:1.1 !important; }
    .cta    { font-size:16px !important; padding:16px 24px !important; }
    .logo   { height:26px !important; }
    .bignum { font-size:96px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFF; font-family:'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#374151;">

<div style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">
  Four hours. Then your trial is over.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFF;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="shell" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

      <tr>
        <td style="background-color:#0A0E1A; border-radius:24px 24px 0 0; padding:32px 40px 36px; text-align:left;">
          <img src="https://wwfiauhsbssjowaxmqyn.supabase.co/storage/v1/object/sign/Wordifi%20Brand/email/assets/logo-light.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hZGExZDI2Zi1lMzg3LTQzMWMtYjkxNi0wMjY4NjM3Y2YwNzAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJXb3JkaWZpIEJyYW5kL2VtYWlsL2Fzc2V0cy9sb2dvLWxpZ2h0LnBuZyIsImlhdCI6MTc3NjkzNzAxOCwiZXhwIjoxOTM0NjE3MDE4fQ.-d64zsBC0ExEBBYb9u3VQ1vEiTaiTIMao9qrXIcjVwA" width="128" height="40" alt="wordifi" class="logo"
               style="height:28px; width:auto; display:block; margin:0 0 28px; color:#FFFFFF; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; letter-spacing:-0.03em;">
          <p style="margin:0 0 4px; font-family:'Nunito Sans', Arial, sans-serif; font-weight:800; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#DD0000;">
            Final call
          </p>
          <p class="bignum" style="margin:0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:120px; line-height:1; letter-spacing:-0.05em; color:#FFFFFF;">
            4h
          </p>
          <p style="margin:4px 0 0; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:20px; line-height:1; color:#00E5B6;">
            left on your trial
          </p>
        </td>
      </tr>

      <tr>
        <td class="pad" style="background-color:#FFFFFF; border-radius:0 0 24px 24px; padding:36px 40px 40px;">

          <h1 class="h1" style="margin:0 0 14px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:36px; line-height:1.05; letter-spacing:-0.03em; color:#0A0E1A;">
            Four hours, {first_name}.<br>
            <span style="font-style:italic; color:#00E5B6;">Then it's over.</span>
          </h1>

          <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:17px; line-height:1.5; color:#374151;">
            {streak_days}-day streak. {badge_name} badge. Don't lose the momentum today.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr>
              <td align="center" style="border-radius:16px; background-color:#2B70EF; box-shadow:0 6px 16px rgba(43,112,239,0.30);">
                <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://wordifi.com/subscribe" style="height:56px;v-text-anchor:middle;width:220px;" arcsize="29%" stroke="f" fillcolor="#2B70EF"><w:anchorlock/><center style="color:#ffffff;font-family:Tahoma,Arial,sans-serif;font-size:16px;font-weight:bold;">Keep going</center></v:roundrect><![endif]-->
                <!--[if !mso]><!-- -->
                <a href="https://wordifi.com/subscribe" class="cta" style="display:inline-block; padding:18px 36px; font-family:'Outfit', Tahoma, Arial, sans-serif; font-weight:800; font-size:16px; color:#FFFFFF; text-decoration:none; border-radius:16px; letter-spacing:0.01em;">
                  Keep going
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:13px; line-height:1.5; color:#9CA3AF;">
            Cancel anytime.
          </p>

        </td>
      </tr>

      <tr>
        <td class="pad" style="padding:32px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-top:1px solid rgba(229,231,235,0.7); padding-top:20px;">
                <p style="margin:0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  Last email in this trial series. <a href="https://wordifi.com/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Manage emails</a> &middot; <a href="https://wordifi.com/settings/subscription" style="color:#9CA3AF; text-decoration:underline;">Manage subscription</a>
                </p>
                <p style="margin:10px 0 0; font-family:'Nunito Sans', Arial, sans-serif; font-size:12px; line-height:1.55; color:#9CA3AF;">
                  <a href="https://wordifi.com" style="color:#9CA3AF; text-decoration:underline;">wordifi</a> &middot; The smart path to certified.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    },
  },
  'notif.badge_rank_up': {
    push: {
      headings: { en: '{new_badge_translation}.' },
      contents: { en: 'You crossed the line three days ago; the data just caught up. {next_badge_name} is {days_to_next_badge} days out.' },
      deep_link: '/home?source=push_badge',
    },
    in_app: {
      headings: { en: 'Rank up · {new_badge_translation}' },
      contents: { en: 'Next: {next_badge_name} · {days_to_next_badge} days.' },
    },
  },

  'notif.score_shield_used': {
    in_app: {
      headings: { en: 'Shield caught it.' },
      contents: { en: 'Streak held at {current_streak_days} days. No shields left.' },
    },
  },

  'notif.section_completed': {
    in_app: {
      headings: { en: '{section} {level} · {score_pct}' },
      contents: { en: 'Teil {teil} complete. The next Teil builds on this one — take it while the rhythm\'s there.' },
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
export type RenderedInApp = { headings: { en: string }; contents: { en: string }; deep_link?: string };

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
      headings: { en: interpolate(tmpl.in_app.headings.en, ctx) },
      contents: { en: interpolate(tmpl.in_app.contents.en, ctx) },
      deep_link: tmpl.in_app.deep_link,
    };
  }

  console.warn(`[templates] no ${channel} template for event: ${eventKey}`);
  return null;
}
