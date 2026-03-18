# Rebuild Test Stream — Immersive Swipe Feed with Explanation Panel, Bottom Sheet & Reporting

## Features

- **Immersive question feed** — Swipe up through an infinite vertical feed of exam-style questions, one per screen
- **Instant answer feedback** — Tap an option to lock in your answer; correct highlights green, wrong highlights red with the correct answer shown; haptic feedback fires immediately
- **Explanation panel** — After answering, an explanation panel slides up from the bottom pushing the question content upward, showing ✓/✗ result, explanation text, and an EN/DE language toggle (preference saved)
- **Swipe-down review** — Swipe down to review the previous question (max 1 back) in read-only mode with its answer and explanation already visible
- **Preparedness gauge** — Top-right pill shows your level and readiness score, colour-coded (red < 40%, amber 40–69%, green ≥ 70%), animates on each answer
- **Gauge bottom sheet** — Tap the gauge pill to open a draggable bottom sheet showing Hören %, Lesen %, overall %, streak count, and last practice date
- **Section & Teil indicator** — Top-left pill shows 🎧 Hören or 📖 Lesen with Teil number for the current question
- **Report an issue** — Small link in the explanation panel opens a report flow: reason picker (Wrong answer, Bad audio, Unclear question, Other) + optional text detail, writes to Supabase `question_reports`
- **Swipe affordance cue** — Small upward chevron appears after answering, pulses once after 3 seconds of idle; auto-hides permanently after 10 total answers (stored locally)
- **Smart queue** — Fetches 20 questions filtered by level, excluding questions answered in the last 30 days; pre-fetches 20 more when 5 remain; recycles with a banner when all questions are exhausted
- **XP & streak** — XP awarded per correct answer (A1=5, A2=10, B1=15); streak updates daily; milestone toasts appear as non-blocking top banners (7-day, 30-day streak; XP milestones; first B1 correct)
- **Preparedness score writes** — +2 correct / −1 incorrect, clamped 0–100, written to Supabase asynchronously (never blocks UI)
- **Empty state** — When queue is exhausted: shows readiness gauge, streak, and two buttons: "Try Sectional Test" and "Come back tomorrow"
- **First-launch welcome** — If no answer history exists, shows "Your first [Level] question. Swipe up when you're ready."

## Design

- **Dark navy status bar zone** (52px) at top with two pills — section/teil on the left, preparedness gauge on the right
- **Full-bleed question card** — No card borders, no shadows, no container chrome; the card IS the screen; deep navy (#091728) accent tones with clean white (#FFFFFF) surfaces
- **Audio player** for Hören questions — dark rounded bar (56px) with green play/pause button, progress bar, time display, and replay icon
- **Stimulus panel** for Lesen questions — scrollable container capped at 38% screen height with a soft bottom fade when content overflows
- **Answer options** — Full-width rows with left key pill (A/B/C or Richtig/Falsch), 52px minimum touch height, thin dividers; true/false and ja/nein rendered as two side-by-side square buttons
- **Explanation panel** — Slides up from bottom (42% screen height), white background, rounded top corners (16px radius); green ✓ Richtig or red ✗ Falsch header; explanation body; EN/DE toggle top-right; report link bottom-right
- **Bottom sheet** — 40% screen height, drag handle at top, dark background overlay, swipe-down or tap-outside to close; animated bar charts for Hören/Lesen/Overall scores
- **Milestone toasts** — Full-width banner sliding in from top, auto-dismiss after 3 seconds, non-blocking (user can keep swiping)
- **Swipe animations** — 280ms ease-out card transitions; spring snap-back below threshold; gentle bounce + option flash when trying to skip unanswered
- **Colour palette** — Deep navy primary (#091728), green accent (#14B86A), red for errors (#E24D4D), amber for warning (#F4B942), white surfaces

## Screens / Components

**Test Stream screen (Home tab)**
- Three permanent zones: status bar, question card, swipe affordance
- PanResponder for vertical swipe gestures (up = next, down = previous, horizontal = ignored)
- Swipe threshold: 40% screen height OR 800px/s velocity
- Tab bar stays visible at all times

**StreamCard component (rebuilt)**
- Renders stimulus (audio or text), question text, answer options, and the new explanation panel
- Handles answer selection, option highlighting, and explanation panel slide-up animation
- Supports all question types: MCQ, true/false, ja/nein, matching, speaker_match

**Explanation panel (new, inside StreamCard)**
- Animated slide-up panel that pushes card content upward
- Shows result, explanation text with EN/DE toggle, and report link
- Language preference persisted to local storage

**Preparedness bottom sheet (new component)**
- Custom draggable bottom sheet with Hören/Lesen/Overall breakdown bars
- Streak count and last practice date
- Backdrop tap or swipe-down to dismiss

**Report modal (new component)**
- Reason picker: Wrong answer, Bad audio, Unclear question, Other
- Optional text detail input
- Submit writes to `question_reports` table in Supabase

**Stream helpers (updated)**
- XP rates: A1=5, A2=10, B1=15 per correct answer
- Preparedness delta: +2 correct, −1 incorrect
- Batch XP/streak writes every 5 answers
- 30-day deduplication window for queue
