# Budget Alignment Tool — Admin + Per-Org Links Setup

Last updated: 23 April 2026. Target deployment: 12 May 2026.

This guide is in plain English. Three things need to happen in the Cloudflare
dashboard before the admin page and per-org links work. Nothing else is required
on your end.

---

## What's new

- **`index.html`** now recognises a URL like `.../?c=ABC123…` and pre-loads that
  org's submission asks. The org still uploads the budget PDFs themselves in
  Step 2 — only the submission side is preloaded.
- **`admin.html`** is a password-gated page where you:
  - Create/rename/delete orgs (e.g. "Mission Australia", "ACOSS")
  - Create rehearsal and live preset links per org
  - Upload a submission PDF, review the extracted asks in a table, edit
    category / ask text, reorder rows, delete rows
  - Copy per-org viewer links
  - See open-analytics (how many times each link was opened, and when)
- **Cloudflare Worker** is extended to store presets in KV and gate admin
  endpoints with the password `BudgetNight2026!`.

---

## One-time Cloudflare setup (you do this once)

You need three things in the Cloudflare dashboard: a KV namespace, two new
secrets, and a Worker deploy.

### 1. Create a KV namespace

1. Log into Cloudflare → Workers & Pages → KV.
2. Click **Create namespace**. Name it `POLICYPATCH` (exact spelling, all caps).
3. Copy the namespace ID it shows you — you'll need it in the next step.

### 2. Bind the KV namespace to the Worker

1. Go to Workers & Pages → `sqt-gemini-proxy` (your existing worker).
2. Settings → Variables → **KV Namespace Bindings** → Add binding.
3. Variable name: `POLICYPATCH` · KV namespace: the one you just created.
4. Save and deploy.

### 3. Add two new secrets

Same worker → Settings → Variables → **Environment Variables / Secrets** →
Add secret (choose "Encrypt"):

| Secret name              | Value                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| `ADMIN_PASSWORD_HASH`    | `bfb1cb1d67d1a769813c8bc1df1cee5b2de856965d162fa28d367c3a67c42dec`    |
| `ADMIN_PASSWORD_SALT`    | `T7dbyd1-Rbbrw3yMFtA4FvBINjq1vopp`                                    |

These together encode the password `BudgetNight2026!`. Leave the existing
`GEMINI_API_KEY` secret alone — it still powers the extractor.

### 4. Deploy the updated `worker.js`

The new code is at `/home/user/workspace/cloudflare-worker/worker.js`. You can
either paste it into the Cloudflare dashboard editor for `sqt-gemini-proxy`
and click Save & Deploy, or run `wrangler deploy` if you have wrangler set up.

That's it for Cloudflare. Nothing breaks for the existing tool if you haven't
done this yet — the tool still works without any preloaded link. Only the
admin page and preset links need this setup.

---

## URLs

- **Viewer (live, for orgs):** https://pghook93.github.io/budget-tool/
- **Admin:** https://pghook93.github.io/budget-tool/admin.html
- **GitHub repo:** https://github.com/pghook93/budget-tool
- **Worker:** https://sqt-gemini-proxy.penny-e27.workers.dev/

Both pages auto-update from GitHub within 1–2 minutes of a push.

---

## How the workflow looks in practice

1. **Now (rehearsal):**
   - Open the admin page. Log in with `BudgetNight2026!`.
   - Create an org, e.g. "Mission Australia".
   - Under that org, create a **Rehearsal** preset. Upload their 2025-26
     submission PDF. The admin page extracts and lists the asks. Edit any
     messy category/ask text inline. Reorder or delete rows as needed. Save.
   - Copy the viewer link (ends in `?c=<16-char-slug>`) and send it to that org.
   - They open the link → they see their submission's asks already preloaded,
     with a yellow "Rehearsal" banner at the top.
   - They upload the 2025-26 Federal Budget papers (BP2 etc) in Step 2 and
     click Evaluate in Step 3.

2. **Budget night (12 May 2026):**
   - Back in the admin page, under the same org, create a **Live** preset with
     their 2026-27 submission. (Separate from the rehearsal preset — editing
     one does not touch the other.)
   - Send them the new live link.
   - They upload the 2026-27 Federal Budget papers on the night and evaluate.

3. **Analytics:** the Opens tab on the admin page shows, per preset:
   open count, first-opened timestamp, and last-opened timestamp.

---

## Test plan (15 minutes before you send to any client)

1. Go to admin, log in with `BudgetNight2026!`. Confirm login works.
2. Create a test org called "Test Org".
3. Under Test Org, create a Rehearsal preset. Upload any submission PDF you
   have lying around. Wait for extraction to finish (60–120s).
4. Review the extracted rows in the admin editor. Try: editing one ask, editing
   one category, deleting a row, dragging a row to a new position. Save.
5. Click the "Copy link" button and open that link in a new window. Verify:
   - Yellow "Rehearsal" banner appears at the top.
   - Upload-status line shows "Loaded N preloaded asks…".
   - The ask table is populated with your edited rows in your reordered order.
   - Step 1 (submission upload) is still available — uploading a new submission
     overrides the preloaded rows. This is the expected behaviour.
6. Back in admin → Analytics tab, confirm the open count for that preset is ≥ 1.
7. Delete "Test Org" from admin to clean up.

If all six steps pass, you're safe to send real org links.

---

## Safety notes

- Password is stored only as a hash + salt in Cloudflare secrets. The admin
  page never sees the plaintext password except at login.
- Session tokens are stored in the browser's `localStorage` for 24 hours. Close
  the tab → you stay logged in. Private/Incognito → you log out when the
  window closes.
- Rehearsal and Live presets for the same org are fully independent — editing
  one doesn't touch the other. You can keep last year's rehearsal and this
  year's live side-by-side forever.
- If a preset link is mistyped or deleted, the viewer shows a clear "This
  preloaded link was not found" banner and falls back to the regular
  upload-your-own-submission flow. The client never sees a broken page.
