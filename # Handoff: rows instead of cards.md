# Handoff: rows instead of cards

**Status:** handoff document, written 2026-11-06 when the wider `UI-revamp` design was abandoned.
**Keep:** the move away from cards described here, the tutor row above all.
**Drop:** everything else from that redesign unless a new decision brings it back.

**Source of truth for the code:** branch `UI-revamp`, commit `7074b9d` ("implemented design brief (initial)").
Uncommitted work on that branch after `7074b9d` is about the home page and the logo, not about rows, with one exception
noted in §6.4. The longer reasoning is in `REDESIGN_DECISIONS.md` (items 4, 6, 11, 12, 15) and `DESIGN.md` (§4, §6).

---

## 1. What changed, in one paragraph

Every list of people or companies on the site used to be a grid of cards. Each card had a border, a soft shadow,
14px corners, a nested tinted strip for subjects and a stat tile rail. Now each list is a run of **rows**: photo on the
left, details in the middle, rate or action on the right. The rows have **no box of their own**; the list draws a 1px
rule between them. The same idea spread from the tutor list to company lists, related tutors, notifications, account
settings, admin queues and the profile page body, where sections are separated by a heading and a rule instead of
sitting in cards. The model is Wyzant's search results and LinkedIn's lists: dense, scannable, and nothing decorative
competing with the information.

## 2. Why: problems with the cards

These were measured on the live database and code on 2026-11-05, not assumed:

- **Missing rate.** The card's stat rail had room for two tiles. A tutor's second credential pushed the rate out, so
  **57 tutors never showed a price** on browse, the most important fact for a parent comparing tutors.
- **Unreadable text.** Subject pills were 10.5px and stat captions 9 to 10px uppercase, so the card could fit
  everything. Most of it failed basic legibility.
- **Nested containers.** The subject strip was a tinted box inside a bordered, shadowed box. That is a "card inside a
  card", and it read as template output.
- **Border and shadow together** on a static element (`0 18px 44px -20px` plus a 1px border), which made the page look
  generated rather than designed.
- **Fragile code.** `TutorCard.js` was 494 lines. It measured subject chips off-screen with two ResizeObservers per
  card to decide how many pills fit (`SubjectChipsFill`), depended on `StatTile`, and needed hand-derived height
  constants wherever it was reused, because the shadow overflowed its box. The row is about 160 lines and does none of
  that.
- **Wasted width.** A three-column card grid at 1128px gives each tutor about 360px, so bios were cut to a line and
  subjects to two pills. A row uses the whole width: photo 72px, details about 800px, rate column about 120px.
- **Inconsistent lists.** Tutors, companies, related tutors and landing pages each used a slightly different card,
  with different radii, shadows and fields.

## 3. Principles to keep

1. **The list draws the rules, never the row.** A row has no border, background, radius or shadow. Its parent `<ul>`
   has a top rule, and each `<li>` has a bottom rule. That keeps rules from doubling up, and lets a row be dropped into
   any list.
2. **Prefer no box at all.** Lists are rows divided by rules; page sections are divided by spacing and a rule. A box
   (1px rule border, 4px radius) is allowed only where something must visually stand apart, and there are very few
   such places (see §7.2).
3. **No nested containers.** A bordered box never sits inside another bordered box.
4. **Borders, not shadows.** Static elements get a 1px `--rule` border or nothing. Shadows are only for things that
   float (menus, modals, toasts, sheets).
5. **People are circles, companies are squares** (LinkedIn's rule). Photos and the initials fallback are circles;
   company logos are 4px-radius squares.
6. **The rate is always present.** A row always answers "how much?", even if the answer is "Rate not listed" or
   "Priced by package". Nothing is allowed to push it out.
7. **Text, not chips.** Subjects are a plain comma-separated list with "+N more". No pills, no tinted tags.
8. **The whole row is one link.** One click target to the profile. Secondary actions (the bookmark) sit outside the
   link, because a button inside an `<a>` is invalid HTML.
9. **Hover changes colour only.** The name turns accent on hover. No lift, no shadow, no scale.
10. **One row component everywhere.** Every tutor list renders the same component, so a field added once shows up
    everywhere.

## 4. The tutor row

**File:** `components/TutorCard.js`. The export is still called `TutorCard`, so no import had to change. It is a row,
not a card.

### 4.1 Anatomy

**Wide (640px and up): three columns**, `grid-cols-[72px_minmax(0,1fr)_auto]`, `gap-x-4`, `py-4`:

| Column | Width | Content |
| --- | --- | --- |
| Photo | 72px | Circle photo, or initials on a light grey circle |
| Details | fills | Name line, tagline, credentials, years and modes, bio, subjects, school / place / reviews |
| Rate | auto, min 120px | `$70 per hour` (or a fallback), right-aligned, `pt-14`, so it sits below the bookmark |

The bookmark button is absolutely positioned at the top right (`top-4 right-0`), outside the link.

**Phone (below 640px): two columns**, `grid-cols-[56px_minmax(0,1fr)]`. The photo shrinks to 56px, the rate moves onto
the name line (pushed right with `ml-auto`), and the details column gets `pr-12` so text never runs under the bookmark.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ (photo)  Kanishka B.  ✓                                        [bookmark] │
│  72px    Tagline, one line, truncated…                                    │
│          ATAR 99.15 · Dux 2024                              $70 per hour  │
│          Years 7–12 · In person near Epping · Online                      │
│          Bio excerpt, clamped to two lines of 14px text, from the long    │
│          bio with Markdown stripped…                                      │
│          HSC Chemistry, HSC Physics, HSC Maths Ext 1, +3 more             │
│          James Ruse AHS · Epping, NSW · No reviews yet                    │
├───────────────────────────────────────────────────────────────────────────┤  ← the list's rule, not the row's
```

### 4.2 Fields, in order

Each line renders only when it has content, except the reviews line, which always renders.

| # | Line | Source (card object) | Rule / fallback | Style |
| --- | --- | --- | --- | --- |
| 1 | Name | `name` → `shortName()` | "Kanishka B." in every row; the profile page shows the full name. Turns accent on row hover. | 16px/24 600 `--text` |
| 1 | Verified **or** company | `verified`, `company.name` | A company tutor shows the company name with a building icon and **never** the verified tick (the tick is earned by an individual). | tick 14px accent; company 12px `--text-2` |
| 1 | Rate (phone only) | see rate rule | | |
| 2 | Tagline | `bio` (the tagline column) via `stripMarkdown` | one line (`line-clamp-1`) | 14px/20 `--text` |
| 3 | Credentials | `credentials[]`, first 2 | ATAR credential renders "ATAR 99.15"; the rest render their label as written. Joined with " · ". | 14px/20 `--text-2` |
| 4 | Fit | `yearMin`/`yearMax` → `yearRangeLabel`; `deliversInPerson`, `deliversOnline`, `suburb` | "Years 7–12 · In person near Epping · Online". "In person" without a suburb if none is set. | 14px/20 `--text-2` |
| 5 | Bio | `bioLong` via `stripMarkdown` | two lines (`line-clamp-2`) | 14px/20 `--text-2` |
| 6 | Subjects | `subjects[]` → `subjectLabel`, first 4 | comma-separated, then ", +N more" in muted | 14px/20 `--text-2` |
| 7 | Meta | `highSchool` or `university`; `suburb`, `city`; `rating`, `reviews` | "School · Suburb, STATE · ★ 4.8 (12 reviews)" or "No reviews yet" | 12px/16 `--muted` |

Long user text gets `[overflow-wrap:anywhere]` so an unbroken string (a URL, emoji runs) cannot widen the page.

### 4.3 Rate rule

```js
if (tutor.isCompanyTutor || tutor.company)  -> "Priced by package"   (14px, --muted)
else if (!Number.isFinite(rate) || rate <= 0) -> "Rate not listed"   (14px, --muted)
else -> "$70" (20px/28 600, tabular-nums) + "per hour" (12px, --muted)
```

Company tutors have no hourly rate by design (migration 0069). Their company prices by package.

### 4.4 Props

| Prop | Default | Use |
| --- | --- | --- |
| `tutor` | | The card object from `tutorRowToCard` (§8) |
| `showSave` | `true` | Shows the bookmark. It is also suppressed for company tutors. |
| `tabIndex` | `0` | `-1` for a decorative duplicate (the marquee's second copy) so keyboard users meet each tutor once |
| `showVerifiedLabel` | `true` | Shows the word "Verified" beside the tick where there is room |

### 4.5 Interaction and accessibility

- The whole row is a `next/link` to `/tutor/<slug>`; that is the row's only link.
- The bookmark (`SaveTutorButton variant="card"`) is a sibling of the link inside a `relative` wrapper. It is 44px,
  white, with a 1px rule border, 4px radius, no blur and no shadow.
- Tap targets: the row is far taller than 44px; the bookmark is exactly 44px.
- There is no hover background on tutor rows. Only the name colour changes. Notifications and messages are the
  exception: they use `--surface-2` on hover or for unread items.
- Focus: the global 2px accent outline (`app/globals.css`) lands on the link.

## 5. The list container

Every list of rows uses the same markup. Copy this, not a card grid:

```jsx
<ul className="border-t border-rule">
  {tutors.map((t) => (
    <li key={t.id} className="border-b border-rule">
      <TutorCard tutor={t} />
    </li>
  ))}
</ul>
```

- A list heading, if there is one, is a 20px/28 600 `<h2>` with `mt-4` before the `<ul>`.
- Do **not** add horizontal padding to rows inside a page section; rows align flush with the section heading.
- An empty list is one line of `--text-2` text and one action link: no icon tile, no dashed box.
- Pagination sits below the list as real `<Link>`s.

## 6. Where the row is used, and its variants

### 6.1 Tutor row consumers (all render `TutorCard` in the §5 list)

| Place | File | Notes |
| --- | --- | --- |
| `/browse` results | `app/browse/BrowseResultsGrid.jsx` | On `?saved=1`, an unsaved row drops immediately once saved state is ready |
| `/tutors/...` landing pages | `app/tutors/LandingView.jsx` | "Also teaching online" is a second list with its own heading |
| Company page "Our tutors" | `app/companies/[slug]/CompanyCards.jsx` | Company tutors: company name instead of tick, "Priced by package", no bookmark. The owner's editor (`CompanyTutorsEditor.jsx`) feeds its draft tutors into this same list, so owners see the real row. |
| Profile "Other verified tutors" | `app/tutor/[slug]/PublicProfileView.jsx` | Renamed from "Similar tutors" (they were never similar), filtered to individually verified tutors so the heading is true |
| Home list | `app/page.js` at `7074b9d` | 25 verified rows; later replaced (see §6.4) |

### 6.2 Company row

**File:** `components/CompanyCard.jsx` (export still `CompanyCard`). This is the tutor row with three differences:

- **Square 4px logo** instead of a circle (`Avatar shape="square"`). The logo maps onto Avatar's `avatarImg`/`name`.
- **Fields:** name; tagline; "Suburb, STATE · N tutors"; up to 4 subjects + "+N more"; up to 2 packages
  ("Weekly $60 · Term $550, +1 more"); reviews line.
- **Right column** is a "View company ›" text link instead of a rate. It hides below 640px, where the whole row is
  the link.

A company's subjects are **derived from its tutors**, never stored (see `CLAUDE.md` Companies). `listCompanies` loads
only up to three preview tutors per company, so the row shows those tutors' subjects. Its list wrapper is
`app/companies/CompaniesFeed.jsx` (`<ul className="flex flex-col border-t border-rule">`).

### 6.3 Related tutors on a profile

The same list under a 20px heading, after the main column, with `pt-12`. There is no sidebar of mini-cards; the old
`SimilarTutorMini` component is deleted.

### 6.4 Rows on a dark band (uncommitted, after `7074b9d`)

The last iteration of the home page showed featured tutors as two horizontally scrolling marquees of **rows without
cards**, separated by 1px vertical rules, on a dark teal band (`components/FeaturedTutors.jsx`, uncommitted). The
marquee itself belongs to the abandoned design, but **one technique is worth keeping**:

The row was not given a dark variant. The band sets a class that **redefines the colour tokens** the row already uses,
so the unchanged row renders light-on-dark:

```css
.band-scope {
  --text: var(--on-band);        /* #FFFFFF */
  --text-2: var(--on-band-2);    /* #C7DEDC */
  --muted: var(--on-band-2);
  --accent: var(--on-band-accent); /* #8FD0CB */
  --accent-hover: var(--on-band);
  color: var(--text);
}
```

This works only because the row takes **every colour from a token** and never from a hex value. Keep that property and
any future inverse or themed surface comes for free, with no prop and no risk to `/browse`.

## 7. Beyond lists: moving page structure off cards

### 7.1 Sections instead of cards

Profile pages, account settings, onboarding and admin detail pages used stacks of cards. They now use **sections**:

```jsx
// app/tutor/[slug]/ProfileCards.jsx
export function Section({ title, subtitle, children, id }) {
  return (
    <section id={id} className="border-b border-rule py-6">
      <div className="mb-4">
        <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{title}</h2>
        {subtitle && <p className="text-[14px] leading-5 text-[color:var(--text-2)] mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
```

That means a 20px heading, content, and a rule before the next section, with no icons beside headings. The exported
names in `ProfileCards.jsx` (`SubjectsCard`, `DocumentationCard`, `ServiceAreaCard`, …) kept their "Card" suffix
because the owner editor and company pages import them. The suffix is historical: they are flat sections.

Where else this applies:
- **Account** (`/account`): one reading-width column of sections: Profile, Password, Profile management, then Delete
  account last with an error-colour heading.
- **Notifications:** a ruled list. Each row has a 16px grey type icon, the text and a relative time; unread rows sit on
  `--surface-2` with a 600 title. No dots, no photos.
- **Messages:** rows grouped by sender (circle photo, name, time), plain text on white, no bubbles. A row turns
  `--surface-2` on hover and shows its controls.
- **Admin:** queues are ruled rows; detail pages are sections.
- **Companies directory and `/tutors` "Narrow it down":** plain text link lists with muted counts, up to three columns.

### 7.2 The few boxes that remain

`cardStyle` in `ProfileCards.jsx` is now just `{ border: "1px solid var(--rule)", borderRadius: "var(--radius)" }`,
with no shadow. It is used only where something must stand apart:

- **The profile contact column** (rate, packages, Message or Enquire). From 1024px up it is the one bordered box on the
  page and sticks under the nav. Below 1024px it becomes a section with a bottom rule:
  `contactColumnClass = "border-b border-rule pb-6 lg:border lg:rounded lg:p-6"`.
- **Choose-role** radio rows: two bordered options, because they are form controls.
- **Inline alert boxes:** at most one per screen.

### 7.3 Profile header without a card

The header is no longer a card. A banner appears **only if the tutor uploaded one** (120px on phones, 160px from 640px
up, 4px corners, page width). A 112px circle photo overlaps its bottom-left edge (white ring) and the name block sits
beside it. With no banner there is no strip, no generated gradient and no placeholder: the photo and name simply start
the page. The header ends with a rule. `ProfileHeader` in `PublicProfileView.jsx` is exported so the owner editor
renders the identical header.

### 7.4 Deliberately still a grid

The **blog index** kept a two-up grid of article tiles (`app/blog/ArticleCard.jsx`), flattened: 4px covers, no shadow,
no hover animation. A cover image is the content there, and a row would shrink it to a thumbnail. This is an
acknowledged inconsistency (open item E in `REDESIGN_DECISIONS.md`). Decide it explicitly rather than by drift.

## 8. Data the row depends on

The row needed four fields that the browse query did not return. These are additive and touch neither RLS nor any
RPC:

```js
// lib/supabase/tutors.js, BROWSE_SELECT: add
  delivers_in_person,
  delivers_online,
// (year_min / year_max were already selected)

// tutorRowToCard: add
  yearMin: row.year_min ?? null,
  yearMax: row.year_max ?? null,
  deliversInPerson: row.delivers_in_person === true,
  deliversOnline: row.delivers_online === true,
```

Fields the row reads: `id, slug, name, avatarImg, verified, company, isCompanyTutor, rate, bio (tagline), bioLong,
credentials[{label, icon}], subjects[{name, slug, exam}], highSchool, university, suburb, city, yearMin, yearMax,
deliversInPerson, deliversOnline, rating, reviews`.

Helpers (all in `components/ui.js` unless noted):
- `shortName(name)` gives "Kanishka B.". Use it in every row and card, never on the profile page itself.
- `initialsFrom(name)` derives initials at render time. **Do not trust the `initials` column:** 17 tutors had it
  empty. `Avatar` prefers `initial`/`initials` and falls back to this.
- `Avatar({ tutor, size, shape: "circle" | "square", ring })`: no photo means initials in `--text-2` on
  `--surface-2`. No icons, no tutor-picked colours.
- `VerifiedTick({ size, label })`: an accent check, optionally with "Verified".
- `subjectLabel` (`lib/subjects.js`), `stripMarkdown` (`lib/richText.js`), `yearRangeLabel` (`lib/yearLevels.js`).

Related, but a separate decision: the State filter now also returns tutors who teach online (`R3`, an `.or()` in
`getTutorsForBrowse`). It is not part of the row work, but it is why QLD results went from 0 to 77, so keep it in mind
if browse results look thin after porting.

## 9. Tokens and sizes the row assumes

If you port the row into a new design, map these. The row hard-codes none of their values.

| Token | Value at `7074b9d` | Row uses it for |
| --- | --- | --- |
| `--text` | `#1A1A1A` | name, tagline, rate |
| `--text-2` | `#4A4A4A` | credentials, fit line, bio, subjects |
| `--muted` | `#666666` | meta line, "per hour", fallbacks, "+N more" |
| `--accent` | `#016764` | name on hover, verified tick |
| `--rule` | `#E3E3E3` | the list's rules, the bookmark border |
| `--surface-2` | `#F5F5F5` | initials background |
| `--radius` | `4px` | bookmark, company logo |

Type sizes used: 20/28 (rate), 16/24 (name), 14/20 (body lines), 12/16 (meta, "per hour", company name). Weights: 400
and 600 only. Spacing: `py-4` per row, `gap-x-4` between columns, `gap-1` between detail lines.

## 10. Edge cases already handled

- **No photo:** initials circle; the layout does not change.
- **No rate or $0:** "Rate not listed"; the right column never collapses.
- **Company tutor:** company name instead of the tick, "Priced by package", no bookmark.
- **No tagline / bio / credentials / years:** the line is omitted; rows simply get shorter. Rows in one list are not
  forced to equal heights (this was a deliberate choice over a uniform card height).
- **Unbroken long strings and emoji credentials:** `overflow-wrap:anywhere`.
- **No reviews:** "No reviews yet". While no tutor has reviews, this repeats on every row (open item B).
- **Saved filter:** unsaving removes the row without a reload (`BrowseResultsGrid.jsx`).
- **Duplicate rows for decoration:** pass `tabIndex={-1}` and put `aria-hidden` on the duplicate container.

## 11. Porting checklist

To carry the row pattern into another design:

1. Take `components/TutorCard.js`, `components/CompanyCard.jsx`, `components/SaveTutorButton.jsx` and the `Avatar`,
   `VerifiedTick`, `shortName`, `initialsFrom` exports of `components/ui.js` from commit `7074b9d`.
2. Apply the §8 data change to `lib/supabase/tutors.js` (two select columns, four mapped fields).
3. Make sure the new design defines the §9 tokens, or rename them in the two row files. Keep every row colour a token
   (§6.4).
4. Replace each card grid with the §5 list markup. Consumers are listed in §6.1.
5. Delete what the cards needed: `StatTile`, `SimilarTutorMini`, the `SubjectChipsFill` measuring code and any
   card-height constants.
6. Decide the open items below explicitly.
7. Check at 390px and 1440px: the rate is always visible; the bookmark never overlaps text; the page never scrolls
   sideways; tab order reaches each row once.

## 12. Open questions for whoever picks this up

- **B. Reviews line:** "No reviews yet" on every row while there are no reviews. Hide the line until a tutor has one?
- **C. Verified tick:** unlabelled in tight rows, and parents may read it as a WWCC or background check, which it is
  not (it covers ATAR and marks).
- **E. Blog:** keep the two-up article grid or move it to rows with thumbnails.
- **Row height variance:** rows differ in height by content. Accept it (as now), or cap the bio to one line for a
  calmer rhythm.
- **Bookmark placement:** it sits top-right outside the link. If a new design adds more row actions, group them there,
  never inside the link.
