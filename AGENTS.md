# Codex Instructions — Wordifi Exam Prep App

## Design System

**All UI work MUST follow the Wordifi Design System defined in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).**

The master source of truth is the Wordifi Brand Brief (`Wordifi_Stitch_Doc1_Base_Brief.docx`).
`DESIGN_SYSTEM.md` is the in-repo representation of that brief. Read it before writing or modifying
any UI component, screen, or style.

Key rules to always enforce:
- Use exact color tokens from the token table — no arbitrary hex values
- Fonts: **Outfit 800** for all headlines, scores, and CTA labels · **Nunito Sans 400** for body copy and option labels · **Nunito Sans 600** for sub-headlines, card titles, and emphasis
- No 1px solid borders — use surface color shifts or Ghost Borders (outline-variant at 10–20% opacity)
- Primary CTAs use **flat Primary Blue (`#2B70EF`)** — no gradients, ever
- Body copy always uses Mid Gray (`#374151`) — never dark navy, never the old `on-surface-variant`
- Corner radii: 12px small elements · 16px cards and buttons · 24px large containers
- Minimum horizontal margin: 24px · Section spacing: 32px
- 8pt grid — all spacing in multiples of 8

## Project Stack

- **Framework:** React Native + Expo (managed workflow)
- **Navigation:** Expo Router (file-based, `expo/app/` directory)
- **Platform target:** Mobile (iOS + Android), 390px design width

## General Coding Rules

- Read existing code before modifying — understand patterns in use
- Match the conventions of the surrounding code
- Do not add features, comments, or abstractions beyond what is asked
- Do not introduce 1px borders, arbitrary colors, or off-system fonts in any UI code
