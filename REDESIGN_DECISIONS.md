# MatchTutor UI redesign: decision log

The decisions behind `DESIGN.md`. Each item states its **final** decision only; how decisions changed along the way
is in the Changelog at the end, and the full working history is in git (commit `8fe4400`).

Ground rules for this pass:
- Visual and content only. Auth, RLS, Realtime messaging, notification delivery and RPCs are not touched.
  Anything that needs a data or query change is flagged and approved first, never built silently.
- References: highschooltutors.com.au (HST: density, AU context), Wyzant (search and profiles), LinkedIn (restraint,
  messaging, notifications, dashboards).
- Never invent content, names, reviews or numbers.
- No em dashes in user-facing copy (CLAUDE.md rule).

---

## Phase 0: inventory and audit (2026-11-05)

### Screens
| Area | Routes |
| --- | --- |
| Public | `/`, `/browse`, `/tutor/[slug]`, `/companies`, `/companies/[slug]`, `/blog`, `/blog/[slug]`, `/tutors` + 3 deeper landing levels, `/terms-of-service`, `/privacy-policy`, `/join` |
| Auth | `/signup`, `/login`, `/choose-role`, `/forgot-password`, `/reset-password`, `/join/details`, `/companies/claim` |
| Signed in | owner profile editor (`/profile` redirects to `/tutor/<slug>` owner branch), `/onboarding`, `/account`, `/notifications`, `/messages` (real two-pane chat, `app/messages/MessagesClient.jsx`), `/browse?saved=1`, `/account-disabled`, `/company`, `/author`, `/author/[id]` |
| Admin | `/admin` overview + verification, reviews, reports, profile-changes, tutor-invites, companies, users, history (+5 legacy redirect stubs) |

Shared chrome: `components/TopNav.js`, `components/SiteFooter.jsx` + `components/Footer.js`. Overlays: `PolicyConsentGate`,
`VerificationPrompt`, `RouteLoadingProvider`, `BugReportModal`, `ReportModal`, `ConfirmModal`, `ImageCropModal`,
`ReviewFormModal`, `ReviewsModal`, `CompanyTutorModal`, `EditRegion` modals. Emails: 24 builders in `lib/email/send.js`,
2 Supabase templates in `supabase/email-templates/`, 1 newsletter in `email-updates/`. No `loading.js`, `error.js` or
`not-found.js` anywhere.

### Sprawl found (over `app/` + `components/`)
| Axis | In use |
| --- | --- |
| Font sizes | 34 distinct `text-[Npx]` values (7 to 44px, half-pixel steps) + about 15 inline `fontSize` values (3 `clamp()`). Named Tailwind scale unused. |
| Weights | 300 / 400 / 500 only; headings light 300; `<strong>` pinned to 500. |
| Fonts | General Sans (Fontshare) + Caveat script. |
| Colours | 63 hex + 44 `rgba()` values; ~29 `:root` tokens mirrored in `tailwind.config.js`; teal-tinted `slate` override; stock Tailwind status colours; ~6 near-identical teal-whites. |
| Radii | ~16 values (2 to 16px, card 14px) + `50%` + `999` pills (67 uses). |
| Shadows | 18 inline values + 3 CSS classes + 35 Tailwind `shadow`; cards carry border AND shadow. |
| Spacing | 21 Tailwind steps + 54 inline paddings; container widths 440 to 1400px (10 values). |
| Effects | 13 gradients (9 files), backdrop blur (12 files), `motion/react` (16 files). |

### impeccable detect (via npx, 2026-11-05)
Desktop scan of 9 live pages: 196 findings (84 `low-contrast`, 61 `undersized-ui-text`, 32 `nested-cards`, 13
`line-length`, 4 `straggler`, 1 `hero-eyebrow-chip`, 1 `ai-color-palette`). Phone scan (home, browse, profile): 182
findings, 115 undersized text on `/browse`. Source scan: 0 (regex only, an undercount). Raw JSON in the session
scratchpad, not the repo.

### Live data (2026-11-05, the database the dev server uses)
114 public tutors (113 individual, 1 company tutor), 88 verified, 89 shown by `/browse` by default (verified or company),
**0 approved reviews**, 0 public companies, 0 published articles. 29 tutors without a photo; 17 with an empty `initials`
column. 17 individual tutors with no rate, 1 with $0. Based-in state: NSW 72, VIC 13, ACT 2, SA 1, WA 1, none 25
(QLD, TAS, NT 0). 97 teach online. 26 uploaded a banner. 113 of 114 profile slugs contain the surname.

### Data flags
1. **WWCC is not a verified field**, only an optional uploaded document. "Verified" means ATAR/marks checked by an admin.
2. **Response time is self-reported** from a 4-option select (`RESPONSE_OPTIONS`, `components/profile-edit/sections.js:45`),
   defaulting to "Usually responds in <1 hr" (`components/profile-edit/defaults.js:24`, `lib/supabase/tutors.js:116`).
3. **No lesson count or hours tutored, no public "last active".**
4. **80 profiles hold the default "Usually responds in <1 hr".** Clearing them (one-off UPDATE, run by the user) is
   deferred to Phase 3. See open item A.

### Approved query change (the only non-visual change so far)
- **State filter includes online tutors** (R3): in `getTutorsForBrowse` (`lib/supabase/tutors.js`) the State filter
  becomes "based in the state OR teaches online". No schema change.

---

## 1. Design foundation
**Status:** decided

**Was:** palette in `app/globals.css` + `tailwind.config.js`; teal `#016764` on buttons, links, chips, rings; teal-tinted
greys everywhere; General Sans 300/400/500 + Caveat; cards with 1px border + soft shadow at 14px; the sprawl above.

**Decision:**
- **Lead reference per screen:** Wyzant for search results, tutor rows and profiles; LinkedIn for messaging,
  notifications, account, the owner editor and admin; HST for homepage density and `/tutors` landing pages.
- **Colour:** teal `#016764` is the single brand accent, for links, primary buttons and the verified mark (plus the
  roles it holds today: badges, focus ring, selected states, R7). True neutral greys for text, borders, surfaces. One
  fixed status set (error, warning, success). Logo, OG image and emails keep the same teal. All text 4.5:1 minimum.
- **Typeface:** Source Sans 3 (Google Fonts), weights 400 and 600, chosen from a side-by-side specimen of real profiles.
  General Sans, its Fontshare workaround, and Caveat are removed. Bold allowed. Emails keep the system sans.
- **Wordmark:** the General Sans "MatchTutor" wordmark is traced to SVG outlines once (one-off tool, not added to
  `package.json`), so the logo keeps its look with no font loading.
- **Surfaces:** Wyzant model. White page; sections separated by 1px rules and spacing, not boxes. 4px radius. Shadows
  only on floating elements. `.desk-surface`, `DeskBackdrop` and `--card-shadow` go.
- **Type scale:** 12 / 14 / 16 / 20 / 24 / 32px, no half pixels, no `clamp()`. 14px UI base, 16px reading, 12px floor
  for meta only.
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px only.
- **Widths:** page 1128px; reading about 680px (forms, blog, legal, account); auth forms about 400px (R9 left as is).
- **Breakpoints (R8):** 640px and 1024px. Below 1024 is "compact", below 640 is "phone".
- **Phone:** type does not shrink except 32px headings, which become 24px (R11). 16px side gutter.
- **Tap targets (R10):** 44px for buttons, controls and tappable rows; 24px for text links.
- **Shapes (R6):** people are circles; companies are squares at 4px.

## 2. Nav + footer
**Status:** decided

**Was:** fixed 1400px bar, transparent with no border, slides away on scroll; three of six links were home-page anchors;
signed-in everything inside one avatar dropdown with a teal dot; no phone menu. Dark footer with three links failing
contrast.

**Decision:**
- **Bar:** solid white, always visible, 1px bottom border, no hide-on-scroll, 1128px. **No search box.**
- **Logged out:** Find a tutor (`/browse`), Companies, Blog, Become a tutor (`/signup`), Log in, Sign up.
- **Signed in:** Browse, Messages, Notifications (icon + label, numeric badges), Companies, Blog, then a "Me" dropdown
  with Profile, Account, Saved tutors, My company, Write, Admin, Log out (each gated on role or capability as today).
  No avatar dot. Companies have no Messages item.
- **Compact (below 1024):** logo, a magnifier icon linking to `/browse`, and a menu button opening a full-width sheet.
  Signed in, Messages and Notifications also sit in the bar as icons with numeric badges (companies: Notifications only).
- **Footer:** one light row: wordmark, Become a tutor (logged out only), Companies, Blog, Terms, Privacy, Report a bug,
  copyright. 4.5:1 contrast. Still hidden on auth pages and `/messages`. Companies always shown, whatever the count.

## 3. Homepage
**Status:** decided (lead: HST)

**Was:** 90svh hero with particle network, glow, swaying leaves, tracked-caps "Australia's Most Trusted Tutor
Network", typewriter word; rotating school crests; featured-tutor marquee on a dark band; animated "How it works"
vine; gradient CTA band. Copy claimed booking (which does not exist).

**Decision (top to bottom):**
1. Functional headline and a count line from live data using the **total public tutor count** ("114 tutors"; never
   "verified" in count copy, R4). No superlatives.
2. HST-style search panel: **State, then Subject**, labels above fields, full-width submit button. State results include
   online tutors (R3). Phone: fields stack full width above the button.
3. Compact "Browse by subject" and "Browse by state/city" link lists feeding the `/tutors` pages.
4. 25 verified tutor rows (item 4 design), ranked by `lib/ranking.js` with equal scores reshuffled each load.
5. "See all N tutors" as a plain `/browse` link (lands on a page showing its own smaller count; accepted, R4).

Removed: hero backdrop, typewriter, scroll cue, icon bullets, schools strip and the 24 crest images in
`public/images/marquee/`, featured marquee, How it works, the CTA band (its job moves to the footer link). All load and
scroll animation goes. Existing verification wording elsewhere is left as written (user skipped that question).

## 4. Browse + tutor rows
**Status:** decided (lead: Wyzant)

**Was:** gradient page with swaying stationery; `TutorCard` with border + shadow, 14px radius, weight-300 name, teal
tagline, nested tinted subject strip, stat rail where a second credential displaced the rate (57 tutors never showed a
rate); 9 to 10px text; staggered fade-in; on phones all filters stacked above results.

**Decision:**
- **Rows, not cards:** photo left, details middle, rate + action right, 1px rule between rows. Shared by `/browse`, the
  home list, `/tutors` pages, company "Our tutors" and related tutors.
- **Fields:** everything shown today (verified tick or company name, lead and second credential, tagline, bio excerpt,
  school + suburb/state, subjects, bookmark, profile link), plus: rate always shown; year range; in person near suburb
  and/or online; a reviews line (rating + count, or "No reviews yet"; see open item B).
- **Rate rule (R2):** a missing or $0 rate reads "Rate not listed". Company tutors show no rate (company prices by package).
- **Names (R1):** first name + last initial ("Kanishka B.") in every row and card. The Name filter still searches full names.
- **Photos (R6):** circles. No photo: initials on light grey in a circle. Derive initials from the name at render time,
  since 17 tutors have an empty `initials` column (no data change).
- **Filters:** left sidebar, plain labels, rule-separated groups; School, Minimum ATAR, Max rate and Verification under
  "More filters" (Verification stays on by default, R5). Compact: results first, "Filters (n)" opens a full-screen sheet.
- **Phone row:** 56px photo; name + verified + rate on the first line; credentials, years, mode, reviews line, 2-line
  bio, first few subjects below. Whole row taps through.

## 5. Public tutor profile
**Status:** decided (lead: Wyzant)

**Was:** stationery backdrop, staggered card fade-ins; header card with 150px banner (or generated gradient for 88
tutors), ringed photo, weight-300 name, response time with an amber dot; rate and Message down in the sidebar;
"Similar tutors" that were really top-rated tutors; a fixed phone bar with hard-coded "Online or in person".

**Decision:**
- **Header:** banner only if the tutor uploaded one (about 160px, page width, 4px corners, no card), circle photo
  overlapping its bottom-left edge; then the name block: **full name** (R1, also page title and JSON-LD), verified,
  tagline, location, in person/online, years, rating line, and response time as plain text labelled as the tutor's own
  claim (no dot). No banner means no strip and no placeholder.
- **Body:** main column About, Subjects, Credentials, Education, Experience, Reviews, Availability, Location map;
  sticky right column with rate, packages, Message. Sections divided by rules, not cards.
- **Related:** same query, honest label (for example "Other verified tutors"), at the bottom.
- **Copy:** Availability no longer says "book".
- **Compact (below 1024):** no sticky column; rate + Message inline under the header; no fixed bottom bar.

## 6. Companies directory + company page
**Status:** decided (mirrors items 4 and 5)

**Decision:**
- **Directory:** item 4 rows. Square logo; name, location, subjects (from its tutors), number of tutors, packages,
  reviews line; view link. Same filters and compact sheet as `/browse`. Gradient, stationery, fade-in removed.
- **Company page:** item 5 structure. Banner only if uploaded; square logo + name block; sticky right column with
  packages + Enquire; main column About, Our tutors (rows, no nested cards), Reviews, Location. Compact: Enquire inline,
  no fixed bar. The owner view keeps the same layout with edit controls.

## 7. Onboarding + owner profile editor
**Status:** decided (lead: LinkedIn)

**Was:** wizard with a sparkle pill, light heading, segmented progress bar, sliding steps, "edit it all later in
Settings" (no such page), 8 em dashes; editor modals over a blurred page; percentage meter with dots; a site-wide
verification nag modal.

**Decision:**
- **Editing:** LinkedIn pen + modal on the page the tutor sees; plain modal, no blur. Phone: full-screen sheet.
- **Onboarding:** same six steps and Skip; plain "Step 2 of 6" text; no pill, no slide, no segmented bar; copy fixed.
- **Verification nudge:** `VerificationPrompt` modal removed; the tutor's own profile shows a one-line notice with
  "Request verification" and a plain checklist of what is missing.
- **Response time (R13):** the editor select and its "Usually responds in <1 hr" default stay as they are.
- **Banner upload:** stays.

## 8. Auth screens
**Status:** decided

**Decision:** plain centred form, about 400px, no card, no shadow, no animation, 24px heading at 600, for signup, login,
forgot/reset, choose-role, `/join` (still static) and `/join/details`. Headings "Log in" and "Create an account".
"Alex Nguyen" placeholder removed; em dashes rewritten. Choose-role: two bordered radio rows, Continue, and the
"You can't change this later" warning as text above the button (no modal). Phone: full width, 16px gutters.

## 9. Messaging
**Status:** decided (lead: LinkedIn)

**Decision:** LinkedIn rows, no bubbles: every message left-aligned and grouped under the sender's photo, name and
time, on white. No fills at rest; a row turns light grey on hover, where its controls appear. Reactions, reply, menu
and double-click thumbs-up kept, restyled. Phone: list then thread with back button; composer pinned; controls on
long-press (**new interaction code**, there is no touch handling today; confirm at build time). Behaviour untouched.

## 10. Notifications (in-app + email)
**Status:** decided (lead: LinkedIn)

**Decision:**
- **In-app:** one continuous list with 1px rules; each row a 16px grey type icon, text, relative time; unread rows on
  very light grey with a 600-weight title, no dot. No person photos (R12: no actor data).
- **Icons:** plain grey glyphs; only rejections and warnings use the warning colour; no sparkle.
- **Emails (light touch):** remove emoji and symbols from headings, subjects and notification titles (10 occurrences in
  `lib/email/send.js` and `app/api/**`); neutral greys; 4.5:1 text; 4px buttons; 600 headings. Same in both Supabase
  templates (the user re-pastes them in the dashboard). The newsletter is left alone.

## 11. Account / saved tutors / account disabled
**Status:** decided (lead: LinkedIn)

**Decision:** account as one reading-width column, 24px heading, sections divided by rules (Profile, Password,
Profile management, Delete account last with an error-colour heading), no cards or heading icons. Saved tutors stays a
`/browse?saved=1` filter. Account disabled: plain centred heading, explanation, Log out.

## 12. Blog + author editor
**Status:** decided

**Decision:** blog index keeps the two-up article grid, flattened (4px covers, no hover animation, no Caveat, 600
heading; see open item E). Article page keeps its structure with the foundation applied. The CTA band is removed from
both blog routes. Author pages: foundation restyle only.

## 13. SEO landing pages
**Status:** decided (lead: HST)

**Decision:** "Narrow it down" becomes HST-style column link lists with counts (3 columns, 1 on phones), no pills;
headings at 600; rows from item 4 ("First L."). Full names stay in the JSON-LD and `llms-full.txt` (R1). Internal links
come from the home page lists and `sitemap.xml`; the footer stays minimal.

## 14. Legal pages
**Status:** decided

**Decision:** foundation only: reading width at 16px, 600 headings. No date, no contents list. **User to reword:**
privacy policy section 11 refers to a "Last updated" date at the top that does not exist.

## 15. Admin dashboard
**Status:** decided (lead: LinkedIn)

**Decision:** restyle the shared kit only (`app/admin/layout.js`, `_components/AdminNav.jsx`, `_components/ui.jsx`,
`DecisionPanel.jsx` styling): white page, plain left nav with numeric counts, rules instead of `Panel` cards, no icon
tiles, `Inset` as a light grey area without a nested border, plain text labels except status. Compact: one section
dropdown instead of the chip row.

## 16. Empty / loading / error / 404 + overlays
**Status:** decided

**Decision:**
- Add `app/not-found.js` and `app/error.js`: nav and footer, 24px heading, one sentence, links to Find a tutor and
  Home (error page adds "Try again"). No server fetches.
- `RouteLoadingProvider` keeps its timing and spinner; the overlay is translucent white with no blur (open item F).
- Empty states: one line of text + one action link, no icon tile, no dashed box.
- Modals: one shared style for all 13 (white, 4px, 1px border, shadow, plain 40% neutral scrim, no blur, no icon
  tiles). Below 640, form modals (editor sections, report, review, bug report, image crop) are full-screen sheets;
  short confirms and the consent gate stay small centred dialogs.
- Toasts: one shared component replaces the five copies, same behaviour.

---

## Still open
- **A.** With the response-time default kept (R13) and the 80-profile reset deferred, profiles show "Usually responds in
  <1 hr" as the tutor's own claim for tutors who may never have chosen it.
- **B.** "No reviews yet" on every row while 0 tutors have reviews.
- **C.** The verified tick is unlabelled; parents may read it as a background or WWCC check (data flag 1 open).
- **D.** The home page has no sentence explaining what MatchTutor is.
- **E.** The blog keeps a card grid while every other list is rows.
- **F.** The route-loading overlay still hides the page after 250ms.
- **G.** "Become a tutor" lands on a role-neutral signup, then `/choose-role` asks again.
- **H.** Placeholder people remain outside signup: "Alex Nguyen" (`app/(auth)/join/JoinFlow.jsx:222`), "Amelia Tran"
  (`components/profile-edit/sections.js:744`), "Jane Liu" (`app/companies/[slug]/CompanyTutorModal.jsx:156`), and the
  real brand "Kumon Chatswood" (`components/profile-edit/company-sections.js:96`).
- **CLAUDE.md** (updated 2026-11-05 on DESIGN.md approval): it now points to `DESIGN.md` as the authority, marks the
  Styling, Theme, Typography and component notes as describing today's code, notes R3 as approved but unbuilt, and fixes
  the stale `/`, `/messages` and `/account-disabled` rows. Still to do in Phase 3: rewrite those sections once the code
  matches.

## Changelog (how decisions moved)
- **Item 1:** system UI stack picked, then replaced by Source Sans 3 after the specimen.
- **Item 2:** a subject + suburb search box in the nav was decided, re-confirmed, then withdrawn in item 3 (search lives
  on the home page only). Item 3 added "Find a tutor" and the footer "Become a tutor" link. Phone nav breakpoint moved
  from 768 to 1024 (R8); the phone search icon became a plain `/browse` link (item 17).
- **Item 3:** search fields went subject + suburb, then HST's model, then State + Subject only (Year and Online declined).
  The tutor CTA moved from a band into the footer. Count line lost "verified" (R4).
- **Item 4:** photos became circles, not 4px squares (R6); rate rule added (R2).
- **Item 5:** banner went HST full-width band, then dropped, then back only when uploaded (item 7). Name went "First L.",
  then full name on the profile (R1). Response time went hidden permanently, then back as the tutor's claim (item 7),
  default kept (R13). Phone fixed bar removed.
- **Item 6:** "no banner" became "banner only if uploaded" (item 7).
- **Item 10:** person photos in notification rows dropped (R12).
- **Item 17 (mobile check)** and the **review flags R1 to R13** are folded into the items above.
