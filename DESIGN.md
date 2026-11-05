# MatchTutor design system

Every UI change must conform to this file. Where it is silent, follow the nearest rule here, not an older pattern in the
code. The reasoning behind each rule is in `REDESIGN_DECISIONS.md`.

**Status: approved and implemented (2026-11-05), including every value marked ◆** (◆ marks values chosen while writing
this document rather than in the walkthrough). `npm run check:design` enforces §10.

**Direction:** an established marketplace, not a startup landing page. Light neutral page, one restrained brand colour,
small radii, borders instead of decoration, real information doing the work. References: Wyzant (search, rows,
profiles), LinkedIn (messaging, notifications, account, editor, admin), highschooltutors.com.au (home, landing pages).

---

## 1. Colour

Colours are defined once as CSS variables in `app/globals.css` and mirrored in `tailwind.config.js` under the same names.
No other hex, `rgb()` or `rgba()` value may appear in components, except in `lib/email/send.js` and
`supabase/email-templates/` (which cannot read CSS variables and use the same values as constants).

| Token | Value | Role |
| --- | --- | --- |
| `--accent` | `#016764` | Links, primary buttons, the verified mark, unread badges, focus ring, selected controls, the active nav item, the loading spinner, the wordmark's "Tutor". Nothing else. |
| `--accent-hover` | `#005958` | Hover/pressed state of the above. |
| `--text` ◆ | `#1A1A1A` | Primary text, headings. |
| `--text-2` ◆ | `#4A4A4A` | Secondary text (meta lines, descriptions). |
| `--muted` ◆ | `#666666` | Tertiary text (timestamps, captions, the 12px floor). |
| `--placeholder` ◆ | `#707070` | Input placeholders. |
| `--border-input` ◆ | `#8A8A8A` | Borders of inputs, selects, checkboxes, radios (3:1 non-text contrast). |
| `--rule` ◆ | `#E3E3E3` | Dividers between rows and sections; borders of static containers. |
| `--surface` | `#FFFFFF` | Page and every container. |
| `--surface-2` ◆ | `#F5F5F5` | Hover rows, unread rows, the no-photo fallback, admin inset areas. The only tint. |
| `--error` ◆ | `#B42318` | Errors, destructive actions, "Delete account". |
| `--warning` ◆ | `#B54708` | Warnings, rejections in notifications. |
| `--success` ◆ | `#067647` | Success messages. |

Rules:
- **All text is at least 4.5:1** against its background. Checked: every text token above passes on both `--surface`
  and `--surface-2` (lowest: `--placeholder` 4.54:1 on `--surface-2`). White on `--accent` is 6.72:1.
- **No hue in neutrals.** The teal-tinted `slate` override in `tailwind.config.js` is removed; greys are neutral.
- **No gradients, no glows, no translucent colour washes.** The one translucent value allowed is the modal scrim
  (`rgba(0,0,0,0.4)`) and the route-loading overlay (`rgba(255,255,255,0.7)` ◆).
- Status colours are for text, icons and 1px borders. A status background tint is allowed only for inline alert boxes,
  at most one per screen ◆.
- Colour never carries meaning alone: pair it with text or an icon.

## 2. Typography

**Font:** Source Sans 3 (Google Fonts), weights **400 and 600 only**. No other weights, no italics except for emphasis
inside long-form text. Emails use the system sans stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
Helvetica, Arial, sans-serif`) at the same sizes and weights. Caveat and General Sans are not used anywhere. The
wordmark is an SVG, never live text.

| Size | Line height ◆ | Use |
| --- | --- | --- |
| 32px | 40px | Page title (h1) on wide screens. Below 640px it becomes 24px. |
| 24px | 32px | Page title on narrow screens; h1 on auth, account, 404/error; major section headings. |
| 20px | 28px | Section headings (h2) inside a page; the rate figure in rows. |
| 16px | 24px | Reading text: bios, About, blog bodies, legal text, the home lead line. Tutor names in rows. |
| 14px | 20px | The UI base: rows, forms, buttons, nav, filters, notifications, messages. |
| 12px | 16px | The floor. Meta only: dates, captions, counts beside links, badges. Never body text. |

Rules:
- **Only these six sizes.** No half pixels, no `clamp()`, no `text-[Npx]` outside this list.
- **Weights:** 400 for body; 600 for headings, names, buttons, form labels ◆, unread notification titles, and emphasis
  (`<strong>` / `<b>` render at 600).
- **No uppercase letter-spaced labels**, no eyebrows above headings, no numbered "01 / 02" labels.
- Headings are sentence case and never end with a full stop.
- **Line length:** long-form text (bios, About, blog bodies, legal text) is capped at `max-w-[65ch]`. Source Sans 3 is
  narrow, so the 680px reading width alone gives about 100 characters a line; 65ch keeps it near 75.

## 3. Spacing and layout

- **Spacing steps:** 4, 8, 12, 16, 24, 32, 48, 64px. No other values (Tailwind `1, 2, 3, 4, 6, 8, 12, 16`).
  Items inside a group are closer together than the groups are to each other.
- **Widths:** page content **1128px**; reading width **680px** (forms, account, blog bodies, legal, onboarding ◆);
  auth forms **400px**. No other container widths. Admin uses the page width ◆.
- **Gutters:** 24px at 1024px and above ◆, 16px below.
- **Breakpoints:** two only.
  - **Compact, below 1024px** (Tailwind `lg`): nav collapses to its menu; filters move into a sheet; profile and
    company pages drop the sticky right column.
  - **Phone, below 640px** (Tailwind `sm`): 32px headings become 24px; form fields stack; rows use the phone layout;
    form modals become full-screen sheets.
  - `md:` (768px) is not used. Existing `md:` classes move to `sm:` or `lg:`.
- **Tap targets:** at least **44px** tall for buttons, inputs, selects, toggles, icon buttons and tappable rows; at
  least **24px** for text links (footer, link lists, breadcrumbs, inline).

## 4. Shape, borders, shadows

- **Radius: 4px** for buttons, inputs, selects, banners, article covers, modals, menus, toasts, company logos and the
  few containers that remain. **People are circles** (photos and initials fallbacks). Nothing else is round: no pills.
- **Borders or shadows:** static elements use a 1px `--rule` border or nothing; they never have a shadow.
  Floating elements (menus, popovers, modals, toasts, sheets) use the one shadow ◆
  `0 4px 16px rgba(0,0,0,0.12)` and may also keep a 1px `--rule` border so their edge is visible on white. This is the
  only case where border and shadow combine.
- **No nested containers:** a bordered box never sits inside another bordered box. Inside a section, separate with
  spacing or a rule.
- **Prefer no box at all.** Lists are rows divided by rules; sections are divided by rules and spacing.

## 5. Motion

- **Allowed:** colour and background changes on hover/focus/press (120ms ◆, ease-out); menus, popovers and modals
  appearing (150ms ◆ opacity only); the route-loading spinner.
- **Not allowed:** entrance animations (fade or slide on load or scroll), staggered reveals, marquees, auto-rotating
  content, typewriter effects, blinking carets, bouncing cues, swaying or floating decoration, parallax, transforms on
  hover (no lifting, nudging arrows, sliding underlines), hide-on-scroll bars, page-level blur.
- All motion is removed under `prefers-reduced-motion: reduce`.
- `motion/react` is no longer needed for page content once the above is applied.

## 6. Components

**Nav** (`components/TopNav.js`): white, 1px bottom rule, always visible, 1128px.
- Logged out: Find a tutor, Companies, Blog, Become a tutor, Log in (text button), Sign up (primary button).
- Signed in: Browse, Messages, Notifications (icon + label with numeric badge), Companies, Blog, Me (dropdown: Profile,
  Account, Saved tutors, My company, Write, Admin, Log out, each gated as today). Companies have no Messages item.
- Compact: logo, a magnifier icon linking to `/browse`, menu button opening a full-width sheet; signed-in users also see
  Messages and Notifications icons with badges.
- No search box in the nav.

**Badge:** numeric only, 12px 600 white on `--accent`, 16px tall ◆, 4px radius, "9+" above nine. No dots.

**Footer:** one light row on `--surface` with a top rule: wordmark, Become a tutor (logged out only), Companies, Blog,
Terms, Privacy, Report a bug, copyright. Hidden on auth pages and `/messages`.

**Buttons:** 44px tall ◆, 4px radius, 14px 600, sentence case.
- Primary: `--accent` fill, white text. One per view where possible.
- Secondary: white with a 1px `--border-input` border, `--text` text.
- Text button: no border, `--accent` text.
- Destructive: `--error` text or fill, used only for irreversible actions.
- No icons inside buttons unless the button is icon-only (then it carries an `aria-label`).

**Inputs, selects, checkboxes, radios:** 44px tall ◆, white, 1px `--border-input`, 4px radius, 14px text, label above
in 14px 600, hint below in 12px `--muted`. Focus: `--accent` border plus a 2px `--accent` outline offset 2px ◆. Errors:
`--error` border and an error line below. No placeholder text standing in for a label, and no placeholder people.

**Tutor row** (used by `/browse`, the home list, `/tutors` pages, company "Our tutors", related tutors):
- Wide: 72px ◆ circle photo; middle column with name ("First L.", 16px 600), verified mark or company name, tagline,
  credentials, years, in person near suburb and/or Online, reviews line, 2-line bio excerpt, first few subjects; right
  column with rate (20px 600 + "per hour") and the bookmark. Rows separated by a 1px rule, no box, no shadow.
- Phone: 56px circle photo; name, verified and rate on the first line; the rest stacked; the whole row is the link.
- **Rate:** a missing or $0 rate reads "Rate not listed". Company tutors show no rate.
- **Reviews line:** rating and count, or "No reviews yet" (see open item B in the decision log).
- **Subjects:** plain text, comma-separated, with "+N more" ◆. No chips.

**Company row:** the tutor row with a square logo; name, location, subjects from its tutors, number of tutors,
packages, reviews line.

**Avatar:** circle for people, square (4px) for companies. Fallback: initials (from the display name, not the
`initials` column) in `--text-2` on `--surface-2`. No icons, no tutor-picked colours.

**Verified mark:** `--accent` check icon, with the word "Verified" where space allows. Never shown for company tutors.

**Profile header** (tutor and company): banner only if uploaded (about 160px, page width, 4px radius), circle photo or
square logo overlapping its bottom-left edge; then the name block. No banner means no strip and no placeholder.
Tutor pages show the **full name**.

**Section** (profile, account, admin, settings): a 20px 600 heading, content, then a rule before the next section.
No cards, no icons beside headings.

**Modal:** white, 4px radius, the floating shadow, optional 1px `--rule` border, scrim `rgba(0,0,0,0.4)`, no blur, no
icon tiles. Title 20px 600; actions bottom right (secondary then primary). Below 640px, modals that contain a form are
full-screen sheets; short confirms stay centred dialogs.

**Toast:** one shared component. White, floating shadow, 4px radius, 14px text, optional status icon in its status
colour, bottom centre, auto-dismiss.

**Empty state:** one line of text in `--text-2` plus one action link. No icon tile, no dashed border, no illustration.

**Loading:** the route-loading overlay is `rgba(255,255,255,0.7)` ◆ with the `--accent` spinner, no blur, shown only
after 250ms. No skeleton screens.

**Notifications row:** 16px grey type icon, text, relative time on the right; unread rows on `--surface-2` with a 600
title. Warning/rejection icons use `--warning`. No photos, no dots.

**Messages:** rows grouped by sender (circle photo, name, time), plain text on white, `--surface-2` on hover with the
controls; no bubbles.

**Links:** `--accent`, no underline in navigation and rows; underlined in long-form text and link lists ◆. Hover changes
colour only.

**Link lists** (home browse-by lists, `/tutors` "Narrow it down"): plain text links with counts in `--muted`, up to 3
columns wide, 1 column on phones.

## 7. Icons and imagery

- Icons come only from `components/Icon.js`, 16px or 20px ◆, stroke style, `currentColor`. Icons sit beside text that
  says the same thing, never as decoration, never inside a round or square tile.
- **No emoji** in UI copy, headings, email subjects or notification titles. Message reactions are content, not UI, and
  are allowed.
- No decorative illustrations, backdrops, watermarks, stock photos or school crests. Photos are real tutor photos,
  company logos, tutor-uploaded banners and article covers only.

## 8. Copy rules

- **No em dashes** in user-facing text (CLAUDE.md). Use a comma, full stop or parentheses.
- **Sentence case** for headings, buttons, labels and nav. Headings have no full stop.
- **No superlatives or unbacked claims** ("most trusted", "best", "world-class", "seamless"). Only claims the product
  can show.
- **Never describe features that do not exist** (no "booking").
- **Numbers come from live data.** Tutor counts always use the total public tutor count, and count copy never says
  "verified" ("114 tutors").
- **Names:** "First L." in every row and card; the full name on the tutor's own page, its title and its structured data.
- **No placeholder people or brands** in placeholders, samples or empty states. Use a label and leave the field empty.
- Say each thing once: a field gets a label and at most one hint.
- No implementation details in user-facing text.

## 9. Avoid list

Gradients · glows and radial halos · blur and glassmorphism · decorative backdrops (particles, stationery, leaves,
trees, vines) · cards inside cards · border and shadow on a static element · pills and fully rounded chips · status
dots · round icon tiles · uppercase tracked eyebrows · handwritten or script fonts · light (300) headings · half-pixel
or `clamp()` font sizes · text under 12px · marquees, typewriters, carousels, auto-rotation · entrance and scroll
animations · hide-on-scroll bars · landing-page templates (hero, metric strip, feature cards, CTA band) · emoji as
decoration · placeholder people · em dashes.

## 10. Enforcement (Phase 3)

`npm run check:design` (`scripts/check-design.mjs`) exits 1 on:
- `text-[Npx]` or inline `fontSize` values outside 12/14/16/20/24/32;
- hex, `rgb()` or `rgba()` values in `app/` or `components/` outside `app/globals.css`;
- `rounded-*` other than `rounded` (4px) and `rounded-full` on avatars, and inline `borderRadius` other than 4 or `50%`;
- `boxShadow` / `shadow-*` outside the floating-element components;
- `font-light`, `fontWeight: 300` or `500`;
- `linear-gradient`, `radial-gradient`, `backdrop-filter`, `blur(`;
- the em dash character in JSX text.

Inline `style={{ … }}` objects may stay (CLAUDE.md's Styling convention), but every value must reference a token; the
check reads both Tailwind classes and inline styles. A line may opt out with a `design-allow: <reason>` comment (used for
Google's brand colours on the sign-in button and a stored default avatar colour).
