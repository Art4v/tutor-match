# Sending update emails to all tutors

This folder holds ready-to-send email content for matchtutor product updates. Emails go out
through **Resend Broadcasts** against a synced audience of your tutors. There is no "send" code in
the app — you compose and send from the Resend dashboard.

| File | What it is |
| --- | --- |
| `0001_verification-and-education-update.html` | The launch email for **Verification** + **High school / University** education. Paste into a Resend Broadcast. |
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
4. **Subject** — e.g. `Two new ways to stand out on matchtutor`.
5. **Body** — switch the editor to **HTML / "Code"**, then **paste the entire contents of** the
   email file you're sending (e.g. `0001_verification-and-education-update.html`). (If you prefer the
   visual editor, you can rebuild it there, but the HTML file already matches the site theme.)
6. **Personalisation (merge tags)** — the email uses:
   - `{{{FIRST_NAME}}}` — the contact's first name (set from each tutor's name during sync).
   - `{{{RESEND_UNSUBSCRIBE_URL}}}` — Resend fills this per-recipient for the unsubscribe link.

   Leave these exactly as written; Resend substitutes them at send time.
7. **Send a test** to yourself first (Resend → "Send test email"). Check the logo, both feature
   cards, the button, and the unsubscribe link render correctly.
8. **Send** (or **Schedule** for later). Done.

---

## Notes

- **Unsubscribes are automatic.** Resend appends/handles unsubscribe via `{{{RESEND_UNSUBSCRIBE_URL}}}`,
  and anyone who opts out is marked unsubscribed in the audience. The sync script **never**
  re-subscribes them, so re-running `npm run sync:audience` before the next campaign is safe.
- **Re-sync before every campaign** so new tutors are included and the list stays current.
- **Editing the email** — keep styles **inline** (email clients strip `<style>` blocks and external
  CSS). Match the brand: logo is `match` + `tutor` in indigo `#4F46E5`; body text `#334155`; muted
  text `#64748B` / `#94A3B8`; accent / buttons `#4F46E5`; surfaces `#FFFFFF` on a `#F8FAFC` page.
- **New campaigns** — drop another numbered `.html` file in this folder (next number, same
  structure and theme), then repeat the steps above.
