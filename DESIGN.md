---
version: alpha
colors:
  brand: "#E1461D"
  brandHover: "#B8330F"
  ink: "#241512"
  inkMuted: "#6B5B52"
  background: "#F6EEE0"
  surface: "#FFFFFF"
  border: "#E8DCC8"
  success: "#2F8F5B"
  successSurface: "#E4F3EA"
  warning: "#F2A93B"
  danger: "#C0392B"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
  body:
    fontFamily: "Inter, sans-serif"
  utility:
    fontFamily: "IBM Plex Mono, monospace"
rounded:
  control: "0.75rem"
  card: "1rem"
  pill: "9999px"
components:
  button:
    primary: "brand solid, white text"
    secondary: "white with border"
    destructive: "danger only for irreversible actions"
  surface:
    default: "white with hairline border"
    feature: "food-first photography and authentic menu content"
  icon:
    strokeWidth: 1.8
    style: "simple line SVG"
omitted:
  - section: spacing
    reason: "Tailwind v3 default spacing scale remains canonical in runtime"
---
# Delixious Design System

## Overview
Delixious is a Nigerian food-ordering marketplace for customers, restaurants and riders. The product should feel like a reliable food counter: inviting food photography, clear menu prices, focused ordering actions and readable transaction records. **Not** a crypto exchange, fintech neon UI, generic purple SaaS dashboard or a decorative animation demo.

**Registers:** public discovery pages may be expressive and food-led; logged-in order, wallet, rider and admin screens are task-first and restrained. Use a single brand identity across them.

**Token ownership:** `frontend/tailwind.config.js` is the runtime source of truth. The YAML above mirrors its accepted color and font values. Shared components consume Tailwind semantic utility names, never ad-hoc raw hex values. Any token change must update both files.

## Colors
Brand pepper is for primary actions, active navigation, and meaningful links. Ink is the default text. Sand is the page canvas, paper the content surface, hairline the border. Jade denotes success, danger denotes failure, gold denotes caution or positive ratings. Never convey status by color without text.

## Typography
Space Grotesk: page titles, food headings and key prices. Inter: all controls, forms and reading text. IBM Plex Mono: short order references and utilitarian metadata, not paragraphs. Preserve typographic hierarchy at 320px widths, tablet and desktop.

## Layout
Page gutters are 16px on phones and 24px on larger screens; max content width depends on task (reading 4xl, operations 6xl, discovery 7xl). Touch targets should reach ~44px. Prevent horizontal overflow at 320px, 200% zoom and with long currencies/usernames. Avoid nesting full-screen fixed-height scroll regions.

## Elevation & Depth
Flat paper panels with a fine border by default; reserve elevation for overlays, menus, selected surfaces and active affordances. Avoid generic floating gradient cards.

## Shapes
Use rounded-xl controls, rounded-2xl standard panels, rounded-full pills only for chips/status. The existing ticket-edge visual motif may appear on order receipts; do not force it onto every admin panel.

## Components
- **Icon:** `frontend/src/components/ui/Icon.jsx`, native SVG, stroke width 1.8, 24x24 viewBox; no emoji.
- **Button/Field/Panel:** `frontend/src/components/ui/Primitives.jsx`, use for new or touched workflows.
- **Loading:** maintain content geometry and use an accessible labeled loading region.
- **Search:** show an explicit clear button and handle stale requests; respect IME input.
- **Forms:** labels and validation feedback visible, strong keyboard focus, prevent duplicate submissions.
- **Status:** semantic text, not badges as decorative headings.
- **Wallet:** must never display a fake virtual account or enabled transfer until a regulated provider is activated.

## Do's and Don'ts
- Do use real dish images with fixed aspect ratios and `object-cover`.
- Do show prices, availability and order state clearly.
- Do make all actions accessible on touch and keyboard.
- Don't use emojis for UI icons or default to icon-only primary actions.
- Don't render fake account balances, mock orders, fake testimonials or pretend integrations work.
- Don't invent delivery availability, payout eligibility or financial guarantees.
- Don't turn every feature into the same oversized marketing card.

## Verification
Screen review: 320px, 375px, 768px and 1280px; keyboard flow, zoom 200%, reduced motion, loading/empty/error/success, restaurant and rider roles, dark text contrast and checkout confirmation. Static checks complement but do not replace real browser tests.
