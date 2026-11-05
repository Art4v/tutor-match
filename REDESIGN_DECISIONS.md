# MatchTutor UI redesign: decision log

Working log for the visual and content pass. One section per item, filled in as we go.
Status values: `pending` (not discussed), `in discussion`, `decided`.

Ground rules for this pass:
- Visual and content only. Auth, RLS, Realtime messaging, notification delivery and RPCs are not touched.
  Anything that needs a data change is flagged under "Data flags" and asked about, never built silently.
- References: highschooltutors.com.au (density, AU context), Wyzant (search and profiles), LinkedIn (restraint,
  messaging, notifications, dashboards). Each decision names the one it draws from.
- Never invent content, names, reviews or numbers.
- No em dashes in user-facing copy (CLAUDE.md rule).

---

## Phase 0: inventory and audit (2026-11-05)

### Screens
| Area | Routes |
| --- | --- |
| Public | `/`, `/browse`, `/tutor/[slug]`, `/companies`, `/companies/[slug]`, `/blog`, `/blog/[slug]`, `/tutors` + 3 deeper landing levels, `/terms-of-service`, `/privacy-policy`, `/join` |
| Auth | `/signup`, `/login`, `/choose-role`, `/forgot-password`, `/reset-password`, `/join/details`, `/companies/claim` |
| Signed in | owner profile editor (`/profile` redirects to `/tutor/<slug>` owner branch), `/onboarding`, `/account`, `/notifications`, `/messages` (real two-pane chat, `app/messages/MessagesClient.jsx`, 1425 lines), `/browse?saved=1`, `/account-disabled`, `/company`, `/author`, `/author/[id]` |
| Admin | `/admin` overview + verification, reviews, reports, profile-changes, tutor-invites, companies, users, history (+5 legacy redirect stubs) |

Shared chrome: `components/TopNav.js` (fixed, transparent then frosted on scroll, hides on scroll down, **no mobile menu**),
`components/SiteFooter.jsx` + `components/Footer.js` (dark `#001E1E` band).
Overlays: `PolicyConsentGate`, `VerificationPrompt`, `RouteLoadingProvider` (blur + spinner on slow navigations),
`BugReportModal`, `ReportModal`, `ConfirmModal`, `ImageCropModal`, `ReviewFormModal`, `ReviewsModal`, `CompanyTutorModal`,
and the `EditRegion` section modals in the owner profile.
Emails: 24 builders in `lib/email/send.js`, 2 Supabase auth templates in `supabase/email-templates/`, 1 newsletter in `email-updates/`.
States: no `loading.js`, `error.js` or `not-found.js` anywhere. Every loading, error and 404 state is the Next.js default.

Note: CLAUDE.md is stale in two places (it calls `/messages` a stub, and describes the home page as hero carousel +
`SchoolsMarquee`; the real page is `HomeHero` + `SchoolsStrip` + `FeaturedTutors` marquee + `HomeHowItWorks` + `HomeCta`).

### Sprawl (measured over `app/` + `components/`)
| Axis | In use |
| --- | --- |
| Font sizes | 34 distinct `text-[Npx]` values (7px to 44px, including 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5) plus about 15 inline `fontSize` values (3 are `clamp()` headings). The named Tailwind scale is never used. Most used: 13px (138), 12.5px (103), 14px (90), 13.5px (83), 12px (55). |
| Weights | 300 / 400 / 500 only. Headings are light 300, and `<strong>` is pinned to 500 so nothing is ever bold. |
| Fonts | General Sans (Fontshare) for everything, Caveat script for eyebrows and hero accents. |
| Colours | 63 distinct hex values, 44 distinct `rgba()` values, about 29 `:root` tokens duplicated in `tailwind.config.js`. The `slate` ramp is overridden with teal-tinted greys, so every neutral is teal-washed. Status colours are stock Tailwind red/amber/green hexes. About 6 near-identical teal-whites (`#F7FBFB`, `#F7FAFA`, `#F5FAFA`, `#FAFBFB`, `#F3F8F8`, `#F0F6F6`). |
| Radii | About 16 distinct values: 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14 (`--radius-card`), 16px, plus `50%` and `999` pills (67 uses). |
| Shadows | 18 distinct inline `boxShadow` values + 3 CSS classes + 35 uses of Tailwind `shadow`. Cards carry a 1px border AND a wide soft shadow (`TutorCard.js` `CARD_SHADOW`). |
| Spacing | 21 Tailwind steps (including 0.5, 1.5, 2.5, 3.5) plus 54 distinct inline `padding` values. Container widths: 1200, 1128, 1400, 720, 760, 640, 560, 520, 480, 440px and `max-w-6xl`. |
| Effects | 13 gradients across 9 files, backdrop blur in 12 files, `motion/react` in 16 files. |

### Slop tells found (checklist items)
- **Motion:** particle-network canvas behind the hero (`ParticleNetwork.jsx`), swaying leaf sprigs (`.leaf-sway`), typewriter word with blinking caret, bouncing "Scroll" chevron, school logo crossfade every 2.5s (`SchoolsStrip.jsx`), featured-tutor marquee (`FeaturedTutors.jsx`), staggered fade-ins on browse results and profile cards (`BrowseResultsGrid.jsx`, `RevealStack.jsx`), hero fade/slide-ins, nav that slides away on scroll.
- **Visual:** radial glow on the hero, `DeskBackdrop` swaying stationery (pencils, rulers, scissors) behind browse, profile, companies and admin, `.desk-surface` radial gradient page background, hand-drawn vine SVG in "How it works", tree watermark on the CTA bands, border + soft shadow on the same card, nested cards on browse, 14px card radius, pills everywhere.
- **Typography:** tracked uppercase eyebrow above the hero headline, 34 uppercase tracked labels site-wide, Caveat script eyebrows, 01/02/03 step numbers, oversized 90svh hero, flat hierarchy from light-300 headings, 9 to 10px text on cards.
- **Copy:** "Australia's Most Trusted Tutor Network" (unbacked claim); roughly 48 JSX lines with em dashes (not yet separated from comments).
- **Colour:** teal-tinted everything (accent and neutrals share a hue), low-contrast grey text.

### impeccable detect (v. latest via npx, run 2026-11-05)
- Source scan (`app`, `components`, 214 files): 0 findings, but regex-only; the tool itself says this is an undercount.
- Live scan, desktop 1280x800, 9 pages: **196 findings**.
  - `low-contrast` 84: `#8FA9A7` on white is 2.5:1 (placeholders, captions), `#6B8A88` (`--sage`) on white or desk tints is 3.6 to 3.7:1, footer links `#5E8280` on `#001E1E` are 4.1:1.
  - `undersized-ui-text` 61: 9px credential captions and 10px stat-tile labels on tutor cards ("ATAR", "per hour", "State rank").
  - `nested-cards` 32 (all on `/browse`), `line-length` 13 (privacy policy and profile bio over 90 chars), `straggler` 4.
  - `hero-eyebrow-chip` 1 (home), `ai-color-palette` 1 ("cyan gradient background", tutor profile banner).
- Live scan, phone 390x844 (home, browse, profile): **182 findings**, 115 of them undersized text on `/browse`, plus 2 `unbalanced-heading`.
- `/this-page-does-not-exist` returned the default Next 404, which impeccable refuses to score.
- Raw output: scratchpad `imp-desktop.json`, `imp-mobile.json` (not in the repo).

### Data flags (need a decision, not a UI change)
1. **WWCC is not a verified field.** It exists only as an optional uploaded document title. "Verified" today means ATAR/marks were checked by an admin.
2. **Response time is self-reported free text** (`responsiveText`, `components/profile-edit/sections.js:724`).
3. **No lesson count or hours tutored**, and **no public "last active"** (messaging has presence internally).
4. **80 profiles hold the old prefilled response time "Usually responds in <1 hr".** Whether to clear them (one-off
   UPDATE, run by the user) is deferred to Phase 3 (item 7).

### Walkthrough order (confirmed)
1 Design foundation, 2 Nav + footer, 3 Homepage, 4 Browse + TutorCard, 5 Public tutor profile, 6 Companies,
7 Onboarding + owner profile editor (incl. verification display), 8 Auth screens, 9 Messaging,
10 Notifications (in-app + email), 11 Account / saved / disabled, 12 Blog + author editor, 13 SEO landing pages,
14 Legal, 15 Admin, 16 Empty / loading / error / 404 + global overlays, 17 Mobile consistency check.

Session settings: mobile is decided **per item**; all added areas (Companies, Blog, SEO landing, Admin) are in scope.

---

## 1. Design foundation
**Status:** decided (2026-11-05)

**Current state:** `app/globals.css` `:root` + `tailwind.config.js` (palette mirrored in both). Brand teal `#016764`
for buttons, links, chips and focus rings; headings `#014848` at weight 300; text `#001E1E`; secondary `#33514F`;
muted `#6B8A88`. Overridden `slate` ramp (teal greys). General Sans 300/400/500 from Fontshare, Caveat from Google Fonts.
Card = white, 1px `#E7EDEC` border, 14px radius, two-layer soft shadow. See the sprawl table above.

**Problems:** see sprawl table; accent and neutrals share one hue so the whole site reads teal; light-300 headings
flatten hierarchy; 34 font sizes with half-pixel steps; ~16 radii; border + shadow on cards; contrast failures from `--sage` and `#8FA9A7`.

**Decision (2026-11-05, partial):**
- **Lead reference per screen** (applies to every later item):
  Wyzant leads search results, tutor cards and tutor profiles. LinkedIn leads messaging, notifications,
  account, the owner editor and admin. highschooltutors.com.au leads homepage density and the `/tutors` landing pages.
- **Colour:** keep teal `#016764` as the single brand accent, used only for links, primary buttons and the
  verified mark. Replace the teal-tinted `slate` override with true neutral greys (text, borders, surfaces carry no hue).
  Status colours become one small fixed set (error, warning, success); exact values go in DESIGN.md.
  The logo, OG image and email templates keep the same teal, so they need no recolour.
- **Typeface (revised 2026-11-05 after a side-by-side specimen of real profiles):** **Source Sans 3** (Google Fonts)
  for all running text, weights 400 (body) and 600 (headings, names, buttons); whether labels use 500 or 600 is
  settled in DESIGN.md. Rejected after the specimen: system UI stack, Public Sans, IBM Plex Sans, General Sans.
  General Sans (Fontshare, and its referrer workaround in `app/layout.js`) and Caveat are both removed. Bold is
  allowed again, so headings get real weight instead of light 300. Emails keep the system sans, since mail clients
  cannot load web fonts reliably.
- **Surfaces:** Wyzant model. White page, few cards; sections are separated by 1px dividers and spacing rather
  than boxes. 4px radius on inputs, buttons and the few remaining containers. No shadows except on elements that
  float (menus, modals, popovers). The `.desk-surface` gradient, `DeskBackdrop` and the `--card-shadow` treatment go.

**Consequences to carry forward:**
- The `Wordmark` in `components/Logo.jsx` is live text, so it would change face with the body font; resolved below by tracing it to SVG.
- CLAUDE.md's Typography section (General Sans, Caveat eyebrow rule, "the brand has no bold weight") will be
  rewritten when DESIGN.md lands. `scripts/gen-og-image.mjs` already falls back to a system face.
- "Few cards" changes the browse results: Wyzant-style rows divided by rules, not a card grid (decided in item 4).

- **Type scale:** 12 / 14 / 16 / 20 / 24 / 32px, no half pixels, no `clamp()` headings. 14px is the UI base
  (cards, rows, forms, nav); 16px is the reading size for long-form text (bios, blog, legal). 12px is the floor,
  for meta only (dates, captions). This fixes impeccable's 9 to 10px `undersized-ui-text` findings by construction.
- **Spacing:** only 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. Related items sit closer than unrelated groups.
- **Widths:** one page width, 1128px (LinkedIn's), and one reading width (about 680px) for forms, auth, blog and legal.
- **Wordmark:** trace the current General Sans "MatchTutor" wordmark into SVG outlines once, so the logo keeps its
  look with no font loading. It is the only branded type element. (Implementation note: needs the General Sans font
  file and a one-off outline tool such as fonttools or opentype.js, installed temporarily and not added to `package.json`.)

- **Phone (below 640px):** the type scale does not shrink, except that 32px and 24px headings step down one size.
  16px side gutter. Tap targets at least 44px tall even when their text is 14px.

**Open questions:** none. Confirmed complete by user.

## 2. Nav + footer
**Status:** decided (2026-11-05)

**Current state:**
- `components/TopNav.js`: fixed 64px bar, max width 1400px. BookSproutMark + two-tone wordmark, then six links:
  Browse, Featured tutors, How it works, For tutors (the middle three are anchors into home page sections), Companies, Blog.
  Logged out: "Log in" (ghost) + "Sign Up" (primary). Signed in: one avatar chip opens a dropdown holding everything
  (Browse, Profile, Notifications, Messages, My company, Account or "Profile and Account", Saved Tutors, Write, Admin, Log out),
  with counts as teal pills in the menu and a single 9px teal dot on the avatar.
  Hides on scroll down and slides back on scroll up (320ms custom easing). Background is always transparent with no
  border: a `scrolled` state is computed but never read, so when the bar returns mid-page, page content shows through it.
  Below `md` the links row is hidden and there is no menu, so a logged-out phone visitor has no Browse, Companies or Blog link.
- `components/SiteFooter.jsx` + `components/Footer.js`: dark `#001E1E` band, max width 1200px, centred logo and three links
  (Terms of Service, Privacy Policy, Report a bug, which opens `BugReportModal`). Hidden on login, signup, password pages and `/messages`.

**Problems:** landing-page nav (anchor links to marketing sections) instead of a product nav; nav slides away on scroll
(motion tell); transparent bar over content; no mobile navigation at all; signed-in essentials (Messages, Notifications)
buried in a dropdown, unread shown as a status dot; inconsistent "Log in" / "Sign Up" casing; nav, footer and decided
page widths all differ (1400 / 1200 / 1128). Footer: dark band carries almost nothing (no browse-by-subject or location
links, no tutor entry point, no blog or companies), and its links fail contrast (4.1:1, impeccable).

**Decision (2026-11-05, partial):**
- **Bar behaviour (baseline, not objected to):** solid white, always visible, 1px bottom border, no hide-on-scroll,
  1128px content width.
- **Logged out (desktop):** product links plus a compact search box in the bar (LinkedIn). All three home-page anchor
  links (Featured tutors, How it works, For tutors) are removed. Exact search fields and which links sit beside it: open.
- **Signed in:** LinkedIn-style bar items. Browse, Messages and Notifications are top-level icon + label items with numeric
  badges; a "Me" dropdown holds Profile, Account, Saved tutors, My company, Write, Admin and Log out (each still gated on
  role or capability exactly as today). No unread dot on the avatar. Companies have no Messages item, as today.
- **Phone (below 768px):** logo, a visible search icon, and a menu button opening a full-width sheet with the same links
  (logged out) or the account links (signed in). One pattern for everyone; no bottom tab bar.
- **Footer:** minimal light row (no dark band): wordmark, Companies, Blog, Terms, Privacy, Report a bug, copyright.
  Contrast must meet 4.5:1. Still hidden on auth pages and `/messages`.

**Trade-off noted:** a minimal footer means the `/tutors` landing pages get no site-wide internal links from it;
they stay reachable through `sitemap.xml`. Revisit in item 13 (SEO landing pages).

- **Search box:** two compact fields, subject and suburb, reusing `SubjectPicker` and `SuburbAutocomplete` and
  submitting the same `/browse` URL params as the home hero. No data change. (Free-text `?q=` was rejected because it
  does not match subject names.)
- **Where it shows:** every page except `/` (own search) and `/browse` (sidebar filters), signed in or out.
- **Logged-out links:** search box, then Companies, Blog, Become a tutor (to `/signup`), then Log in and Sign up.
  No separate "Find a tutor" link; the search box is the entry point.

- **Signed-in bar:** search box, Browse, Messages, Notifications, then Companies and Blog as text links, then Me.

> **Amended in item 3 (2026-11-05):** the nav has **no search box** at all; search lives only on the home page.
> Logged-out bar: Find a tutor, Companies, Blog, Become a tutor, Log in, Sign up. Signed-in bar: Browse, Messages,
> Notifications, Companies, Blog, Me. The footer gains a logged-out "Become a tutor" link. The search bullets above
> are superseded.

- **Search box type (re-confirmed after pros and cons):** stays structured, subject + suburb fields (option A).
  Rejected: B, a single text box with grouped suggestions resolving to existing params (more new code, ambiguity on
  bare subjects); C, server-side full-text search (data change). Implementation note: the nav must load the subject
  catalog lazily in the browser (on first focus), never from the root layout, so cached pages and the static `/join`
  page stay free of server fetches.

**Open questions:** none. Confirmed complete by user.

## 3. Homepage
**Status:** decided (2026-11-05)

**Current state** (`app/page.js`, top to bottom):
1. `components/HomeHero.jsx`: 90svh hero. Animated particle network + radial glow + two swaying leaf sprigs behind it.
   Tracked-caps eyebrow "Australia's Most Trusted Tutor Network", headline "Trust your next [Maths|English|…] tutor" with
   a typewriter word in Caveat and a blinking caret, a State + Subject search bar (phones get a single "Search Now"
   button), four icon bullets (Verified ATARs and marks, Completely free browsing, Private and group tutoring,
   In-person and Online), a bouncing "Scroll" chevron. Everything fades and slides in on load.
2. `components/SchoolsStrip.jsx`: "TRUSTED TUTORS FROM" over six school crests (from a fixed list of 24 NSW/VIC schools,
   crests from Wikipedia) that crossfade one at a time every 1.2 to 1.7s.
3. `components/FeaturedTutors.jsx`: dark teal band, Caveat eyebrow "Featured tutors", "Meet your next tutor",
   "Every tutor here has had their ATAR, marks and identity checked by us.", two rows of 12 verified tutor cards
   scrolling in opposite directions (marquee), "Browse all 114 tutors" link with a sliding underline.
4. `components/HomeHowItWorks.jsx` (684 lines): Caveat eyebrow, "Finding the right tutor is easy", "Browsing, messaging
   and booking all done on one platform.", a scroll-triggered animated vine with sun, clouds, birds and falling leaves
   growing into three tilted 01/02/03 cards with stock-style photos.
5. `components/HomeCta.jsx`: gradient band with a tree watermark, Caveat "For tutors.", "Looking to advertise?",
   Become a tutor + Browse tutors buttons.

**Live data checked (2026-11-05, public anon reads):** 114 public tutors, 88 verified, **0 tutors with an approved review**.
Of the 24 schools in the strip, roughly 10 appear in any tutor's high-school education; the rest (for example North Sydney
Girls, Fort Street, Nossal, Haileybury, Melbourne Grammar) have no matching tutor.

**Problems:** the full "hero, metric strip, feature cards, CTA" landing-page template; nearly every motion tell (canvas,
sway, typewriter, caret, bounce, crossfade, marquee, scroll-triggered reveals, vine choreography); Caveat eyebrows and a
tracked-caps hero eyebrow (impeccable `hero-eyebrow-chip`); oversized hero. **Copy accuracy:** "Most Trusted" is unbacked;
"booking" is claimed but there is no booking feature; "identity independently checked" needs confirming against what
verification actually checks (terms 4.1 say proof of qualifications and identity are required); "Trusted tutors from"
shows schools no current tutor attended, and uses school crests, which can read as endorsement.

**Decision (2026-11-05, partial):**
- **Model:** listing-first (highschooltutors density). Short plain headline + subject/suburb search at the top (no
  full-screen hero), then real verified tutors as rows, then "Browse by subject" and "Browse by state/city" link lists
  feeding the `/tutors` pages. Removed: hero backdrop (particle network, glow, sprigs), typewriter, scroll cue, the four
  icon bullets as a decorative row, the featured marquee, the How it works section (vine, cards, stock photos) and the
  gradient CTA band. All load and scroll animations go.
- **Tutor CTA:** still needed, but it moves **into the footer** (user's call), not a band on the page. This amends item 2's
  "minimal light row" footer; details open below.
- **Headline:** functional, with a count line built from live data at request time (today that would read 114 tutors,
  88 verified). No hard-coded numbers, no superlatives; "Australia's Most Trusted Tutor Network" is removed.
- **Schools strip:** removed, including the 24 crest images under `public/images/marquee/`. School backgrounds stay on
  cards and profiles, where they are true.
- **Verification wording:** user chose to skip this question. Existing verification claims are left as written and not
  rewritten by me; "booking" is still flagged as describing a feature that does not exist (it disappears with How it works).

- **Footer CTA (amends item 2):** a plain "Become a tutor" link blended into the footer link row, styled exactly like
  the other links (no button, no sentence, no band). Shown on every page that has a footer, **logged-out only**.
  Footer row is therefore: wordmark, Become a tutor (logged out), Companies, Blog, Terms, Privacy, Report a bug, copyright.
- **Home list size:** about 25 tutors to start (user: "a lot"), well above the 10 proposed.
- **Phone:** headline, count line, then Subject and Suburb fields stacked full width with a Search button; tutor rows
  below; browse-by link lists as simple stacked lists.

- **Home list selection:** verified tutors only, ranked by `lib/ranking.js` with equal scores reshuffled each load
  (today's marquee pool, `app/page.js`). 25 rows, then a "See all N tutors" link. No data change.
- **Page order:** headline + count line, search, compact "Browse by subject" and "Browse by state/city" link lists,
  then the 25 tutor rows, then the "See all" link. The row design itself is decided in item 4 (shared with `/browse`).

**Reference: highschooltutors.com.au search (from user screenshots, 2026-11-05; the site blocks automated fetches):**
one white panel below the header (their header has only logo + account icon). Three fields in a row, each with a
question label above: "Where abouts?" (text, "Search locations...") with an "Or online?" checkbox beside the label,
"What year?" (dropdown, "Select year..."), "What subject?" (text, "Search subjects..."), then a full-width "Find tutors"
button. Below it: "4,318 top tutors available now", three columns of exam links, then the tutor grid. Every input maps
to an existing `/browse` param (`lat`/`lng`/`place`, `mode`, `year`, `subject`), so copying it needs no data change.
Also noted for item 4: cards show first name + last initial, a "Very responsive" badge, an "Online tutoring" badge,
tutor type (Private Tutor / University Student) and a bio excerpt; "Browse by school" search; Previous/Next paging;
year-level link lists at the bottom.

- **Search placement (amends item 2):** HST model. The search lives **only on the home page**, as an HST-style panel
  (labels above fields, full-width submit button). **The nav has no search box**, logged in or out; item 2's nav
  search decisions (subject + suburb fields, where it shows, lazy catalog loading) are withdrawn.
- **Field order:** our current order (the hero today is State, then Subject), in HST's style.

- **Panel fields:** State, then Subject, only (today's two fields, `CatalogPicker kind="state"` + `SubjectPicker`),
  restyled as an HST panel: label above each field, full-width submit button. Year and Online were offered and declined.
  Phone: the two fields stack full width above the button (replaces the earlier "Subject and Suburb" phone note).
- **Logged-out nav (amends item 2):** Find a tutor (`/browse`), Companies, Blog, Become a tutor, Log in, Sign up.
  Signed-in bar loses only the search box.

**Open questions:** none. Confirmed complete by user.

## 4. Browse + TutorCard
**Status:** decided (2026-11-05, lead reference: Wyzant)

**Current state:**
- `app/browse/page.js`: `.desk-surface` radial gradient + `DeskBackdrop` swaying stationery, 1400px wide, 260px left
  filter sidebar + results column. 24 per page, numbered pagination. Empty state: dashed box, round icon tile,
  "No tutors match those filters".
- `app/browse/BrowseFilters.jsx`: light-300 40px "All tutors" + "N tutors match your filters", Clear all filters, then
  Saved tutors switch (students), Name, Location, State, Year level, Subject, School, Mode, Minimum ATAR slider,
  Max rate slider, Verification. Below `lg` the whole sidebar stacks **above** the results.
- `app/browse/BrowseResultsGrid.jsx`: one column of cards with a staggered fade-in on mount.
- `components/TutorCard.js` (494 lines): white card, 1px border + wide soft shadow, 14px radius. Left: 132px rounded
  photo. Middle: name at weight 300, verified tick (or company chip), tagline in teal, 2-line bio, "school · suburb · state"
  in muted teal, a tinted strip of subject pills (measured to fit + "+N"). Right rail: two stat tiles (lead credential,
  then the second credential, falling back to the hourly rate) + a dark "View full profile" button. Bookmark button overlaid.

**Live data (2026-11-05):** of 113 individual public tutors, **57 have two or more credentials, so their card never shows
the hourly rate**. 29 of 114 have no photo. 97 teach online, 73 in person. 0 have reviews.

**Problems:** the card omits fields the brief says a listing needs: price is hidden for half the tutors, and year levels,
in person / online, and rating or "No reviews yet" never appear. Visual: border + shadow, 14px radius, nested tinted strip
inside the card (impeccable `nested-cards`, 32 on this page), 9 to 10px text (impeccable `undersized-ui-text`, 55 here),
weight-300 names, teal taglines, pills, stationery backdrop, gradient page, staggered reveal. Phone: every filter
stacks above the first result.

**Reference notes:** HST (from screenshots) shows first name + last initial, a responsiveness badge, an online badge,
tutor type and a bio excerpt; Wyzant is the lead for this screen.

**Decision (2026-11-05, partial):**
- **Layout:** Wyzant rows. One tutor per row, no card box: photo left, details middle, rate + action right, rows
  separated by a 1px rule. Used by `/browse` and the home page's 25-tutor list. Page background is plain white; the
  `.desk-surface` gradient, `DeskBackdrop` and the staggered fade-in go.
- **Fields:** everything the card shows today, rebuilt in the new theme (verified tick or company name, lead and second
  credential, tagline, bio excerpt, school + suburb/state, subjects, bookmark, link to the profile), **plus**:
  hourly rate always shown (no longer displaced by a second credential; company tutors still have no rate),
  year range ("Years 9 to 12"), in person near suburb and/or online, and a reviews line (rating + count, or
  "No reviews yet"). All from existing columns; no data change.
- **Names in listings:** first name + last initial ("Kanishka B."), as HST and Wyzant listings do. The profile page's
  name display is decided in item 5. The Name filter still searches full names.
- **Filters:** left sidebar on desktop with plain labels and divider-separated groups; School, Minimum ATAR, Max rate
  and Verification collapse under "More filters". Phone: results come first and a "Filters (n)" button opens a
  full-screen sheet.

- **Phone row:** 56px photo left; first line name + verified + rate; then credentials, years, in person/online,
  reviews line, a 2-line bio and the first few subjects stacked. The whole row taps through; no separate button on phones.
- **No photo (29 of 114 today):** initials in grey on a light grey square, same size and 4px radius as photos
  (LinkedIn). Replaces the graduation-cap icon on a tutor-picked colour, site-wide wherever `Avatar` renders.
  Uses the existing `initials` column; no data change.

**Open questions:** none. Confirmed complete by user.

## 5. Public tutor profile
**Status:** decided (2026-11-05, lead reference: Wyzant)

**Current state** (`app/tutor/[slug]/PublicProfileView.jsx`, shared with the admin revision preview):
- Page: white with `DeskBackdrop` stationery, 1128px, every card fades in staggered (`RevealStack`).
- Header card: 150px banner (uploaded image, or a gradient from the tutor's colour), 108px round photo with a white ring
  overlapping it, name 34px at weight 300, verified tick (or company chip), tagline 17px, a facts row (suburb + state,
  "In-person + online", response time with an amber dot), and a stats column (years tutoring, year range, languages).
- Main column: About, Credentials ("What sets this tutor apart"), Experience, Education, Availability
  ("When you can book a session each week").
- Sidebar: rate card ($X /hour, packages, Message button), Subjects, Documentation, Ratings & reviews, service-area map,
  "Similar tutors" (2-column minis; actually the top-rated tutors via `getFeaturedTutors`, not similar ones).
- Phone: a fixed bottom bar with the rate, the hard-coded text "Online or in person" (shown even for tutors who offer
  only one), and Message.
- Every card: border + soft shadow, 14px radius.

**Live data (2026-11-05):** **80 of 114 public profiles show "Usually responds in <1 hr"**, which is the editor's prefilled
default (`lib/supabase/tutors.js:116`), not a measured value; 18 empty, 16 other self-chosen values. Only 26 of 114 have
uploaded a banner, so 88 show the generated gradient (impeccable `ai-color-palette`). 29 have no long bio. 0 reviews.

**Problems:** decision order is off versus the brief (photo, price, rating/verification, description, CTA): price and
Message sit in the sidebar below the header, reviews are buried mid-sidebar. Status dot for response time; response time
is mostly an unchosen default; "book a session" implies booking that does not exist; "Similar tutors" is mislabelled;
phone bar copy is wrong for single-mode tutors; cards everywhere (border + shadow), light-300 name, gradient banner,
stationery backdrop, staggered reveal.

**Decision (2026-11-05, partial):**
- **Structure:** Wyzant layout. Top block: photo, name, verified, tagline, location, in person/online, years, rating
  line. Right column (sticky on desktop): rate, packages, Message. Main column: About, Subjects, Credentials, Education,
  Experience, Reviews, Availability, Location map. Sections divided by rules, not cards. Related tutors at the bottom.
- **Banner (user's reference: HST profile screenshot):** a full-width band across the top of the page, not inside a
  card. The round photo overlaps its bottom-left edge and a white name block sits beside the photo, also overlapping
  the band (HST: name, a badge, tutor type, "Tutoring near ...", save star).
- **Name:** first name + last initial on the profile too ("Kanishka B."), consistent with listings, including the page
  title. (Amended in item 13: the schema.org JSON-LD and `llms-full.txt` keep the full name.)
- **Response time:** hidden permanently from public profiles (not "until measured"). Item 7 decides whether the editor
  field goes too. The `lib/supabase/tutors.js:116` default no longer matters to visitors.

**Reference: HST profile (user screenshot, 2026-11-05):** full-width illustrated band; photo + name block overlapping
it; then three columns: left (Contact + Message button, Badges: Verified mobile / Verified marks, Rate "$55 per hour",
Services list, Subjects), centre (About), right (Availability, service-area maps).

- **Banner (revised, supersedes the band above):** dropped completely "for now". No banner on public profiles; the
  header is photo + name block on white (Wyzant). Uploaded banner files are kept, nothing is deleted. Whether the
  editor's banner upload is hidden is decided in item 7.
- **Body:** Wyzant structure as above; HST's three-column body was declined.

> **Amended in item 7 (2026-11-05):** banners return, shown only when uploaded (page width, about 160px, photo
> overlapping); response time returns as a self-reported value with no prefilled default, labelled as the tutor's own
> claim. The "dropped" and "hidden permanently" bullets above are superseded.

- **Phone:** no fixed bottom bar (removes the hard-coded "Online or in person" with it). Rate + Message sit inline
  directly under the header block, then sections in the desktop main-column order.
- **Related tutors:** keep the current query (`getFeaturedTutors`, top-rated excluding this tutor) but label it
  honestly, e.g. "Other verified tutors". No data change.
- **Copy:** Availability's "When you can book a session each week" is rewritten without "book" (no booking feature).

**Open questions:** none. Confirmed complete by user.

## 6. Companies directory + company page
**Status:** decided (2026-11-05, lead reference: Wyzant, mirroring items 4 and 5)

**Current state:**
- `/companies` (`app/companies/page.js`): same shell as `/browse` (gradient desk surface, stationery backdrop, 1400px,
  260px sidebar of State / Subject / free-text filters). Results are `components/CompanyCard.jsx`: TutorCard's
  composition (logo, text, stat rail, dark "View" button) with a staggered fade-in (`CompaniesFeed.jsx`).
  Empty state: "No companies match those filters" / "We're adding tutoring companies now. Check back soon."
- `/companies/[slug]`: banner (upload or gradient) + 108px ringed logo + name at weight 300 + bio + "Tutoring company"
  + location, then About and "Our tutors" (compact TutorCards inside a card) in the main column; Packages, Ratings &
  reviews, "Where we are" in the sidebar; stationery backdrop; phone gets a fixed bottom Enquire bar. Owners get the
  same layout with per-section edit modals (`OwnerCompany.jsx`).

**Live data (2026-11-05, the database the dev server uses):** **0 publicly visible companies**, so `/companies` shows the
empty state today. (One public tutor is still attached to a hidden company.)

**Problems:** same visual tells as browse and profile (gradient, stationery, border + shadow cards, banner gradient,
staggered reveal, weight-300 headings); nested cards (tutor cards inside the "Our tutors" card); a nav link (item 2)
pointing at an empty page.

**Decision (2026-11-05):**
- **Nav link:** Companies always shows in the nav and footer, regardless of count (user: prod has or will soon have
  live companies).
- **Directory:** the same Wyzant row as item 4. Logo left; name, location, subjects (derived from its tutors),
  number of tutors, packages, reviews line in the middle; view link on the right. Same sidebar + phone "Filters (n)"
  sheet as `/browse`; gradient, stationery and fade-in removed.
- **Company page:** mirrors item 5. No banner; logo + name block on white; sticky right column with packages +
  Enquire; main column About, Our tutors (plain rows, no nested cards), Reviews, Location. Phone: no fixed bar,
  Enquire inline under the header. The owner view (`OwnerCompany.jsx`) keeps the same layout with its edit controls.

> **Amended in item 7 (2026-11-05):** companies follow the tutor banner rule: shown only when uploaded.

**Open questions:** none. Confirmed complete by user.

## 7. Onboarding + owner profile editor
**Status:** decided (2026-11-05, lead reference: LinkedIn)

**Current state:**
- `/onboarding` (`app/onboarding/OnboardingWizard.jsx`): 760px column, sparkle-icon pill "Welcome to MatchTutor" above a
  40px weight-300 "Let's set up your profile", a segmented progress bar + "Step n of 6", six steps (identity, subjects,
  about, location, credentials, verify) that slide in and out, Back / Skip / Next / Finish, a toast for errors. It reuses
  the real editor sections (`components/profile-edit/sections.js`, 1510 lines).
- Owner editor (`/profile` redirects to `/tutor/<slug>`; `OwnerProfile.jsx`, 808 lines): the public layout with a pen
  button on each section; a pen opens that section's editor in a modal over the blurred page (`EditRegion`). `OwnerCard`
  carries the completion meter (percentage bar + round check dots), Get verified (`RequestVerification`, a card with a
  dashed border drawn by four repeating gradients), Public / Hidden, and the copyable profile link. Verified and managed
  tutors edit a draft that an admin approves (`ProfileReviewStatus`).
- `components/VerificationPrompt.jsx`: a dismissible modal, mounted site-wide, that nags unverified tutors once per
  browser session until they request verification.

**Problems:** pill badge above the heading with a sparkle icon (checklist "pill badge above the hero headline"), weight
300 headings, step slide animation, progress segments + percentage meter + check dots (status dots), dashed-border trick,
a site-wide nag modal. Copy: "you can edit it all later in Settings" (there is no Settings page); 8 em dashes in the
wizard's user-facing copy (CLAUDE.md forbids them); "When students can book a session each week" (no booking).
Editor fields now without a public output: banner upload and response time (both hidden by item 5).
Verification wording itself stays as written (user skipped that question in item 3).

**Decision (2026-11-05, partial):**
- **Editing model:** LinkedIn pen + modal. Editing stays on the page the tutor sees (now the Wyzant layout); each
  section's pen opens its form in a plain modal (no blurred backdrop). Phones: the modal becomes a full-screen sheet.
- **Onboarding:** keep the six steps and Skip behaviour; remove the sparkle pill, the step slide animation and the
  segmented bar (plain "Step 2 of 6" text). Fix "edit it all later in Settings" and the em dashes.
- **Verification nudge:** remove the site-wide `VerificationPrompt` modal. The tutor's own profile shows a plain
  one-line notice with "Request verification" and a simple checklist of what's missing (no percentage bar, no dots).
- **Banner + response time:** user wants both **back** on tutor profiles but is unsure how. This reopens item 5's
  "banner dropped" and "response time hidden permanently" decisions.

- **Response time returns (amends item 5), option B:** self-reported. The tutor picks from the existing short list
  in the editor and onboarding, **with no prefilled default** (removes the `"Usually responds in <1 hr"` fallback at
  `lib/supabase/tutors.js:116`). The public profile shows it as plain text labelled as the tutor's own claim, with no
  status dot. Empty means nothing is shown. Measured response time (option A) was declined.
  **Data flag:** the 80 profiles holding the old default cannot be told apart from deliberate choices; clearing them
  is a one-off data change that needs explicit approval (asked below).
- **Banners return (amends item 5), option C:** shown only when the tutor uploaded one; tutors without a banner get
  no strip and no placeholder (photo + name on white). The banner upload stays in the editor.

- **Banner placement:** about 160px tall at the 1128px page width, 4px corners, no card around it; the photo overlaps
  its bottom-left edge and the name block sits below (LinkedIn proportions).
- **Companies (amends item 6):** same rule. A company banner shows only if uploaded, placed exactly like a tutor's.
- **Response-time reset:** deferred. Logged as an open data question for Phase 3 (see Data flags).

**Open questions:** none. Confirmed complete by user.

## 8. Auth screens
**Status:** decided (2026-11-05)

**Current state** (`app/(auth)/`, shared centred layout, footer hidden): signup, login, choose-role, forgot and reset
password, `/join` (tutor invite, deliberately static) and `/join/details`. Each is a 440px card with a 1px border and a
large soft shadow that scales and fades in on load. Headings 42px weight 300 with full stops ("Create your account.",
"Welcome back."), subline with the inline wordmark. Fields: labels above, placeholders including the made-up name
"Alex Nguyen". Live password checklist, "Continue with Google". `/choose-role`: two option cards ("I'm a tutor",
"I'm a student/parent") and a confirm modal on a blurred dark backdrop ("You can't change this later").
Behaviour (signup route, deferred role choice, OAuth, `/join` static rule) is out of scope and unchanged.

**Problems:** border + shadow card, load animation, 42px light headings, placeholder person name (checklist "placeholder
people"), 6 em dashes in user-facing copy ("Almost there — we've sent...", "Sent — check your inbox."), blurred backdrop
modal for a two-option choice.

**Decision (2026-11-05):**
- **Layout:** plain centred form (LinkedIn / Wyzant login). About 400px column on the white page, no card box, no
  shadow, no load animation; 24px heading at weight 600. Applies to signup, login, forgot/reset password, choose-role,
  `/join` and `/join/details` (`/join` stays static). Phones: full width with 16px gutters.
- **Copy:** headings "Log in" and "Create an account" (no full stops, no "Welcome back."); short sublines; the "Alex
  Nguyen" placeholder is removed (label only, no made-up person); all em dashes in these screens rewritten.
- **Choose-role:** two plain bordered radio rows with their one-line descriptions, a Continue button, and the "You can't
  change this later" warning as text above the button. The confirm modal and its blurred backdrop go.

**Open questions:** none. Confirmed complete by user.

## 9. Messaging
**Status:** decided (2026-11-05, lead reference: LinkedIn)

**Current state** (`app/messages/MessagesClient.jsx`, 1425 lines; Realtime, presence, reactions, reply, edit, unsend,
block and the disclaimer gate are behaviour and stay untouched): full-height two-pane view under the nav, footer hidden.
Left: 360px conversation list with a 26px weight-300 "Messages" heading, rows with photo, name, snippet, time and a teal
unread pill; active row tinted teal. Right: thread header (name, View profile, a menu), a pale tinted message area,
bubbles with 14px radius (own = solid teal with white text, other = white with border), Instagram-style hover controls
(quick emoji bar, reply, a menu), a composer with 12px radius field, emoji button and a teal send button. Block notices are
red-tinted boxes with a round icon. Empty state is a round icon tile + "No messages yet". Phones: list first, the thread
replaces it with a back button.

**Problems:** largely already a functional tool (good), but: weight-300 heading, teal-washed surfaces, 12 to 14px radii,
large soft shadows on menus, round icon tiles in empty and block states.

**Decision (2026-11-05, partial):**
- **Message style:** LinkedIn rows, no bubbles. Every message left-aligned, grouped by sender under their photo + name
  + time. White thread background, no tint.
- **Fills:** none at rest; every message is plain text on white. A row turns light grey on hover, which is where its
  reaction controls appear.
- **Reactions and controls:** keep the hover emoji bar, reply, menu and double-click thumbs-up; restyle only (small icon
  buttons, flat bordered menu, shadow only because it floats).

- **Phone:** keep list-then-thread with a back button, restyled; composer pinned to the bottom of the thread.
  Reaction controls open on long-press. **Flag:** there is no touch handling today (`MessagesClient.jsx` has no
  touch or context-menu handlers), so long-press is new interaction code, not a restyle; confirm at build time.

**Open questions:** none. Confirmed complete by user.

## 10. Notifications (in-app + email)
**Status:** decided (2026-11-05, lead reference: LinkedIn)

**Current state:**
- `/notifications` (`app/notifications/NotificationsList.jsx`): a list of separate cards (border, 14px radius), unread ones
  tinted teal with a 7px teal dot; each has a 36px round coloured icon chosen by type (sparkle, shield, star, clock,
  alert in teal / green / amber tints). Empty state: round bell tile + "No notifications yet". Rows are marked read in
  the background. Delivery (`notifyUser`, `lib/notifications.js`) is out of scope.
- Emails (`lib/email/send.js`, 24 builders): plain 520px white layout, system sans, a text wordmark, a 22px weight-500
  heading, 14px body in `#33514F`, a teal button with 10px radius, a muted "MatchTutor" sign-off in `#6B8A88` (fails
  4.5:1). Emoji or symbols in a heading or subject: "Welcome to MatchTutor 👋", "You're verified ✓" (10 occurrences across
  emails and notification titles). Supabase auth templates (`supabase/email-templates/`) use the same palette with a
  `#F7FAFA` panel and 10 to 16px radii.

**Problems:** in-app: cards per row, coloured round icon tiles, unread tint + status dot. Emails: already restrained;
issues are emoji/symbols as decoration, the low-contrast sign-off, 10 to 16px radii, teal-tinted greys.

**Decision (2026-11-05):**
- **In-app list:** LinkedIn list. One continuous list divided by 1px rules, no card per row. Each row: small icon (or
  the related person's photo where one exists), text, relative time on the right. Unread rows get a very light grey
  background and a bold title; no teal tint, no dot. Same single column on phones.
- **Type icons:** plain 16px grey glyphs, no round tile, no colour; only rejections and warnings use the single warning
  colour. The sparkle "welcome" icon is replaced with a neutral one.
- **Emails (light touch):** keep the plain layout. Remove emoji and symbols from headings, subjects and notification
  titles (👋, ✓; 10 occurrences in `lib/email/send.js` and `app/api/**`). Neutral greys; body and sign-off at 4.5:1
  contrast; buttons 4px radius; headings weight 600. Same changes in both Supabase templates, which the user re-pastes
  into the Supabase dashboard. The `email-updates/` newsletter was not discussed and is left alone.

**Open questions:** none. Confirmed complete by user.

## 11. Account / saved tutors / account disabled
**Status:** decided (2026-11-05, lead reference: LinkedIn)

**Current state:**
- `/account` (`app/account/AccountSettings.jsx`, 645 lines): 760px column, 40px weight-300 "Account" (students:
  "Profile & account"), then separate bordered cards with an icon beside each heading: Profile (students: name + photo
  with crop modal), Change password, Profile management (managed tutors, with a confirm modal), Delete account (red
  heading, type DELETE). Toasts for results. Behaviour (password re-verify, delete RPC, opt-out) is out of scope.
- Saved tutors: not a page. The nav's "Saved tutors" opens `/browse?saved=1`, a switch at the top of the browse sidebar
  (students only); inherits item 4.
- `/account-disabled` (`DisabledScreen.jsx`): centred bordered card, round red "ban" icon tile, "Your account has been
  disabled" + explanation, Log out button. (CLAUDE.md still mentions an inert "Request review" button; the code no longer
  has it.)

**Problems:** weight-300 heading, a card per section with icons beside headings, round icon tile on the disabled screen.

**Decision (2026-11-05):**
- **Account:** one column at the 680px reading width, 24px heading at 600, sections (Profile, Password, Profile
  management, Delete account) separated by 1px rules; no cards, no heading icons. Delete account last, its heading in
  the error colour. Phones: same column.
- **Saved tutors:** stays a `/browse?saved=1` filter; no new page. Follows item 4.
- **Account disabled:** plain centred text (heading, explanation, Log out); no card, no red icon tile; copy unchanged.
- **Doc note:** CLAUDE.md's `/account-disabled` row mentions an inert "Request review" button the code no longer has.

**Open questions:** none. Confirmed complete by user.

## 12. Blog + author editor
**Status:** decided (2026-11-05)

**Current state:**
- `/blog`: Caveat eyebrow "The MatchTutor Blog", 44px weight-300 "Guides for students and parents", lead paragraph,
  a two-up grid of `ArticleCard`s (2:1 cover image with 14px radius, category + byline + date, 23px title that turns teal
  on hover, 3-line excerpt, "Read" link with a sliding underline and nudging arrow), then the full-bleed `CtaBand`
  (gradient + tree watermark + Caveat eyebrow + clamp() heading + two buttons; a line-for-line copy of `HomeCta`).
- `/blog/[slug]`: header (dates, reading time, byline), Markdown body via the whitelisted renderer, a sticky contents
  rail on the right from `lg`, related articles, then the same `CtaBand`.
- `/author` and `/author/[id]`: article list and the Markdown editor (`ArticleEditor.jsx`, `MarkdownField.jsx`) with
  toolbar, preview, cover upload, publish. Renderer security rules (`html: false`, node whitelist, literal classes) are
  out of scope and unchanged.

**Live data (2026-11-05, the dev server's database):** 0 published articles, so `/blog` shows "No articles have been
published yet. Check back soon."

**Problems:** Caveat eyebrows, light-300 oversized headings, hover animations (sliding underline, arrow nudge, colour
change), 14px radii, the gradient CTA band (which item 3 removed from the home page but still exists here).

**Decision (2026-11-05):**
- **Blog index:** keep the two-up grid of article cards, flat: 4px radius on covers, no sliding underline, no arrow
  nudge, no Caveat eyebrow, heading at weight 600 from the type scale.
- **Article page:** keep the structure (reading column at 16px, sticky contents rail, byline, related articles) and
  apply the foundation only.
- **CTA band:** removed from both blog routes (`app/blog/CtaBand.jsx` goes with `HomeCta`); the logged-out footer
  "Become a tutor" link covers it.

- **Author pages:** foundation restyle only; no layout change.

**Open questions:** none. Confirmed complete by user.

## 13. SEO landing pages
**Status:** decided (2026-11-05, lead reference: highschooltutors.com.au)

**Current state** (`app/tutors/LandingView.jsx`, 181 lines, cached hourly; data from `resolveLanding`): breadcrumb,
44px weight-300 title, a generated factual summary, local tutors as `TutorCard`s, "Showing n of N", "Also teaching
online", "See all tutors with filters", "Narrow it down" as rounded pill links with counts, and an FAQ, plus
BreadcrumbList / ItemList / FAQPage JSON-LD. Already functional and factual; it inherits item 4's rows automatically.
`llms-full.txt` (`lib/seo/llms.js:94`) lists every indexable tutor by full name.

**Problems:** light-300 headings, pill links. Two consequences carried from earlier items: tutor names are now
"First L." in listings and on profiles (item 5), so machine-facing surfaces need a matching decision; and the minimal
footer (item 2) gives these pages no site-wide links, though the home page's new browse-by link lists (item 3) do.

**Decision (2026-11-05):**
- **"Narrow it down":** HST-style column link lists, plain underlined text links with counts in 3 columns
  ("Sydney (12)", "HSC Chemistry (5)"); one column on phones. Pills removed. Headings move to weight 600.
- **Names for machines:** visible pages show "First L." (items 4 and 5), but `llms-full.txt` and the JSON-LD on
  profile and landing pages **keep full names** (user's call, for name search). Noted risk: structured data that differs
  from the visible text can be treated as inconsistent by Google; revisit if rich results drop.
- **Internal linking:** the home page's browse-by-subject and browse-by-state lists plus `sitemap.xml` are enough; the
  footer stays minimal.

**Open questions:** none. Confirmed complete by user.

## 14. Legal pages
**Status:** decided (2026-11-05)

**Current state:** `app/terms-of-service/page.js` (13 sections) and `app/privacy-policy/page.js` (12 sections): 720px
column, 96px top padding, 44px weight-300 title, 20px weight-300 numbered section headings, 15px body at 1.7 line
height. No contents list, no date.

**Problems:** light-300 headings; lines run 93 to 105 characters (impeccable `line-length`, 12 findings), which the
680px reading width at 16px fixes. **Content bug:** privacy policy section 11 says "The 'Last updated' date at the top of
this page reflects the most recent revision", but neither page shows any date. `POLICY_EFFECTIVE_DATE` in
`lib/policy.js` is 2026-10-14.

**Decision (2026-11-05):**
- **Layout:** foundation only: reading width (about 680px) at 16px, headings at weight 600, no other change.
- **Date:** none shown (user's call). **Flag for the user:** privacy policy section 11 still refers to a "Last updated"
  date at the top of the page that does not exist; rewording legal text is left to the user, not done in this pass.
- **Contents list:** none.

**Open questions:** none. Confirmed complete by user.

## 15. Admin dashboard
**Status:** decided (2026-11-05, lead reference: LinkedIn)

**Current state** (`app/admin/`, internal, three admins): gradient desk surface + `DeskBackdrop` stationery, 1200px,
220px sticky left nav (`AdminNav.jsx`, chip row on phones) with teal count pills, then the section. Shared kit in
`app/admin/_components/ui.jsx`: `PageHeader` (40px round teal icon tile + title), `Panel` (card with border + shadow,
18px weight-300 title), `Inset` (tinted 12px box), `QueueList` / `QueueRow`, pill `Chip`s, `DecidedNote`, `HistoryList`;
`DecisionPanel.jsx` for every decision. Behaviour (RPCs, guard, alerts) is out of scope.

**Problems:** stationery backdrop and gradient on an internal tool, round icon tiles above titles, cards nested
(Inset inside Panel), pills, weight-300 titles, 10 to 14px radii.

**Decision (2026-11-05):**
- **Scope:** restyle the shared kit only: `app/admin/layout.js`, `_components/AdminNav.jsx`, `_components/ui.jsx`
  (and `DecisionPanel.jsx` styling). White page, no stationery or gradient; plain left nav with numeric counts;
  sections divided by rules instead of `Panel` cards; no icon tiles in `PageHeader`; `Inset` becomes a light grey area
  without a nested border; `Chip`s become plain text labels except status. Page files untouched where possible.
- **Phone:** a single section dropdown at the top ("Section: Verification (3)") instead of the scrolling chip row.

**Open questions:** none. Confirmed complete by user.

## 16. Empty / loading / error / 404 + global overlays
**Status:** decided (2026-11-05)

**Current state:**
- **404 / error / loading pages:** none exist (no `not-found.js`, `error.js`, `loading.js`, `global-error.js`), so a bad
  URL shows Next's unbranded default 404 and a crash shows Next's default error screen.
- **Route loading:** `components/RouteLoadingProvider.jsx` intercepts every link click and, if navigation takes over
  250ms, covers the whole viewport with a 6px blur and a spinning ring.
- **Empty states:** each page has its own (browse: dashed box + round search icon tile; notifications: round bell tile;
  messages: round tile; companies and blog: plain text).
- **Modals:** 13 dialog components (consent gate, confirm, image crop, report, bug report, review form, reviews list,
  company tutor, unsend, message disclaimer, edit regions, ...), with dark teal scrims (some blurred), 14px radius,
  large soft shadows, round coloured icon tiles in `ConfirmModal`.
- **Toasts:** five separate hand-rolled toast implementations (onboarding, owner profile, account, company owner,
  article editor).

**Problems:** missing 404 and error pages; a full-screen blur on every slow navigation (content disappears behind
an animation, checklist "content invisible until an animation runs"); round icon tiles in empty states and modals;
blurred scrims; five toast copies.

**Decision (2026-11-05):**
- **404 and error pages:** add `app/not-found.js` and `app/error.js`. Nav and footer kept; a 24px heading ("Page not
  found" / "Something went wrong"), one sentence, links to Find a tutor and Home; the error page adds "Try again".
  No illustration, no data. (Both must stay free of server fetches so static routes such as `/join` are unaffected.)
- **Slow navigation:** keep `RouteLoadingProvider` and its timing (250ms delay, minimum visible time) and the spinner,
  but the overlay becomes translucent white with **no blur**.
- **Empty states:** one pattern site-wide: one line of text + one action link; no icon tile, no dashed box.
- **Modals:** one shared style for all 13: white, 4px radius, 1px border, shadow (it floats), plain 40% neutral scrim,
  no blur, no icon tiles. Behaviour unchanged.
- **Toasts:** one shared toast component replaces the five hand-rolled copies, same behaviour and timing.

**Open questions:** none. Confirmed complete by user.

## 17. Mobile consistency check
**Status:** decided (2026-11-05)

**Phone decisions collected from items 1 to 16:**
- Foundation: type scale does not shrink (32/24px headings step down one size), 16px gutter, 44px tap targets.
- Nav (2, amended in 3): logo + menu button opening a full-width sheet; originally also "a visible search icon".
- Home (3): State and Subject stacked above a full-width button; browse-by lists; tutor rows.
- Browse (4): results first, "Filters (n)" full-screen sheet; rows with 56px photo, whole row taps through.
- Profile (5) and company page (6): no fixed bottom bar; rate/packages + Message/Enquire inline under the header.
- Editor (7): section modals become full-screen sheets. Onboarding: same steps.
- Auth (8): full-width form, 16px gutters. Account (11): same single column.
- Messaging (9): list then thread with back button; long-press for controls (new code, flagged).
- Notifications (10): single column list. Legal (14), blog (12), landing pages (13): single column, link lists in one column.
- Admin (15): section dropdown.
- Overlays (16): one modal style; no fixed bars anywhere remain.

**Conflicts found:**
1. The nav's phone "visible search icon" came from the nav search box, which item 3 withdrew.
2. Signed-in Messages and Notifications counts live in the menu sheet on phones, so unread counts are invisible
   until the sheet is opened.
3. Item 7 makes editor modals full-screen sheets on phones, but item 16's shared modal style says nothing about phones.

**Decision (2026-11-05):**
1. **Phone nav:** logo, a magnifier icon that simply links to `/browse` ("Find a tutor"), and the menu button.
   Replaces the withdrawn search icon (amends item 2's phone bullet).
2. **Unread on phones:** signed-in phones show Messages and Notifications as icons with numeric badges beside the
   menu button (LinkedIn app top bar); everything else stays in the sheet. Companies get Notifications only, as on desktop.
3. **Modals on phones:** forms (editor sections, report, review, bug report, image crop) become full-screen sheets
   below 640px; short confirms and the consent gate stay small centred dialogs (refines item 16).

**Open questions:** none. Walkthrough complete; next is Phase 2 (`DESIGN.md`) on the user's go.
