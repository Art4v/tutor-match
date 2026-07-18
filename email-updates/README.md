# Sending update emails to all tutors

This folder holds ready-to-send email content for matchtutor product updates. Emails go out
through **Resend Broadcasts** against a synced audience of your tutors. There is no "send" code in
the app — you compose and send from the Resend dashboard.

| File | What it is |
| --- | --- |
| `0001_verification-education-and-policies-update.html` | The launch email: the **fresh new look** (redesign) + **Verification** + **High school / University** education. Paste into a Resend Broadcast. |
| `README.md` | This guide. |

**Naming:** each email is a numbered HTML file (`NNNN_short-description.html`, e.g.
`0001_...`), kept in numeric order like `supabase/migrations/`. New campaigns take the next
number; `README.md` is the only unnumbered file.

---

## Before you send (one-time / each campaign)

1. **Verified sending domain.** In Resend → **Domains**, your domain (e.g. `matchtutor.com.au`)
   must be verified (SPF/DKIM/DMARC green). Broadcasts from `onboarding@resend.dev` only reach your
   own Resend account email.
2. **Sync the audience** so it reflects current tutors:
   ```
   npm run sync:audience
   ```
   This adds every confirmed tutor as a contact (idempotent; safe to re-run). It needs a
   **full-access** Resend key in `.env` as `RESEND_AUDIENCE_API_KEY` (the app's sending-only
   `RESEND_API_KEY` can't manage contacts). See the comment block in `.env.example`.

---

## Sending a broadcast (step by step)

1. Go to **Resend → Broadcasts → Create broadcast** (a.k.a. "New broadcast").
2. **Audience** — pick your tutors audience (the one `npm run sync:audience` fills).
3. **From** — choose an address on your verified domain, e.g. `matchtutor <noreply@matchtutor.com.au>`.
4. **Subject** — e.g. `matchtutor has a fresh new look — plus more ways to stand out`.
5. **Body** — switch the editor to **HTML / "Code"**, then **paste the entire contents of** the
   email file you're sending (e.g. `0001_verification-education-and-policies-update.html`). (If you prefer the
   visual editor, you can rebuild it there, but the HTML file already matches the site theme.)
6. **Personalisation (merge tags)** — the email uses:
   - `{{{FIRST_NAME}}}` — the contact's first name (set from each tutor's name during sync).
   - `{{{RESEND_UNSUBSCRIBE_URL}}}` — Resend fills this per-recipient for the unsubscribe link.

   Leave these exactly as written; Resend substitutes them at send time.
7. **Send a test** to yourself first (Resend → "Send test email"). Check the logo, all three feature
   cards, the button, and the unsubscribe link render correctly.
8. **Send** (or **Schedule** for later). Done.

---

## Notes

- **Unsubscribes are automatic.** Resend appends/handles unsubscribe via `{{{RESEND_UNSUBSCRIBE_URL}}}`,
  and anyone who opts out is marked unsubscribed in the audience. The sync script **never**
  re-subscribes them, so re-running `npm run sync:audience` before the next campaign is safe.
- **Re-sync before every campaign** so new tutors are included and the list stays current.
- **Editing the email** — keep styles **inline** (email clients strip `<style>` blocks and external
  CSS). Match the brand (teal-on-white palette, mirroring `app/globals.css`): the wordmark is live
  text, `Match` in `#014848` + `Tutor` in `#016764` (never an image, so it survives images-off);
  headings `#014848`; body text `#33514F`; muted text `#6B8A88`; accent / buttons `#016764`; card
  surface `#FFFFFF` and feature cards `#F7FBFB` (border `#E7EDEC`) on a white page.
  `lib/email/send.js` holds the same palette as named constants, so copy values from there.
- **No bold, no web font.** The brand has no bold weight: headings and labels are `500`, body `400`.
  Emails can't load General Sans, so use the system sans stack and skip the site's light `300`
  (no light weight exists there). Caveat is reserved for four in-app accents, so no cursive headings.
- **No em dashes in copy** (repo-wide rule, see `CLAUDE.md`): use a comma, parentheses, or a period.
- **New campaigns** — drop another numbered `.html` file in this folder (next number, same
  structure and theme), then repeat the steps above.
